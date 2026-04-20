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
- Normalize unidades técnicas (HP, kcal/h, °C, %, mm, m).
- Para equipamentos, liste cada item separado.
- Gere resumos analíticos de alto nível (executivo, técnico, comercial).
- Classifique porte do projeto (pequeno < R$ 200k, médio R$ 200k-1M, grande > R$ 1M) e indício de fechamento (baixo/médio/alto) baseado em sinais como assinatura, status, condições.

EXTRAÇÃO TÉCNICA OBRIGATÓRIA (padrão Conela e similares — câmaras frias / climatização industrial):
- FABRICANTE/CONCORRENTE: identifique a empresa que ASSINA/EMITIU a proposta (Conela, Thermopro, Kit Frigor, DNS, Refrimaq, Frigelar, Plotter, etc.) — NÃO o cliente. Procure no cabeçalho, rodapé, logo, CNPJ, "razão social", "atenciosamente", "vendedor". Se não conseguir identificar, retorne null.
- Procure explicitamente medidas da câmara: comprimento (C), largura (L), altura (A), pé-direito (m).
- Procure painel/isolamento de PAREDE/TETO e de PISO separadamente: tipo (PIR, PUR, EPS, concreto), espessura (mm), densidade.
- Procure tensão elétrica (ex: "380V/3F – 60HZ"), produto armazenado, temperatura interna desejada, umidade relativa interna, funcionamento do compressor (h/dia), fator de segurança (%).
- Procure carga térmica REQUERIDA (kcal/h) E carga térmica INSTALADA/OFERTADA (kcal/h) — campos diferentes.
- Para cada equipamento ofertado, capture: modelo, tipo de instalação (Plug In, Split, Self Out, Monobloco, Rack), quantidade, potência (HP) por unidade, compressor (Scroll Inverter, Semi-hermético, etc.), condensador (On Board, Remoto), tensão, gás refrigerante (R-410a, R-404A, R-449A, R-22, NH3, CO2), tipo de desumidificação (Gás Quente, Elétrico, Nenhum), tipo de degelo (Ventilação, Elétrico, Gás Quente, Água), tipo de expansão (Direta, Indireta, Eletrônica), vazão de ar do EVP por unidade (m³/h), flecha de ar por unidade (m), capacidade unitária (kcal/h).
- Procure também: volume da câmara (m³), número de trocas de ar por hora, potência frigorífica a ser instalada total (kcal/h), margem/sobra de segurança.
- Se houver texto como "24 x 20 x 6m", converta para comprimento/largura/altura e preserve "dimensoes".
- Se houver "PUR 70", "PIR-100", "EPS 150" — normalize em isolamento_tipo + isolamento_espessura_mm.
- Mesmo que dados comerciais estejam ausentes, priorize preencher TODOS os campos técnicos disponíveis com evidência.

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
        numero: { type: "string" },
        data_proposta: { type: "string", description: "ISO YYYY-MM-DD" },
        tipo_documental: { type: "string", description: "proposta_comercial, proposta_tecnica, contrato, anexo, memorial, planilha" },
        status_proposta: { type: "string", description: "comercial, contratada, revisao, aditivo, rascunho" },
        fabricante: { type: "string", description: "Empresa que EMITIU a proposta (Conela, Thermopro, Kit Frigor, DNS, etc). NÃO é o cliente." },
        fabricante_cnpj: { type: "string" },

        // Cliente
        cliente_nome: { type: "string" },
        cliente_razao_social: { type: "string" },
        cliente_cidade: { type: "string" },
        cliente_estado: { type: "string", description: "UF 2 letras" },
        segmento: { type: "string" },
        segmentacao_cliente: { type: "string", description: "Inferência analítica do segmento (agronegócio, frigorífico, varejo, etc)" },

        // Comercial
        valor_total: { type: "number" },
        condicao_pagamento: { type: "string" },
        parcelas: { type: "integer" },
        prazo_fabricacao_dias: { type: "integer" },
        prazo_entrega_dias: { type: "integer" },
        prazo_instalacao_dias: { type: "integer" },
        garantia_meses: { type: "integer" },
        garantia_limitacoes: { type: "string" },
        exclusoes_garantia: { type: "string" },
        frete_tipo: { type: "string", description: "FOB, CIF ou similar" },
        frete_incluso: { type: "boolean" },
        instalacao_inclusa: { type: "boolean" },
        fornecimento_cliente: { type: "string", description: "Itens a serem fornecidos pelo cliente" },

        // Pessoas
        vendedor: { type: "string" },
        representante_legal: { type: "string" },
        tem_assinatura: { type: "boolean", description: "Há assinatura física, eletrônica ou DocuSign" },

        // Análise
        observacoes: { type: "string" },
        riscos: { type: "string" },
        score_confianca: { type: "number" },

        // Resumos analíticos
        resumo_executivo: { type: "string", description: "2-4 linhas, visão de alto nível" },
        resumo_tecnico: { type: "string", description: "Aspectos técnicos da solução" },
        resumo_comercial: { type: "string", description: "Condições comerciais, valor, prazos" },
        insights_benchmarking: { type: "string", description: "Pontos comparáveis com mercado" },
        palavras_chave: { type: "array", items: { type: "string" }, description: "5-15 palavras-chave do documento" },
        porte_projeto: { type: "string", description: "pequeno, medio ou grande" },
        indicio_fechamento: { type: "string", description: "baixo, medio ou alto" },

        // Técnico
        dados_tecnicos: {
          type: "object",
          properties: {
            tipo_camara: { type: "string" },
            aplicacao: { type: "string" },
            produto_armazenado: { type: "string" },
            temperatura_alvo_c: { type: "number" },
            umidade_alvo_pct: { type: "number" },
            dimensoes: { type: "string" },
            comprimento_m: { type: "number" },
            largura_m: { type: "number" },
            altura_m: { type: "number" },
            pe_direito_m: { type: "number" },
            area_m2: { type: "number" },
            volume_m3: { type: "number" },
            isolamento: { type: "string" },
            isolamento_tipo: { type: "string", description: "PIR, PUR, EPS, etc — parede/teto" },
            isolamento_espessura_mm: { type: "number" },
            isolamento_densidade_kg_m3: { type: "number" },
            isolamento_piso: { type: "string", description: "Ex: concreto, painel pisável, EPS" },
            painel_isolante_descricao: { type: "string" },
            tensao: { type: "string", description: "Ex: 380V/3F-60HZ" },
            funcionamento_compressor_h_dia: { type: "number" },
            fator_seguranca_pct: { type: "number" },
            carga_termica_kcal: { type: "number", description: "Carga térmica REQUERIDA da câmara" },
            potencia_frigorifica_instalada_kcal: { type: "number", description: "Capacidade total ofertada/instalada" },
            sobra_capacidade_pct: { type: "number", description: "(instalada/requerida - 1) * 100" },
            numero_trocas_ar_h: { type: "number" },
            supervisorio: { type: "boolean" },
            monitoramento_remoto: { type: "boolean" },
          },
        },

        // Equipamentos
        equipamentos: {
          type: "array",
          items: {
            type: "object",
            properties: {
            tipo: { type: "string", description: "Plug In, Split, Self Out, Monobloco, Rack, Central" },
              modelo: { type: "string" },
              marca: { type: "string" },
              quantidade: { type: "integer" },
              potencia_hp: { type: "number" },
              capacidade_kcal: { type: "number", description: "Capacidade unitária em kcal/h" },
              compressor: { type: "string", description: "Scroll Inverter, Semi-hermético, Alternativo, Parafuso" },
              gas_refrigerante: { type: "string" },
              tipo_degelo: { type: "string", description: "Ventilação, Elétrico, Gás Quente, Água" },
              tipo_condensacao: { type: "string", description: "On Board, Remoto, Ar, Água, Evaporativa" },
              tipo_desumidificacao: { type: "string", description: "Gás Quente, Elétrico, Nenhum" },
              tipo_expansao: { type: "string", description: "Direta, Indireta, Eletrônica, Termostática" },
              tensao: { type: "string" },
              vazao_ar_evp_m3h: { type: "number" },
              flecha_ar_m: { type: "number" },
              valor_unitario: { type: "number" },
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
              valor_extraido: { type: "string" },
              pagina: { type: "integer" },
              trecho: { type: "string", description: "Citação literal ~120 caracteres" },
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

const MIN_TEXT_LENGTH = 120;

function normalizeSpaces(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function hasMeaningfulText(value: string | null | undefined) {
  return normalizeSpaces(value).length >= MIN_TEXT_LENGTH;
}

function parseLocalizedNumber(value: string | null | undefined) {
  const raw = normalizeSpaces(value).replace(/[^\d,.-]/g, "");
  if (!raw) return null;

  let normalized = raw;
  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    const decimalPart = normalized.split(",")[1] || "";
    normalized = decimalPart.length === 3
      ? normalized.replace(/,/g, "")
      : normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(".")) {
    const decimalPart = normalized.split(".").pop() || "";
    if (decimalPart.length === 3) {
      normalized = normalized.replace(/\./g, "");
    }
  }

  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function extractSnippet(sourceText: string, start: number, end: number) {
  const from = Math.max(0, start - 50);
  const to = Math.min(sourceText.length, end + 70);
  return normalizeSpaces(sourceText.slice(from, to)).slice(0, 220) || null;
}

function extractTechnicalHints(sourceText: string) {
  const hints: any = { dados_tecnicos: {}, evidencias: [] };

  const dimensionPatterns = [
    /(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:m|metros?)?\s*[x×]\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:m|metros?)?\s*[x×]\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:m|metros?)\b/i,
    /comprimento\s*[:=-]?\s*(\d{1,3}(?:[.,]\d{1,2})?).{0,30}?largura\s*[:=-]?\s*(\d{1,3}(?:[.,]\d{1,2})?).{0,30}?altura\s*[:=-]?\s*(\d{1,2}(?:[.,]\d{1,2})?)/i,
  ];

  for (const pattern of dimensionPatterns) {
    const match = pattern.exec(sourceText);
    if (!match) continue;
    const comprimento = parseLocalizedNumber(match[1]);
    const largura = parseLocalizedNumber(match[2]);
    const altura = parseLocalizedNumber(match[3]);
    if (comprimento && largura && altura && comprimento <= 500 && largura <= 500 && altura <= 30) {
      hints.dados_tecnicos.comprimento_m = comprimento;
      hints.dados_tecnicos.largura_m = largura;
      hints.dados_tecnicos.altura_m = altura;
      hints.dados_tecnicos.area_m2 = Number((comprimento * largura).toFixed(2));
      hints.dados_tecnicos.volume_m3 = Number((comprimento * largura * altura).toFixed(2));
      hints.dados_tecnicos.dimensoes = `${comprimento} x ${largura} x ${altura} m`;
      hints.evidencias.push({
        campo: "dados_tecnicos.dimensoes",
        valor_extraido: hints.dados_tecnicos.dimensoes,
        pagina: null,
        trecho: extractSnippet(sourceText, match.index, match.index + match[0].length),
        score_confianca: 0.96,
      });
      break;
    }
  }

  const insulationMatch = /\b(?:painel(?:\s+isolante)?|isolamento|painel\s+frigor[ií]fico)?[^\n]{0,60}?\b(PIR|PUR|EPS)\s*(?:-|\/|\s)?\s*(\d{2,3})(?:\s*mm)?\b/i.exec(sourceText);
  if (insulationMatch) {
    const tipo = insulationMatch[1].toUpperCase();
    const espessura = parseLocalizedNumber(insulationMatch[2]);
    hints.dados_tecnicos.isolamento_tipo = tipo;
    hints.dados_tecnicos.isolamento_espessura_mm = espessura;
    hints.dados_tecnicos.isolamento = espessura ? `${tipo}-${espessura}mm` : tipo;
    hints.dados_tecnicos.painel_isolante_descricao = normalizeSpaces(insulationMatch[0]);
    hints.evidencias.push({
      campo: "dados_tecnicos.isolamento",
      valor_extraido: hints.dados_tecnicos.isolamento,
      pagina: null,
      trecho: extractSnippet(sourceText, insulationMatch.index, insulationMatch.index + insulationMatch[0].length),
      score_confianca: 0.95,
    });
  }

  const kcalMatch = /(\d[\d.,]{2,})\s*(?:kcal\/h|kcal\/?hora|kcal\b)/i.exec(sourceText);
  if (kcalMatch) {
    const kcal = parseLocalizedNumber(kcalMatch[1]);
    if (kcal && kcal >= 1000) {
      hints.dados_tecnicos.carga_termica_kcal = kcal;
      hints.evidencias.push({
        campo: "dados_tecnicos.carga_termica_kcal",
        valor_extraido: String(kcal),
        pagina: null,
        trecho: extractSnippet(sourceText, kcalMatch.index, kcalMatch.index + kcalMatch[0].length),
        score_confianca: 0.94,
      });
    }
  }

  const tempMatch = /(-?\d{1,2}(?:[.,]\d{1,2})?)\s*°\s*C/i.exec(sourceText);
  if (tempMatch) {
    const temp = parseLocalizedNumber(tempMatch[1]);
    if (temp != null) hints.dados_tecnicos.temperatura_alvo_c = temp;
  }

  const humidityMatch = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s*(?:UR|umidade)?/i.exec(sourceText);
  if (humidityMatch) {
    const humidity = parseLocalizedNumber(humidityMatch[1]);
    if (humidity != null && humidity <= 100) hints.dados_tecnicos.umidade_alvo_pct = humidity;
  }

  return hints;
}

// Known competitor catalog — order matters (specific before generic).
// "fallback" is true when AI didn't detect anything in the text.
const KNOWN_COMPETITORS: Array<{ name: string; patterns: RegExp[] }> = [
  { name: "Conela", patterns: [/\bconela\b/i, /conela\.com/i] },
  { name: "Thermopro", patterns: [/\bthermo\s*pro\b/i, /thermopro/i] },
  { name: "Kit Frigor", patterns: [/\bkit\s*frigor\b/i] },
  { name: "DNS", patterns: [/\bDNS\s+refrigera/i, /\bDNS\s+(?:câmara|camara|frio)/i] },
  { name: "Refrimaq", patterns: [/\brefrimaq\b/i] },
  { name: "Frigelar", patterns: [/\bfrigelar\b/i] },
  { name: "Plotter", patterns: [/\bplotter\s+refrigera/i] },
  { name: "Mecalux Frio", patterns: [/\bmecalux\b/i] },
];

function detectManufacturer(sourceText: string): string | null {
  for (const c of KNOWN_COMPETITORS) {
    if (c.patterns.some((p) => p.test(sourceText))) return c.name;
  }
  return null;
}

function mergeTechnicalHints(extracted: any, sourceText: string) {
  const normalized = normalizeExtraction(extracted) || {};
  const hints = extractTechnicalHints(sourceText);
  const dadosTecnicos = { ...(normalized.dados_tecnicos || {}) };

  const fill = (key: string) => {
    if (dadosTecnicos[key] == null || dadosTecnicos[key] === "") {
      const value = hints.dados_tecnicos?.[key];
      if (value != null && value !== "") dadosTecnicos[key] = value;
    }
  };

  [
    "dimensoes",
    "comprimento_m",
    "largura_m",
    "altura_m",
    "pe_direito_m",
    "area_m2",
    "volume_m3",
    "isolamento",
    "isolamento_tipo",
    "isolamento_espessura_mm",
    "isolamento_densidade_kg_m3",
    "painel_isolante_descricao",
    "carga_termica_kcal",
    "temperatura_alvo_c",
    "umidade_alvo_pct",
  ].forEach(fill);

  const evidenciasExistentes = Array.isArray(normalized.evidencias) ? normalized.evidencias : [];
  const camposExistentes = new Set(evidenciasExistentes.map((item: any) => item?.campo).filter(Boolean));
  const evidencias = [
    ...evidenciasExistentes,
    ...((hints.evidencias || []).filter((item: any) => item?.campo && !camposExistentes.has(item.campo))),
  ];

  // Manufacturer/competitor detection: prefer AI value, fall back to text scan, then null.
  const aiFabricante = normalizeSpaces(normalized.fabricante);
  const detected = !aiFabricante ? detectManufacturer(sourceText) : null;
  const fabricante = aiFabricante || detected || null;

  return {
    ...normalized,
    fabricante,
    fabricante_origem: aiFabricante ? "ia" : detected ? "heuristica" : "indefinido",
    dados_tecnicos: dadosTecnicos,
    evidencias,
  };
}

function normalizeExtraction(extracted: any) {
  if (!extracted || typeof extracted !== "object") return extracted;
  const evidencias = Array.isArray(extracted.evidencias) ? extracted.evidencias.filter((ev: any) => ev?.campo) : [];
  return {
    ...extracted,
    palavras_chave: Array.isArray(extracted.palavras_chave) ? extracted.palavras_chave.filter(Boolean) : [],
    equipamentos: Array.isArray(extracted.equipamentos) ? extracted.equipamentos.filter((item: any) => item && Object.values(item).some((v) => v != null && v !== "")) : [],
    clausulas: Array.isArray(extracted.clausulas) ? extracted.clausulas.filter((item: any) => item?.tipo || item?.texto) : [],
    evidencias,
  };
}

function validateExtraction(extracted: any, sourceText: string) {
  const text = normalizeSpaces(sourceText).toLowerCase();
  const normalized = normalizeExtraction(extracted);
  const cliente = normalizeSpaces(normalized?.cliente_nome || normalized?.cliente_razao_social);
  const numero = normalizeSpaces(normalized?.numero);
  const evidenceCount = Array.isArray(normalized?.evidencias) ? normalized.evidencias.length : 0;
  const hasClient = !!cliente;
  const hasCommercial = normalized?.valor_total != null || !!normalizeSpaces(normalized?.condicao_pagamento) || !!numero;
  const hasTechnical = !!(
    normalizeSpaces(normalized?.dados_tecnicos?.tipo_camara) ||
    normalizeSpaces(normalized?.dados_tecnicos?.aplicacao) ||
    normalizeSpaces(normalized?.dados_tecnicos?.produto_armazenado) ||
    normalizeSpaces(normalized?.dados_tecnicos?.dimensoes) ||
    normalizeSpaces(normalized?.dados_tecnicos?.isolamento) ||
    normalized?.dados_tecnicos?.comprimento_m != null ||
    normalized?.dados_tecnicos?.largura_m != null ||
    normalized?.dados_tecnicos?.altura_m != null ||
    normalized?.dados_tecnicos?.area_m2 != null ||
    normalized?.dados_tecnicos?.volume_m3 != null ||
    normalized?.dados_tecnicos?.temperatura_alvo_c != null ||
    normalized?.dados_tecnicos?.carga_termica_kcal != null ||
    (Array.isArray(normalized?.equipamentos) && normalized.equipamentos.length > 0)
  );

  if (!hasClient && !hasCommercial && !hasTechnical) {
    return { valid: false, reason: "IA não encontrou dados úteis suficientes" };
  }

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  if (cliente) {
    const compactClient = norm(cliente);
    const compactText = norm(text);
    // Tolerate AI reordering / abbreviations: accept when full string is present
    // OR when any significant word (>=4 chars) of the client name appears.
    const significantTokens = cliente
      .split(/\s+/)
      .map((t) => norm(t))
      .filter((t) => t.length >= 4);
    const anyWordHit = significantTokens.some((t) => compactText.includes(t));
    if (compactClient.length >= 6 && !compactText.includes(compactClient) && !anyWordHit) {
      return { valid: false, reason: "Nome do cliente não aparece no texto fonte" };
    }
  }

  if (numero) {
    const compactNumber = norm(numero);
    const compactText = norm(text);
    if (compactNumber.length >= 4 && !compactText.includes(compactNumber) && evidenceCount < 2) {
      return { valid: false, reason: "Número da proposta sem evidência suficiente" };
    }
  }

  const confidence = typeof normalized?.score_confianca === "number" ? normalized.score_confianca : 0;
  if (confidence < 0.15 && evidenceCount < 2) {
    return { valid: false, reason: "Baixa confiança geral sem evidências mínimas" };
  }

  return { valid: true, extracted: normalized };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, fileName, fileType } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'text'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!hasMeaningfulText(text)) {
      return new Response(JSON.stringify({ error: "Texto insuficiente para extração confiável" }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const MAX = 60000;
    const content = text.length > MAX ? text.slice(0, MAX) + "\n\n[...truncado...]" : text;

    const MODELS = ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "google/gemini-2.5-flash-lite"];
    let toolCall: any = null;
    let lastError: string | null = null;
    let lastStatus = 0;

    for (const model of MODELS) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Documento: ${fileName} (${fileType})\n\n--- INÍCIO ---\n${content}\n--- FIM ---` },
          ],
          tools: [TOOL_SCHEMA],
          tool_choice: { type: "function", function: { name: "extract_proposal" } },
        }),
      });

      if (!res.ok) {
        lastStatus = res.status;
        if (res.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        lastError = await res.text();
        console.error(`AI gateway error model=${model}`, res.status, lastError);
        continue;
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const innerError = choice?.error;
      const finishReason = choice?.finish_reason;

      if (innerError) {
        console.error(`AI inner error model=${model}`, JSON.stringify(innerError));
        lastError = innerError.message || "provider error";
        continue;
      }

      if (finishReason === "length" || finishReason === "max_tokens") {
        lastError = "resposta truncada";
        continue;
      }

      toolCall = choice?.message?.tool_calls?.[0];
      if (toolCall) break;

      lastError = "sem tool_call";
      console.error(`No tool call model=${model}`, JSON.stringify(data).slice(0, 500));
    }

    if (!toolCall) {
      return new Response(JSON.stringify({ error: `IA indisponível após retries: ${lastError || "sem detalhes"}` }), { status: lastStatus === 503 ? 503 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const extracted = mergeTechnicalHints(JSON.parse(toolCall.function.arguments), content);
    const validation = validateExtraction(extracted, content);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.reason }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ extracted: validation.extracted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("extract-document error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
