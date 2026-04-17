import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard-bits";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/app/dashboards/geographic")({
  component: Geo,
  head: () => ({ meta: [{ title: "Painel geográfico — DocIntel" }] }),
});

function Geo() {
  const { data } = useQuery({
    queryKey: ["dash-geo"],
    queryFn: async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("clients").select("estado,cidade"),
        supabase.from("proposals").select("valor_total,client:clients(estado,cidade)"),
      ]);
      return { clients: c || [], props: p || [] };
    },
  });

  const stateClients: Record<string, number> = {};
  (data?.clients || []).forEach((c: any) => { if (c.estado) stateClients[c.estado] = (stateClients[c.estado] || 0) + 1; });
  const stateValue: Record<string, number> = {};
  (data?.props || []).forEach((p: any) => { const e = p.client?.estado; if (e) stateValue[e] = (stateValue[e] || 0) + (Number(p.valor_total)||0); });

  const cityValue: Record<string, number> = {};
  (data?.props || []).forEach((p: any) => { const c = p.client?.cidade; if (c) cityValue[c] = (cityValue[c] || 0) + (Number(p.valor_total)||0); });

  const sd = Object.entries(stateClients).map(([k,v])=>({ k, v })).sort((a,b)=>b.v-a.v);
  const sv = Object.entries(stateValue).map(([k,v])=>({ k, v })).sort((a,b)=>b.v-a.v);
  const cv = Object.entries(cityValue).map(([k,v])=>({ k, v })).sort((a,b)=>b.v-a.v).slice(0,10);

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Painel geográfico" description="Concentração de clientes e valores por região." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Chart title="Clientes por estado" data={sd} fill="oklch(0.65 0.20 250)" />
        <Chart title="Valor por estado" data={sv} fill="oklch(0.68 0.17 152)" money />
      </div>
      <Chart title="Top 10 cidades por valor" data={cv} fill="oklch(0.78 0.15 75)" money />
    </div>
  );
}

function Chart({ title, data, fill, money }: { title: string; data: { k: string; v: number }[]; fill: string; money?: boolean }) {
  return (
    <Card className="p-5 gradient-surface border-border">
      <h3 className="font-medium text-sm mb-4">{title}</h3>
      <div className="h-72"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
          <XAxis type="number" stroke="oklch(0.66 0.012 260)" fontSize={11} tickFormatter={money ? (v)=>`${(v/1000).toFixed(0)}k` : undefined} />
          <YAxis type="category" dataKey="k" stroke="oklch(0.66 0.012 260)" fontSize={11} width={80} />
          <Tooltip contentStyle={{ background: "oklch(0.19 0.006 260)", border: "1px solid oklch(0.27 0.008 260)", borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="v" fill={fill} radius={[0,4,4,0]} />
        </BarChart>
      </ResponsiveContainer></div>
    </Card>
  );
}
