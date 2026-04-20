// Global upload queue — singleton that survives route changes.
// Allows users to navigate away while uploads/AI processing continue in background.
import { supabase } from "@/integrations/supabase/client";
// Lazy import — document-parsers loads pdfjs-dist which is browser-only.
async function parseDocument(file: File) {
  const mod = await import("@/lib/document-parsers");
  return mod.parseDocument(file);
}

export type QueueStatus =
  | "pending"
  | "uploading"
  | "parsing"
  | "extracting"
  | "saving"
  | "done"
  | "duplicate"
  | "error";

export type QueueItem = {
  id: string;
  file: File | null;
  fileName: string;
  status: QueueStatus;
  message?: string;
  documentId?: string;
  kind?: "upload" | "reprocess";
  /** When set, the proposal will be linked to this competitor_id (used for "house" uploads — CN Cold) bypassing manufacturer detection. */
  houseCompetitorId?: string;
};

type Listener = (items: QueueItem[]) => void;

const MIN_TEXT_LENGTH = 120;

function hasMeaningfulText(value?: string | null) {
  return !!value && value.replace(/\s+/g, " ").trim().length >= MIN_TEXT_LENGTH;
}

class UploadQueue {
  private items: QueueItem[] = [];
  private listeners = new Set<Listener>();
  private running = false;
  private concurrency = 10;
  private activeIds = new Set<string>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.items);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const snapshot = [...this.items];
    this.listeners.forEach((l) => l(snapshot));
  }

  getItems() {
    return [...this.items];
  }

  isRunning() {
    return this.running;
  }

  setConcurrency(n: number) {
    this.concurrency = Math.max(1, Math.min(20, Math.floor(n)));
  }

  add(files: File[]) {
    const newOnes: QueueItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      fileName: f.name,
      status: "pending",
      kind: "upload",
    }));
    this.items = [...this.items, ...newOnes];
    this.emit();
  }

  /** Add files marked as "house" — proposal will be linked to the given competitor_id (CN Cold) ignoring AI manufacturer detection. */
  addHouse(files: File[], houseCompetitorId: string) {
    const newOnes: QueueItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      fileName: f.name,
      status: "pending",
      kind: "upload",
      houseCompetitorId,
    }));
    this.items = [...this.items, ...newOnes];
    this.emit();
  }

  reprocess(documentId: string, fileName: string) {
    // Avoid duplicate reprocess in queue
    const already = this.items.find(
      (it) => it.kind === "reprocess" && it.documentId === documentId &&
        ["pending", "extracting", "saving"].includes(it.status),
    );
    if (already) return;
    this.items = [
      ...this.items,
      {
        id: crypto.randomUUID(),
        file: null,
        fileName,
        documentId,
        status: "pending",
        kind: "reprocess",
      },
    ];
    this.emit();
  }

  clear() {
    // Only clear finished items; keep in-flight ones
    this.items = this.items.filter((it) =>
      ["pending", "uploading", "parsing", "extracting", "saving"].includes(it.status),
    );
    this.emit();
  }

  private update(id: string, patch: Partial<QueueItem>) {
    this.items = this.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    this.emit();
  }

  private async hashFile(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private async persistExtractedProposal(
    docId: string,
    ex: any,
    ownerId: string,
    houseCompetitorId?: string,
  ) {
    // Resolve client
    let clientId: string | null = null;
    if (ex.cliente_nome) {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("owner_id", ownerId)
        .ilike("nome", ex.cliente_nome)
        .maybeSingle();
      if (existingClient) clientId = existingClient.id;
      else {
        const { data: newClient } = await supabase
          .from("clients")
          .insert({
            owner_id: ownerId,
            nome: ex.cliente_nome,
            razao_social: ex.cliente_razao_social,
            cidade: ex.cliente_cidade,
            estado: ex.cliente_estado,
            segmento: ex.segmento,
          })
          .select()
          .single();
        clientId = newClient?.id || null;
      }
    }

    // Resolve competitor — trust AI/heuristic; if it matches CN Cold, treat as house.
    let competitorId: string | null = null;
    if (houseCompetitorId) {
      competitorId = houseCompetitorId;
    } else {
      const fabricanteNome = (ex.fabricante && String(ex.fabricante).trim()) || null;
      if (fabricanteNome) {
        const isHouse = /\bcn\s*cold\b|\bcncold\b|\bcn[\s\-_]?code\b/i.test(fabricanteNome);
        const lookupName = isHouse ? "CN Cold" : fabricanteNome;
        const { data: existingComp } = await supabase
          .from("competitors")
          .select("id")
          .eq("owner_id", ownerId)
          .ilike("nome", lookupName)
          .maybeSingle();
        if (existingComp) {
          competitorId = existingComp.id;
          if (isHouse) await supabase.from("competitors").update({ is_house: true } as any).eq("id", existingComp.id);
        } else {
          const { data: newComp } = await supabase
            .from("competitors")
            .insert({
              owner_id: ownerId,
              nome: lookupName,
              is_house: isHouse,
              descricao: isHouse
                ? "Empresa da casa (detectada pelo fabricante do documento)"
                : ex.fabricante_origem === "ia"
                  ? "Detectado pela IA"
                  : "Detectado por padrão de texto",
            } as any)
            .select()
            .single();
          competitorId = newComp?.id || null;
        }
      }
    }

    const { data: prop } = await supabase
      .from("proposals")
      .insert({
        owner_id: ownerId,
        document_id: docId,
        client_id: clientId,
        competitor_id: competitorId,
        numero: ex.numero,
        data_proposta: ex.data_proposta,
        valor_total: ex.valor_total,
        condicao_pagamento: ex.condicao_pagamento,
        parcelas: ex.parcelas,
        prazo_fabricacao_dias: ex.prazo_fabricacao_dias,
        prazo_entrega_dias: ex.prazo_entrega_dias,
        prazo_instalacao_dias: ex.prazo_instalacao_dias,
        garantia_meses: ex.garantia_meses,
        garantia_limitacoes: ex.garantia_limitacoes,
        exclusoes_garantia: ex.exclusoes_garantia,
        frete_tipo: ex.frete_tipo,
        frete_incluso: ex.frete_incluso,
        instalacao_inclusa: ex.instalacao_inclusa,
        fornecimento_cliente: ex.fornecimento_cliente,
        vendedor: ex.vendedor,
        representante_legal: ex.representante_legal,
        tem_assinatura: ex.tem_assinatura,
        status_proposta: ex.status_proposta,
        observacoes: ex.observacoes,
        riscos: ex.riscos,
        score_confianca: ex.score_confianca,
        dados_tecnicos: ex.dados_tecnicos || {},
        clausulas: ex.clausulas || [],
        resumo_executivo: ex.resumo_executivo,
        resumo_tecnico: ex.resumo_tecnico,
        resumo_comercial: ex.resumo_comercial,
        insights_benchmarking: ex.insights_benchmarking,
        palavras_chave: Array.isArray(ex.palavras_chave) ? ex.palavras_chave : [],
        porte_projeto: ex.porte_projeto,
        indicio_fechamento: ex.indicio_fechamento,
        segmentacao_cliente: ex.segmentacao_cliente,
      })
      .select()
      .single();

    if (prop && Array.isArray(ex.equipamentos) && ex.equipamentos.length) {
      await supabase.from("equipments").insert(
        ex.equipamentos.map((e: any) => ({
          owner_id: ownerId,
          proposal_id: prop.id,
          tipo: e.tipo,
          modelo: e.modelo,
          marca: e.marca,
          quantidade: e.quantidade,
          potencia_hp: e.potencia_hp,
          capacidade_kcal: e.capacidade_kcal,
          compressor: e.compressor,
          gas_refrigerante: e.gas_refrigerante,
          tipo_degelo: e.tipo_degelo,
          tipo_condensacao: e.tipo_condensacao,
          valor_unitario: e.valor_unitario,
        })),
      );
    }

    if (prop && Array.isArray(ex.evidencias) && ex.evidencias.length) {
      await supabase.from("evidences").insert(
        ex.evidencias
          .filter((ev: any) => ev?.campo)
          .map((ev: any) => ({
            owner_id: ownerId,
            document_id: docId,
            proposal_id: prop.id,
            campo: String(ev.campo).slice(0, 200),
            valor_extraido:
              ev.valor_extraido != null ? String(ev.valor_extraido).slice(0, 1000) : null,
            pagina: typeof ev.pagina === "number" ? ev.pagina : null,
            trecho: ev.trecho ? String(ev.trecho).slice(0, 500) : null,
            score_confianca: typeof ev.score_confianca === "number" ? ev.score_confianca : null,
            status: "pending",
          })),
      );
    }

    await supabase
      .from("documents")
      .update({
        status: "extracted",
        error_message: null,
        client_id: clientId,
        competitor_id: competitorId,
        tipo_documental: ex.tipo_documental,
        resumo_executivo: ex.resumo_executivo,
      })
      .eq("id", docId);

    return prop;
  }

  private async processReprocess(it: QueueItem) {
    if (!it.documentId) throw new Error("documentId ausente para reprocessar");

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, file_path, file_name, raw_text, owner_id")
      .eq("id", it.documentId)
      .maybeSingle();
    if (docErr || !doc) throw new Error("Documento não encontrado");

    // Ensure raw_text exists; if not, re-parse from storage
    if (!hasMeaningfulText(doc.raw_text)) {
      this.update(it.id, { status: "parsing", message: "Re-extraindo texto do arquivo…" });
      const { data: blob, error: dlErr } = await supabase.storage
        .from("documents")
        .download(doc.file_path);
      if (dlErr || !blob) throw new Error("Falha ao baixar arquivo do storage");
      const file = new File([blob], doc.file_name, { type: blob.type });
      const parsed = await parseDocument(file);
      if (!hasMeaningfulText(parsed.text)) {
        throw new Error("Não foi possível extrair texto (PDF escaneado/sem OCR?)");
      }
      doc.raw_text = parsed.text.slice(0, 200000);
      await supabase.from("documents").update({ raw_text: doc.raw_text }).eq("id", doc.id);
    }

    // Check if a proposal already exists for this document
    const { data: existingProp } = await supabase
      .from("proposals")
      .select("id")
      .eq("document_id", it.documentId)
      .maybeSingle();

    // If no proposal, run the FULL extraction pipeline (reuses cached raw_text)
    if (!existingProp) {
      this.update(it.id, { status: "extracting", message: "Re-extraindo proposta com IA…" });
      const ext = doc.file_name.split(".").pop()?.toLowerCase() || "";
      const { data: ai, error: aiErr } = await supabase.functions.invoke("extract-document", {
        body: { text: doc.raw_text, fileName: doc.file_name, fileType: ext },
      });
      if (aiErr) throw new Error(aiErr.message);
      if (ai?.error) throw new Error(ai.error);
      const ex = ai.extracted;
      this.update(it.id, { status: "saving", message: "Persistindo proposta…" });
      await this.persistExtractedProposal(doc.id, ex, doc.owner_id, it.houseCompetitorId);
    }

    // Always run forensic on top
    this.update(it.id, { status: "extracting", message: "Análise forense profunda…" });
    const { data, error } = await supabase.functions.invoke("forensic-analyze", {
      body: { documentId: it.documentId },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    this.update(it.id, {
      status: "done",
      message: !existingProp
        ? "Proposta criada + análise forense"
        : data?.padrao_camara
          ? `Padrão: ${data.padrao_camara}`
          : "Reprocessado",
    });
  }

  private async processOne(it: QueueItem) {
    try {
      if (it.kind === "reprocess") {
        await this.processReprocess(it);
        return;
      }
      if (!it.file) throw new Error("Arquivo ausente");
      const file = it.file;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");

      // Dedup: hash file and check existing
      const fileHash = await this.hashFile(file);
      const { data: existing } = await supabase
        .from("documents")
        .select("id, status")
        .eq("owner_id", u.user.id)
        .eq("file_hash", fileHash)
        .maybeSingle();

      if (existing) {
        this.update(it.id, {
          status: "duplicate",
          message: "Arquivo idêntico já processado",
          documentId: existing.id,
        });
        return;
      }

      // 1) Upload to storage
      this.update(it.id, { status: "uploading" });
      const dotIdx = file.name.lastIndexOf(".");
      const baseName = dotIdx > 0 ? file.name.slice(0, dotIdx) : file.name;
      const extName = dotIdx > 0 ? file.name.slice(dotIdx) : "";
      const safeBase =
        baseName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "")
          .slice(0, 80) || "file";
      const safeExt = extName.toLowerCase().replace(/[^a-z0-9.]/g, "");
      const path = `${u.user.id}/${Date.now()}-${safeBase}${safeExt}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      // 2) Insert document row with hash
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const { data: doc, error: docErr } = await supabase
        .from("documents")
        .insert({
          owner_id: u.user.id,
          file_path: path,
          file_name: file.name,
          file_type: ext,
          file_size: file.size,
          file_hash: fileHash,
          status: "processing",
        })
        .select()
        .single();
      if (docErr) {
        if (docErr.code === "23505") {
          this.update(it.id, { status: "duplicate", message: "Já enviado anteriormente" });
          return;
        }
        throw docErr;
      }
      this.update(it.id, { documentId: doc.id });

      // 3) Parse text
      this.update(it.id, { status: "parsing" });
      const parsed = await parseDocument(file);
      if (!hasMeaningfulText(parsed.text)) {
        throw new Error("Texto insuficiente para análise confiável; tente reprocessar para OCR/análise profunda");
      }

      await supabase
        .from("documents")
        .update({ raw_text: parsed.text.slice(0, 200000) })
        .eq("id", doc.id);

      // 4) AI extraction
      this.update(it.id, { status: "extracting" });
      const { data: ai, error: aiErr } = await supabase.functions.invoke("extract-document", {
        body: { text: parsed.text, fileName: file.name, fileType: ext },
      });
      if (aiErr) throw new Error(aiErr.message);
      if (ai?.error) throw new Error(ai.error);

      const ex = ai.extracted;
      const hasClientData = !!(ex.cliente_nome || ex.cliente_razao_social || ex.cliente_cidade || ex.segmento);
      const hasCommercialData = ex.valor_total != null || !!ex.condicao_pagamento || !!ex.numero;
      const hasTechnicalData = !!(
        ex.dados_tecnicos?.tipo_camara ||
        ex.dados_tecnicos?.aplicacao ||
        ex.dados_tecnicos?.produto_armazenado ||
        ex.dados_tecnicos?.dimensoes ||
        ex.dados_tecnicos?.isolamento ||
        ex.dados_tecnicos?.temperatura_alvo_c != null ||
        ex.dados_tecnicos?.carga_termica_kcal != null ||
        (Array.isArray(ex.equipamentos) && ex.equipamentos.length > 0)
      );
      const evidenceCount = Array.isArray(ex.evidencias) ? ex.evidencias.length : 0;
      const confidence = typeof ex.score_confianca === "number" ? ex.score_confianca : 0;

      if ((!hasClientData && !hasCommercialData && !hasTechnicalData) || (confidence < 0.2 && evidenceCount < 2)) {
        throw new Error("Extração fraca demais para salvar como proposta válida; use reprocessar para análise profunda");
      }

      // 5) Resolve client
      this.update(it.id, { status: "saving" });
      let clientId: string | null = null;
      if (ex.cliente_nome) {
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("owner_id", u.user.id)
          .ilike("nome", ex.cliente_nome)
          .maybeSingle();
        if (existingClient) clientId = existingClient.id;
        else {
          const { data: newClient } = await supabase
            .from("clients")
            .insert({
              owner_id: u.user.id,
              nome: ex.cliente_nome,
              razao_social: ex.cliente_razao_social,
              cidade: ex.cliente_cidade,
              estado: ex.cliente_estado,
              segmento: ex.segmento,
            })
            .select()
            .single();
          clientId = newClient?.id || null;
        }
      }

      // 5b) Resolve competitor (manufacturer) — for house uploads (CN Cold) we force the configured id; otherwise fallback to "Conela" when not detected.
      let competitorId: string | null = null;
      if (it.houseCompetitorId) {
        competitorId = it.houseCompetitorId;
      } else {
        const fabricanteNome = (ex.fabricante && String(ex.fabricante).trim()) || "Conela";
        const { data: existingComp } = await supabase
          .from("competitors")
          .select("id")
          .eq("owner_id", u.user.id)
          .ilike("nome", fabricanteNome)
          .maybeSingle();
        if (existingComp) competitorId = existingComp.id;
        else {
          const { data: newComp } = await supabase
            .from("competitors")
            .insert({
              owner_id: u.user.id,
              nome: fabricanteNome,
              descricao:
                ex.fabricante_origem === "ia"
                  ? "Detectado pela IA"
                  : ex.fabricante_origem === "heuristica"
                    ? "Detectado por padrão de texto"
                    : "Atribuído por padrão (Conela)",
            })
            .select()
            .single();
          competitorId = newComp?.id || null;
        }
      }

      // 6) Insert proposal
      const { data: prop } = await supabase
        .from("proposals")
        .insert({
          owner_id: u.user.id,
          document_id: doc.id,
          client_id: clientId,
          competitor_id: competitorId,
          numero: ex.numero,
          data_proposta: ex.data_proposta,
          valor_total: ex.valor_total,
          condicao_pagamento: ex.condicao_pagamento,
          parcelas: ex.parcelas,
          prazo_fabricacao_dias: ex.prazo_fabricacao_dias,
          prazo_entrega_dias: ex.prazo_entrega_dias,
          prazo_instalacao_dias: ex.prazo_instalacao_dias,
          garantia_meses: ex.garantia_meses,
          garantia_limitacoes: ex.garantia_limitacoes,
          exclusoes_garantia: ex.exclusoes_garantia,
          frete_tipo: ex.frete_tipo,
          frete_incluso: ex.frete_incluso,
          instalacao_inclusa: ex.instalacao_inclusa,
          fornecimento_cliente: ex.fornecimento_cliente,
          vendedor: ex.vendedor,
          representante_legal: ex.representante_legal,
          tem_assinatura: ex.tem_assinatura,
          status_proposta: ex.status_proposta,
          observacoes: ex.observacoes,
          riscos: ex.riscos,
          score_confianca: ex.score_confianca,
          dados_tecnicos: ex.dados_tecnicos || {},
          clausulas: ex.clausulas || [],
          resumo_executivo: ex.resumo_executivo,
          resumo_tecnico: ex.resumo_tecnico,
          resumo_comercial: ex.resumo_comercial,
          insights_benchmarking: ex.insights_benchmarking,
          palavras_chave: Array.isArray(ex.palavras_chave) ? ex.palavras_chave : [],
          porte_projeto: ex.porte_projeto,
          indicio_fechamento: ex.indicio_fechamento,
          segmentacao_cliente: ex.segmentacao_cliente,
        })
        .select()
        .single();

      // 7) Equipments
      if (prop && Array.isArray(ex.equipamentos) && ex.equipamentos.length) {
        await supabase.from("equipments").insert(
          ex.equipamentos.map((e: any) => ({
            owner_id: u.user.id,
            proposal_id: prop.id,
            tipo: e.tipo,
            modelo: e.modelo,
            marca: e.marca,
            quantidade: e.quantidade,
            potencia_hp: e.potencia_hp,
            capacidade_kcal: e.capacidade_kcal,
            compressor: e.compressor,
            gas_refrigerante: e.gas_refrigerante,
            tipo_degelo: e.tipo_degelo,
            tipo_condensacao: e.tipo_condensacao,
            valor_unitario: e.valor_unitario,
          })),
        );
      }

      // 8) Evidences
      if (prop && Array.isArray(ex.evidencias) && ex.evidencias.length) {
        await supabase.from("evidences").insert(
          ex.evidencias
            .filter((ev: any) => ev?.campo)
            .map((ev: any) => ({
              owner_id: u.user.id,
              document_id: doc.id,
              proposal_id: prop.id,
              campo: String(ev.campo).slice(0, 200),
              valor_extraido:
                ev.valor_extraido != null ? String(ev.valor_extraido).slice(0, 1000) : null,
              pagina: typeof ev.pagina === "number" ? ev.pagina : null,
              trecho: ev.trecho ? String(ev.trecho).slice(0, 500) : null,
              score_confianca: typeof ev.score_confianca === "number" ? ev.score_confianca : null,
              status: "pending",
            })),
        );
      }

      await supabase
        .from("documents")
        .update({
          status: "extracted",
          client_id: clientId,
          competitor_id: competitorId,
          tipo_documental: ex.tipo_documental,
          resumo_executivo: ex.resumo_executivo,
        })
        .eq("id", doc.id);

      // 9) Forensic in background (fire-and-forget)
      supabase.functions
        .invoke("forensic-analyze", { body: { documentId: doc.id } })
        .then(({ data, error }) => {
          if (error || data?.error) {
            console.warn("forensic-analyze falhou:", error?.message || data?.error);
          }
        })
        .catch((err) => console.warn("forensic-analyze falhou:", err));

      this.update(it.id, { status: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      this.update(it.id, { status: "error", message: msg });
      const current = this.items.find((x) => x.id === it.id);
      if (current?.documentId) {
        await supabase
          .from("documents")
          .update({ status: "failed", error_message: msg })
          .eq("id", current.documentId);
      }
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.emit();
    try {
      // Process in parallel blocks (default 10) to keep things fast without
      // overwhelming the AI gateway / browser.
      while (true) {
        const slots = this.concurrency - this.activeIds.size;
        if (slots <= 0) {
          // wait a tick for one of the active ones to finish
          await new Promise((r) => setTimeout(r, 80));
          continue;
        }
        const ready = this.items
          .filter(
            (it) =>
              !this.activeIds.has(it.id) &&
              (it.status === "pending" || it.status === "error"),
          )
          .slice(0, slots);
        if (!ready.length && this.activeIds.size === 0) break;
        if (!ready.length) {
          await new Promise((r) => setTimeout(r, 80));
          continue;
        }
        for (const next of ready) {
          if (next.status === "error") {
            this.update(next.id, { status: "pending", message: undefined });
          }
          this.activeIds.add(next.id);
          // Fire and track without awaiting so the loop fills the next slot.
          void this.processOne(next).finally(() => {
            this.activeIds.delete(next.id);
          });
        }
      }
    } finally {
      this.running = false;
      this.emit();
    }
  }
}

export const uploadQueue = new UploadQueue();
