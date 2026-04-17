import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, KpiCard } from "@/components/dashboard-bits";
import { ShieldCheck, Calendar, Truck } from "lucide-react";

export const Route = createFileRoute("/app/dashboards/contractual")({
  component: Contract,
  head: () => ({ meta: [{ title: "Painel contratual — DocIntel" }] }),
});

function Contract() {
  const { data } = useQuery({
    queryKey: ["dash-contract"],
    queryFn: async () => (await supabase.from("proposals").select("garantia_meses,prazo_entrega_dias,frete_tipo,frete_incluso,instalacao_inclusa,garantia_limitacoes")).data || [],
  });

  const avgGar = data?.length ? data.reduce((s, p: any) => s + (Number(p.garantia_meses) || 0), 0) / data.length : 0;
  const avgPrazo = data?.length ? data.reduce((s, p: any) => s + (Number(p.prazo_entrega_dias) || 0), 0) / data.length : 0;
  const fob = (data || []).filter((p: any) => p.frete_tipo?.toUpperCase().includes("FOB")).length;
  const cif = (data || []).filter((p: any) => p.frete_tipo?.toUpperCase().includes("CIF")).length;

  const limitacoes: Record<string, number> = {};
  (data || []).forEach((p: any) => { if (p.garantia_limitacoes) limitacoes[p.garantia_limitacoes] = (limitacoes[p.garantia_limitacoes] || 0) + 1; });
  const topLim = Object.entries(limitacoes).sort((a,b)=>b[1]-a[1]).slice(0,8);

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Painel contratual" description="Garantias, prazos, frete e cláusulas." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Garantia média" value={`${avgGar.toFixed(0)} meses`} icon={ShieldCheck} />
        <KpiCard label="Prazo entrega médio" value={`${avgPrazo.toFixed(0)} dias`} icon={Calendar} />
        <KpiCard label="FOB" value={fob} icon={Truck} />
        <KpiCard label="CIF" value={cif} icon={Truck} />
      </div>
      <Card className="p-5 gradient-surface border-border">
        <h3 className="font-medium text-sm mb-4">Limitações de garantia mais recorrentes</h3>
        {topLim.length === 0 ? <div className="text-sm text-muted-foreground">Sem dados.</div> : (
          <ul className="space-y-2">
            {topLim.map(([k, n]) => (
              <li key={k} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">{n}×</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
