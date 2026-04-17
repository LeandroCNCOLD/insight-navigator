// Edge function: receives raw text + metadata, calls Lovable AI, returns structured proposal data + evidences
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um especialista sênior em leitura de propostas técnicas, propostas comerciais, contratos e anexos de engenharia (refrigeração industrial, câmaras frias, armazenagem de sementes, agroindústria).

Sua tarefa é transformar o documento em dados estruturados confiáveis para análise de benchmarking competitivo.

REGRAS CRÍTICAS:
- Extraia APENAS informações com evidência documental clara. NUNCA invente.
- Quando não encontrar um dado, retorne null. Quando houver incerteza, sinalize baixa confiança (score < 0.5).
- Para CADA campo extraído, popule o array "evidencias" com: campo, valor_extraido, pagina (se identificável no texto), trecho (citação literal ~120 chars) e score_confianca (0-1).
- Normalize valores monetários para BRL (números, sem símbolo).
- Normalize unidades técnicas (HP, kcal/h, °C, %).
- Para equipamentos, liste cada item separado.
- Gere resumos analíticos de alto nível (executivo, técnico, comercial).
- Classifique porte do projeto (pequeno < R$ 200k, médio R$ 200k-1M, grande > R$ 1M) e indício de fechamento (baixo/médio/alto) baseado em sinais como assinatura, status, condições.

Retorne SOMENTE chamando a função extract_proposal.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "extract_proposal",
    description: "Extrai dados estruturados, resumos analíticos e evidências por campo de uma proposta/documento.",
    parameters: {
      type: "object",
      properties: {
        // Identificação
        numero: { type: ["string", "null"] },
        data_proposta: { type: ["string", "null"], description: "ISO YYYY-MM-DD" },
        tipo_documental: { type: ["string", "null"], description: "proposta_comercial, proposta_tecnica, contrato, anexo, memorial, planilha" },
        status_proposta: { type: ["string", "null"], description: "comercial, contratada, revisao, aditivo, rascunho" },

        // Cliente
        cliente_nome: { type: ["string", "null"] },
        cliente_razao_social: { type: ["string", "null"] },
        cliente_cidade: { type: ["string", "null"] },
        cliente_estado: { type: ["string", "null"], description: "UF 2 letras" },
        segmento: { type: ["string", "null"] },
        segmentacao_cliente: { type: ["string", "null"], description: "Inferência analítica do segmento (agronegócio, frigorífico, varejo, etc)" },

        // Comercial
        valor_total: { type: ["number", "null"] },
        condicao_pagamento: { type: ["string", "null"] },
        parcelas: { type: ["integer", "null"] },
        prazo_fabricacao_dias: { type: ["integer", "null"] },
        prazo_entrega_dias: { type: ["integer", "null"] },
        prazo_instalacao_dias: { type: ["integer", "null"] },
        garantia_meses: { type: ["integer", "null"] },
        garantia_limitacoes: { type: ["string", "null"] },
        exclusoes_garantia: { type: ["string", "null"] },
        frete_tipo: { type: ["string", "null"], description: "FOB, CIF ou similar" },
        frete_incluso: { type: ["boolean", "null"] },
        instalacao_inclusa: { type: ["boolean", "null"] },
        fornecimento_cliente: { type: ["string", "null"], description: "Itens a serem fornecidos pelo cliente" },

        // Pessoas
        vendedor: { type: ["string", "null"] },
        representante_legal: { type: ["string", "null"] },
        tem_assinatura: { type: ["boolean", "null"], description: "Há assinatura física, eletrônica ou DocuSign" },

        // Análise
        observacoes: { type: ["string", "null"] },
        riscos: { type: ["string", "null"] },
        score_confianca: { type: "number" },

        // Resumos analíticos
        resumo_executivo: { type: ["string", "null"], description: "2-4 linhas, visão de alto nível" },
        resumo_tecnico: { type: ["string", "null"], description: "Aspectos técnicos da solução" },
        resumo_comercial: { type: ["string", "null"], description: "Condições comerciais, valor, prazos" },
        insights_benchmarking: { type: ["string", "null"], description: "Pontos comparáveis com mercado" },
        palavras_chave: { type: "array", items: { type: "string" }, description: "5-15 palavras-chave do documento" },
        porte_projeto: { type: ["string", "null"], description: "pequeno, medio ou grande" },
        indicio_fechamento: { type: ["string", "null"], description: "baixo, medio ou alto" },

        // Técnico
        dados_tecnicos: {
          type: "object",
          properties: {
            tipo_camara: { type: ["string", "null"] },
            aplicacao: { type: ["string", "null"] },
            produto_armazenado: { type: ["string", "null"] },
            temperatura_alvo_c: { type: ["number", "null"] },
            umidade_alvo_pct: { type: ["number", "null"] },
            dimensoes: { type: ["string", "null"] },
            isolamento: { type: ["string", "null"] },
            carga_termica_kcal: { type: ["number", "null"] },
            supervisorio: { type: ["boolean", "null"] },
            monitoramento_remoto: { type: ["boolean", "null"] },
          },
        },

        // Equipamentos
        equipamentos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tipo: { type: ["string", "null"] },
              modelo: { type: ["string", "null"] },
              marca: { type: ["string", "null"] },
              quantidade: { type: ["integer", "null"] },
              potencia_hp: { type: ["number", "null"] },
              capacidade_kcal: { type: ["number", "null"] },
              compressor: { type: ["string", "null"] },
              gas_refrigerante: { type: ["string", "null"] },
              tipo_degelo: { type: ["string", "null"] },
              tipo_condensacao: { type: ["string", "null"] },
              valor_unitario: { type: ["number", "null"] },
            },
          },
        },

        // Cláusulas
        clausulas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tipo: { type: "string" },
              texto: { type: "string" },
            },
          },
        },

        // EVIDÊNCIAS por campo (rastreabilidade)
        evidencias: {
          type: "array",
          description: "Uma entrada por campo extraído com trecho literal de evidência.",
          items: {
            type: "object",
            properties: {
              campo: { type: "string", description: "Nome do campo extraído (ex: valor_total, garantia_meses)" },
              valor_extraido: { type: ["string", "null"] },
              pagina: { type: ["integer", "null"] },
              trecho: { type: ["string", "null"], description: "Citação literal ~120 caracteres" },
              score_confianca: { type: "number" },
            },
            required: ["campo", "score_confianca"],
          },
        },
      },
      required: ["score_confianca"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, fileName, fileType } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'text'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const MAX = 60000;
    const content = text.length > MAX ? text.slice(0, MAX) + "\n\n[...truncado...]" : text;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Documento: ${fileName} (${fileType})\n\n--- INÍCIO ---\n${content}\n--- FIM ---` },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "extract_proposal" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await res.text();
      console.error("AI gateway error", res.status, errText);
      return new Response(JSON.stringify({ error: "Falha na IA", details: errText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados", raw: data }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ extracted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("extract-document error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
