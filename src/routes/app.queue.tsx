import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Badge } from "@/components/ui/badge";
import { ListChecks } from "lucide-react";
import { formatDate, statusLabel } from "@/lib/format";

export const Route = createFileRoute("/app/queue")({
  component: Queue,
  head: () => ({ meta: [{ title: "Fila de processamento — DocIntel" }] }),
});

function Queue() {
  const { data } = useQuery({
    queryKey: ["queue-docs"],
    queryFn: async () => (await supabase.from("documents").select("id,file_name,status,created_at,error_message").in("status", ["queued","processing","failed"]).order("created_at", { ascending: false })).data || [],
    refetchInterval: 5000,
  });
  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Fila de processamento" description="Documentos em fila, em processamento ou com falha." />
      {!data?.length ? <EmptyState icon={ListChecks} title="Fila vazia" description="Nenhum documento aguardando ou com erro." /> : (
        <Card className="gradient-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-2.5 font-medium">Arquivo</th><th className="text-left px-4 py-2.5 font-medium">Status</th><th className="text-left px-4 py-2.5 font-medium">Data</th><th className="text-left px-4 py-2.5 font-medium">Erro</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2.5">{d.file_name}</td>
                  <td className="px-4 py-2.5"><Badge variant={d.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">{statusLabel[d.status] || d.status}</Badge></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-2.5 text-xs text-destructive">{d.error_message || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
