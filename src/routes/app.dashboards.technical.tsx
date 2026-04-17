import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, KpiCard } from "@/components/dashboard-bits";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter } from "recharts";
import { Wrench, Zap, Snowflake } from "lucide-react";

export const Route = createFileRoute("/app/dashboards/technical")({
  component: Tech,
  head: () => ({ meta: [{ title: "Painel técnico — DocIntel" }] }),
});

function Tech() {
  const { data } = useQuery({
    queryKey: ["dash-tech"],
    queryFn: async () => {
      const [{ data: e }, { data: p }] = await Promise.all([
        supabase.from("equipments").select("*"),
        supabase.from("proposals").select("dados_tecnicos,valor_total"),
      ]);
      return { equips: e || [], props: p || [] };
    },
  });

  const totalEquips = data?.equips.length || 0;
  const avgHp = data?.equips.length ? data.equips.reduce((s, e: any) => s + (Number(e.potencia_hp) || 0), 0) / data.equips.length : 0;
  const avgKcal = data?.props.length ? data.props.reduce((s, p: any) => s + (Number(p.dados_tecnicos?.carga_termica_kcal) || 0), 0) / data.props.length : 0;

  const cargaVsValor = (data?.props || [])
    .filter((p: any) => p.dados_tecnicos?.carga_termica_kcal && p.valor_total)
    .map((p: any) => ({ carga: Number(p.dados_tecnicos.carga_termica_kcal), valor: Number(p.valor_total) }));

  const byCamara: Record<string, number> = {};
  (data?.props || []).forEach((p: any) => {
    const t = p.dados_tecnicos?.tipo_camara;
    if (t) byCamara[t] = (byCamara[t] || 0) + 1;
  });
  const camaraData = Object.entries(byCamara).map(([k, v]) => ({ k, v }));

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Painel técnico" description="Cargas térmicas, equipamentos e correlações." />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="Equipamentos" value={totalEquips} icon={Wrench} />
        <KpiCard label="HP médio" value={avgHp.toFixed(1)} icon={Zap} />
        <KpiCard label="Carga térmica média" value={`${avgKcal.toFixed(0)} kcal/h`} icon={Snowflake} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5 gradient-surface border-border">
          <h3 className="font-medium text-sm mb-4">Tipos de câmara</h3>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={camaraData}>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
              <XAxis dataKey="k" stroke="oklch(0.66 0.012 260)" fontSize={11} />
              <YAxis stroke="oklch(0.66 0.012 260)" fontSize={11} />
              <Tooltip contentStyle={tt} />
              <Bar dataKey="v" fill="oklch(0.65 0.20 250)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer></div>
        </Card>
        <Card className="p-5 gradient-surface border-border">
          <h3 className="font-medium text-sm mb-4">Carga térmica × Valor</h3>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} />
              <XAxis dataKey="carga" name="kcal/h" stroke="oklch(0.66 0.012 260)" fontSize={11} />
              <YAxis dataKey="valor" name="R$" stroke="oklch(0.66 0.012 260)" fontSize={11} tickFormatter={(v)=>`${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tt} />
              <Scatter data={cargaVsValor} fill="oklch(0.68 0.17 152)" />
            </ScatterChart>
          </ResponsiveContainer></div>
        </Card>
      </div>
    </div>
  );
}

const tt = { background: "oklch(0.19 0.006 260)", border: "1px solid oklch(0.27 0.008 260)", borderRadius: 8, fontSize: 12 };
