// Forensic-grade document analysis: 4-level reading + DEEP technical extraction.
// Extracts cameras, thermal load, client contact data, and a "padrao_camara" signature.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é um analista forense sênior de propostas técnico-comerciais de refrigeração industrial (câmaras frias, sistemas frigoríficos). Leia o documento integralmente preservando rastreabilidade total.

REGRAS INQUEBRÁVEIS:
1. NUNCA invente dados. 2. SÓ extraia o que tiver evidência textual. 3. SEMPRE preserve a origem (página, trecho). 4. Em dúvida, baixa confiança (<0.5). 5. Campo inexistente = null.

LEITURA EM 4 NÍVEIS: literal → estrutural → semântica → analítica.

EXTRAIA EM PROFUNDIDADE:

A) Estrutura documental (tipo, seções, cabeçalhos, rodapés, presença de tabelas/assinatura/DocuSign/carimbo).

B) Campos literais com rastreabilidade.

C) DADOS CADASTRAIS DO CLIENTE (procure em capa, rodapé, "Para:", "Cliente:", carimbos):
   - razao_social, nome_fantasia, cnpj, ie, endereco, bairro, cidade, estado, cep
   - contato_nome, contato_cargo, telefone, whatsapp, email, site
   - segmento (varejo alimentar, frigorífico, laticínio, food service, distribuidor, etc.)

D) ANÁLISE TÉCNICA PROFUNDA — para CADA câmara fria descrita, retorne um objeto:
   - nome (ex: "Câmara 01 – Resfriados"), produto_armazenado
   - dimensoes: { comprimento_m, largura_m, altura_m, pe_direito_m }
   - volume_m3 (calcule se dimensões existem), area_m2
   - temperatura_alvo_c, temperatura_min_c, temperatura_max_c, umidade_relativa_pct
   - carga_termica_kcal_h (REQUERIDA — sempre tente extrair, é fundamental), carga_termica_btu_h, fator_seguranca_pct
   - isolamento: { tipo (PIR/PUR/EPS), espessura_mm, densidade_kg_m3, revestimento }
   - piso: { tipo, isolamento_mm, acabamento }
   - portas: { quantidade, tipo (giro/correr/automática), dimensoes }
   - iluminacao, ralos, antecamara (boolean), pressurizacao
   - quantidade_unidades (CRÍTICO: quantas câmaras IDÊNTICAS desta dimensão existem na proposta — ex: "3 câmaras de 20×24×6m" → quantidade_unidades=3)
   - equipamentos_alocados: ARRAY de objetos com { modelo, marca, quantidade (por câmara), capacidade_unitaria_kcal_h, gas, compressor, tipo (Plug In/Split/etc) }
     * SE a proposta detalhar quais equipamentos vão em qual câmara, popule fielmente.
     * SE a proposta listar equipamentos só globalmente, distribua proporcionalmente OU repita o mesmo array em todas as câmaras iguais (deixe observação no campo "observacoes" da câmara).
   - capacidade_total_ofertada_kcal_h: SOMA das (quantidade × capacidade_unitaria_kcal_h) dos equipamentos alocados — sempre calcule.

E) RESUMO DE EQUIPAMENTOS:
   - total_unidades_refrigeracao, total_evaporadores, total_condensadores
   - capacidade_total_kcal_h, potencia_total_hp
   - gases_refrigerantes (lista), tipos_compressor (lista)
   - tipo_sistema (rack, splitão, monobloco, etc.)

F) CÁLCULO DE CARGA TÉRMICA:
   - metodologia (ASHRAE, IIR, fabricante, manual)
   - fatores_considerados (transmissão, infiltração, produto, iluminação, pessoas, motores, degelo)
   - margem_seguranca_pct, software_utilizado

