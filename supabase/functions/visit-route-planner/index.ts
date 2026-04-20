const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `
Você é o Visit Route Planner do DocIntel — um agente de logística comercial para um time que vende câmaras frigoríficas e equipamentos industriais de refrigeração.

Sua tarefa: receber um conjunto de clientes que compartilham o MESMO padrão técnico de câmara (mesma assinatura: temperatura, volume, isolamento, produto) e propor um ROTEIRO DE VISITAS comercial e logisticamente otimizado.

Diretrizes:
1. Agrupar por estado e cidade. Sugerir uma ordem de visita que minimize deslocamento (proximidade geográfica entre cidades do mesmo estado, e estados vizinhos depois).
2. Para cada cliente, indicar:
   - prioridade (alta / média / baixa) com justificativa baseada no porte da operação, recência de proposta e potencial de fechamento;
   - argumento de abordagem específico (ex: "já cotou padrão idêntico, oportunidade de up-sell", "região com 3 clientes similares — visita combinada");
   - ponto de contato sugerido a partir dos dados cadastrais (nome do contato, cargo, telefone/WhatsApp/e-mail).
3. Propor blocos de viagem: "Bloco 1 — SP capital + interior (2 dias)", "Bloco 2 — PR (1 dia)" etc., com estimativa de duração.
4. Ao final, listar oportunidades cruzadas: clientes que poderiam ser visitados na mesma viagem mesmo não sendo do padrão principal.
5. Não invente dados. Se faltar telefone/e-mail/cidade, diga "cadastro incompleto — atualizar antes da visita".

Formato de saída em Markdown:
- Resumo executivo do roteiro (3-4 linhas)
- Blocos de viagem numerados
- Para cada bloco: estado, cidades, lista de clientes (nome, cidade, prioridade, contato, argumento)
- Ações de pré-visita recomendadas
- Avisos sobre cadastros incompletos

Tom: técnico-comercial, objetivo, acionável. Use bullets curtos. Evite enrolação.
`.trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { padrao, clients, technicalContext } = await req.json();

    if (!Array.isArray(clients) || clients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum cliente informado para roteirizar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = [
      `Padrão técnico de câmara: ${padrao || "não informado"}`,
      technicalContext ? `Contexto técnico:\n${JSON.stringify(technicalContext, null, 2)}` : "",
      "",
      `Clientes elegíveis para roteiro (${clients.length}):`,
      JSON.stringify(clients, null, 2),
      "",
      "Gere o roteiro de visitas seguindo as diretrizes do system prompt.",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      },
    );

    if (response.status === 429) {
      return new Response(
        JSON.stringify({
          error: "Muitas requisições. Aguarde alguns segundos e tente novamente.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({
          error:
            "Créditos esgotados. Adicione créditos em Settings > Workspace > Usage.",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("ai gateway error", response.status, t);
      return new Response(
        JSON.stringify({ error: "Falha ao gerar roteiro de visitas." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const content =
      data?.choices?.[0]?.message?.content || "Sem retorno do modelo.";

    return new Response(JSON.stringify({ roteiro: content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("visit-route-planner error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
