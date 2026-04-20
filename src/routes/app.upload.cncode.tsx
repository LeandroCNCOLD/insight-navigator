import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload as UploadIcon, FileText, Loader2, CheckCircle2, XCircle, Copy, Home } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard-bits";
import { formatBytes } from "@/lib/format";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { uploadQueue, type QueueItem, type QueueStatus } from "@/lib/upload-queue";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/upload/cncode")({
  component: UploadCNCodePage,
  head: () => ({ meta: [{ title: "Upload CN Cold — DocIntel" }] }),
});

const HOUSE_NAME = "CN Cold";

async function ensureHouseCompetitorId(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado");
  const { data: existing } = await supabase
    .from("competitors")
    .select("id")
    .eq("owner_id", u.user.id)
    .ilike("nome", HOUSE_NAME)
    .maybeSingle();
  if (existing?.id) {
    // Make sure it's marked as house
    await supabase.from("competitors").update({ is_house: true } as any).eq("id", existing.id);
    return existing.id;
  }
  const { data: created, error } = await supabase
    .from("competitors")
    .insert({
      owner_id: u.user.id,
      nome: HOUSE_NAME,
      descricao: "Empresa da casa — base de propostas próprias para análise comparativa",
      is_house: true,
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

function UploadCNCodePage() {
  const [items, setItems] = useState<QueueItem[]>(uploadQueue.getItems());
  const [running, setRunning] = useState(uploadQueue.isRunning());
  const [houseId, setHouseId] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    ensureHouseCompetitorId()
      .then(setHouseId)
      .catch((e) => toast.error(`Falha ao configurar empresa-casa: ${e.message}`));
  }, []);

  useEffect(() => {
    const unsub = uploadQueue.subscribe((next) => {
      setItems(next);
      setRunning(uploadQueue.isRunning());
    });
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    const doneCount = items.filter((i) => i.status === "done" || i.status === "duplicate").length;
    if (doneCount > 0) qc.invalidateQueries();
  }, [items, qc]);

  const houseItems = items.filter((it) => it.houseCompetitorId === houseId && houseId);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    onDrop: (accepted) => {
      if (!houseId) {
        toast.error("Aguarde a configuração da empresa-casa…");
        return;
      }
      uploadQueue.addHouse(accepted, houseId);
    },
  });

  const processAll = async () => {
    uploadQueue.start().then(() => {
      qc.invalidateQueries();
      toast.success("Processamento concluído");
    });
    toast.info("Processando em segundo plano — você pode navegar para outras páginas");
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Upload CN Cold (Empresa da casa)"
        description="Base exclusiva das propostas da CN Cold. Documentos enviados aqui são automaticamente atribuídos à empresa-casa, separando-os dos concorrentes para permitir análise head-to-head."
      />

      <Card className="p-4 border-l-4 border-l-success bg-success/5">
        <div className="flex items-center gap-3">
          <Home className="size-5 text-success" />
          <div className="text-sm">
            <div className="font-medium">Modo empresa-casa ativo</div>
            <div className="text-muted-foreground">
              Propostas serão vinculadas a <strong>CN Cold</strong>. Detecção de fabricante via IA é ignorada.
            </div>
          </div>
        </div>
      </Card>

      <Card
        {...getRootProps()}
        className={`p-12 border-2 border-dashed cursor-pointer transition-all ${isDragActive ? "border-success bg-success/5" : "border-border hover:border-success/50 hover:bg-muted/20"}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center">
          <div className="size-14 rounded-full bg-success/10 text-success flex items-center justify-center mb-4">
            <UploadIcon className="size-6" />
          </div>
          <div className="font-medium">
            {isDragActive ? "Solte as propostas CN Cold aqui" : "Arraste propostas CN Cold ou clique para selecionar"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            PDF, DOCX, XLSX — vão direto para a base CN Cold
          </div>
        </div>
      </Card>

      {houseItems.length > 0 && (
        <Card className="gradient-surface border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">
              {houseItems.length} arquivo(s) CN Cold{running && " · processando…"}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => uploadQueue.clear()} disabled={running}>
                Limpar concluídos
              </Button>
              <Button
                size="sm"
                onClick={processAll}
                disabled={
                  running ||
                  !houseItems.some((i) => i.status === "pending" || i.status === "error")
                }
              >
                {running && <Loader2 className="size-3.5 mr-2 animate-spin" />}
                Processar com IA
              </Button>
            </div>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-y-auto scrollbar-thin">
            {houseItems.map((it) => (
              <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">
                    {it.fileName}
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-success">CN Cold</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {it.file ? `${formatBytes(it.file.size)} · ` : ""}{it.message || statusLabel(it.status)}
                  </div>
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

const statusLabel = (s: QueueStatus) =>
  ({
    pending: "Aguardando",
    uploading: "Enviando...",
    parsing: "Lendo texto...",
    extracting: "Extração com IA...",
    saving: "Salvando...",
    done: "Concluído",
    duplicate: "Duplicado (ignorado)",
    error: "Erro",
  })[s];

function StatusBadge({ status }: { status: QueueStatus }) {
  if (status === "done") return <CheckCircle2 className="size-4 text-success" />;
  if (status === "duplicate") return <Copy className="size-4 text-muted-foreground" />;
  if (status === "error") return <XCircle className="size-4 text-destructive" />;
  if (status === "pending")
    return (
      <Badge variant="secondary" className="text-[10px]">
        aguarda
      </Badge>
    );
  return <Loader2 className="size-4 animate-spin text-primary" />;
}
