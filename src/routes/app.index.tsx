import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard, PageHeader } from "@/components/dashboard-bits";
import { FileText, DollarSign, Users, Building2, TrendingUp } from "lucide-react";
import { formatBRL, formatNumber } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { OriginFilter, type OriginValue } from "@/components/origin-filter";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — DocIntel" }] }),
});

function Dashboard() {
  const [origin, setOrigin] = useState<OriginValue>("all");
  const { data } = useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const [docs, props, clients, comps, equips, recent] = await Promise.all([
        supabase.from("documents").select("id,status,competitor:competitors(is_house)"),
        supabase.from("proposals").select("id,valor_total,data_proposta,status_proposta,competitor_id,client_id,competitor:competitors(is_house)"),
        supabase.from("clients").select("id,estado", { count: "exact" }),
        supabase.from("competitors").select("id", { count: "exact" }),
        supabase.from("equipments").select("id", { count: "exact" }),
        supabase.from("documents").select("id,file_name,status,created_at,competitor:competitors(nome,is_house)").order("created_at", { ascending: false }).limit(8),
      ]);
      return { docs, props, clients, comps, equips, recent };
    },
  });

  const isHouse = (r: any) => !!r?.competitor?.is_house;
  const matchesOrigin = (r: any) => origin === "all" || (origin === "house" ? isHouse(r) : !isHouse(r));

  const allDocs = data?.docs.data || [];
  const allProps = data?.props.data || [];
  const allRecent = data?.recent.data || [];

  const counts = useMemo(() => ({
    all: allProps.length,
    house: allProps.filter(isHouse).length,
    rival: allProps.filter((r) => !isHouse(r)).length,
  }), [allProps]);

  const filteredDocs = allDocs.filter(matchesOrigin);
  const filteredProps = allProps.filter(matchesOrigin);
  const filteredRecent = allRecent.filter(matchesOrigin);

  const totalValor = filteredProps.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  const ticket = filteredProps.length ? totalValor / filteredProps.length : 0;

  const monthly: Record<string, number> = {};
  filteredProps.forEach((p: any) => {
    if (!p.data_proposta) return;
    const k = p.data_proposta.slice(0, 7);
    monthly[k] = (monthly[k] || 0) + (Number(p.valor_total) || 0);
  });
  const monthlyData = Object.entries(monthly).sort().slice(-12).map(([k, v]) => ({ mes: k, valor: v }));

  const byState: Record<string, number> = {};
  (data?.clients.data || []).forEach((c) => { if (c.estado) byState[c.estado] = (byState[c.estado] || 0) + 1; });
  const stateData = Object.entries(byState).map(([estado, n]) => ({ estado, n })).sort((a, b) => b.n - a.n).slice(0, 8);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visão consolidada da inteligência competitiva."
        action={<OriginFilter value={origin} onChange={setOrigin} counts={counts} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Documentos" value={formatNumber(filteredDocs.length)} icon={FileText} />
        <KpiCard label="Propostas" value={formatNumber(filteredProps.length)} icon={FileText} />
        <KpiCard label="Valor mapeado" value={formatBRL(totalValor)} icon={DollarSign} />
        <KpiCard label="Ticket médio" value={formatBRL(ticket)} icon={TrendingUp} />
        <KpiCard label="Clientes" value={formatNumber(data?.clients.count || 0)} icon={Users} />
        <KpiCard label="Concorrentes" value={formatNumber(data?.comps.count || 0)} icon={Building2} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 gradient-surface border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-sm">Evolução de valor mapeado</h3>
              <p className="text-xs text-muted-foreground">Últimos 12 meses {origin !== "all" && `· ${origin === "house" ? "CN Cold" : "Concorrentes"}`}</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                <XAxis dataKey="mes" stroke="oklch(0.66 0.012 260)" fontSize={11} />
                <YAxis stroke="oklch(0.66 0.012 260)" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "oklch(0.19 0.006 260)", border: "1px solid oklch(0.27 0.008 260)", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatBRL(Number(v))} />
                <Line type="monotone" dataKey="valor" stroke="oklch(0.65 0.20 250)" strokeWidth={2} dot={{ fill: "oklch(0.65 0.20 250)", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 gradient-surface border-border">
          <h3 className="font-medium text-sm mb-1">Top estados (clientes)</h3>
          <p className="text-xs text-muted-foreground mb-4">Concentração geográfica</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateData} layout="vertical">
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
                <XAxis type="number" stroke="oklch(0.66 0.012 260)" fontSize={11} />
                <YAxis type="category" dataKey="estado" stroke="oklch(0.66 0.012 260)" fontSize={11} width={32} />
                <Tooltip contentStyle={{ background: "oklch(0.19 0.006 260)", border: "1px solid oklch(0.27 0.008 260)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="n" fill="oklch(0.65 0.20 250)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="gradient-surface border-border overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-medium text-sm">Documentos recentes</h3>
            <p className="text-xs text-muted-foreground">Últimos uploads e processamentos</p>
          </div>
          <Link to="/app/documents" className="text-xs text-primary hover:underline">Ver todos →</Link>
        </div>
        <div className="divide-y divide-border">
          {filteredRecent.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum documento ainda. <Link to="/app/upload" className="text-primary hover:underline">Faça upload do primeiro</Link>.
            </div>
          )}
          {filteredRecent.map((d: any) => (
            <Link key={d.id} to="/app/documents/$id" params={{ id: d.id }} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30">
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{d.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {d.competitor?.is_house ? <span className="text-success">CN Cold</span> : (d.competitor?.nome || "—")} · {new Date(d.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <Badge variant={d.status === "extracted" ? "default" : d.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">{d.status}</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
