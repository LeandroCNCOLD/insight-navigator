import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Factory,
  MapPinned,
  Search,
  Snowflake,
  Wrench,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/dashboard-bits";
import { fetchEquipmentIntelligenceData } from "@/lib/equipment-intelligence";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/app/equipments")({
  component: EquipmentsIntelligencePage,
  head: () => ({
    meta: [{ title: "Equipment Intelligence â DocIntel" }],
  }),
});

function EquipmentsIntelligencePage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["equipment-intelligence"],
    queryFn: fetchEquipmentIntelligenceData,
  });

  const filteredRows = useMemo(() => {
    const rows = data?.rows || [];
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();

    return rows.filter((row) =>
      [
        row.tipo,
        row.modelo,
        row.gas_refrigerante,
        row.compressor,
        row.proposal?.numero,
        row.proposal?.client?.nome,
        row.proposal?.client?.estado,
        row.proposal?.competitor?.nome,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [data?.rows, search]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando inteligÃªncia de equipamentos...</div>;
  }

  if (!data || !data.rows.length) {
    return (
      <div className="p-6">
        <PageHeader
          title="Equipment Intelligence"
          description="PadrÃµes tÃ©cnicos, concentraÃ§Ã£o regional e leitura analÃ­tica da base de equipamentos."
        />
        <EmptyState
          icon={Wrench}
          title="Sem equipamentos estruturados"
          description="Envie documentos e gere propostas com equipamentos para ativar este mÃ³dulo."
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
        title="Equipment Intelligence"
        description="Motor analÃ­tico para padrÃµes tÃ©cnicos, distribuiÃ§Ã£o, recorrÃªncia e benchmarking de equipamentos."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Registros estruturados" value={String(data.totalRows)} icon={Wrench} />
        <MetricCard label="Qtd. total de equipamentos" value={String(data.totalEquipments)} icon={Snowflake} />
        <MetricCard label="HP total" value={String(data.totalHp)} icon={Factory} />
        <MetricCard label="Capacidade total kcal/h" value={String(data.totalKcal)} icon={BarChart3} />
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por modelo, proposta, cliente, estado, concorrente, gÃ¡s, compressor..."
            className="pl-9"
          />
        </div>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">VisÃ£o Geral</TabsTrigger>
          <TabsTrigger value="patterns">PadrÃµes TÃ©cnicos</TabsTrigger>
          <TabsTrigger value="regions">RegiÃµes e Concorrentes</TabsTrigger>
          <TabsTrigger value="proposals">Por Proposta</TabsTrigger>
          <TabsTrigger value="catalog">CatÃ¡logo AnalÃ­tico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Top modelos mais usados" data={data.topModels} dataKey="value" nameKey="label" />
            <ChartCard title="Top gases refrigerantes" data={data.topGases} dataKey="value" nameKey="label" />
            <ChartCard title="Top tipos de compressor" data={data.topCompressors} dataKey="value" nameKey="label" />
            <ChartCard title="Top estados por equipamentos" data={data.byState} dataKey="value" nameKey="label" />
          </div>
        </TabsContent>

        <TabsContent value="patterns">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Combos tÃ©cnicos mais recorrentes" data={data.topTechnicalCombos} dataKey="value" nameKey="label" />
            <Card className="p-5">
              <div className="mb-4 text-lg font-semibold">Insights automÃ¡ticos</div>
              <div className="space-y-3">
                {data.insights.map((insight, idx) => (
                  <div key={idx} className="rounded-lg border p-3 text-sm">
                    {insight}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="regions">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="ConcentraÃ§Ã£o por estado" data={data.byState} dataKey="value" nameKey="label" />
            <ChartCard title="ConcentraÃ§Ã£o por concorrente" data={data.byCompetitor} dataKey="value" nameKey="label" />
          </div>
        </TabsContent>

        <TabsContent value="proposals">
          <Card className="p-5">
            <div className="mb-4 text-lg font-semibold">Resumo tÃ©cnico por proposta</div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Proposta</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">UF</th>
                    <th className="px-4 py-3 font-medium">Concorrente</th>
                    <th className="px-4 py-3 font-medium">Qtd.</th>
                    <th className="px-4 py-3 font-medium">HP total</th>
                    <th className="px-4 py-3 font-medium">kcal/h total</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.proposals.map((item) => (
                    <tr key={item.proposalId}>
                      <td className="border-t px-4 py-3">{item.numero}</td>
                      <td className="border-t px-4 py-3">{item.cliente}</td>
                      <td className="border-t px-4 py-3">{item.estado}</td>
                      <td className="border-t px-4 py-3">{item.concorrente}</td>
                      <td className="border-t px-4 py-3">{item.totalEquipments}</td>
                      <td className="border-t px-4 py-3">{item.totalHp}</td>
                      <td className="border-t px-4 py-3">{item.totalKcal}</td>
                      <td className="border-t px-4 py-3">{formatBRL(item.valueTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="catalog">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold">CatÃ¡logo analÃ­tico de equipamentos</div>
              <Badge variant="secondary">{filteredRows.length}</Badge>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Modelo / Tipo</th>
                    <th className="px-4 py-3 font-medium">Qtd.</th>
                    <th className="px-4 py-3 font-medium">HP</th>
                    <th className="px-4 py-3 font-medium">kcal/h</th>
                    <th className="px-4 py-3 font-medium">GÃ¡s</th>
                    <th className="px-4 py-3 font-medium">Compressor</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">UF</th>
                    <th className="px-4 py-3 font-medium">Concorrente</th>
                    <th className="px-4 py-3 font-medium">Proposta</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border-t px-4 py-3">{row.modelo || row.tipo || "â"}</td>
                      <td className="border-t px-4 py-3">{row.quantidade || 1}</td>
                      <td className="border-t px-4 py-3">{row.potencia_hp || "â"}</td>
                      <td className="border-t px-4 py-3">{row.capacidade_kcal || "â"}</td>
                      <td className="border-t px-4 py-3">{row.gas_refrigerante || "â"}</td>
                      <td className="border-t px-4 py-3">{row.compressor || "â"}</td>
                      <td className="border-t px-4 py-3">{row.proposal?.client?.nome || "â"}</td>
                      <td className="border-t px-4 py-3">{row.proposal?.client?.estado || "â"}</td>
                      <td className="border-t px-4 py-3">{row.proposal?.competitor?.nome || "â"}</td>
                      <td className="border-t px-4 py-3">{row.proposal?.numero || "â"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
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
          <div className="mt-1 text-2xl font-semibold">{value || "â"}</div>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </Card>
  );
}

function ChartCard({
  title,
  data,
  dataKey,
  nameKey,
}: {
  title: string;
  data: Array<Record<string, any>>;
  dataKey: string;
  nameKey: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <MapPinned className="h-5 w-5" />
        {title}
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 12 }} angle={-18} textAnchor="end" height={70} />
            <YAxis />
            <Tooltip />
            <Bar dataKey={dataKey} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
