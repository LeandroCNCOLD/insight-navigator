// Streaming chat over the user's proposal database
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SYSTEM_PROMPT = `Você é um analista de inteligência competitiva. Responde perguntas em português baseando-se no contexto JSON de propostas/equipamentos/clientes/concorrentes que será fornecido.

Regras:
- Seja direto, executivo e use números concretos.
- Quando relevante, cite o concorrente, cliente, estado e o valor.
- Se a base de dados não tiver a resposta, diga claramente que não há dados suficientes.
- Use markdown leve: **negrito**, listas, tabelas.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { messages } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Build a compact analytical context
    const [{ data: proposals }, { data: equipments }, { data: clients }, { data: competitors }] = await Promise.all([
      supabase.from("proposals").select("numero,data_proposta,valor_total,condicao_pagamento,parcelas,prazo_entrega_dias,garantia_meses,frete_tipo,status_proposta,dados_tecnicos,competitor_id,client_id").limit(500),
      supabase.from("equipments").select("tipo,modelo,marca,quantidade,potencia_hp,capacidade_kcal,compressor,gas_refrigerante,proposal_id").limit(2000),
      supabase.from("clients").select("id,nome,cidade,estado,segmento"),
      supabase.from("competitors").select("id,nome"),
    ]);

    const context = JSON.stringify({
      total_propostas: proposals?.length || 0,
      total_equipamentos: equipments?.length || 0,
      propostas: proposals?.slice(0, 200) || [],
      equipamentos: equipments?.slice(0, 500) || [],
      clientes: clients || [],
      concorrentes: competitors || [],
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: `Base de dados (JSON):\n${context}` },
          ...messages,
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return new Response(JSON.stringify({ error: "Limite excedido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await res.text();
      return new Response(JSON.stringify({ error: "AI error", details: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(res.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
