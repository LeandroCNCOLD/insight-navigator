const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SYSTEM_PROMPT = `
Você é o Intelligence Brain do DocIntel.

Sua função é responder em português com base na base estruturada de:
- propostas
- equipamentos
- clientes
- concorrentes

Objetivos:
1. responder perguntas com clareza e objetividade;
2. identificar padrões técnicos, comerciais, regionais e contratuais;
3. comparar concorrentes, clientes, estados, equipamentos, gases, compressores e valores;
4. apontar tendências, concentrações, recorrências e possíveis anomalias;
5. ser técnico, executivo e analítico.

Regras:
- não invente dados;
- use somente o contexto fornecido;
- quando houver pouca base, diga claramente que não há dados suficientes;
- quantifique sempre que possível;
- cite concorrente, cliente, estado, número da proposta, equipamento, HP, kcal/h, gás, compressor, valor, prazo, garantia ou frete quando isso ajudar;
- organize a resposta com markdown leve;
- quando fizer comparação, deixe explícito o critério;
- quando identificar padrão recorrente, diga que é um padrão observado na base;
- quando não conseguir inferir com segurança, diga que é apenas indício e não conclusão definitiva.

Formato preferido da resposta:
1. resposta direta
2. principais achados
3. riscos ou ressalvas
4. próximos recortes úteis para análise
`;

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
      { data: equipments },
      { data: clients },
      { data: competitors },
    ] = await Promise.all([
      supabase
        .from("proposals")
        .select(`
          id,
          numero,
          data_proposta,
          valor_total,
          condicao_pagamento,
          parcelas,
          prazo_entrega_dias,
          garantia_meses,
          frete_tipo,
          vendedor,
          status_proposta,
          score_confianca,
          observacoes,
          riscos,
          dados_tecnicos,
          competitor_id,
          client_id
        `)
        .limit(1000),

      supabase
        .from("equipments")
        .select(`
          id,
          proposal_id,
          tipo,
          modelo,
          marca,
          quantidade,
          potencia_hp,
          capacidade_kcal,
          compressor,
          gas_refrigerante,
          observacoes
        `)
        .limit(4000),

      supabase
        .from("clients")
        .select("id,nome,cidade,estado,segmento")
        .limit(2000),

      supabase
        .from("competitors")
        .select("id,nome")
        .limit(500),
    ]);

    const proposalsSafe = proposals || [];
    const equipmentsSafe = equipments || [];
    const clientsSafe = clients || [];
    const competitorsSafe = competitors || [];

    const clientMap = Object.fromEntries(clientsSafe.map((c) => [c.id, c]));
    const competitorMap = Object.fromEntries(competitorsSafe.map((c) => [c.id, c]));
    const equipmentsByProposal = new Map<string, any[]>();

    for (const eq of equipmentsSafe) {
      const proposalId = eq.proposal_id;
      if (!proposalId) continue;
      if (!equipmentsByProposal.has(proposalId)) {
        equipmentsByProposal.set(proposalId, []);
      }
      equipmentsByProposal.get(proposalId)!.push(eq);
    }

    const enrichedProposals = proposalsSafe.map((proposal) => ({
      ...proposal,
      client: proposal.client_id ? clientMap[proposal.client_id] ?? null : null,
      competitor: proposal.competitor_id ? competitorMap[proposal.competitor_id] ?? null : null,
      equipments: equipmentsByProposal.get(proposal.id) ?? [],
    }));

    const summary = {
      total_propostas: proposalsSafe.length,
      total_equipamentos: equipmentsSafe.length,
      total_clientes: clientsSafe.length,
      total_concorrentes: competitorsSafe.length,
      propostas_com_valor: proposalsSafe.filter((p) => p.valor_total != null).length,
      propostas_com_dados_tecnicos: proposalsSafe.filter((p) => p.dados_tecnicos != null).length,
      propostas_com_garantia: proposalsSafe.filter((p) => p.garantia_meses != null).length,
      propostas_contratadas: proposalsSafe.filter((p) => p.status_proposta === "contratada").length,
    };

    const context = JSON.stringify({
      summary,
      proposals: enrichedProposals.slice(0, 500),
      clients: clientsSafe,
      competitors: competitorsSafe,
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
          { role: "system", content: `Resumo da base:\n${JSON.stringify(summary, null, 2)}` },
          { role: "system", content: `Base estruturada:\n${context}` },
          ...messages,
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Limite excedido" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const text = await res.text();
      return new Response(JSON.stringify({ error: "AI error", details: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(res.body, {
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
