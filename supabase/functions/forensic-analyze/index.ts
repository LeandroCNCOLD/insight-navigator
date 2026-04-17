// Forensic-grade document analysis: 4-level reading (literal → structural → semantic → analytical)
// Returns 6 blocks (A-F) with full traceability.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um analista forense sênior de documentos técnico-comerciais. Sua tarefa é ler integralmente cada documento, preservando rastreabilidade do primeiro caractere ao último, e transformá-lo em uma representação estrutural, semântica e analítica AUDITÁVEL.

REGRAS OBRIGATÓRIAS (inquebráveis):
1. NUNCA invente dados.
2. SÓ extraia o que tiver evidência textual ou visual clara.
3. SEMPRE preserve a origem exata da informação (página, bloco, trecho literal).
4. Em dúvida, retorne baixa confiança (< 0.5).
5. Quando um campo não existir, retorne null.
6. Quando houver conflito entre trechos, popule "conflitos_documentais".

LEITURA EM 4 NÍVEIS:
- Nível 1 LITERAL: o texto como está
- Nível 2 ESTRUTURAL: seções, blocos, tabelas, cláusulas, campos
- Nível 3 SEMÂNTICO: significado técnico, comercial, contratual
- Nível 4 ANALÍTICO: padrões de benchmarking

ENTREGA OBRIGATÓRIA — chame APENAS forensic_extract retornando 6 blocos:
- Bloco A — Estrutura documental (tipo, seções ordenadas, cabeçalhos, rodapés, índice, presença de tabelas/assinatura/DocuSign/carimbo/formulário)
- Bloco B — Campos literais rastreáveis (cada item: nome, valor, página, bloco, trecho, score, método)
- Bloco D — Taxonomia (classifica blocos em institucional/cadastral/técnico/comercial/contratual/assinatura/fechamento)
- Bloco E — Análise comparável (4 resumos + riscos op./jurídicos + 5 padrões + insights)
- Bloco F — Inferências (apenas com forte evidência, cada item explicita evidências e confiança)
- Conflitos documentais quando houver

