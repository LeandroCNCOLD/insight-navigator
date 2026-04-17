import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Users } from "lucide-react";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/app/clients")({
  component: Clients,
  head: () => ({ meta: [{ title: "Clientes — DocIntel" }] }),
});

function Clients() {
  const { data } = useQuery({
    queryKey: ["clients-with-stats"],
    queryFn: async () => {
      const { data: clients } = await supabase.from("clients").select("*").order("nome");
      const { data: props } = await supabase.from("proposals").select("client_id,valor_total");
      const stats: Record<string, { count: number; total: number }> = {};
      (props || []).forEach((p) => {
        if (!p.client_id) return;
        stats[p.client_id] = stats[p.client_id] || { count: 0, total: 0 };
        stats[p.client_id].count++;
        stats[p.client_id].total += Number(p.valor_total) || 0;
      });
      return (clients || []).map((c) => ({ ...c, stats: stats[c.id] || { count: 0, total: 0 } }));
    },
  });

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Clientes" description={`${data?.length || 0} clientes mapeados`} />
      {!data?.length ? <EmptyState icon={Users} title="Sem clientes" description="Os clientes serão criados automaticamente conforme a IA processa propostas." /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((c) => (
            <Card key={c.id} className="p-5 gradient-surface border-border hover:border-primary/40 transition-colors">
              <div className="font-medium">{c.nome}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.cidade || "—"}{c.estado ? `/${c.estado}` : ""} · {c.segmento || "—"}</div>
              <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-border">
                <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Propostas</div><div className="text-lg font-mono font-semibold">{c.stats.count}</div></div>
                <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div><div className="text-lg font-mono font-semibold">{formatBRL(c.stats.total)}</div></div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
