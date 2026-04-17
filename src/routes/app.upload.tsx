import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload as UploadIcon, FileText, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard-bits";
import { supabase } from "@/integrations/supabase/client";
import { parseDocument } from "@/lib/document-parsers";
import { formatBytes } from "@/lib/format";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/app/upload")({
  component: UploadPage,
  head: () => ({ meta: [{ title: "Upload — DocIntel" }] }),
});

type Item = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "parsing" | "extracting" | "saving" | "done" | "error";
  message?: string;
  documentId?: string;
};

function UploadPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const qc = useQueryClient();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    onDrop: (accepted) => {
      setItems((prev) => [
        ...prev,
        ...accepted.map((f) => ({ id: crypto.randomUUID(), file: f, status: "pending" as const })),
      ]);
    },
  });

  const update = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const processOne = async (it: Item) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");

      // 1) Upload to storage
      update(it.id, { status: "uploading" });
      const path = `${u.user.id}/${Date.now()}-${it.file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, it.file, { upsert: false });
      if (upErr) throw upErr;

      // 2) Insert document row
      const ext = it.file.name.split(".").pop()?.toLowerCase() || "";
      const { data: doc, error: docErr } = await supabase.from("documents").insert({
        owner_id: u.user.id, file_path: path, file_name: it.file.name,
        file_type: ext, file_size: it.file.size, status: "processing",
      }).select().single();
      if (docErr) throw docErr;
      update(it.id, { documentId: doc.id });

      // 3) Parse document text in browser
      update(it.id, { status: "parsing" });
      const parsed = await parseDocument(it.file);
      if (!parsed.text) throw new Error("Não foi possível extrair texto do documento");

      await supabase.from("documents").update({ raw_text: parsed.text.slice(0, 200000) }).eq("id", doc.id);

      // 4) Call edge function for AI extraction
      update(it.id, { status: "extracting" });
      const { data: ai, error: aiErr } = await supabase.functions.invoke("extract-document", {
        body: { text: parsed.text, fileName: it.file.name, fileType: ext },
      });
      if (aiErr) throw new Error(aiErr.message);
      if (ai?.error) throw new Error(ai.error);

      const ex = ai.extracted;

      // 5) Resolve client
      update(it.id, { status: "saving" });
      let clientId: string | null = null;
      if (ex.cliente_nome) {
        const { data: existing } = await supabase.from("clients").select("id").eq("owner_id", u.user.id).ilike("nome", ex.cliente_nome).maybeSingle();
        if (existing) clientId = existing.id;
        else {
          const { data: newClient } = await supabase.from("clients").insert({
            owner_id: u.user.id, nome: ex.cliente_nome,
            razao_social: ex.cliente_razao_social, cidade: ex.cliente_cidade,
            estado: ex.cliente_estado, segmento: ex.segmento,
          }).select().single();
          clientId = newClient?.id || null;
        }
      }

      // 6) Insert proposal
      const { data: prop } = await supabase.from("proposals").insert({
        owner_id: u.user.id, document_id: doc.id, client_id: clientId,
        numero: ex.numero, data_proposta: ex.data_proposta, valor_total: ex.valor_total,
        condicao_pagamento: ex.condicao_pagamento, parcelas: ex.parcelas,
        prazo_fabricacao_dias: ex.prazo_fabricacao_dias, prazo_entrega_dias: ex.prazo_entrega_dias,
        prazo_instalacao_dias: ex.prazo_instalacao_dias, garantia_meses: ex.garantia_meses,
        garantia_limitacoes: ex.garantia_limitacoes, frete_tipo: ex.frete_tipo,
        frete_incluso: ex.frete_incluso, instalacao_inclusa: ex.instalacao_inclusa,
        vendedor: ex.vendedor, representante_legal: ex.representante_legal,
        tem_assinatura: ex.tem_assinatura, status_proposta: ex.status_proposta,
        observacoes: ex.observacoes, riscos: ex.riscos,
        score_confianca: ex.score_confianca, dados_tecnicos: ex.dados_tecnicos || {},
        clausulas: ex.clausulas || [],
      }).select().single();

      // 7) Insert equipments
      if (prop && Array.isArray(ex.equipamentos) && ex.equipamentos.length) {
        await supabase.from("equipments").insert(
          ex.equipamentos.map((e: any) => ({
            owner_id: u.user.id, proposal_id: prop.id,
            tipo: e.tipo, modelo: e.modelo, marca: e.marca, quantidade: e.quantidade,
            potencia_hp: e.potencia_hp, capacidade_kcal: e.capacidade_kcal,
            compressor: e.compressor, gas_refrigerante: e.gas_refrigerante,
            tipo_degelo: e.tipo_degelo, tipo_condensacao: e.tipo_condensacao,
            valor_unitario: e.valor_unitario,
          }))
        );
      }

      await supabase.from("documents").update({ status: "extracted", client_id: clientId }).eq("id", doc.id);
      update(it.id, { status: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      update(it.id, { status: "error", message: msg });
      if (it.documentId) {
        await supabase.from("documents").update({ status: "failed", error_message: msg }).eq("id", it.documentId);
      }
    }
  };

  const processAll = async () => {
    setRunning(true);
    const pending = items.filter((i) => i.status === "pending" || i.status === "error");
    for (const it of pending) await processOne(it);
    setRunning(false);
    qc.invalidateQueries();
    toast.success("Processamento concluído");
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Upload de documentos" description="Arraste PDF, DOCX ou XLSX. A IA extrai automaticamente cliente, valor, equipamentos, prazos e cláusulas." />

      <Card
        {...getRootProps()}
        className={`p-12 border-2 border-dashed cursor-pointer transition-all ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center">
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <UploadIcon className="size-6" />
          </div>
          <div className="font-medium">{isDragActive ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para selecionar"}</div>
          <div className="text-sm text-muted-foreground mt-1">PDF, DOCX, XLSX — até centenas de arquivos por vez</div>
        </div>
      </Card>

      {items.length > 0 && (
        <Card className="gradient-surface border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">{items.length} arquivo(s)</div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setItems([])} disabled={running}>Limpar</Button>
              <Button size="sm" onClick={processAll} disabled={running || !items.some((i) => i.status === "pending" || i.status === "error")}>
                {running && <Loader2 className="size-3.5 mr-2 animate-spin" />}Processar com IA
              </Button>
            </div>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-y-auto scrollbar-thin">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{it.file.name}</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(it.file.size)} · {it.message || statusLabel(it.status)}</div>
                </div>
                <StatusBadge status={it.status} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

const statusLabel = (s: Item["status"]) => ({
  pending: "Aguardando", uploading: "Enviando...", parsing: "Lendo texto...",
  extracting: "Extração com IA...", saving: "Salvando...", done: "Concluído", error: "Erro",
}[s]);

function StatusBadge({ status }: { status: Item["status"] }) {
  if (status === "done") return <CheckCircle2 className="size-4 text-success" />;
  if (status === "error") return <XCircle className="size-4 text-destructive" />;
  if (status === "pending") return <Badge variant="secondary" className="text-[10px]">aguarda</Badge>;
  return <Loader2 className="size-4 animate-spin text-primary" />;
}