Bloco C (técnico-comercial) já é coberto por outro motor — NÃO repetir aqui.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "forensic_extract",
    description: "Extração forense multinível com 6 blocos auditáveis.",
    parameters: {
      type: "object",
      properties: {
        score_global: { type: "number", description: "Confiança média 0-1" },

        // Bloco A
        tipo_documento: { type: ["string", "null"] },
        secoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ordem: { type: "integer" },
              titulo: { type: "string" },
              pagina_inicio: { type: ["integer", "null"] },
              pagina_fim: { type: ["integer", "null"] },
              tipo: { type: ["string", "null"], description: "capa, sumario, escopo, tecnico, comercial, contratual, anexos" },
            },
          },
        },
        cabecalhos: { type: "array", items: { type: "string" } },
        rodapes: { type: "array", items: { type: "string" } },
        indice_paginas: {
          type: "array",
          items: {
            type: "object",
            properties: { pagina: { type: "integer" }, conteudo: { type: "string" } },
          },
        },
        tem_tabelas: { type: ["boolean", "null"] },
        tem_assinatura: { type: ["boolean", "null"] },
        tem_docusign: { type: ["boolean", "null"] },
        tem_carimbo: { type: ["boolean", "null"] },
        tem_formulario: { type: ["boolean", "null"] },

        // Bloco B
        campos_literais: {
          type: "array",
          description: "Todos os campos extraídos com rastreabilidade.",
          items: {
            type: "object",
            properties: {
              nome: { type: "string" },
              valor: { type: ["string", "null"] },
              pagina: { type: ["integer", "null"] },
              bloco: { type: ["string", "null"] },
              trecho: { type: ["string", "null"], description: "Citação literal" },
              score: { type: "number" },
              metodo: { type: ["string", "null"], description: "regex, parsing direto, inferência contextual, etc." },
            },
            required: ["nome", "score"],
          },
        },

        // Bloco D
        taxonomia_blocos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              bloco: { type: "string" },
              categoria: { type: "string", description: "institucional, cadastral, técnico, comercial, contratual, assinatura, fechamento" },
              pagina: { type: ["integer", "null"] },
              evidencia: { type: ["string", "null"] },
            },
          },
        },

        // Bloco E
        resumo_executivo: { type: ["string", "null"] },
        resumo_tecnico: { type: ["string", "null"] },
        resumo_comercial: { type: ["string", "null"] },
        resumo_contratual: { type: ["string", "null"] },
        riscos_operacionais: { type: ["string", "null"] },
        riscos_juridicos: { type: ["string", "null"] },
        padrao_posicionamento: { type: ["string", "null"] },
        padrao_transferencia_risco: { type: ["string", "null"] },
        padrao_pagamento: { type: ["string", "null"] },
        padrao_garantia: { type: ["string", "null"] },
        padrao_tecnico: { type: ["string", "null"] },
        insights_benchmarking: { type: ["string", "null"] },

        // Bloco F
        inferencias: {
          type: "array",
          items: {
            type: "object",
            properties: {
              chave: { type: "string", description: "porte_projeto, indicio_fechamento, grau_padronizacao, agressividade_contratual, grau_personalizacao, maturidade_comercial, segmento_cliente" },
              valor: { type: "string" },
              evidencias: { type: "array", items: { type: "string" } },
              confianca: { type: "number" },
              justificativa: { type: ["string", "null"] },
            },
            required: ["chave", "valor", "confianca"],
          },
        },

        // Conflitos
        conflitos_documentais: {
          type: "array",
          items: {
            type: "object",
            properties: {
              campo: { type: "string" },
              trechos: { type: "array", items: { type: "string" } },
              paginas: { type: "array", items: { type: "integer" } },
              observacao: { type: ["string", "null"] },
            },
          },
        },
      },
      required: ["score_global"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: "Missing documentId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return new Response(JSON.stringify({ error: "Invalid auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch document
    const { data: doc, error: docErr } = await admin
      .from("documents")
      .select("id, owner_id, file_name, file_type, raw_text")
      .eq("id", documentId)
      .maybeSingle();
    if (docErr || !doc) throw new Error("Documento não encontrado");
    if (!doc.raw_text) throw new Error("Documento sem texto extraído. Reprocesse o upload primeiro.");
    if (doc.owner_id !== userRes.user.id) throw new Error("Sem permissão");

    // Find linked proposal (optional)
    const { data: prop } = await admin.from("proposals").select("id").eq("document_id", documentId).maybeSingle();

    // Truncate context
    const MAX = 80000;
    const content = doc.raw_text.length > MAX ? doc.raw_text.slice(0, MAX) + "\n\n[...truncado...]" : doc.raw_text;

    const model = "google/gemini-2.5-pro";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Documento: ${doc.file_name} (${doc.file_type})\n\n--- INÍCIO ---\n${content}\n--- FIM ---` },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "forensic_extract" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido. Aguarde alguns instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await res.text();
      console.error("AI gateway error", res.status, errText);
      return new Response(JSON.stringify({ error: "Falha na IA forense", details: errText }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return new Response(JSON.stringify({ error: "IA não retornou dados estruturados" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ex = JSON.parse(toolCall.function.arguments);

    // Compute version
    const { data: prev } = await admin
      .from("forensic_analyses")
      .select("versao")
      .eq("document_id", documentId)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    const versao = (prev?.versao || 0) + 1;

    const { data: inserted, error: insErr } = await admin.from("forensic_analyses").insert({
      document_id: documentId,
      proposal_id: prop?.id || null,
      owner_id: doc.owner_id,
      versao,
      modelo_ia: model,
      score_global: ex.score_global,
      tipo_documento: ex.tipo_documento,
      secoes: ex.secoes || [],
      cabecalhos: ex.cabecalhos || [],
      rodapes: ex.rodapes || [],
      indice_paginas: ex.indice_paginas || [],
      tem_tabelas: ex.tem_tabelas,
      tem_assinatura: ex.tem_assinatura,
      tem_docusign: ex.tem_docusign,
      tem_carimbo: ex.tem_carimbo,
      tem_formulario: ex.tem_formulario,
      campos_literais: ex.campos_literais || [],
      taxonomia_blocos: ex.taxonomia_blocos || [],
      resumo_executivo: ex.resumo_executivo,
      resumo_tecnico: ex.resumo_tecnico,
      resumo_comercial: ex.resumo_comercial,
      resumo_contratual: ex.resumo_contratual,
      riscos_operacionais: ex.riscos_operacionais,
      riscos_juridicos: ex.riscos_juridicos,
      padrao_posicionamento: ex.padrao_posicionamento,
      padrao_transferencia_risco: ex.padrao_transferencia_risco,
      padrao_pagamento: ex.padrao_pagamento,
      padrao_garantia: ex.padrao_garantia,
      padrao_tecnico: ex.padrao_tecnico,
      insights_benchmarking: ex.insights_benchmarking,
      inferencias: ex.inferencias || [],
      conflitos_documentais: ex.conflitos_documentais || [],
    }).select().single();
    if (insErr) throw insErr;

    await admin.from("documents").update({ tem_analise_forense: true }).eq("id", documentId);

    return new Response(JSON.stringify({ analysis: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("forensic-analyze error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
