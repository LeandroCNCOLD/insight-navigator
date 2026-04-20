import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Swords, TrendingDown, TrendingUp, Loader2, Sparkles, Brain, Plus } from "lucide-react";
import { UploadDialog } from "@/components/upload-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/app/dashboards/head-to-head")({
  component: HeadToHeadPage,
  head: () => ({ meta: [{ title: "Head-to-Head CN Cold × Concorrentes — DocIntel" }] }),
});

type Row = {
  id: string;
  client_id: string | null;
  competitor_id: string | null;
  valor_total: number | null;
  status_proposta: string | null;
  prazo_entrega_dias: number | null;
  garantia_meses: number | null;
  condicao_pagamento: string | null;
  numero: string | null;
  data_proposta: string | null;
  dados_tecnicos: any;
  client: { nome: string | null; estado: string | null; cnpj: string | null } | null;
  competitor: { nome: string | null; is_house: boolean | null } | null;
};

type Pair = {
  clientId: string;
  clientName: string;
  estado: string;
  house: Row[];
  rivals: Row[];
};

async function fetchHeadToHead(): Promise<{ pairs: Pair[]; allRows: Row[] }> {
  const { data, error } = await supabase
    .from("proposals")
    .select(
      `id, client_id, competitor_id, valor_total, status_proposta, prazo_entrega_dias, garantia_meses, condicao_pagamento, numero, data_proposta, dados_tecnicos,
       client:clients(nome,estado,cnpj),
       competitor:competitors!competitor_id(nome,is_house)`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data || []) as unknown as Row[];

  // Confrontos automáticos só fazem sentido quando temos client_id em ambos os lados
  const byClient = new Map<string, Pair>();
  for (const r of rows) {
    if (!r.client_id) continue;
    if (!byClient.has(r.client_id)) {
      byClient.set(r.client_id, {
        clientId: r.client_id,
        clientName: r.client?.nome || "Cliente",
        estado: r.client?.estado || "—",
        house: [],
        rivals: [],
      });
    }
    const p = byClient.get(r.client_id)!;
    if (r.competitor?.is_house) p.house.push(r);
    else p.rivals.push(r);
  }
  const pairs = Array.from(byClient.values()).filter((p) => p.house.length > 0 && p.rivals.length > 0);
  // allRows mantém TODAS as propostas (inclusive sem client_id) para o pareamento manual
  return { pairs, allRows: rows };
}

function statusVariant(s: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!s) return "outline";
  const v = s.toLowerCase();
  if (/(ganh|aprov|fech|venc)/.test(v)) return "default";
  if (/(perd|recus|cancel)/.test(v)) return "destructive";
  return "secondary";
}

