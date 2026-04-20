const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `
Você é o Visit Route Planner do DocIntel — um agente de logística comercial e calculadora de viagem para um time que vende câmaras frigoríficas saindo de São Paulo (capital) por padrão.

ENTREGÁVEL OBRIGATÓRIO (Markdown bem formatado):

## 1. Resumo executivo
3-4 linhas: total de clientes elegíveis, nº de blocos sugeridos, dias estimados, custo total estimado da viagem.

## 2. Premissas usadas
Tabela com: origem, veículo, consumo (km/l), preço combustível (R$/l), pedágio médio (R$/100km), diária hotel, refeições/dia, visitas por dia, máximo de visitas no período, dias disponíveis.

## 3. Agrupamento por proximidade (clusters)
Agrupe os clientes em CLUSTERS geográficos (cidades vizinhas no mesmo estado, ou estados limítrofes). Para cada cluster:
- Cidades e estado
- Nº de clientes no cluster
- Distância estimada saindo de São Paulo (ida) em km — use seu conhecimento geográfico do Brasil
- Tempo de viagem estimado (h)

## 4. Roteiro otimizado de visitas
Respeitando o LIMITE de visitas/dia e o MÁXIMO TOTAL informado pelo usuário, monte blocos:

### Bloco N — <Cluster> (X dias)
Para cada DIA do bloco:
- **Dia X (data sugerida relativa, ex: D+1)** — cidade base
  - Visita 1 (manhã): cliente, endereço, contato (telefone/whatsapp/email), prioridade, argumento comercial
  - Visita 2 (tarde): idem
- Deslocamentos internos do dia (km e tempo)

Selecione os clientes priorizando: (a) maior concentração regional (menos km rodados), (b) presença de proposta recente, (c) cadastro completo (com telefone). Se o usuário pediu N visitas e há mais clientes elegíveis, escolha os MELHORES N e cite os demais como "backlog para próxima viagem".

## 5. Custo estimado da viagem (calculadora)
Tabela detalhada por bloco e total geral:

| Item | Cálculo | Valor (R$) |
|---|---|---|
| Combustível | km_total ÷ consumo × preço/litro | R$ X |
| Pedágio | km_total ÷ 100 × pedágio_médio | R$ X |
| Hotel | noites × diária | R$ X |
| Refeições | dias × refeições/dia | R$ X |
| **TOTAL** | | **R$ X** |

Mostre a CONTA explicitamente (ex: "1.200 km ÷ 12 km/l × R$ 6,00 = R$ 600"). Sempre arredonde para 2 casas e use formato brasileiro.

## 6. Custo médio por visita
Total ÷ nº de visitas realizadas = R$ X/visita. Comente se está alto/baixo vs benchmark típico de visita técnica-comercial (R$ 300-800).

## 7. Recomendações finais
- Cadastros incompletos a corrigir antes de viajar
- Combinações com clientes de outros padrões na mesma rota
- Sugestão de melhor mês/semana se houver sazonalidade

Tom: técnico-comercial, MUITO objetivo, números explícitos, zero enrolação. Use bullets e tabelas. Nunca invente telefones/e-mails — use só o que veio nos dados.
`.trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { padrao, clients, technicalContext, premissas } = await req.json();

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

    const p = premissas || {};
    const premissasBlock = `
PREMISSAS DE VIAGEM (USE EXATAMENTE ESTES VALORES NOS CÁLCULOS):
- Origem: ${p.origem || "São Paulo - SP"}
- Veículo: ${p.veiculo || "Carro sedan"}
- Consumo: ${p.consumoKmL ?? 12} km/l
- Preço combustível: R$ ${p.precoCombustivel ?? 6.0} / litro
- Pedágio médio: R$ ${p.pedagioPor100km ?? 25} a cada 100 km
- Diária hotel: R$ ${p.diariaHotel ?? 280}
- Refeições/dia: R$ ${p.refeicoesDia ?? 120}
- Visitas por dia: ${p.visitasPorDia ?? 2}
- Máximo de visitas no período: ${p.maxVisitas ?? "todas"}
- Dias disponíveis: ${p.diasDisponiveis ?? "calcule a partir de visitas/dia"}
- Janela: ${p.janela || "próximas 4 semanas"}
`.trim();

    const userPrompt = [
      `Recorte: ${padrao || "não informado"}`,
      technicalContext ? `Contexto:\n${JSON.stringify(technicalContext, null, 2)}` : "",
      "",
      premissasBlock,
      "",
      `Clientes elegíveis (${clients.length}):`,
      JSON.stringify(clients, null, 2),
      "",
      "Gere o roteiro completo com calculadora de custo seguindo OBRIGATORIAMENTE o formato do system prompt.",
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
          model: "google/gemini-2.5-pro",
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
