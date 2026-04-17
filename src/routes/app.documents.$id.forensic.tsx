import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard-bits";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, AlertTriangle, FileSignature, Stamp, ClipboardList, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/app/documents/$id/forensic")({
  component: ForensicPage,
  head: () => ({ meta: [{ title: "Análise Forense — DocIntel" }] }),
});

function ForensicPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["forensic", id],
    queryFn: async () => {
      const { data: doc } = await supabase.from("documents").select("file_name").eq("id", id).maybeSingle();
      const { data: analyses } = await supabase
        .from("forensic_analyses")
        .select("*")
        .eq("document_id", id)
        .order("versao", { ascending: false });
      return { doc, analyses: analyses || [] };
    },
  });

  const runAnalysis = useMutation({
    mutationFn: async () => {
      setRunning(true);
      const { data, error } = await supabase.functions.invoke("forensic-analyze", { body: { documentId: id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Análise forense concluída");
      qc.invalidateQueries({ queryKey: ["forensic", id] });
      setRunning(false);
    },
    onError: (e: any) => {
      toast.error(e.message || "Falha na análise");
      setRunning(false);
    },
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;
  const a = data?.analyses?.[0];

  return (
    <div className="p-6 space-y-5">
      <Link to="/app/documents/$id" params={{ id }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />Voltar para o documento
      </Link>

      <PageHeader
        title="Análise Forense"
        description={data?.doc?.file_name || ""}
        action={
          <div className="flex items-center gap-2">
            {a && <Badge variant="outline" className="gap-1.5"><Sparkles className="size-3" />v{a.versao} · {a.modelo_ia}</Badge>}
            <Button size="sm" onClick={() => runAnalysis.mutate()} disabled={running}>
              {running ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : a ? <RefreshCw className="size-3.5 mr-2" /> : <Sparkles className="size-3.5 mr-2" />}
              {a ? "Reprocessar" : "Executar análise"}
            </Button>
          </div>
        }
      />

      {!a && !running && (
        <Card className="p-10 text-center text-sm text-muted-foreground gradient-surface border-border">
          <Sparkles className="size-8 mx-auto mb-3 text-primary" />
          <div className="font-medium text-foreground mb-1">Nenhuma análise forense ainda</div>
          <div>Clique em <strong>Executar análise</strong> para gerar uma leitura completa em 4 níveis (literal · estrutural · semântica · analítica). Leva ~30-60s e usa modelo Pro.</div>
        </Card>
      )}

      {running && !a && (
        <Card className="p-10 text-center gradient-surface border-border">
          <Loader2 className="size-8 mx-auto mb-3 animate-spin text-primary" />
          <div className="font-medium">Analisando documento integralmente...</div>
          <div className="text-xs text-muted-foreground mt-1">Pode levar até 60 segundos.</div>
        </Card>
      )}

      {a && (
        <>
          {/* Conflitos no topo */}
          {Array.isArray(a.conflitos_documentais) && a.conflitos_documentais.length > 0 && (
            <Card className="p-4 bg-destructive/10 border-destructive/30">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
                <AlertTriangle className="size-4" />
                {a.conflitos_documentais.length} conflito(s) documental(is) detectado(s)
              </div>
              <ul className="space-y-2">
                {a.conflitos_documentais.map((c: any, i: number) => (
                  <li key={i} className="text-xs">
                    <strong>{c.campo}:</strong> {c.observacao || "trechos divergentes"}
                    {Array.isArray(c.trechos) && (
                      <ul className="list-disc ml-5 mt-1 text-muted-foreground">
                        {c.trechos.map((t: string, j: number) => <li key={j}>"{t}"</li>)}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Header score */}
          <div className="grid md:grid-cols-4 gap-3">
            <ScoreCard label="Score global" value={`${((a.score_global || 0) * 100).toFixed(0)}%`} />
            <ScoreCard label="Tipo" value={a.tipo_documento || "—"} />
            <ScoreCard label="Seções" value={String((a.secoes || []).length)} />
            <ScoreCard label="Campos rastreados" value={String((a.campos_literais || []).length)} />
          </div>

          {/* Bloco A — Estrutura */}
          <Accordion type="multiple" defaultValue={["a", "e"]} className="space-y-3">
            <AccordionItem value="a" className="border-border bg-card rounded-lg overflow-hidden">
              <AccordionTrigger className="px-5 hover:no-underline">
                <span className="flex items-center gap-2 text-sm font-medium"><ClipboardList className="size-4 text-primary" /> Bloco A — Estrutura documental</span>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {a.tem_assinatura && <Badge variant="outline" className="gap-1"><FileSignature className="size-3" />Assinatura</Badge>}
                  {a.tem_docusign && <Badge variant="outline" className="gap-1"><FileSignature className="size-3" />DocuSign</Badge>}
                  {a.tem_carimbo && <Badge variant="outline" className="gap-1"><Stamp className="size-3" />Carimbo</Badge>}
                  {a.tem_tabelas && <Badge variant="outline">Tabelas</Badge>}
                  {a.tem_formulario && <Badge variant="outline">Formulário</Badge>}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Seções identificadas</div>
                  <ol className="border-l-2 border-border ml-2 space-y-2">
                    {(a.secoes || []).map((s: any, i: number) => (
                      <li key={i} className="pl-4 relative">
                        <span className="absolute -left-[5px] top-1.5 size-2 rounded-full bg-primary" />
                        <div className="text-sm">{s.ordem ? `${s.ordem}. ` : ""}{s.titulo}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.tipo && <Badge variant="secondary" className="mr-2 text-[10px]">{s.tipo}</Badge>}
                          {s.pagina_inicio && `pg ${s.pagina_inicio}${s.pagina_fim && s.pagina_fim !== s.pagina_inicio ? `-${s.pagina_fim}` : ""}`}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
                {(a.cabecalhos?.length > 0 || a.rodapes?.length > 0) && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {a.cabecalhos?.length > 0 && <ListBlock label="Cabeçalhos recorrentes" items={a.cabecalhos} />}
                    {a.rodapes?.length > 0 && <ListBlock label="Rodapés recorrentes" items={a.rodapes} />}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Bloco B — Campos */}
            <AccordionItem value="b" className="border-border bg-card rounded-lg overflow-hidden">
              <AccordionTrigger className="px-5 hover:no-underline">
                <span className="text-sm font-medium">Bloco B — Campos literais rastreáveis ({(a.campos_literais || []).length})</span>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Campo</th>
                        <th className="text-left px-3 py-2 font-medium">Valor</th>
                        <th className="text-left px-3 py-2 font-medium">Pg</th>
                        <th className="text-left px-3 py-2 font-medium">Trecho</th>
                        <th className="text-left px-3 py-2 font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(a.campos_literais || []).map((c: any, i: number) => (
                        <tr key={i} className="hover:bg-muted/20 align-top">
                          <td className="px-3 py-2 font-medium">{c.nome}</td>
                          <td className="px-3 py-2">{c.valor || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.pagina ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground italic max-w-md truncate" title={c.trecho}>{c.trecho || "—"}</td>
                          <td className="px-3 py-2"><ScoreBadge score={c.score} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Bloco D — Taxonomia */}
            <AccordionItem value="d" className="border-border bg-card rounded-lg overflow-hidden">
              <AccordionTrigger className="px-5 hover:no-underline">
                <span className="text-sm font-medium">Bloco D — Taxonomia do conteúdo</span>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="space-y-2">
                  {(a.taxonomia_blocos || []).map((t: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/20 border border-border/50">
                      <Badge className="capitalize">{t.categoria}</Badge>
                      <div className="flex-1 text-sm">
                        <div className="font-medium">{t.bloco}</div>
                        {t.evidencia && <div className="text-xs text-muted-foreground italic mt-0.5">"{t.evidencia}"</div>}
                      </div>
                      {t.pagina != null && <div className="text-xs text-muted-foreground">pg {t.pagina}</div>}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Bloco E — Análise comparável */}
            <AccordionItem value="e" className="border-border bg-card rounded-lg overflow-hidden">
              <AccordionTrigger className="px-5 hover:no-underline">
                <span className="text-sm font-medium">Bloco E — Análise comparável</span>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <Tabs defaultValue="resumos">
                  <TabsList>
                    <TabsTrigger value="resumos">Resumos</TabsTrigger>
                    <TabsTrigger value="riscos">Riscos</TabsTrigger>
                    <TabsTrigger value="padroes">Padrões</TabsTrigger>
                    <TabsTrigger value="insights">Insights</TabsTrigger>
                  </TabsList>
                  <TabsContent value="resumos" className="space-y-3 pt-3">
                    <Section title="Resumo executivo" body={a.resumo_executivo} />
                    <Section title="Resumo técnico" body={a.resumo_tecnico} />
                    <Section title="Resumo comercial" body={a.resumo_comercial} />
                    <Section title="Resumo contratual" body={a.resumo_contratual} />
                  </TabsContent>
                  <TabsContent value="riscos" className="space-y-3 pt-3">
                    <Section title="Riscos operacionais" body={a.riscos_operacionais} tone="warning" />
                    <Section title="Riscos jurídicos" body={a.riscos_juridicos} tone="warning" />
                  </TabsContent>
                  <TabsContent value="padroes" className="space-y-3 pt-3">
                    <Section title="Posicionamento" body={a.padrao_posicionamento} />
                    <Section title="Transferência de risco" body={a.padrao_transferencia_risco} />
                    <Section title="Padrão de pagamento" body={a.padrao_pagamento} />
                    <Section title="Padrão de garantia" body={a.padrao_garantia} />
                    <Section title="Padrão técnico" body={a.padrao_tecnico} />
                  </TabsContent>
                  <TabsContent value="insights" className="pt-3">
                    <Section title="Insights de benchmarking" body={a.insights_benchmarking} tone="primary" />
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>

            {/* Bloco F — Inferências */}
            <AccordionItem value="f" className="border-border bg-card rounded-lg overflow-hidden">
              <AccordionTrigger className="px-5 hover:no-underline">
                <span className="text-sm font-medium">Bloco F — Inferências (transparentes)</span>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="grid md:grid-cols-2 gap-3">
                  {(a.inferencias || []).map((inf: any, i: number) => (
                    <Card key={i} className="p-4 gradient-surface border-border">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <Badge variant="secondary" className="text-[10px] mb-1">INFERÊNCIA</Badge>
                          <div className="text-xs uppercase text-muted-foreground">{inf.chave?.replace(/_/g, " ")}</div>
                          <div className="text-sm font-semibold mt-0.5">{inf.valor}</div>
                        </div>
                        <ScoreBadge score={inf.confianca} />
                      </div>
                      {inf.justificativa && <div className="text-xs text-muted-foreground mb-2">{inf.justificativa}</div>}
                      {Array.isArray(inf.evidencias) && inf.evidencias.length > 0 && (
                        <div className="text-[11px] space-y-0.5 border-t border-border pt-2 mt-2">
                          <div className="text-muted-foreground uppercase tracking-wider">Evidências</div>
                          {inf.evidencias.map((e: string, j: number) => (
                            <div key={j} className="italic text-muted-foreground">"{e}"</div>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* histórico de versões */}
          {data!.analyses.length > 1 && (
            <Card className="p-4 gradient-surface border-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Histórico de versões</div>
              <div className="text-xs text-muted-foreground">
                {data!.analyses.map((v) => `v${v.versao}`).join(" · ")} (visualizando v{a.versao})
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 gradient-surface border-border">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1 truncate">{value}</div>
    </Card>
  );
}

function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.round(score * 100);
  const tone = pct >= 75 ? "default" : pct >= 50 ? "secondary" : "destructive";
  return <Badge variant={tone as any} className="text-[10px]">{pct}%</Badge>;
}

function Section({ title, body, tone }: { title: string; body?: string | null; tone?: "warning" | "primary" }) {
  if (!body) return null;
  const cls = tone === "warning" ? "bg-warning/10 border-warning/30" : tone === "primary" ? "bg-primary/5 border-primary/20" : "gradient-surface border-border";
  return (
    <Card className={`p-4 ${cls}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{title}</div>
      <div className="text-sm whitespace-pre-wrap">{body}</div>
    </Card>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <ul className="text-xs text-muted-foreground space-y-0.5">
        {items.map((it, i) => <li key={i} className="truncate">· {it}</li>)}
      </ul>
    </div>
  );
}
