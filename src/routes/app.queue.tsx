import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Badge } from "@/components/ui/badge";
import { ListChecks, RotateCw, AlertTriangle } from "lucide-react";
import { formatDate, statusLabel } from "@/lib/format";
import { uploadQueue } from "@/lib/upload-queue";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/app/queue")({
  component: Queue,
  head: () => ({ meta: [{ title: "Fila de processamento — DocIntel" }] }),
});

function Queue() {
  const [reprocessing, setReprocessing] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["queue-docs"],
    queryFn: async () =>
      (
        await supabase
          .from("documents")
          .select("id,file_name,status,created_at,error_message")
          .in("status", ["queued", "processing", "failed"])
          .order("created_at", { ascending: false })
      ).data || [],
    refetchInterval: 5000,
  });

  // Stuck = failed | queued | processing > 2min (qualquer doc que está parado precisa de retomada)
  const stuck = (data || []).filter((d) => {
    if (d.status === "failed" || d.status === "queued") return true;
    if (d.status === "processing") {
      return Date.now() - new Date(d.created_at).getTime() > 2 * 60 * 1000;
    }
    return false;
  });

  async function handleReprocessAll() {
    if (!stuck.length) {
      toast.info("Nenhum documento elegível para reprocessar");
      return;
    }
    setReprocessing(true);
    try {
      // Reset todos os docs que não estão "uploaded" para liberar o pipeline
      const idsToReset = stuck
        .filter((d) => d.status === "processing" || d.status === "queued")
        .map((d) => d.id);
      if (idsToReset.length) {
        await supabase
          .from("documents")
          .update({ status: "uploaded", error_message: null })
          .in("id", idsToReset);
      }
      // Enfileira em lotes pequenos para não estourar a API gateway de IA
      for (const d of stuck) {
        uploadQueue.reprocess(d.id, d.file_name);
      }
      // Concorrência baixa para reprocesso (extract + forensic em paralelo é pesado)
      uploadQueue.setConcurrency(3);
      void uploadQueue.start();
      toast.success(`${stuck.length} documento(s) reenfileirados — acompanhe abaixo`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reprocessar");
    } finally {
      setReprocessing(false);
    }
  }

  async function handleReprocessOne(id: string, fileName: string, status: string) {
    if (status === "processing" || status === "queued") {
      await supabase.from("documents").update({ status: "uploaded", error_message: null }).eq("id", id);
    }
    uploadQueue.reprocess(id, fileName);
    uploadQueue.setConcurrency(3);
    void uploadQueue.start();
    toast.success(`${fileName} reenfileirado`);
    refetch();
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Fila de processamento"
        description="Documentos em fila, em processamento ou com falha."
      />

      {stuck.length > 0 && (
        <Card className="gradient-surface border-warning/40 p-4 flex items-center gap-4">
          <AlertTriangle className="size-5 text-warning shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium">
              {stuck.length} documento(s) precisam de reprocessamento
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Falhas de extração (rate-limit) ou processos travados (aba fechada durante upload).
              Clique para retomar — o texto já extraído será reaproveitado.
            </p>
          </div>
          <Button onClick={handleReprocessAll} disabled={reprocessing}>
            <RotateCw className={`size-4 mr-2 ${reprocessing ? "animate-spin" : ""}`} />
            Reprocessar todos
          </Button>
        </Card>
      )}

      {!data?.length ? (
        <EmptyState
          icon={ListChecks}
          title="Fila vazia"
          description="Nenhum documento aguardando ou com erro."
        />
      ) : (
        <Card className="gradient-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Arquivo</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Data</th>
                <th className="text-left px-4 py-2.5 font-medium">Erro</th>
                <th className="text-right px-4 py-2.5 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((d) => {
                const isStuck =
                  d.status === "failed" ||
                  d.status === "queued" ||
                  (d.status === "processing" &&
                    Date.now() - new Date(d.created_at).getTime() > 2 * 60 * 1000);
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-2.5">{d.file_name}</td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={d.status === "failed" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {statusLabel[d.status] || d.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-destructive">{d.error_message || "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {isStuck && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReprocessOne(d.id, d.file_name, d.status)}
                        >
                          <RotateCw className="size-3.5 mr-1" />
                          Reprocessar
                        </Button>
                      )}
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
