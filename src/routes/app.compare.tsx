import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  FileSearch,
  GitCompare,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/dashboard-bits";
import {
  buildBenchmarkInsights,
  buildEquipmentRows,
  buildExecutiveRows,
  buildTechnicalRows,
  equipmentMetrics,
  fetchCompareCandidates,
  fetchProposalCompareDetail,
  type ProposalCompareCandidate,
} from "@/lib/proposal-benchmark";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/compare")({
  component: ComparePage,
  head: () => ({
    meta: [{ title: "Benchmark de Propostas — DocIntel" }],
  }),
});

function ComparePage() {
  const [search, setSearch] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const candidatesQuery = useQuery({
    queryKey: ["compare-candidates"],
    queryFn: fetchCompareCandidates,
  });

  const aQuery = useQuery({
    queryKey: ["compare-detail", a],
    queryFn: () => fetchProposalCompareDetail(a),
    enabled: Boolean(a),
  });

  const bQuery = useQuery({
    queryKey: ["compare-detail", b],
    queryFn: () => fetchProposalCompareDetail(b),
    enabled: Boolean(b),
  });

  const filtered = useMemo(() => {
    const list = candidatesQuery.data || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((item) =>
      [
        item.numero,
        item.client?.nome,
        item.client?.estado,
        item.competitor?.nome,
        item.document?.file_name,
        item.status_proposta,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [candidatesQuery.data, search]);

  const detailA = aQuery.data || null;
  const detailB = bQuery.data || null;

  const executiveRows = useMemo(() => buildExecutiveRows(detailA, detailB), [detailA, detailB]);
  const technicalRows = useMemo(() => buildTechnicalRows(detailA, detailB), [detailA, detailB]);
  const equipmentRows = useMemo(() => buildEquipmentRows(detailA, detailB), [detailA, detailB]);
  const insights = useMemo(() => buildBenchmarkInsights(detailA, detailB), [detailA, detailB]);

  const metricsA = useMemo(() => equipmentMetrics(detailA?.equipments || []), [detailA]);
  const metricsB = useMemo(() => equipmentMetrics(detailB?.equipments || []), [detailB]);

  if (!candidatesQuery.data?.length) {
    return (
      <div className="p-6">
        <PageHeader
          title="Benchmark de Propostas"
          description="Compare propostas em profundidade e extraia padrões comerciais, técnicos e contratuais."
        />
        <EmptyState
          icon={GitCompare}
          title="Sem propostas para comparar"
          description="Envie documentos e gere propostas estruturadas para usar este módulo."
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
        title="Benchmark de Propostas"
        description="Comparação executiva, técnica, comercial e contratual entre duas propostas."
        action={
          <Link to="/app/proposals">
            <Button variant="outline">Ver propostas</Button>
          </Link>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, número, arquivo, concorrente..."
              className="pl-9"
            />
          </div>

          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={a}
            onChange={(e) => setA(e.target.value)}
          >
            <option value="">Selecione a proposta A</option>
            {filtered.map((item) => (
              <option key={item.id} value={item.id}>
                {labelForCandidate(item)}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={b}
            onChange={(e) => setB(e.target.value)}
          >
            <option value="">Selecione a proposta B</option>
            {filtered.map((item) => (
              <option key={item.id} value={item.id}>
                {labelForCandidate(item)}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {detailA && detailB ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ProposalHeroCard side="A" proposal={detailA} />
            <ProposalHeroCard side="B" proposal={detailB} />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Valor A" value={formatBRL(detailA.valor_total)} />
            <MetricCard label="Valor B" value={formatBRL(detailB.valor_total)} />
            <MetricCard label="HP total A" value={String(metricsA.totalHp || 0)} />
            <MetricCard label="HP total B" value={String(metricsB.totalHp || 0)} />
          </div>

          <Tabs defaultValue="executive" className="space-y-4">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="executive">Executivo</TabsTrigger>
              <TabsTrigger value="technical">Técnico</TabsTrigger>
              <TabsTrigger value="equipments">Equipamentos</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="executive">
              <ComparisonTable rows={executiveRows} />
            </TabsContent>

            <TabsContent value="technical">
              {technicalRows.length ? (
                <ComparisonTable rows={technicalRows} />
              ) : (
                <Card className="p-5 text-sm text-muted-foreground">
                  Nenhum dado técnico estruturado para comparar.
                </Card>
              )}
            </TabsContent>

            <TabsContent value="equipments">
              <div className="space-y-4">
                <ComparisonTable rows={equipmentRows} />

                <div className="grid gap-4 lg:grid-cols-2">
                  <EquipmentListCard title="Equipamentos da proposta A" items={detailA.equipments || []} />
                  <EquipmentListCard title="Equipamentos da proposta B" items={detailB.equipments || []} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="insights">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <Sparkles className="h-5 w-5" />
                    Insights automáticos
                  </div>

                  <div className="space-y-3">
                    {insights.map((insight, index) => (
                      <div key={index} className="rounded-lg border p-3 text-sm">
                        {insight}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <ShieldCheck className="h-5 w-5" />
                    Leitura comparativa rápida
                  </div>

                  <div className="space-y-3 text-sm">
                    <QuickInsight
                      label="Garantia"
                      a={detailA.garantia_meses ? `${detailA.garantia_meses} meses` : "—"}
                      b={detailB.garantia_meses ? `${detailB.garantia_meses} meses` : "—"}
                    />
                    <QuickInsight
                      label="Prazo"
                      a={detailA.prazo_entrega_dias ? `${detailA.prazo_entrega_dias} dias` : "—"}
                      b={detailB.prazo_entrega_dias ? `${detailB.prazo_entrega_dias} dias` : "—"}
                    />
                    <QuickInsight
                      label="Frete"
                      a={detailA.frete_tipo || "—"}
                      b={detailB.frete_tipo || "—"}
                    />
                    <QuickInsight
                      label="Pagamento"
                      a={detailA.condicao_pagamento || "—"}
                      b={detailB.condicao_pagamento || "—"}
                    />
                    <QuickInsight
                      label="Confiabilidade"
                      a={detailA.score_confianca != null ? `${Math.round(detailA.score_confianca * 100)}%` : "—"}
                      b={detailB.score_confianca != null ? `${Math.round(detailB.score_confianca * 100)}%` : "—"}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {detailA.document?.tem_analise_forense ? (
                      <Link to="/app/documents/$id/forensic" params={{ id: detailA.document.id || "" }}>
                        <Button variant="outline">
                          <FileSearch className="mr-2 h-4 w-4" />
                          Forense A
                        </Button>
                      </Link>
                    ) : null}

                    {detailB.document?.tem_analise_forense ? (
                      <Link to="/app/documents/$id/forensic" params={{ id: detailB.document.id || "" }}>
                        <Button variant="outline">
                          <FileSearch className="mr-2 h-4 w-4" />
                          Forense B
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <EmptyState
          icon={ArrowRightLeft}
          title="Selecione duas propostas"
          description="Escolha a proposta A e a proposta B para ativar o benchmark."
        />
      )}
    </div>
  );
}

function labelForCandidate(item: ProposalCompareCandidate) {
  return `${item.client?.nome || "Cliente"} · ${item.numero || item.id.slice(0, 6)} · ${item.client?.estado || "UF"} · ${formatBRL(item.valor_total)}`;
}

function ProposalHeroCard({
  side,
  proposal,
}: {
  side: "A" | "B";
  proposal: any;
}) {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Proposta {side}</div>
          <div className="text-xl font-semibold">{proposal.client?.nome || "Cliente desconhecido"}</div>
          <div className="text-sm text-muted-foreground">{proposal.document?.file_name || "Sem documento"}</div>
        </div>
        <Badge variant={proposal.score_confianca >= 0.8 ? "default" : "secondary"}>
          {proposal.score_confianca != null ? `${Math.round(proposal.score_confianca * 100)}%` : "—"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Número" value={proposal.numero} />
        <Field label="Data" value={formatDate(proposal.data_proposta)} />
        <Field label="Valor" value={formatBRL(proposal.valor_total)} />
        <Field label="Status" value={proposal.status_proposta} />
        <Field label="Pagamento" value={proposal.condicao_pagamento} />
        <Field label="Garantia" value={proposal.garantia_meses ? `${proposal.garantia_meses} meses` : "—"} />
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value || "—"}</div>
    </Card>
  );
}

function ComparisonTable({
  rows,
}: {
  rows: Array<{ label: string; a: string; b: string; different: boolean; critical?: boolean }>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Campo</th>
              <th className="px-4 py-3 font-medium">Proposta A</th>
              <th className="px-4 py-3 font-medium">Proposta B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={row.different ? "bg-primary/5" : ""}>
                <td className="border-t px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{row.label}</span>
                    {row.critical ? <Badge variant="outline">Crítico</Badge> : null}
                  </div>
                </td>
                <td className="border-t px-4 py-3">{row.a || "—"}</td>
                <td className="border-t px-4 py-3">{row.b || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EquipmentListCard({
  title,
  items,
}: {
  title: string;
  items: any[];
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 text-lg font-semibold">{title}</div>

      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="font-medium">{item.modelo || item.tipo || "Equipamento"}</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
                <div>Tipo: {item.tipo || "—"}</div>
                <div>Qtd.: {item.quantidade || 1}</div>
                <div>HP: {item.potencia_hp || "—"}</div>
                <div>kcal/h: {item.capacidade_kcal || "—"}</div>
                <div>Compressor: {item.compressor || "—"}</div>
                <div>Gás: {item.gas_refrigerante || "—"}</div>
              </div>
              {item.observacoes ? (
                <div className="mt-3 rounded-md border bg-muted/40 p-2 text-sm">{item.observacoes}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Sem equipamentos estruturados.</div>
      )}
    </Card>
  );
}

function QuickInsight({
  label,
  a,
  b,
}: {
  label: string;
  a: string;
  b: string;
}) {
  const different = a !== b;
  return (
    <div className={`rounded-lg border p-3 ${different ? "bg-primary/5" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>A: <span className="font-medium">{a}</span></div>
        <div>B: <span className="font-medium">{b}</span></div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value || "—"}</div>
    </div>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  FileSearch,
  GitCompare,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/dashboard-bits";
import {
  buildBenchmarkInsights,
  buildEquipmentRows,
  buildExecutiveRows,
  buildTechnicalRows,
  equipmentMetrics,
  fetchCompareCandidates,
  fetchProposalCompareDetail,
  type ProposalCompareCandidate,
} from "@/lib/proposal-benchmark";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/compare")({
  component: ComparePage,
  head: () => ({
    meta: [{ title: "Benchmark de Propostas — DocIntel" }],
  }),
});

function ComparePage() {
  const [search, setSearch] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const candidatesQuery = useQuery({
    queryKey: ["compare-candidates"],
    queryFn: fetchCompareCandidates,
  });

  const aQuery = useQuery({
    queryKey: ["compare-detail", a],
    queryFn: () => fetchProposalCompareDetail(a),
    enabled: Boolean(a),
  });

  const bQuery = useQuery({
    queryKey: ["compare-detail", b],
    queryFn: () => fetchProposalCompareDetail(b),
    enabled: Boolean(b),
  });

  const filtered = useMemo(() => {
    const list = candidatesQuery.data || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((item) =>
      [
        item.numero,
        item.client?.nome,
        item.client?.estado,
        item.competitor?.nome,
        item.document?.file_name,
        item.status_proposta,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [candidatesQuery.data, search]);

  const detailA = aQuery.data || null;
  const detailB = bQuery.data || null;

  const executiveRows = useMemo(() => buildExecutiveRows(detailA, detailB), [detailA, detailB]);
  const technicalRows = useMemo(() => buildTechnicalRows(detailA, detailB), [detailA, detailB]);
  const equipmentRows = useMemo(() => buildEquipmentRows(detailA, detailB), [detailA, detailB]);
  const insights = useMemo(() => buildBenchmarkInsights(detailA, detailB), [detailA, detailB]);

  const metricsA = useMemo(() => equipmentMetrics(detailA?.equipments || []), [detailA]);
  const metricsB = useMemo(() => equipmentMetrics(detailB?.equipments || []), [detailB]);

  if (!candidatesQuery.data?.length) {
    return (
      <div className="p-6">
        <PageHeader
          title="Benchmark de Propostas"
          description="Compare propostas em profundidade e extraia padrões comerciais, técnicos e contratuais."
        />
        <EmptyState
          icon={GitCompare}
          title="Sem propostas para comparar"
          description="Envie documentos e gere propostas estruturadas para usar este módulo."
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
        title="Benchmark de Propostas"
        description="Comparação executiva, técnica, comercial e contratual entre duas propostas."
        action={
          <Link to="/app/proposals">
            <Button variant="outline">Ver propostas</Button>
          </Link>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, número, arquivo, concorrente..."
              className="pl-9"
            />
          </div>

          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={a}
            onChange={(e) => setA(e.target.value)}
          >
            <option value="">Selecione a proposta A</option>
            {filtered.map((item) => (
              <option key={item.id} value={item.id}>
                {labelForCandidate(item)}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={b}
            onChange={(e) => setB(e.target.value)}
          >
            <option value="">Selecione a proposta B</option>
            {filtered.map((item) => (
              <option key={item.id} value={item.id}>
                {labelForCandidate(item)}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {detailA && detailB ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ProposalHeroCard side="A" proposal={detailA} />
            <ProposalHeroCard side="B" proposal={detailB} />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Valor A" value={formatBRL(detailA.valor_total)} />
            <MetricCard label="Valor B" value={formatBRL(detailB.valor_total)} />
            <MetricCard label="HP total A" value={String(metricsA.totalHp || 0)} />
            <MetricCard label="HP total B" value={String(metricsB.totalHp || 0)} />
          </div>

          <Tabs defaultValue="executive" className="space-y-4">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="executive">Executivo</TabsTrigger>
              <TabsTrigger value="technical">Técnico</TabsTrigger>
              <TabsTrigger value="equipments">Equipamentos</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="executive">
              <ComparisonTable rows={executiveRows} />
            </TabsContent>

            <TabsContent value="technical">
              {technicalRows.length ? (
                <ComparisonTable rows={technicalRows} />
              ) : (
                <Card className="p-5 text-sm text-muted-foreground">
                  Nenhum dado técnico estruturado para comparar.
                </Card>
              )}
            </TabsContent>

            <TabsContent value="equipments">
              <div className="space-y-4">
                <ComparisonTable rows={equipmentRows} />

                <div className="grid gap-4 lg:grid-cols-2">
                  <EquipmentListCard title="Equipamentos da proposta A" items={detailA.equipments || []} />
                  <EquipmentListCard title="Equipamentos da proposta B" items={detailB.equipments || []} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="insights">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <Sparkles className="h-5 w-5" />
                    Insights automáticos
                  </div>

                  <div className="space-y-3">
                    {insights.map((insight, index) => (
                      <div key={index} className="rounded-lg border p-3 text-sm">
                        {insight}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <ShieldCheck className="h-5 w-5" />
                    Leitura comparativa rápida
                  </div>

                  <div className="space-y-3 text-sm">
                    <QuickInsight
                      label="Garantia"
                      a={detailA.garantia_meses ? `${detailA.garantia_meses} meses` : "—"}
                      b={detailB.garantia_meses ? `${detailB.garantia_meses} meses` : "—"}
                    />
                    <QuickInsight
                      label="Prazo"
                      a={detailA.prazo_entrega_dias ? `${detailA.prazo_entrega_dias} dias` : "—"}
                      b={detailB.prazo_entrega_dias ? `${detailB.prazo_entrega_dias} dias` : "—"}
                    />
                    <QuickInsight
                      label="Frete"
                      a={detailA.frete_tipo || "—"}
                      b={detailB.frete_tipo || "—"}
                    />
                    <QuickInsight
                      label="Pagamento"
                      a={detailA.condicao_pagamento || "—"}
                      b={detailB.condicao_pagamento || "—"}
                    />
                    <QuickInsight
                      label="Confiabilidade"
                      a={detailA.score_confianca != null ? `${Math.round(detailA.score_confianca * 100)}%` : "—"}
                      b={detailB.score_confianca != null ? `${Math.round(detailB.score_confianca * 100)}%` : "—"}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {detailA.document?.tem_analise_forense ? (
                      <Link to="/app/documents/$id/forensic" params={{ id: detailA.document.id || "" }}>
                        <Button variant="outline">
                          <FileSearch className="mr-2 h-4 w-4" />
                          Forense A
                        </Button>
                      </Link>
                    ) : null}

                    {detailB.document?.tem_analise_forense ? (
                      <Link to="/app/documents/$id/forensic" params={{ id: detailB.document.id || "" }}>
                        <Button variant="outline">
                          <FileSearch className="mr-2 h-4 w-4" />
                          Forense B
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <EmptyState
          icon={ArrowRightLeft}
          title="Selecione duas propostas"
          description="Escolha a proposta A e a proposta B para ativar o benchmark."
        />
      )}
    </div>
  );
}

function labelForCandidate(item: ProposalCompareCandidate) {
  return `${item.client?.nome || "Cliente"} · ${item.numero || item.id.slice(0, 6)} · ${item.client?.estado || "UF"} · ${formatBRL(item.valor_total)}`;
}

function ProposalHeroCard({
  side,
  proposal,
}: {
  side: "A" | "B";
  proposal: any;
}) {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Proposta {side}</div>
          <div className="text-xl font-semibold">{proposal.client?.nome || "Cliente desconhecido"}</div>
          <div className="text-sm text-muted-foreground">{proposal.document?.file_name || "Sem documento"}</div>
        </div>
        <Badge variant={proposal.score_confianca >= 0.8 ? "default" : "secondary"}>
          {proposal.score_confianca != null ? `${Math.round(proposal.score_confianca * 100)}%` : "—"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Número" value={proposal.numero} />
        <Field label="Data" value={formatDate(proposal.data_proposta)} />
        <Field label="Valor" value={formatBRL(proposal.valor_total)} />
        <Field label="Status" value={proposal.status_proposta} />
        <Field label="Pagamento" value={proposal.condicao_pagamento} />
        <Field label="Garantia" value={proposal.garantia_meses ? `${proposal.garantia_meses} meses` : "—"} />
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value || "—"}</div>
    </Card>
  );
}

function ComparisonTable({
  rows,
}: {
  rows: Array<{ label: string; a: string; b: string; different: boolean; critical?: boolean }>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Campo</th>
              <th className="px-4 py-3 font-medium">Proposta A</th>
              <th className="px-4 py-3 font-medium">Proposta B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={row.different ? "bg-primary/5" : ""}>
                <td className="border-t px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{row.label}</span>
                    {row.critical ? <Badge variant="outline">Crítico</Badge> : null}
                  </div>
                </td>
                <td className="border-t px-4 py-3">{row.a || "—"}</td>
                <td className="border-t px-4 py-3">{row.b || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EquipmentListCard({
  title,
  items,
}: {
  title: string;
  items: any[];
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 text-lg font-semibold">{title}</div>

      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="font-medium">{item.modelo || item.tipo || "Equipamento"}</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
                <div>Tipo: {item.tipo || "—"}</div>
                <div>Qtd.: {item.quantidade || 1}</div>
                <div>HP: {item.potencia_hp || "—"}</div>
                <div>kcal/h: {item.capacidade_kcal || "—"}</div>
                <div>Compressor: {item.compressor || "—"}</div>
                <div>Gás: {item.gas_refrigerante || "—"}</div>
              </div>
              {item.observacoes ? (
                <div className="mt-3 rounded-md border bg-muted/40 p-2 text-sm">{item.observacoes}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Sem equipamentos estruturados.</div>
      )}
    </Card>
  );
}

function QuickInsight({
  label,
  a,
  b,
}: {
  label: string;
  a: string;
  b: string;
}) {
  const different = a !== b;
  return (
    <div className={`rounded-lg border p-3 ${different ? "bg-primary/5" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>A: <span className="font-medium">{a}</span></div>
        <div>B: <span className="font-medium">{b}</span></div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value || "—"}</div>
    </div>
  );
}