function HeadToHeadPage() {
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const qc = useQueryClient();
  const [explainingKey, setExplainingKey] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ analysis: string; confronts_count: number; confronts: any[] } | null>(null);

  const q = useQuery({ queryKey: ["head-to-head"], queryFn: fetchHeadToHead });

  const pairs = q.data?.pairs || [];
  const allRows = q.data?.allRows || [];
  const houseRows = useMemo(() => allRows.filter((r) => r.competitor?.is_house), [allRows]);
  const rivalRows = useMemo(() => allRows.filter((r) => !r.competitor?.is_house), [allRows]);

  const [manualHouseId, setManualHouseId] = useState("");
  const [manualRivalId, setManualRivalId] = useState("");
  const [manualSearch, setManualSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("__all__");
  const [manualExplain, setManualExplain] = useState<string | null>(null);
  const [manualComparison, setManualComparison] = useState<any | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResultado, setManualResultado] = useState<"ganhou" | "perdeu" | "em_aberto">("em_aberto");

  const norm = (s: string | null | undefined) =>
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

  // Build client groups (cnpj-first, fallback to normalized name) so that
  // multiple proposals of the same client cluster under one filter entry.
  const clientGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number; cnpj: string | null }>();
    for (const r of allRows) {
      const cnpj = (r.client?.cnpj || "").replace(/\D/g, "");
      const key = cnpj.length >= 8 ? `cnpj:${cnpj}` : `name:${norm(r.client?.nome)}`;
      if (key === "name:" || key === "cnpj:") continue;
      const label = r.client?.nome || (cnpj ? `CNPJ ${cnpj}` : "Cliente");
      const cur = map.get(key);
      if (cur) cur.count += 1;
      else map.set(key, { key, label, count: 1, cnpj: cnpj || null });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [allRows]);

  const matchesClient = (r: Row) => {
    if (clientFilter === "__all__") return true;
    const cnpj = (r.client?.cnpj || "").replace(/\D/g, "");
    const key = cnpj.length >= 8 ? `cnpj:${cnpj}` : `name:${norm(r.client?.nome)}`;
    return key === clientFilter;
  };
  const matchesQuery = (r: Row, q: string) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return [r.numero, r.client?.nome, r.client?.estado, r.client?.cnpj, r.competitor?.nome]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(t));
  };
  const houseFiltered = houseRows.filter((r) => matchesClient(r) && matchesQuery(r, manualSearch));
  const rivalFiltered = rivalRows.filter((r) => matchesClient(r) && matchesQuery(r, manualSearch));
  const manualHouse = houseRows.find((r) => r.id === manualHouseId) || null;
  const manualRival = rivalRows.find((r) => r.id === manualRivalId) || null;

  const filtered = useMemo(() => {
    const list = pairs;
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (p) =>
        p.clientName.toLowerCase().includes(s) ||
        p.estado.toLowerCase().includes(s) ||
        p.rivals.some((r) => r.competitor?.nome?.toLowerCase().includes(s)),
    );
  }, [pairs, search]);

  async function runGlobalAI() {
    setAiLoading(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("head-to-head-ai", { body: {} });
      if (error) throw error;
      setAiResult(data as any);
      toast.success(`Análise IA gerada para ${(data as any)?.confronts_count || 0} confronto(s).`);
    } catch (e: any) {
      toast.error(`Falha ao gerar análise IA: ${e.message || e}`);
    } finally {
      setAiLoading(false);
    }
  }

  async function explain(pair: Pair, house: Row, rival: Row) {
    const key = `${house.id}|${rival.id}`;
    setExplainingKey(key);
    try {
      const ctx = {
        cliente: pair.clientName,
        uf: pair.estado,
        casa: {
          fornecedor: house.competitor?.nome,
          valor: house.valor_total,
          prazo_entrega_dias: house.prazo_entrega_dias,
          garantia_meses: house.garantia_meses,
          pagamento: house.condicao_pagamento,
          status: house.status_proposta,
          tecnico: house.dados_tecnicos,
        },
        concorrente: {
          fornecedor: rival.competitor?.nome,
          valor: rival.valor_total,
          prazo_entrega_dias: rival.prazo_entrega_dias,
          garantia_meses: rival.garantia_meses,
          pagamento: rival.condicao_pagamento,
          status: rival.status_proposta,
          tecnico: rival.dados_tecnicos,
        },
      };
      const pergunta = `Compare estas duas propostas para o mesmo cliente (${pair.clientName}) e explique de forma direta o provável motivo de decisão (preço, prazo, garantia, técnica, pagamento). Aponte vantagens da CN Cold e do concorrente, e o que provavelmente determinou o resultado. Contexto JSON: ${JSON.stringify(ctx)}`;

      const { data, error } = await supabase.functions.invoke("market-intelligence", {
        body: { question: pergunta, context: ctx },
      });
      if (error) throw error;
      const answer = (data as any)?.answer || (data as any)?.response || (data as any)?.text || JSON.stringify(data);
      setExplanations((prev) => ({ ...prev, [key]: answer }));

      // Cache as comment on the house proposal
      await supabase.from("proposal_review_events").insert({
        proposal_id: house.id,
        action: "comment",
        comment: `[Head-to-Head vs ${rival.competitor?.nome}] ${answer}`.slice(0, 5000),
      } as any);
    } catch (e: any) {
      toast.error(`Falha ao gerar explicação: ${e.message || e}`);
    } finally {
      setExplainingKey(null);
    }
  }

  if (q.isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="Head-to-Head CN Cold × Concorrentes" description="Carregando…" />
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> Cruzando propostas…
        </div>
      </div>
    );
  }

  async function explainManual() {
    if (!manualHouse || !manualRival) return;
    setManualLoading(true);
    setManualExplain(null);
    setManualComparison(null);
    try {
      const { data, error } = await supabase.functions.invoke("head-to-head-pair-ai", {
        body: {
          house_proposal_id: manualHouse.id,
          rival_proposal_id: manualRival.id,
          resultado: manualResultado,
        },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      setManualExplain(d?.analysis || "Sem análise.");
      setManualComparison(d?.comparison || null);

      await supabase.from("proposal_review_events").insert({
        proposal_id: manualHouse.id,
        action: "comment",
        comment: `[Head-to-Head vs ${manualRival.competitor?.nome} · resultado: ${manualResultado}] ${(d?.analysis || "").slice(0, 4500)}`,
      } as any);

      toast.success("Análise IA do par gerada.");
    } catch (e: any) {
      toast.error(`Falha ao analisar par: ${e.message || e}`);
    } finally {
      setManualLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Head-to-Head CN Cold × Concorrentes"
        description={
          filtered.length
            ? `${filtered.length} cliente(s) com confronto automático por CNPJ. Você também pode parear propostas manualmente abaixo.`
            : "Selecione manualmente uma proposta CN Cold e uma do concorrente para comparar — ou gere a análise automática por CNPJ."
        }
        action={
          <div className="flex gap-2">
            <Button onClick={() => setUploadOpen(true)}>
              <Plus className="size-4 mr-1" /> Novo arquivo
            </Button>
            <Link to="/app/upload/cncode">
              <Button variant="outline">Subir mais CN Cold</Button>
            </Link>
          </div>
        }
      />
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultMode="house"
        onComplete={() => qc.invalidateQueries({ queryKey: ["head-to-head"] })}
      />

      <Card className="p-5 gradient-surface border-border space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2"><Brain className="size-5 text-primary" /></div>
            <div>
              <div className="font-semibold">Análise IA — Confronto por CNPJ</div>
              <div className="text-xs text-muted-foreground max-w-xl">
                A IA cruza propostas da CN Cold e dos concorrentes pelo CNPJ do cliente (com fallback por nome) e gera uma sugestão de análise consolidada do porquê de cada disputa.
              </div>
            </div>
          </div>
          <Button onClick={runGlobalAI} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
            {aiLoading ? "Analisando…" : "Gerar análise IA"}
          </Button>
        </div>
        {aiResult && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{aiResult.confronts_count} confronto(s)</Badge>
              {aiResult.confronts.slice(0, 6).map((c: any, i: number) => (
                <Badge key={i} variant="outline" className="font-mono">
                  {c.cliente} {c.cnpj ? `· ${c.cnpj}` : ""} ({c.house_count}×{c.rivals_count})
                </Badge>
              ))}
              {aiResult.confronts.length > 6 && (
                <Badge variant="outline">+{aiResult.confronts.length - 6}</Badge>
              )}
            </div>
            <div className="rounded-md border bg-background/60 p-4 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{aiResult.analysis || "Sem análise."}</ReactMarkdown>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-success/10 p-2"><Swords className="size-5 text-success" /></div>
          <div>
            <div className="font-semibold">Pareamento manual</div>
            <div className="text-xs text-muted-foreground max-w-2xl">
              Busque por número da proposta, nome do cliente ou CNPJ. Selecione uma proposta da CN Cold e uma do concorrente — a IA gera a análise comparativa do par.
            </div>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr] items-start">
          <Input
            placeholder="Buscar por nº proposta, cliente, CNPJ, UF ou concorrente…"
            value={manualSearch}
            onChange={(e) => setManualSearch(e.target.value)}
          />
          <div className="space-y-1">
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={clientFilter}
              onChange={(e) => { setClientFilter(e.target.value); setManualHouseId(""); setManualRivalId(""); }}
            >
              <option value="__all__">Todos os clientes ({clientGroups.length})</option>
              {clientGroups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}{g.cnpj ? ` · CNPJ ${g.cnpj}` : ""} · {g.count} proposta(s)
                </option>
              ))}
            </select>
            <div className="text-[11px] text-muted-foreground px-1">
              Agrupa propostas pelo mesmo cliente (CNPJ ou nome) — um cliente pode ter várias propostas.
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-l-4 border-l-success bg-background p-2 space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-1">Proposta CN Cold</div>
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={manualHouseId}
              onChange={(e) => setManualHouseId(e.target.value)}
            >
              <option value="">— Selecione —</option>
              {houseFiltered.map((r) => (
                <option key={r.id} value={r.id}>
                  {(r.client?.nome || "Cliente")} · {r.numero || r.id.slice(0, 6)} · {r.client?.estado || "UF"} · {formatBRL(r.valor_total)}{r.client?.cnpj ? ` · CNPJ ${r.client.cnpj}` : ""}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-muted-foreground px-1">{houseFiltered.length} disponível(is)</div>
          </div>
          <div className="rounded-md border border-l-4 border-l-primary bg-background p-2 space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-1">Proposta Concorrente</div>
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={manualRivalId}
              onChange={(e) => setManualRivalId(e.target.value)}
            >
              <option value="">— Selecione —</option>
              {rivalFiltered.map((r) => (
                <option key={r.id} value={r.id}>
                  {(r.competitor?.nome || "Concorrente")} · {r.client?.nome || "Cliente"} · {r.numero || r.id.slice(0, 6)} · {formatBRL(r.valor_total)}{r.client?.cnpj ? ` · CNPJ ${r.client.cnpj}` : ""}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-muted-foreground px-1">{rivalFiltered.length} disponível(is)</div>
          </div>
        </div>
        {manualHouse && manualRival && (
          <div className="grid gap-3 md:grid-cols-2">
            <PropBox label="CN Cold" tone="house" row={manualHouse} />
            <PropBox label={manualRival.competitor?.nome || "Concorrente"} tone="rival" row={manualRival} />
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-md border bg-background p-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground px-2">Resultado CN Cold:</span>
            {(["ganhou", "perdeu", "em_aberto"] as const).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={manualResultado === r ? "default" : "ghost"}
                className="h-7 text-xs"
                onClick={() => setManualResultado(r)}
              >
                {r === "ganhou" ? "✅ Ganhou" : r === "perdeu" ? "❌ Perdeu" : "⏳ Em aberto"}
              </Button>
            ))}
          </div>
          <Button onClick={explainManual} disabled={!manualHouse || !manualRival || manualLoading}>
            {manualLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
            Analisar par com IA
          </Button>
          {(manualHouseId || manualRivalId) && (
            <Button variant="ghost" size="sm" onClick={() => { setManualHouseId(""); setManualRivalId(""); setManualExplain(null); setManualComparison(null); }}>
              Limpar seleção
            </Button>
          )}
        </div>
        {manualComparison && (
          <ComparisonCharts comparison={manualComparison} houseLabel="CN Cold" rivalLabel={manualRival?.competitor?.nome || "Concorrente"} />
        )}
        {manualExplain && (
          <div className="rounded-md border bg-background/60 p-4 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{manualExplain}</ReactMarkdown>
          </div>
        )}
      </Card>

      {filtered.length > 0 && (
        <Card className="p-4">
          <Input
            placeholder="Filtrar confrontos automáticos por cliente, UF ou concorrente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Card>
      )}

      <div className="space-y-4">
        {filtered.map((pair) => (
          <Card key={pair.clientId} className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-lg font-semibold">{pair.clientName}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  {pair.estado} · {pair.house.length} CN Cold × {pair.rivals.length} concorrente(s)
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {pair.house.map((h) =>
                pair.rivals.map((r) => {
                  const key = `${h.id}|${r.id}`;
                  const dvalor =
                    h.valor_total != null && r.valor_total != null && r.valor_total > 0
                      ? ((h.valor_total - r.valor_total) / r.valor_total) * 100
                      : null;
                  return (
                    <div key={key} className="rounded-lg border p-4 space-y-3 bg-muted/20">
                      <div className="grid md:grid-cols-2 gap-3">
                        <PropBox label="CN Cold" tone="house" row={h} />
                        <PropBox label={r.competitor?.nome || "Concorrente"} tone="rival" row={r} />
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-sm">
                        {dvalor != null && (
                          <Badge variant={dvalor > 0 ? "destructive" : "default"} className="gap-1">
                            {dvalor > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                            CN Cold {dvalor > 0 ? "+" : ""}
                            {dvalor.toFixed(1)}% vs {r.competitor?.nome}
                          </Badge>
                        )}
                        {h.prazo_entrega_dias != null && r.prazo_entrega_dias != null && (
                          <span className="text-muted-foreground">
                            Δ prazo: {h.prazo_entrega_dias - r.prazo_entrega_dias}d
                          </span>
                        )}
                        {h.garantia_meses != null && r.garantia_meses != null && (
                          <span className="text-muted-foreground">
                            Δ garantia: {h.garantia_meses - r.garantia_meses}m
                          </span>
                        )}
                        <div className="ml-auto flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => explain(pair, h, r)}
                            disabled={explainingKey === key}
                          >
                            {explainingKey === key ? (
                              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Sparkles className="size-3.5 mr-1.5" />
                            )}
                            Explicar com IA
                          </Button>
                        </div>
                      </div>

                      {explanations[key] && (
                        <div className="rounded-md border bg-background/60 p-3 text-sm whitespace-pre-wrap">
                          {explanations[key]}
                        </div>
                      )}
                    </div>
                  );
                }),
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PropBox({ label, tone, row }: { label: string; tone: "house" | "rival"; row: Row }) {
  const border = tone === "house" ? "border-l-4 border-l-success" : "border-l-4 border-l-primary";
  return (
    <div className={`rounded-md bg-background p-3 ${border}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Badge variant={statusVariant(row.status_proposta)} className="text-[10px]">
          {row.status_proposta || "sem status"}
        </Badge>
      </div>
      <div className="text-lg font-semibold">{formatBRL(row.valor_total)}</div>
      <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <div>Prazo: {row.prazo_entrega_dias != null ? `${row.prazo_entrega_dias}d` : "—"}</div>
        <div>Garantia: {row.garantia_meses != null ? `${row.garantia_meses}m` : "—"}</div>
        <div className="col-span-2 truncate">Pgto: {row.condicao_pagamento || "—"}</div>
        {row.numero && <div className="col-span-2 truncate">Nº {row.numero}</div>}
      </div>
    </div>
  );
}
