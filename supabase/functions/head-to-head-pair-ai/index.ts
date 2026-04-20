// supabase/functions/head-to-head-pair-ai/index.ts
// Generates a deep AI comparative report between a CN Cold proposal and a competitor proposal.
// Returns structured JSON (charts data + insights + win/loss reasoning) plus a markdown narrative.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um analista sênior de inteligência comercial da CN Cold (também escrita Syncode/SN Code), fabricante de equipamentos de refrigeração industrial.

Sua tarefa: comparar UMA proposta da CN Cold contra UMA proposta de concorrente para o mesmo cliente (ou cliente equivalente) e produzir um relatório executivo COMPLETO em português.

Formato do relatório (markdown):
## 1. Resumo executivo
Parágrafo curto (3-4 linhas) com o veredito: a CN Cold ganhou, perdeu, está em disputa? Por quê?

## 2. Comparativo numérico
- Preço: valor CN Cold vs concorrente, Δ absoluto e Δ% (quem está mais caro/barato).
- Prazo de entrega: Δ dias.
- Garantia: Δ meses.
- Pagamento: comparar condições.

## 3. Diferenciais técnicos
Liste o que cada lado oferece de diferente (gás refrigerante, compressor, capacidade, escopo).

## 4. Por que a CN Cold ganhou OU perdeu
Seja específico. Use os dados. Se for perda, aponte a causa provável (preço, prazo, técnica, garantia, relacionamento, escopo). Se for ganho, registre o que funcionou para replicar.

## 5. Recomendações para o próximo confronto
3 a 5 ações práticas que a CN Cold deve fazer no próximo embate com este concorrente / cliente.

Regras:
- Não invente dados. Se faltar informação, diga "sem dado".
- Quantifique sempre que possível (Δ%, Δ dias, Δ meses, R$).
- Seja direto, executivo, sem rodeios.
- Use bullets curtos.`;

function pct(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b === 0) return null;
  return ((a - b) / b) * 100;
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

    const body = await req.json().catch(() => ({}));
    const { house_proposal_id, rival_proposal_id, resultado } = body || {};
    if (!house_proposal_id || !rival_proposal_id) {
      return new Response(
        JSON.stringify({ error: "house_proposal_id e rival_proposal_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: props, error: propsErr } = await supabase
      .from("proposals")
      .select(`id, valor_total, status_proposta, prazo_entrega_dias, garantia_meses, condicao_pagamento, numero, data_proposta, dados_tecnicos, resumo_executivo, resumo_tecnico, resumo_comercial,
               client:clients(nome,estado,cnpj,segmento),
               competitor:competitors!competitor_id(nome,is_house)`)
      .in("id", [house_proposal_id, rival_proposal_id]);
    if (propsErr) throw propsErr;

    const house = (props || []).find((p: any) => p.id === house_proposal_id);
    const rival = (props || []).find((p: any) => p.id === rival_proposal_id);
    if (!house || !rival) {
      return new Response(JSON.stringify({ error: "Propostas não encontradas" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Equipments
    const { data: equips } = await supabase
      .from("equipments")
      .select("proposal_id, tipo, modelo, marca, quantidade, potencia_hp, capacidade_kcal, gas_refrigerante, valor_unitario")
      .in("proposal_id", [house_proposal_id, rival_proposal_id]);
    const houseEquips = (equips || []).filter((e: any) => e.proposal_id === house_proposal_id);
    const rivalEquips = (equips || []).filter((e: any) => e.proposal_id === rival_proposal_id);

    // Structured comparison (drives charts)
    const comparison = {
      preco: {
        cncold: house.valor_total,
        concorrente: rival.valor_total,
        delta_abs: house.valor_total != null && rival.valor_total != null ? house.valor_total - rival.valor_total : null,
        delta_pct: pct(house.valor_total, rival.valor_total),
      },
      prazo_dias: {
        cncold: house.prazo_entrega_dias,
        concorrente: rival.prazo_entrega_dias,
        delta: house.prazo_entrega_dias != null && rival.prazo_entrega_dias != null ? house.prazo_entrega_dias - rival.prazo_entrega_dias : null,
      },
      garantia_meses: {
        cncold: house.garantia_meses,
        concorrente: rival.garantia_meses,
        delta: house.garantia_meses != null && rival.garantia_meses != null ? house.garantia_meses - rival.garantia_meses : null,
      },
      pagamento: {
        cncold: house.condicao_pagamento,
        concorrente: rival.condicao_pagamento,
      },
      capacidade_kcal_total: {
        cncold: houseEquips.reduce((s: number, e: any) => s + (Number(e.capacidade_kcal) || 0) * (Number(e.quantidade) || 1), 0),
        concorrente: rivalEquips.reduce((s: number, e: any) => s + (Number(e.capacidade_kcal) || 0) * (Number(e.quantidade) || 1), 0),
      },
      potencia_hp_total: {
        cncold: houseEquips.reduce((s: number, e: any) => s + (Number(e.potencia_hp) || 0) * (Number(e.quantidade) || 1), 0),
        concorrente: rivalEquips.reduce((s: number, e: any) => s + (Number(e.potencia_hp) || 0) * (Number(e.quantidade) || 1), 0),
      },
    };

    const ctx = {
      cliente_casa: house.client?.nome,
      cliente_rival: rival.client?.nome,
      uf_casa: house.client?.estado,
      uf_rival: rival.client?.estado,
      resultado_informado: resultado || "não informado",
      casa: {
        fornecedor: house.competitor?.nome,
        numero: house.numero,
        data: house.data_proposta,
        valor: house.valor_total,
        prazo_entrega_dias: house.prazo_entrega_dias,
        garantia_meses: house.garantia_meses,
        pagamento: house.condicao_pagamento,
        status: house.status_proposta,
        resumo_tecnico: house.resumo_tecnico,
        resumo_comercial: house.resumo_comercial,
        equipamentos: houseEquips,
      },
      concorrente: {
        fornecedor: rival.competitor?.nome,
        numero: rival.numero,
        data: rival.data_proposta,
        valor: rival.valor_total,
        prazo_entrega_dias: rival.prazo_entrega_dias,
        garantia_meses: rival.garantia_meses,
        pagamento: rival.condicao_pagamento,
        status: rival.status_proposta,
        resumo_tecnico: rival.resumo_tecnico,
        resumo_comercial: rival.resumo_comercial,
        equipamentos: rivalEquips,
      },
      comparativo: comparison,
    };

    const userPrompt = `Analise este confronto e gere o relatório completo no formato pedido. Considere especialmente o resultado informado pelo usuário (${resultado || "não informado"}). Dados:\n\n${JSON.stringify(ctx, null, 2)}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
        comparison,
        meta: {
          house: { fornecedor: house.competitor?.nome, cliente: house.client?.nome, numero: house.numero },
          rival: { fornecedor: rival.competitor?.nome, cliente: rival.client?.nome, numero: rival.numero },
          resultado_informado: resultado || null,
        },
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
