// Global upload queue — singleton that survives route changes.
// Allows users to navigate away while uploads/AI processing continue in background.
import { supabase } from "@/integrations/supabase/client";
import { parseDocument } from "@/lib/document-parsers";

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
  file: File;
  status: QueueStatus;
  message?: string;
  documentId?: string;
};

type Listener = (items: QueueItem[]) => void;

class UploadQueue {
  private items: QueueItem[] = [];
  private listeners = new Set<Listener>();
  private running = false;

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

  add(files: File[]) {
    const newOnes: QueueItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: "pending",
    }));
    this.items = [...this.items, ...newOnes];
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

  private async processOne(it: QueueItem) {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");

      // Dedup: hash file and check existing
      const fileHash = await this.hashFile(it.file);
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
      const dotIdx = it.file.name.lastIndexOf(".");
      const baseName = dotIdx > 0 ? it.file.name.slice(0, dotIdx) : it.file.name;
      const extName = dotIdx > 0 ? it.file.name.slice(dotIdx) : "";
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
        .upload(path, it.file, { upsert: false });
      if (upErr) throw upErr;

      // 2) Insert document row with hash
      const ext = it.file.name.split(".").pop()?.toLowerCase() || "";
      const { data: doc, error: docErr } = await supabase
        .from("documents")
        .insert({
          owner_id: u.user.id,
          file_path: path,
          file_name: it.file.name,
          file_type: ext,
          file_size: it.file.size,
          file_hash: fileHash,
          status: "processing",
        })
        .select()
        .single();
      if (docErr) {
        // Race: another upload created same hash — treat as duplicate
        if (docErr.code === "23505") {
          this.update(it.id, { status: "duplicate", message: "Já enviado anteriormente" });
          return;
        }
        throw docErr;
      }
      this.update(it.id, { documentId: doc.id });

      // 3) Parse text
      this.update(it.id, { status: "parsing" });
      const parsed = await parseDocument(it.file);
      if (!parsed.text) throw new Error("Não foi possível extrair texto do documento");

      await supabase
        .from("documents")
        .update({ raw_text: parsed.text.slice(0, 200000) })
        .eq("id", doc.id);

      // 4) AI extraction
      this.update(it.id, { status: "extracting" });
      const { data: ai, error: aiErr } = await supabase.functions.invoke("extract-document", {
        body: { text: parsed.text, fileName: it.file.name, fileType: ext },
      });
      if (aiErr) throw new Error(aiErr.message);
      if (ai?.error) throw new Error(ai.error);

      const ex = ai.extracted;

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

      // 6) Insert proposal
      const { data: prop } = await supabase
        .from("proposals")
        .insert({
          owner_id: u.user.id,
          document_id: doc.id,
          client_id: clientId,
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
          tipo_documental: ex.tipo_documental,
          resumo_executivo: ex.resumo_executivo,
        })
        .eq("id", doc.id);

      // 9) Forensic in background (fire-and-forget)
      supabase.functions
        .invoke("forensic-analyze", { body: { documentId: doc.id } })
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
      // Process sequentially to avoid hammering the AI gateway
      while (true) {
        const next = this.items.find((it) => it.status === "pending" || it.status === "error");
        if (!next) break;
        // Reset error items so retry works
        if (next.status === "error") this.update(next.id, { status: "pending", message: undefined });
        await this.processOne(next);
      }
    } finally {
      this.running = false;
      this.emit();
    }
  }
}

export const uploadQueue = new UploadQueue();
