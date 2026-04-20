// supabase/functions/head-to-head-ai/index.ts
// Cross CN Cold (house) proposals against competitor proposals by client CNPJ
// (with normalized-name fallback) and return consolidated AI analysis per client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um analista sênior de inteligência comercial da CN Cold (fabricante de equipamentos de refrigeração industrial).

Sua tarefa: dado um conjunto de confrontos onde a CN Cold disputou o mesmo cliente contra um ou mais concorrentes (matched por CNPJ ou nome do cliente), produzir uma análise objetiva, executiva, em português.

Para cada cliente em confronto, gere:
1. Cliente + UF + CNPJ (se houver)
2. Quem participou (CN Cold + concorrentes)
3. Comparativo curto: valor, prazo de entrega, garantia, condição de pagamento
4. Provável motivo da decisão (preço, técnica, prazo, relacionamento, garantia)
5. Sugestão acionável para a CN Cold no próximo confronto com este cliente/concorrente

Regras:
- Não invente dados: se faltar valor, diga "sem dado".
- Quantifique sempre que possível (Δ% de preço, Δ dias, Δ meses).
- Seja direto e prático. Use bullets curtos.
- Quando o status indicar perda da CN Cold, foque na causa provável.
- Quando indicar ganho, registre o que funcionou para replicar.
- Ao final, gere uma seção "Padrões gerais observados" com 3 a 6 bullets.`;

function norm(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function digitsOnly(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : {},
    );

    const [{ data: clients }, { data: competitors }, { data: proposals }] = await Promise.all([
      supabase.from("clients").select("id,nome,cnpj,estado,cidade,segmento").limit(5000),
      supabase.from("competitors").select("id,nome,is_house").limit(500),
      supabase.from("proposals").select(
        "id,client_id,competitor_id,valor_total,status_proposta,prazo_entrega_dias,garantia_meses,condicao_pagamento,numero,data_proposta",
      ).limit(3000),
    ]);

    const clientById = new Map<string, any>();
    (clients || []).forEach((c: any) => clientById.set(c.id, c));
    const compById = new Map<string, any>();
    (competitors || []).forEach((c: any) => compById.set(c.id, c));

    // Group clients by normalized CNPJ (preferred) or normalized name
    const groups = new Map<string, { key: string; cnpj: string; name: string; clientIds: string[]; uf: string }>();
    for (const c of clients || []) {
      const cnpj = digitsOnly(c.cnpj);
      const key = cnpj.length >= 8 ? `cnpj:${cnpj}` : `name:${norm(c.nome)}`;
      if (!key || key === "name:" || key === "cnpj:") continue;
      if (!groups.has(key)) groups.set(key, { key, cnpj, name: c.nome || "—", clientIds: [], uf: c.estado || "—" });
      groups.get(key)!.clientIds.push(c.id);
    }

    // Build confront sets
    type Conf = {
      key: string;
      cliente: string;
      cnpj: string;
      uf: string;
      house: any[];
      rivals: any[];
    };
    const confronts: Conf[] = [];
    for (const g of groups.values()) {
      const propsForGroup = (proposals || []).filter((p: any) => g.clientIds.includes(p.client_id));
      if (!propsForGroup.length) continue;
      const house: any[] = [];
      const rivals: any[] = [];
      for (const p of propsForGroup) {
        const comp = p.competitor_id ? compById.get(p.competitor_id) : null;
        const enriched = {
          id: p.id,
          fornecedor: comp?.nome || "—",
          valor_total: p.valor_total,
          status: p.status_proposta,
          prazo_entrega_dias: p.prazo_entrega_dias,
          garantia_meses: p.garantia_meses,
          pagamento: p.condicao_pagamento,
          numero: p.numero,
          data: p.data_proposta,
        };
        if (comp?.is_house) house.push(enriched);
        else rivals.push(enriched);
      }
      if (house.length && rivals.length) {
        confronts.push({ key: g.key, cliente: g.name, cnpj: g.cnpj, uf: g.uf, house, rivals });
      }
    }

    if (!confronts.length) {
      return new Response(
        JSON.stringify({
          analysis: "Nenhum confronto encontrado. Para gerar análise IA, é necessário ter ao menos uma proposta da CN Cold e uma de concorrente para o mesmo cliente (match por CNPJ ou nome).",
          confronts_count: 0,
          confronts: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Limit payload size
    const payload = confronts.slice(0, 40);
    const userPrompt = `Aqui estão ${confronts.length} confronto(s) CN Cold × concorrentes (matched por CNPJ ou nome do cliente). Gere a análise no formato pedido. Dados:\n\n${JSON.stringify(payload, null, 2)}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos em Lovable Cloud." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI error", details: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await aiResp.json();
    const analysis = json?.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({
        analysis,
        confronts_count: confronts.length,
        confronts: confronts.map((c) => ({
          cliente: c.cliente,
          cnpj: c.cnpj,
          uf: c.uf,
          house_count: c.house.length,
          rivals_count: c.rivals.length,
          rivals: Array.from(new Set(c.rivals.map((r: any) => r.fornecedor))),
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
