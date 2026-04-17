import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, KpiCard } from "@/components/dashboard-bits";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { formatBRL } from "@/lib/format";
import { DollarSign, TrendingUp, FileText, Trophy } from "lucide-react";

export const Route = createFileRoute("/app/dashboards/commercial")({
  component: Dash,
  head: () => ({ meta: [{ title: "Painel comercial — DocIntel" }] }),
});

const COLORS = ["oklch(0.65 0.20 250)", "oklch(0.68 0.17 152)", "oklch(0.78 0.15 75)", "oklch(0.66 0.20 320)", "oklch(0.70 0.18 195)"];

function Dash() {
  const { data } = useQuery({
    queryKey: ["dash-commercial"],
    queryFn: async () => {
      const { data: props } = await supabase.from("proposals").select("*,client:clients(nome,estado)");
      return props || [];
    },
  });

  const total = (data || []).reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  const ticket = data?.length ? total / data.length : 0;
  const contratadas = (data || []).filter((p) => p.status_proposta?.toLowerCase().includes("contrat")).length;

  const byState: Record<string, number> = {};
  const byClient: Record<string, number> = {};
  const byPay: Record<string, number> = {};
  (data || []).forEach((p: any) => {
    const v = Number(p.valor_total) || 0;
    if (p.client?.estado) byState[p.client.estado] = (byState[p.client.estado] || 0) + v;
    if (p.client?.nome) byClient[p.client.nome] = (byClient[p.client.nome] || 0) + v;
    if (p.condicao_pagamento) byPay[p.condicao_pagamento] = (byPay[p.condicao_pagamento] || 0) + 1;
  });
  const stateData = Object.entries(byState).map(([k, v]) => ({ k, v })).sort((a,b)=>b.v-a.v).slice(0,8);
  const clientData = Object.entries(byClient).map(([k, v]) => ({ k, v })).sort((a,b)=>b.v-a.v).slice(0,8);
  const payData = Object.entries(byPay).map(([name, value]) => ({ name, value })).slice(0,5);

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Painel comercial" description="Valores, tickets e ranking de clientes/estados." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Propostas" value={data?.length || 0} icon={FileText} />
        <KpiCard label="Valor mapeado" value={formatBRL(total)} icon={DollarSign} />
        <KpiCard label="Ticket médio" value={formatBRL(ticket)} icon={TrendingUp} />
        <KpiCard label="Contratadas" value={contratadas} icon={Trophy} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Ranking por estado">
          <BarChart data={stateData} layout="vertical">
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
            <XAxis type="number" stroke="oklch(0.66 0.012 260)" fontSize={11} tickFormatter={(v)=>`${(v/1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="k" stroke="oklch(0.66 0.012 260)" fontSize={11} width={32} />
            <Tooltip contentStyle={tt} formatter={(v)=>formatBRL(Number(v))} />
            <Bar dataKey="v" fill="oklch(0.65 0.20 250)" radius={[0,4,4,0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Ranking por cliente">
          <BarChart data={clientData} layout="vertical">
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
            <XAxis type="number" stroke="oklch(0.66 0.012 260)" fontSize={11} tickFormatter={(v)=>`${(v/1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="k" stroke="oklch(0.66 0.012 260)" fontSize={10} width={120} />
            <Tooltip contentStyle={tt} formatter={(v)=>formatBRL(Number(v))} />
            <Bar dataKey="v" fill="oklch(0.68 0.17 152)" radius={[0,4,4,0]} />
          </BarChart>
        </ChartCard>
      </div>
      <ChartCard title="Formas de pagamento mais frequentes">
        <PieChart>
          <Pie data={payData} dataKey="value" nameKey="name" outerRadius={90} label>
            {payData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={tt} />
          <Legend />
        </PieChart>
      </ChartCard>
    </div>
  );
}

const tt = { background: "oklch(0.19 0.006 260)", border: "1px solid oklch(0.27 0.008 260)", borderRadius: 8, fontSize: 12 };

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card className="p-5 gradient-surface border-border">
      <h3 className="font-medium text-sm mb-4">{title}</h3>
      <div className="h-72"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </Card>
  );
}