G) PADRÃO DE CÂMARA (CRÍTICO para inteligência estratégica):
   Crie UMA assinatura única curta para a câmara DOMINANTE da proposta no formato:
   "{TempAlvo}°C | {Volume}m³ | {Isolamento}-{EspessMM} | {Produto}"
   Ex: "0°C | 250m³ | PIR-100 | Resfriados Cárneos"
   Ex: "-25°C | 800m³ | PIR-150 | Congelados"
   Use faixas arredondadas (volume → múltiplos de 50; espessura → padrões 70/100/125/150/200).
   Se a proposta tiver várias câmaras semelhantes, considere a maior/dominante.

H) Resumos (executivo, técnico, comercial, contratual), riscos op./jurídicos, padrões de posicionamento/pagamento/garantia, insights de benchmarking, inferências.

Chame APENAS forensic_extract com o JSON completo.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "forensic_extract",
    description: "Extração forense profunda + dados cadastrais + câmaras detalhadas.",
    parameters: {
      type: "object",
      properties: {
        score_global: { type: "number" },

        // Bloco A
        tipo_documento: { type: ["string", "null"] },
        secoes: { type: "array", items: { type: "object", properties: {
          ordem: { type: "integer" }, titulo: { type: "string" },
          pagina_inicio: { type: ["integer", "null"] }, pagina_fim: { type: ["integer", "null"] },
          tipo: { type: ["string", "null"] },
        } } },
        cabecalhos: { type: "array", items: { type: "string" } },
        rodapes: { type: "array", items: { type: "string" } },
        indice_paginas: { type: "array", items: { type: "object", properties: {
          pagina: { type: "integer" }, conteudo: { type: "string" },
        } } },
        tem_tabelas: { type: ["boolean", "null"] },
        tem_assinatura: { type: ["boolean", "null"] },
        tem_docusign: { type: ["boolean", "null"] },
        tem_carimbo: { type: ["boolean", "null"] },
        tem_formulario: { type: ["boolean", "null"] },

        // Bloco B
        campos_literais: { type: "array", items: { type: "object", properties: {
          nome: { type: "string" }, valor: { type: ["string", "null"] },
          pagina: { type: ["integer", "null"] }, bloco: { type: ["string", "null"] },
          trecho: { type: ["string", "null"] }, score: { type: "number" },
          metodo: { type: ["string", "null"] },
        }, required: ["nome", "score"] } },

        // C — DADOS DO CLIENTE
        cliente: {
          type: "object",
          properties: {
            nome: { type: ["string", "null"] },
            razao_social: { type: ["string", "null"] },
            cnpj: { type: ["string", "null"] },
            email: { type: ["string", "null"] },
            telefone: { type: ["string", "null"] },
            whatsapp: { type: ["string", "null"] },
            endereco: { type: ["string", "null"] },
            bairro: { type: ["string", "null"] },
            cidade: { type: ["string", "null"] },
            estado: { type: ["string", "null"] },
            cep: { type: ["string", "null"] },
            contato_nome: { type: ["string", "null"] },
            contato_cargo: { type: ["string", "null"] },
            site: { type: ["string", "null"] },
            segmento: { type: ["string", "null"] },
          },
        },

        // D — CÂMARAS
        camaras: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nome: { type: ["string", "null"] },
              produto_armazenado: { type: ["string", "null"] },
              quantidade_unidades: { type: ["integer", "null"] },
              comprimento_m: { type: ["number", "null"] },
              largura_m: { type: ["number", "null"] },
              altura_m: { type: ["number", "null"] },
              pe_direito_m: { type: ["number", "null"] },
              volume_m3: { type: ["number", "null"] },
              area_m2: { type: ["number", "null"] },
              temperatura_alvo_c: { type: ["number", "null"] },
              temperatura_min_c: { type: ["number", "null"] },
              temperatura_max_c: { type: ["number", "null"] },
              umidade_relativa_pct: { type: ["number", "null"] },
              carga_termica_kcal_h: { type: ["number", "null"] },
              carga_termica_btu_h: { type: ["number", "null"] },
              fator_seguranca_pct: { type: ["number", "null"] },
              isolamento_tipo: { type: ["string", "null"] },
              isolamento_espessura_mm: { type: ["number", "null"] },
              isolamento_densidade: { type: ["number", "null"] },
              revestimento: { type: ["string", "null"] },
              piso_tipo: { type: ["string", "null"] },
              piso_isolamento_mm: { type: ["number", "null"] },
              num_portas: { type: ["integer", "null"] },
              tipo_porta: { type: ["string", "null"] },
              tem_antecamara: { type: ["boolean", "null"] },
              observacoes: { type: ["string", "null"] },
              capacidade_total_ofertada_kcal_h: {
                type: ["number", "null"],
                description: "Soma de (quantidade × capacidade_unitaria_kcal_h) dos equipamentos alocados nesta câmara.",
              },
              equipamentos_alocados: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    modelo: { type: ["string", "null"] },
                    marca: { type: ["string", "null"] },
                    tipo: { type: ["string", "null"] },
                    quantidade: { type: ["integer", "null"], description: "Qtd de equipamentos por câmara desta dimensão." },
                    capacidade_unitaria_kcal_h: { type: ["number", "null"] },
                    potencia_hp: { type: ["number", "null"] },
                    gas: { type: ["string", "null"] },
                    compressor: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
        },

        // E — RESUMO DE EQUIPAMENTOS
        equipamentos_resumo: {
          type: "object",
          properties: {
            total_unidades_refrigeracao: { type: ["integer", "null"] },
            total_evaporadores: { type: ["integer", "null"] },
            total_condensadores: { type: ["integer", "null"] },
            capacidade_total_kcal_h: { type: ["number", "null"] },
            potencia_total_hp: { type: ["number", "null"] },
            gases_refrigerantes: { type: "array", items: { type: "string" } },
            tipos_compressor: { type: "array", items: { type: "string" } },
            tipo_sistema: { type: ["string", "null"] },
          },
        },

        // F — CÁLCULO TÉRMICO
        calculo_carga_termica: {
          type: "object",
          properties: {
            metodologia: { type: ["string", "null"] },
            fatores_considerados: { type: "array", items: { type: "string" } },
            margem_seguranca_pct: { type: ["number", "null"] },
            software_utilizado: { type: ["string", "null"] },
          },
        },

        // G — PADRÃO ESTRATÉGICO
        padrao_camara: {
          type: ["string", "null"],
          description: "Assinatura única ex: '0°C | 250m³ | PIR-100 | Resfriados'",
        },

        // Bloco D taxonomia
        taxonomia_blocos: { type: "array", items: { type: "object", properties: {
          bloco: { type: "string" }, categoria: { type: "string" },
          pagina: { type: ["integer", "null"] }, evidencia: { type: ["string", "null"] },
        } } },

        // Bloco E resumos
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

        inferencias: { type: "array", items: { type: "object", properties: {
          chave: { type: "string" }, valor: { type: "string" },
          evidencias: { type: "array", items: { type: "string" } },
          confianca: { type: "number" }, justificativa: { type: ["string", "null"] },
        }, required: ["chave", "valor", "confianca"] } },

        conflitos_documentais: { type: "array", items: { type: "object", properties: {
          campo: { type: "string" }, trechos: { type: "array", items: { type: "string" } },
          paginas: { type: "array", items: { type: "integer" } },
          observacao: { type: ["string", "null"] },
        } } },
      },
      required: ["score_global"],
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

