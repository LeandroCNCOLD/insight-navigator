const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SYSTEM_PROMPT = `
Você é o Recommendation Engine do DocIntel.

Sua função é responder em português com base na base estruturada de propostas, equipamentos, clientes e concorrentes.

Objetivos:
1. sugerir configuração técnica provável;
2. sugerir faixa de preço plausível;
3. apontar concorrentes e padrões comparáveis;
4. indicar riscos de preço, prazo, configuração ou posicionamento;
5. sugerir se o caso parece padrão, repetitivo ou altamente customizado.

Regras:
- não invente dados;
- use somente o contexto fornecido;
- quantifique sempre que possível;
- quando houver baixa base comparável, diga isso claramente;
- diferencie observação, recomendação e risco;
- use linguagem técnica, comercial e objetiva.

Formato preferido:
1. resposta direta
2. base comparável observada
3. recomendação técnica/comercial
4. riscos
5. próximos passos
`;

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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [
      { data: proposals },
      { data: clients },
      { data: competitors },
      { data: equipments },
    ] = await Promise.all([
      supabase
        .from("proposals")
        .select(`
          id,
          numero,
          valor_total,
          prazo_entrega_dias,
          garantia_meses,
          frete_tipo,
          status_proposta,
          score_confianca,
          dados_tecnicos,
          competitor_id,
          client_id
        `)
        .limit(1500),

      supabase
        .from("clients")
        .select("id,nome,estado,cidade,segmento")
        .limit(2000),

      supabase
        .from("competitors")
        .select("id,nome")
        .limit(500),

      supabase
        .from("equipments")
        .select(`
          proposal_id,
          tipo,
          modelo,
          quantidade,
          potencia_hp,
          capacidade_kcal,
          compressor,
          gas_refrigerante
        `)
        .limit(5000),
    ]);

    const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c]));
    const competitorMap = Object.fromEntries((competitors || []).map((c) => [c.id, c]));
    const equipmentsByProposal = new Map<string, any[]>();

    for (const eq of equipments || []) {
      const proposalId = eq.proposal_id;
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

    const context = JSON.stringify({
      total_proposals: enriched.length,
      proposals: enriched.slice(0, 700),
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
          { role: "system", content: `Base comparável:\n${context}` },
          ...messages,
        ],
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI error", details: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
