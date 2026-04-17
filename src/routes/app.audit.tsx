import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/audit")({
  component: Audit,
  head: () => ({ meta: [{ title: "Auditoria — DocIntel" }] }),
});

function Audit() {
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200)).data || [],
  });
  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Auditoria" description="Trilha de alterações e operações da plataforma." />
      {!data?.length ? <EmptyState icon={ShieldCheck} title="Sem registros de auditoria" /> : (
        <Card className="gradient-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-2.5 font-medium">Quando</th><th className="text-left px-4 py-2.5 font-medium">Ação</th><th className="text-left px-4 py-2.5 font-medium">Entidade</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(l.created_at)}</td>
                  <td className="px-4 py-2.5">{l.acao}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.entidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
