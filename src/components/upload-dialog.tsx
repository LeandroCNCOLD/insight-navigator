import { useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload as UploadIcon, FileText, Loader2, CheckCircle2, XCircle, Copy, Home } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadQueue, type QueueItem, type QueueStatus } from "@/lib/upload-queue";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes } from "@/lib/format";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
    await supabase.from("competitors").update({ is_house: true } as any).eq("id", existing.id);
    return existing.id;
  }
  const { data: created, error } = await supabase
    .from("competitors")
    .insert({ owner_id: u.user.id, nome: HOUSE_NAME, descricao: "Empresa da casa", is_house: true } as any)
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

const statusLabel = (s: QueueStatus) =>
  ({ pending: "Aguardando", uploading: "Enviando...", parsing: "Lendo texto...", extracting: "Extração IA...", saving: "Salvando...", done: "Concluído", duplicate: "Duplicado", error: "Erro" })[s];

function StatusBadge({ status }: { status: QueueStatus }) {
  if (status === "done") return <CheckCircle2 className="size-4 text-success" />;
  if (status === "duplicate") return <Copy className="size-4 text-muted-foreground" />;
  if (status === "error") return <XCircle className="size-4 text-destructive" />;
  if (status === "pending") return <Badge variant="secondary" className="text-[10px]">aguarda</Badge>;
  return <Loader2 className="size-4 animate-spin text-primary" />;
}

export function UploadDialog({
  open,
  onOpenChange,
  defaultMode = "auto",
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultMode?: "auto" | "house";
  onComplete?: () => void;
}) {
  const [mode, setMode] = useState<"auto" | "house">(defaultMode);
  const [items, setItems] = useState<QueueItem[]>(uploadQueue.getItems());
  const [running, setRunning] = useState(uploadQueue.isRunning());
  const [houseId, setHouseId] = useState<string | null>(null);
  const [sessionIds, setSessionIds] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setMode(defaultMode);
    setSessionIds(new Set());
  }, [open, defaultMode]);

  useEffect(() => {
    if (mode === "house" && !houseId) {
      ensureHouseCompetitorId().then(setHouseId).catch((e) => toast.error(`Falha: ${e.message}`));
    }
  }, [mode, houseId]);

  useEffect(() => {
    const unsub = uploadQueue.subscribe((next) => {
      setItems(next);
      setRunning(uploadQueue.isRunning());
    });
    return () => { unsub(); };
  }, []);

  // Quando todos da sessão concluem, invalida e dispara callback
  useEffect(() => {
    if (sessionIds.size === 0) return;
    const sessionItems = items.filter((i) => sessionIds.has(i.id));
    const allDone = sessionItems.length > 0 && sessionItems.every((i) => i.status === "done" || i.status === "duplicate" || i.status === "error");
    if (allDone && !running) {
      qc.invalidateQueries();
      onComplete?.();
    }
  }, [items, running, sessionIds, qc, onComplete]);

  const sessionItems = useMemo(() => items.filter((i) => sessionIds.has(i.id)), [items, sessionIds]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    onDrop: (accepted) => {
      if (mode === "house") {
        if (!houseId) { toast.error("Aguarde configuração CN Cold…"); return; }
        const before = new Set(uploadQueue.getItems().map((i) => i.id));
        uploadQueue.addHouse(accepted, houseId);
        const after = uploadQueue.getItems().filter((i) => !before.has(i.id)).map((i) => i.id);
        setSessionIds((prev) => new Set([...prev, ...after]));
      } else {
        const before = new Set(uploadQueue.getItems().map((i) => i.id));
        uploadQueue.add(accepted);
        const after = uploadQueue.getItems().filter((i) => !before.has(i.id)).map((i) => i.id);
        setSessionIds((prev) => new Set([...prev, ...after]));
      }
    },
  });

  const processAll = () => {
    uploadQueue.start().then(() => {
      qc.invalidateQueries();
      toast.success("Processamento concluído");
    });
    toast.info("Processando em segundo plano…");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar nova proposta</DialogTitle>
          <DialogDescription>
            Suba PDF/DOCX/XLSX. A IA extrai cliente, valor, equipamentos e prazos automaticamente. Ao concluir, a proposta fica disponível para seleção.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          <Button size="sm" variant={mode === "house" ? "default" : "outline"} onClick={() => setMode("house")}>
            <Home className="size-4 mr-1" /> CN Cold (casa)
          </Button>
          <Button size="sm" variant={mode === "auto" ? "default" : "outline"} onClick={() => setMode("auto")}>
            Concorrente (detectar)
          </Button>
        </div>

        <div
          {...getRootProps()}
          className={`p-8 border-2 border-dashed rounded-md cursor-pointer transition-all ${
            isDragActive
              ? mode === "house" ? "border-success bg-success/5" : "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/20"
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center text-center">
            <div className={`size-12 rounded-full flex items-center justify-center mb-3 ${mode === "house" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
              <UploadIcon className="size-5" />
            </div>
            <div className="font-medium text-sm">
              {isDragActive ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para selecionar"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {mode === "house" ? "Vinculado à CN Cold" : "Fabricante detectado pela IA"}
            </div>
          </div>
        </div>

        {sessionItems.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between bg-muted/30">
              <div className="text-xs font-medium">{sessionItems.length} arquivo(s){running && " · processando…"}</div>
              <Button size="sm" onClick={processAll} disabled={running || !sessionItems.some((i) => i.status === "pending" || i.status === "error")}>
                {running && <Loader2 className="size-3.5 mr-2 animate-spin" />}
                Processar com IA
              </Button>
            </div>
            <div className="divide-y max-h-[260px] overflow-y-auto">
              {sessionItems.map((it) => (
                <div key={it.id} className="flex items-center gap-3 px-3 py-2">
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{it.fileName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {it.file ? `${formatBytes(it.file.size)} · ` : ""}{it.message || statusLabel(it.status)}
                    </div>
                  </div>
                  <StatusBadge status={it.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
