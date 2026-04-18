import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `
Você é o Product & Market Engine do DocIntel.

Sua função é analisar uma base de propostas estruturadas e responder em português sobre:
- padrões de produto
- recorrência técnica
- oportunidades regionais
- linhas padronizáveis
- comportamento de concorrentes
- faixas de preço
- combinações técnicas recorrentes
- oportunidades de mercado e portfólio

Objetivos:
1. identificar padrões reais da base;
2. sugerir oportunidades de produto;
3. sugerir oportunidades regionais;
4. apontar recorrências de HP, kcal/h, quantidade de equipamentos, gases e compressores;
5. indicar quando algo pode virar linha padrão;
6. indicar quando a base ainda não é suficiente.

Regras:
- não invente dados;
- basear-se somente na base enviada;
- quantificar sempre que possível;
- quando sugerir produto, explicar por quê;
- separar claramente observação, padrão e sugestão;
- quando houver pouca densidade, dizer isso;
- usar tom técnico, executivo e comercial.

Formato preferido:
1. resposta direta
2. padrões observados
3. oportunidades de produto
4. oportunidades regionais
5. riscos e ressalvas
`;

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function hpTotal(items: any[] = []) {
  return (items || []).reduce(
    (acc, item) => acc + ((item.potencia_hp || 0) * (item.quantidade || 1)),
    0,
  );
}

function kcalTotal(items: any[] = []) {
  return (items || []).reduce(
    (acc, item) => acc + ((item.capacidade_kcal || 0) * (item.quantidade || 1)),
    0,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const { messages } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : {},
    );

    const [
      { data: proposals },
      { data: clients },
      { data: competitors },
      { data: equipments },
    ] = await Promise.all([
      supabase.from("proposals").select(`
        id, numero, valor_total, data_proposta, prazo_entrega_dias,
        garantia_meses, frete_tipo, status_proposta, score_confianca,
        dados_tecnicos, competitor_id, client_id
      `).limit(1200),
      supabase.from("clients").select("id,nome,estado,cidade,segmento").limit(2000),
      supabase.from("competitors").select("id,nome").limit(500),
      supabase.from("equipments").select(`
        proposal_id, tipo, modelo, quantidade, potencia_hp,
        capacidade_kcal, compressor, gas_refrigerante
      `).limit(5000),
    ]);

    const clientMap = Object.fromEntries((clients || []).map((c: any) => [c.id, c]));
    const competitorMap = Object.fromEntries((competitors || []).map((c: any) => [c.id, c]));
    const equipmentsByProposal = new Map<string, any[]>();

    for (const eq of equipments || []) {
      const proposalId = (eq as any).proposal_id;
      if (!proposalId) continue;
      if (!equipmentsByProposal.has(proposalId)) {
        equipmentsByProposal.set(proposalId, []);
      }
      equipmentsByProposal.get(proposalId)!.push(eq);
    }

    const enriched = (proposals || []).map((proposal: any) => ({
      ...proposal,
      client: proposal.client_id ? clientMap[proposal.client_id] ?? null : null,
      competitor: proposal.competitor_id ? competitorMap[proposal.competitor_id] ?? null : null,
      equipments: equipmentsByProposal.get(proposal.id) ?? [],
      total_hp: hpTotal(equipmentsByProposal.get(proposal.id) ?? []),
      total_kcal: kcalTotal(equipmentsByProposal.get(proposal.id) ?? []),
    }));

    const summary = {
      total_proposals: enriched.length,
      total_value: enriched.reduce((acc: number, p: any) => acc + (p.valor_total || 0), 0),
      avg_ticket: enriched.length
        ? enriched.reduce((acc: number, p: any) => acc + (p.valor_total || 0), 0) / enriched.length
        : 0,
      top_states: Object.entries(
        enriched.reduce((acc: Record<string, number>, p: any) => {
          const state = p.client?.estado || "—";
          acc[state] = (acc[state] || 0) + 1;
          return acc;
        }, {})
      ).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10),
      top_competitors: Object.entries(
        enriched.reduce((acc: Record<string, number>, p: any) => {
          const comp = p.competitor?.nome || "—";
          acc[comp] = (acc[comp] || 0) + 1;
          return acc;
        }, {})
      ).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10),
    };

    const context = JSON.stringify({
      summary: {
        ...summary,
        total_value_brl: brl(summary.total_value),
        avg_ticket_brl: brl(summary.avg_ticket),
      },
      proposals: enriched.slice(0, 600),
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: `Resumo do mercado:\n${JSON.stringify(summary, null, 2)}` },
          { role: "system", content: `Base consolidada:\n${context}` },
          ...messages,
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI error", details: text }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
