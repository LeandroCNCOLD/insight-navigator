import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, KpiCard, EmptyState } from "@/components/dashboard-bits";
import { ArrowLeft, Building2, FileText, Wrench, Snowflake, Zap } from "lucide-react";
import { formatBRL, formatDate, statusLabel } from "@/lib/format";

export const Route = createFileRoute("/app/competitors/$nome")({
  component: CompetitorDetail,
  head: ({ params }) => ({
    meta: [{ title: `${decodeURIComponent(params.nome)} — Pasta do fabricante` }],
  }),
});

function CompetitorDetail() {
  const { nome: rawNome } = Route.useParams();
  const nome = decodeURIComponent(rawNome);

  const { data, isLoading } = useQuery({
    queryKey: ["competitor-folder", nome],
    queryFn: async () => {
      const { data: comp } = await supabase
        .from("competitors")
        .select("*")
        .ilike("nome", nome)
        .maybeSingle();

      if (!comp) return { competitor: null, docs: [], proposals: [], equips: [] };

      const { data: docs } = await supabase
        .from("documents")
        .select("id,file_name,file_type,status,created_at,client:clients(nome,estado)")
        .eq("competitor_id", comp.id)
        .order("created_at", { ascending: false });

      const { data: proposals } = await supabase
        .from("proposals")
        .select("id,valor_total,dados_tecnicos,document_id,client:clients(nome)")
        .eq("competitor_id", comp.id);

      const proposalIds = (proposals || []).map((p) => p.id);
      const { data: equips } = proposalIds.length
        ? await supabase.from("equipments").select("*").in("proposal_id", proposalIds)
        : { data: [] as any[] };

      return { competitor: comp, docs: docs || [], proposals: proposals || [], equips: equips || [] };
    },
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando pasta…</div>;
  }
  if (!data?.competitor) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Building2}
          title="Fabricante não encontrado"
          description={`Nenhum fabricante cadastrado com o nome "${nome}".`}
          action={
            <Link to="/app/competitors">
              <Button variant="outline">Voltar para concorrentes</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const docs = data.docs;
  const proposals = data.proposals;
  const equips = data.equips;

  const totalValor = proposals.reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0);
  const avgKcal =
    proposals.length > 0
      ? proposals.reduce(
          (s: number, p: any) => s + (Number(p.dados_tecnicos?.carga_termica_kcal) || 0),
          0,
        ) / proposals.length
      : 0;
  const avgHp =
    equips.length > 0
      ? equips.reduce((s: number, e: any) => s + (Number(e.potencia_hp) || 0), 0) / equips.length
      : 0;

  // Padrões técnicos da marca
  const gases: Record<string, number> = {};
  const compressores: Record<string, number> = {};
  const tipos: Record<string, number> = {};
  const isolamentos: Record<string, number> = {};
  equips.forEach((e: any) => {
    if (e.gas_refrigerante) gases[e.gas_refrigerante] = (gases[e.gas_refrigerante] || 0) + 1;
    if (e.compressor) compressores[e.compressor] = (compressores[e.compressor] || 0) + 1;
    if (e.tipo) tipos[e.tipo] = (tipos[e.tipo] || 0) + 1;
  });
  proposals.forEach((p: any) => {
    const iso = p.dados_tecnicos?.isolamento_tipo || p.dados_tecnicos?.isolamento;
    if (iso) isolamentos[iso] = (isolamentos[iso] || 0) + 1;
  });

  const top = (m: Record<string, number>, n = 4) =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title={data.competitor.nome}
        description={data.competitor.descricao || "Pasta do fabricante — documentos, padrões técnicos e KPIs"}
        action={
          <Link to="/app/competitors">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-4 mr-2" />
              Concorrentes
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Documentos" value={docs.length} icon={FileText} />
        <KpiCard label="Propostas extraídas" value={proposals.length} icon={Wrench} />
        <KpiCard label="Valor total ofertado" value={formatBRL(totalValor)} icon={Zap} />
        <KpiCard label="Carga térmica média" value={`${avgKcal.toFixed(0)} kcal/h`} icon={Snowflake} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <PatternCard title="Gases refrigerantes" items={top(gases)} empty="Sem dados de gás" />
        <PatternCard title="Compressores" items={top(compressores)} empty="Sem dados de compressor" />
        <PatternCard title="Tipos de instalação" items={top(tipos)} empty="Sem dados de tipo" />
        <PatternCard title="Isolamentos" items={top(isolamentos)} empty="Sem dados de isolamento" />
      </div>

      <Card className="gradient-surface border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-medium">Documentos do fabricante</div>
          <div className="text-xs text-muted-foreground">HP médio · {avgHp.toFixed(1)}</div>
        </div>
        {docs.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum documento vinculado a este fabricante ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Arquivo</th>
                <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Data</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((d: any) => (
                <tr key={d.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/app/documents/$id"
                      params={{ id: d.id }}
                      className="flex items-center gap-2 hover:text-primary"
                    >
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span className="truncate max-w-md">{d.file_name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.client?.nome || "—"}</td>
                  <td className="px-4 py-2.5 uppercase text-xs">{d.file_type}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={
                        d.status === "extracted"
                          ? "default"
                          : d.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {statusLabel[d.status] || d.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function PatternCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: [string, number][];
  empty: string;
}) {
  return (
    <Card className="p-5 gradient-surface border-border">
      <div className="text-sm font-medium mb-3">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">{empty}</div>
      ) : (
        <div className="space-y-2">
          {items.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="truncate">{k}</span>
              <Badge variant="secondary" className="text-[10px]">
                {v}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
