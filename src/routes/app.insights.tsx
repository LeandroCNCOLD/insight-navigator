import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Brain,
  Building2,
  FileSearch,
  Gauge,
  Globe2,
  Lightbulb,
  ShieldAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { fetchInsightRadarData } from "@/lib/insight-radar";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/app/insights")({
  component: InsightRadarPage,
  head: () => ({
    meta: [{ title: "Insight Radar — DocIntel" }],
  }),
});

function InsightRadarPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["insight-radar"],
    queryFn: fetchInsightRadarData,
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando radar de insights...</div>;
  }

  if (!data || !data.totalProposals) {
    return (
      <div className="p-6">
        <PageHeader
          title="Insight Radar"
          subtitle="Padrões, alertas e achados automáticos da base"
        />
        <EmptyState
          icon={Lightbulb}
          title="Sem base suficiente para gerar insights"
          subtitle="Envie documentos e consolide propostas para ativar o radar."
          action={
            <Link to="/app/upload">
              <Button>Ir para upload</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Insight Radar"
        subtitle="Leitura automática da base com padrões, alertas e anomalias"
        actions={
          <div className="flex gap-2">
            <Link to="/app/chat">
              <Button variant="outline">
                <Brain className="mr-2 h-4 w-4" />
                Abrir Intelligence Brain
              </Button>
            </Link>
            <Link to="/app/compare">
              <Button variant="outline">
                <FileSearch className="mr-2 h-4 w-4" />
                Benchmark
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total de propostas" value={String(data.totalProposals)} icon={Building2} />
        <MetricCard label="Valor total mapeado" value={formatBRL(data.totalValue)} icon={Gauge} />
        <MetricCard label="Qtd. total de equipamentos" value={String(data.totalEquipments)} icon={Globe2} />
        <MetricCard
          label="Confiança média"
          value={`${Math.round(data.avgConfidence * 100)}%`}
          icon={ShieldAlert}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top concorrentes por proposta" data={data.byCompetitor} />
        <ChartCard title="Top estados por proposta" data={data.byState} />
        <ChartCard title="Top modelos" data={data.byModel} />
        <ChartCard title="Top gases refrigerantes" data={data.byGas} />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Lightbulb className="h-5 w-5" />
          Insights automáticos
        </div>

        <div className="space-y-4">
          {data.insights.map((insight) => (
            <div
              key={insight.id}
              className={`rounded-xl border p-4 ${
                insight.severity === "high"
                  ? "border-destructive/30 bg-destructive/5"
                  : insight.severity === "medium"
                    ? "border-primary/20 bg-primary/5"
                    : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{labelForCategory(insight.category)}</Badge>
                <Badge variant={variantForSeverity(insight.severity) as any}>
                  {labelForSeverity(insight.severity)}
                </Badge>
                {insight.metricLabel && insight.metricValue ? (
                  <Badge variant="outline">
                    {insight.metricLabel}: {insight.metricValue}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-3 text-lg font-semibold">{insight.title}</div>
              <div className="mt-2 text-sm text-muted-foreground">{insight.description}</div>

              {insight.evidence?.length ? (
                <div className="mt-3 space-y-2">
                  {insight.evidence.map((item, idx) => (
                    <div key={idx} className="rounded-md border bg-background p-2 text-sm">
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <ProposalListCard
          title="Top propostas por valor"
          items={data.topValueProposals.map((item) => ({
            id: item.id,
            title: `${item.client?.nome || "Cliente"} · ${item.numero || "sem nº"}`,
            subtitle: `${item.competitor?.nome || "Concorrente"} · ${item.client?.estado || "UF"}`,
            value: formatBRL(item.valor_total || 0),
            documentId: undefined,
          }))}
        />

        <ProposalListCard
          title="Menor confiança"
          items={data.lowestConfidenceProposals.map((item) => ({
            id: item.id,
            title: `${item.client?.nome || "Cliente"} · ${item.numero || "sem nº"}`,
            subtitle: `${item.competitor?.nome || "Concorrente"} · ${item.client?.estado || "UF"}`,
            value: `${Math.round((item.score_confianca || 0) * 100)}%`,
            documentId: undefined,
          }))}
          warn
        />

        <ProposalListCard
          title="Maior HP total"
          items={data.highestHpProposals.map((item) => ({
            id: item.id,
            title: `${item.client?.nome || "Cliente"} · ${item.numero || "sem nº"}`,
            subtitle: `${item.competitor?.nome || "Concorrente"} · ${item.client?.estado || "UF"}`,
            value: `${item.totalHp} HP`,
            documentId: undefined,
          }))}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: any;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </Card>
  );
}

function ChartCard({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 text-lg font-semibold">{title}</div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} angle={-18} textAnchor="end" height={70} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ProposalListCard({
  title,
  items,
  warn,
}: {
  title: string;
  items: Array<{ id: string; title: string; subtitle: string; value: string; documentId?: string }>;
  warn?: boolean;
}) {
  return (
    <Card className={`p-5 ${warn ? "border-destructive/20" : ""}`}>
      <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
        {warn ? <AlertTriangle className="h-5 w-5" /> : <FileSearch className="h-5 w-5" />}
        {title}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border p-3">
            <div className="font-medium">{item.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{item.subtitle}</div>
            <div className="mt-2 text-sm font-semibold">{item.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function labelForCategory(category: string) {
  switch (category) {
    case "commercial":
      return "Comercial";
    case "technical":
      return "Técnico";
    case "regional":
      return "Regional";
    case "competitor":
      return "Concorrente";
    case "risk":
      return "Risco";
    case "quality":
      return "Qualidade";
    default:
      return category;
  }
}

function labelForSeverity(severity: string) {
  switch (severity) {
    case "high":
      return "Alta";
    case "medium":
      return "Média";
    case "low":
      return "Baixa";
    default:
      return severity;
  }
}

function variantForSeverity(severity: string) {
  switch (severity) {
    case "high":
      return "destructive";
    case "medium":
      return "default";
    case "low":
      return "secondary";
    default:
      return "secondary";
  }
}
