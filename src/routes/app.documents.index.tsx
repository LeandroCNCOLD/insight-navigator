import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { FileText, Upload, RefreshCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate, statusLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useState } from "react";
import { uploadQueue, type QueueItem } from "@/lib/upload-queue";
import { toast } from "sonner";

export const Route = createFileRoute("/app/documents/")({
  component: DocsList,
  head: () => ({ meta: [{ title: "Documentos — DocIntel" }] }),
});

function DocsList() {
  const [q, setQ] = useState("");
  const [fab, setFab] = useState<string>("__all__");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  useEffect(() => {
    const unsub = uploadQueue.subscribe(setQueue);
    return () => { unsub(); };
  }, []);

  const { data, refetch } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data } = await supabase.from("documents")
        .select("id,file_name,file_type,file_size,status,created_at,tem_analise_forense,competitor:competitors(id,nome),client:clients(nome,estado)")
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

  const fabricantes = Array.from(
    new Set((data || []).map((d: any) => d.competitor?.nome).filter(Boolean)),
  ).sort() as string[];

  const filtered = (data || []).filter((d: any) => {
    if (q && !d.file_name.toLowerCase().includes(q.toLowerCase())) return false;
    if (fab !== "__all__") {
      if (fab === "__none__") return !d.competitor?.nome;
      if (d.competitor?.nome !== fab) return false;
    }
    return true;
  });

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

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar por nome..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <div className="flex flex-wrap gap-1.5">
          <FabChip label="Todos" active={fab === "__all__"} onClick={() => setFab("__all__")} count={(data || []).length} />
          {fabricantes.map((name) => (
            <FabChip
              key={name}
              label={name}
              active={fab === name}
              onClick={() => setFab(name)}
              count={(data || []).filter((d: any) => d.competitor?.nome === name).length}
            />
          ))}
          <FabChip
            label="Sem fabricante"
            active={fab === "__none__"}
            onClick={() => setFab("__none__")}
            count={(data || []).filter((d: any) => !d.competitor?.nome).length}
          />
        </div>
      </div>

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
                <th className="text-left px-4 py-2.5 font-medium">Fabricante</th>
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
                    <td className="px-4 py-2.5">
                      {d.competitor?.nome ? (
                        <Link
                          to="/app/competitors/$nome"
                          params={{ nome: encodeURIComponent(d.competitor.nome) }}
                          className="text-xs text-primary hover:underline"
                        >
                          {d.competitor.nome}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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

function FabChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
      }`}
    >
      {label} <span className="opacity-70">· {count}</span>
    </button>
  );
}
