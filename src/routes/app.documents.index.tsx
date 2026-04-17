import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { FileText, Upload, RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate, statusLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { uploadQueue, type QueueItem } from "@/lib/upload-queue";
import { toast } from "sonner";

export const Route = createFileRoute("/app/documents/")({
  component: DocsList,
  head: () => ({ meta: [{ title: "Documentos — DocIntel" }] }),
});

function DocsList() {
  const [q, setQ] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  useEffect(() => {
    const unsub = uploadQueue.subscribe(setQueue);
    return () => { unsub(); };
  }, []);

  const { data, refetch } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data } = await supabase.from("documents")
        .select("id,file_name,file_type,file_size,status,created_at,tem_analise_forense,competitor:competitors(nome),client:clients(nome,estado)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Refresh list when reprocess queue items finish
  useEffect(() => {
    const finished = queue.filter((it) => it.kind === "reprocess" && it.status === "done");
    if (finished.length) refetch();
  }, [queue, refetch]);

  const reprocessingIds = new Set(
    queue
      .filter(
        (it) =>
          it.kind === "reprocess" &&
          ["pending", "uploading", "parsing", "extracting", "saving"].includes(it.status),
      )
      .map((it) => it.documentId),
  );

  const filtered = (data || []).filter((d) => !q || d.file_name.toLowerCase().includes(q.toLowerCase()));

  const reprocess = (id: string, name: string) => {
    uploadQueue.reprocess(id, name);
    uploadQueue.start();
    toast.success("Reprocessamento agendado", {
      description: "Análise técnica profunda em segundo plano. Você pode navegar.",
    });
  };

  const reprocessAll = () => {
    if (!filtered.length) return;
    filtered.forEach((d) => uploadQueue.reprocess(d.id, d.file_name));
    uploadQueue.start();
    toast.success(`${filtered.length} documento(s) na fila de reprocessamento`);
  };

  const queueCount = queue.filter(
    (it) => it.kind === "reprocess" && ["pending", "extracting"].includes(it.status),
  ).length;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Documentos"
        description={`${data?.length || 0} documento(s) na base${queueCount ? ` · ${queueCount} reprocessando` : ""}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reprocessAll} disabled={!filtered.length}>
              <Sparkles className="size-4 mr-2" />Reprocessar todos
            </Button>
            <Link to="/app/upload">
              <Button size="sm"><Upload className="size-4 mr-2" />Novo upload</Button>
            </Link>
          </div>
        }
      />

      <Input placeholder="Buscar por nome..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum documento" description="Faça upload do primeiro arquivo para começar." action={
          <Link to="/app/upload"><Button>Fazer upload</Button></Link>
        } />
      ) : (
        <Card className="gradient-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Arquivo</th>
                <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Tamanho</th>
                <th className="text-left px-4 py-2.5 font-medium">Data</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Forense</th>
                <th className="text-right px-4 py-2.5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d: any) => {
                const isReprocessing = reprocessingIds.has(d.id);
                return (
                  <tr key={d.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <Link to="/app/documents/$id" params={{ id: d.id }} className="flex items-center gap-2 hover:text-primary">
                        <FileText className="size-3.5 text-muted-foreground" />
                        <span className="truncate max-w-xs">{d.file_name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{d.client?.nome || "—"}</td>
                    <td className="px-4 py-2.5 uppercase text-xs">{d.file_type}</td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{formatBytes(d.file_size)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={d.status === "extracted" ? "default" : d.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                        {statusLabel[d.status] || d.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {d.tem_analise_forense ? (
                        <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">v{/* version unknown here */}OK</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        disabled={isReprocessing || !["extracted", "failed"].includes(d.status)}
                        onClick={() => reprocess(d.id, d.file_name)}
                      >
                        <RefreshCcw className={`size-3.5 mr-1.5 ${isReprocessing ? "animate-spin" : ""}`} />
                        {isReprocessing ? "Em fila" : "Reprocessar"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