function validateForensicExtraction(ex: any, sourceText: string) {
  const text = normalizeSpaces(sourceText).toLowerCase();
  const cliente = normalizeSpaces(ex?.cliente?.nome || ex?.cliente?.razao_social);
  const padrao = normalizeSpaces(ex?.padrao_camara);
  const camaras = Array.isArray(ex?.camaras) ? ex.camaras.filter(Boolean) : [];
  const evidencias = Array.isArray(ex?.campos_literais) ? ex.campos_literais.filter((item: any) => item?.nome) : [];
  const confidence = typeof ex?.score_global === "number" ? ex.score_global : 0;
  const hasTechnical = camaras.length > 0 || !!padrao || !!normalizeSpaces(ex?.padrao_tecnico);
  const hasClient = !!cliente || !!normalizeSpaces(ex?.cliente?.cnpj) || !!normalizeSpaces(ex?.cliente?.email);

  if (!hasTechnical && !hasClient) {
    return { valid: false, reason: "Análise forense não encontrou dados técnicos nem cadastrais suficientes" };
  }

  if (cliente) {
    const compactClient = cliente.replace(/\s+/g, "").toLowerCase();
    const compactText = text.replace(/\s+/g, "");
    if (compactClient.length >= 6 && !compactText.includes(compactClient) && evidencias.length < 2) {
      return { valid: false, reason: "Cliente retornado sem sustentação no texto do documento" };
    }
  }

  if (confidence < 0.2 && evidencias.length < 2 && camaras.length === 0) {
    return { valid: false, reason: "Análise forense com baixa confiança e sem evidências mínimas" };
  }

  return { valid: true };
}

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return new Response(JSON.stringify({ error: "Invalid auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: doc, error: docErr } = await admin
      .from("documents")
      .select("id, owner_id, file_name, file_type, file_path, raw_text, client_id")
      .eq("id", documentId)
      .maybeSingle();
    if (docErr || !doc) throw new Error("Documento não encontrado");
    if (doc.owner_id !== userRes.user.id) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userRes.user.id, _role: "admin" });
      if (!isAdmin) throw new Error("Sem permissão");
    }

    // Self-healing: if raw_text missing, OCR via Gemini Vision through the Lovable AI gateway
    let rawText = doc.raw_text || "";
    if (!hasMeaningfulText(rawText)) {
      console.log(`raw_text ausente para ${documentId}, tentando OCR via Vision API`);
      const { data: blob, error: dlErr } = await admin.storage.from("documents").download(doc.file_path);
      if (dlErr || !blob) throw new Error("Falha ao baixar arquivo do storage");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const mime = doc.file_type === "pdf" ? "application/pdf"
        : doc.file_type === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : doc.file_type === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : (blob.type || "application/octet-stream");
      const dataUrl = `data:${mime};base64,${base64}`;
      const visionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Extraia TODO o texto deste documento preservando a ordem das páginas. Marque cada página como [PÁGINA N]. Retorne APENAS o texto bruto, sem comentários." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          }],
        }),
      });
      if (!visionRes.ok) {
        const errText = await visionRes.text();
        console.error("Vision OCR falhou", visionRes.status, errText);
        throw new Error("Falha ao extrair texto do arquivo via OCR");
      }
      const visionData = await visionRes.json();
      rawText = visionData.choices?.[0]?.message?.content || "";
      if (!hasMeaningfulText(rawText)) {
        throw new Error("OCR não conseguiu extrair texto suficiente do documento");
      }
      await admin.from("documents").update({ raw_text: rawText.slice(0, 200000) }).eq("id", doc.id);
    }

    const { data: prop } = await admin.from("proposals").select("id, client_id").eq("document_id", documentId).maybeSingle();

    const MAX = 120000;
    const content = rawText.length > MAX ? rawText.slice(0, MAX) + "\n\n[...truncado...]" : rawText;

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
    const finishReason = data.choices?.[0]?.finish_reason;
    if (finishReason === "length" || finishReason === "max_tokens") {
      return new Response(JSON.stringify({ error: "Resposta da IA forense foi truncada; tente novamente." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resilient extraction: prefer tool_calls, fall back to JSON in content
    const message = data.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0];
    let ex: any = null;
    if (toolCall?.function?.arguments) {
      try {
        ex = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Falha ao parsear tool_call.arguments", e, toolCall.function.arguments?.slice(0, 500));
      }
    }
    if (!ex && typeof message?.content === "string" && message.content.trim()) {
      // Try to extract JSON from raw content (some models return JSON instead of tool calls)
      let raw = message.content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const start = raw.search(/[\{\[]/);
      const end = raw.lastIndexOf(start !== -1 && raw[start] === "[" ? "]" : "}");
      if (start !== -1 && end !== -1) {
        raw = raw.substring(start, end + 1);
        try {
          ex = JSON.parse(raw);
        } catch {
          try {
            ex = JSON.parse(raw.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, ""));
          } catch (e) {
            console.error("Falha ao parsear JSON do content", e, raw.slice(0, 500));
          }
        }
      }
    }
    if (!ex) {
      console.error("IA não retornou dados estruturados. finish_reason:", finishReason, "message:", JSON.stringify(message)?.slice(0, 1000));
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados", finish_reason: finishReason }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const validation = validateForensicExtraction(ex, content);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.reason }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== CLIENTE: merge não-destrutivo =====
    let resolvedClientId: string | null = doc.client_id || prop?.client_id || null;
    const c = ex.cliente || {};
    if (c && (c.nome || c.razao_social || c.cnpj)) {
      // Try match by CNPJ first, then by name
      let existing: { id: string } | null = null;
      if (c.cnpj) {
        const { data } = await admin.from("clients").select("id").eq("owner_id", doc.owner_id).eq("cnpj", c.cnpj).maybeSingle();
        if (data) existing = data;
      }
      if (!existing && (c.nome || c.razao_social)) {
        const nome = c.nome || c.razao_social;
        const { data } = await admin.from("clients").select("id").eq("owner_id", doc.owner_id).ilike("nome", nome).maybeSingle();
        if (data) existing = data;
      }
      if (!existing && resolvedClientId) {
        existing = { id: resolvedClientId };
      }

      const patch: Record<string, any> = {};
      const setIf = (k: string, v: any) => { if (v != null && v !== "") patch[k] = v; };
      setIf("nome", c.nome || c.razao_social);
      setIf("razao_social", c.razao_social);
      setIf("cnpj", c.cnpj);
      setIf("email", c.email);
      setIf("telefone", c.telefone);
      setIf("whatsapp", c.whatsapp);
      setIf("endereco", c.endereco);
      setIf("bairro", c.bairro);
      setIf("cidade", c.cidade);
      setIf("estado", c.estado);
      setIf("cep", c.cep);
      setIf("contato_nome", c.contato_nome);
      setIf("contato_cargo", c.contato_cargo);
      setIf("site", c.site);
      setIf("segmento", c.segmento);

      if (existing) {
        // Merge: only fill missing fields (don't overwrite user edits)
        const { data: cur } = await admin.from("clients").select("*").eq("id", existing.id).maybeSingle();
        const mergePatch: Record<string, any> = {};
        for (const [k, v] of Object.entries(patch)) {
          if (v != null && (cur?.[k] == null || cur[k] === "")) mergePatch[k] = v;
        }
        if (Object.keys(mergePatch).length) {
          await admin.from("clients").update(mergePatch).eq("id", existing.id);
        }
        resolvedClientId = existing.id;
      } else if (patch.nome) {
        const { data: created } = await admin.from("clients").insert({ ...patch, owner_id: doc.owner_id }).select("id").single();
        resolvedClientId = created?.id || null;
      }
    }

    // Update document + proposal client + deep technical analysis
    if (resolvedClientId) {
      await admin.from("documents").update({ client_id: resolvedClientId }).eq("id", documentId);
    }

    if (prop?.id) {
      const propUpdate: Record<string, any> = {
        analise_tecnica_profunda: {
          camaras: ex.camaras || [],
          equipamentos_resumo: ex.equipamentos_resumo || {},
          calculo_carga_termica: ex.calculo_carga_termica || {},
        },
        padrao_camara: ex.padrao_camara || null,
      };
      if (resolvedClientId) propUpdate.client_id = resolvedClientId;
      await admin.from("proposals").update(propUpdate).eq("id", prop.id);
    }

    // Versioned forensic record
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

    return new Response(JSON.stringify({ analysis: inserted, versao, padrao_camara: ex.padrao_camara }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("forensic-analyze error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
