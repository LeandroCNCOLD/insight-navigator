import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload as UploadIcon, FileText, Loader2, CheckCircle2, XCircle, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard-bits";
import { formatBytes } from "@/lib/format";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { uploadQueue, type QueueItem, type QueueStatus } from "@/lib/upload-queue";

export const Route = createFileRoute("/app/upload")({
  component: UploadPage,
  head: () => ({ meta: [{ title: "Upload — DocIntel" }] }),
});

function UploadPage() {
  const [items, setItems] = useState<QueueItem[]>(uploadQueue.getItems());
  const [running, setRunning] = useState(uploadQueue.isRunning());
  const qc = useQueryClient();

  useEffect(() => {
    const unsub = uploadQueue.subscribe((next) => {
      setItems(next);
      setRunning(uploadQueue.isRunning());
    });
    return () => {
      unsub();
    };
  }, []);

  // Invalidate queries whenever a doc finishes so other pages refresh
  useEffect(() => {
    const doneCount = items.filter((i) => i.status === "done" || i.status === "duplicate").length;
    if (doneCount > 0) qc.invalidateQueries();
  }, [items, qc]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    onDrop: (accepted) => uploadQueue.add(accepted),
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
        title="Upload de documentos"
        description="Arraste PDF, DOCX ou XLSX. A IA extrai cliente, valor, equipamentos, prazos e cláusulas. Arquivos idênticos são detectados automaticamente."
      />

      <Card
        {...getRootProps()}
        className={`p-12 border-2 border-dashed cursor-pointer transition-all ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/20"}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center text-center">
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <UploadIcon className="size-6" />
          </div>
          <div className="font-medium">
            {isDragActive ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para selecionar"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            PDF, DOCX, XLSX — processamento em segundo plano, navegue livremente
          </div>
        </div>
      </Card>

      {items.length > 0 && (
        <Card className="gradient-surface border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">
              {items.length} arquivo(s){running && " · processando…"}
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
                  !items.some((i) => i.status === "pending" || i.status === "error")
                }
              >
                {running && <Loader2 className="size-3.5 mr-2 animate-spin" />}
                Processar com IA
              </Button>
            </div>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-y-auto scrollbar-thin">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{it.fileName}{it.kind === "reprocess" && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">reprocessar</span>}</div>
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
