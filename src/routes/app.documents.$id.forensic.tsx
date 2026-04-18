import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  FileSearch,
  FileSignature,
  Loader2,
  RefreshCw,
  ScanText,
  Sparkles,
  Stamp,
  Table2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  fetchForensicNavigatorData,
  forensicStatusTone,
  percent,
  splitRawText,
  type ForensicAnalysis,
} from "@/lib/document-forensic";
import { formatBRL, formatDate, statusLabel } from "@/lib/format";

export const Route = createFileRoute("/app/documents/$id/forensic")({
  component: ForensicNavigatorPage,
  head: () => ({
    meta: [{ title: "Navegador Forense — DocIntel" }],
  }),
});

function ForensicNavigatorPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["forensic-navigator", id],
    queryFn: () => fetchForensicNavigatorData(id),
  });

  const runAnalysis = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("forensic-analyze", {
        body: { documentId: id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Análise forense concluída");
      qc.invalidateQueries({ queryKey: ["forensic-navigator", id] });
    },
    onError: (e: any) => {
      toast.error(e.message || "Falha ao executar análise forense");
    },
  });

  const analysis = useMemo(() => {
    const analyses = data?.analyses || [];
    if (!analyses.length) return null;
    if (selectedVersion == null) return analyses[0];
    return analyses.find((item) => item.versao === selectedVersion) || analyses[0];
  }, [data?.analyses, selectedVersion]);

  const chunks = useMemo(() => splitRawText(data?.document?.raw_text), [data?.document?.raw_text]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando análise forense...</div>;
  }

  if (!data?.document) {
    return <div className="p-6 text-sm text-muted-foreground">Documento não encontrado.</div>;
  }

  const d = data.document;
  const p = data.proposal;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Navegador Forense"
        subtitle="Leitura profunda, rastreável e auditável do documento"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/app/documents/$id" params={{ id }}>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o documento
              </Button>
            </Link>
            <Button
              onClick={() => runAnalysis.mutate()}
              disabled={runAnalysis.isPending}
            >
              {runAnalysis.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {analysis ? "Reprocessar análise" : "Executar análise"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <TopMetric
          label="Documento"
          value={d.file_name || "—"}
          helper={statusLabel[d.status] || d.status || "—"}
        />
        <TopMetric
          label="Cliente"
          value={d.client?.nome || p?.cliente_nome || "—"}
          helper={d.client?.estado || "—"}
        />
        <TopMetric
          label="Valor"
          value={formatBRL(p?.valor_total)}
          helper={p?.numero || "Sem número"}
        />
        <TopMetric
          label="Versões forenses"
          value={String(data.analyses.length)}
          helper={analysis?.modelo_ia || "—"}
        />
      </div>

      {!analysis ? (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border">
            <FileSearch className="h-6 w-6" />
          </div>
          <div className="text-lg font-semibold">Nenhuma análise forense ainda</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Execute a análise para gerar leitura em níveis literal, estrutural, semântico e analítico.
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Versão ativa da análise</div>
                <div className="text-sm text-muted-foreground">
                  v{analysis.versao} · {analysis.modelo_ia || "modelo não informado"}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(data.analyses || []).map((version) => (
                  <Button
                    key={version.id}
                    variant={analysis.versao === version.versao ? "default" : "outline"}
                    onClick={() => setSelectedVersion(version.versao)}
                  >
                    v{version.versao}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <ScoreCard
                label="Estrutura"
                value={percent(analysis.score_estrutura)}
                tone={forensicStatusTone(analysis.score_estrutura)}
              />
              <ScoreCard
                label="Rastreabilidade"
                value={percent(analysis.score_rastreabilidade)}
                tone={forensicStatusTone(analysis.score_rastreabilidade)}
              />
              <ScoreCard
                label="Analiticidade"
                value={percent(analysis.score_analiticidade)}
                tone={forensicStatusTone(analysis.score_analiticidade)}
              />
              <ScoreCard
                label="Confiança global"
                value={percent(analysis.score_confianca_global)}
                tone={forensicStatusTone(analysis.score_confianca_global)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {analysis.tem_assinatura ? (
                <Badge><FileSignature className="mr-1 h-3 w-3" />Assinatura</Badge>
              ) : null}
              {analysis.tem_docusign ? (
                <Badge><Sparkles className="mr-1 h-3 w-3" />DocuSign</Badge>
              ) : null}
              {analysis.tem_carimbo ? (
                <Badge><Stamp className="mr-1 h-3 w-3" />Carimbo</Badge>
              ) : null}
              {analysis.tem_tabelas ? (
                <Badge><Table2 className="mr-1 h-3 w-3" />Tabelas</Badge>
              ) : null}
              {analysis.tem_formulario ? (
                <Badge><ClipboardList className="mr-1 h-3 w-3" />Formulário</Badge>
              ) : null}
            </div>

            {Array.isArray(analysis.conflitos_documentais) && analysis.conflitos_documentais.length > 0 ? (
              <Card className="border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-center gap-2 font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {analysis.conflitos_documentais.length} conflito(s) documental(is)
                </div>
                <div className="mt-3 space-y-3">
                  {analysis.conflitos_documentais.map((conflict, index) => (
                    <div key={index} className="rounded-lg border border-destructive/20 bg-background p-3">
                      <div className="font-medium">{conflict.campo || "Campo não identificado"}</div>
                      {conflict.observacao ? (
                        <div className="mt-1 text-sm text-muted-foreground">{conflict.observacao}</div>
                      ) : null}
                      {Array.isArray(conflict.trechos) && conflict.trechos.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {conflict.trechos.map((excerpt, j) => (
                            <div key={j} className="rounded-md border bg-muted/40 p-2 text-xs">
                              “{excerpt}”
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </Card>

          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="summary">Resumos</TabsTrigger>
              <TabsTrigger value="structure">Estrutura</TabsTrigger>
              <TabsTrigger value="fields">Campos literais</TabsTrigger>
              <TabsTrigger value="taxonomy">Taxonomia</TabsTrigger>
              <TabsTrigger value="inferences">Inferências</TabsTrigger>
              <TabsTrigger value="raw">Texto bruto</TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              <div className="grid gap-4 lg:grid-cols-2">
                <SectionCard title="Resumo executivo" body={analysis.resumo_executivo} />
                <SectionCard title="Resumo técnico" body={analysis.resumo_tecnico} />
                <SectionCard title="Resumo comercial" body={analysis.resumo_comercial} />
                <SectionCard title="Resumo contratual" body={analysis.resumo_contratual} />
                <SectionCard title="Riscos operacionais" body={analysis.riscos_operacionais} tone="warning" />
                <SectionCard title="Riscos jurídicos" body={analysis.riscos_juridicos} tone="warning" />
                <SectionCard title="Padrão de posicionamento" body={analysis.padrao_posicionamento} />
                <SectionCard title="Transferência de risco" body={analysis.padrao_transferencia_risco} />
                <SectionCard title="Padrão de pagamento" body={analysis.padrao_pagamento} />
                <SectionCard title="Padrão de garantia" body={analysis.padrao_garantia} />
                <SectionCard title="Padrão técnico" body={analysis.padrao_tecnico} />
                <SectionCard title="Insights de benchmarking" body={analysis.insights_benchmarking} tone="primary" />
              </div>
            </TabsContent>

            <TabsContent value="structure">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <div className="mb-3 text-lg font-semibold">Seções identificadas</div>
                  <div className="space-y-3">
                    {(analysis.secoes || []).map((section, idx) => (
                      <div key={idx} className="rounded-lg border p-3">
                        <div className="font-medium">
                          {section.ordem ? `${section.ordem}. ` : ""}
                          {section.titulo || "Sem título"}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {section.tipo || "tipo não informado"} · página{" "}
                          {section.pagina_inicio ?? "—"}
                          {section.pagina_fim && section.pagina_fim !== section.pagina_inicio
                            ? `-${section.pagina_fim}`
                            : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5 space-y-4">
                  <div>
                    <div className="text-lg font-semibold">Cabeçalhos recorrentes</div>
                    <div className="mt-3 space-y-2">
                      {(analysis.cabecalhos || []).length ? (
                        (analysis.cabecalhos || []).map((item, idx) => (
                          <div key={idx} className="rounded-md border bg-muted/40 p-2 text-sm">
                            {item}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">Nenhum cabeçalho identificado.</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-lg font-semibold">Rodapés recorrentes</div>
                    <div className="mt-3 space-y-2">
                      {(analysis.rodapes || []).length ? (
                        (analysis.rodapes || []).map((item, idx) => (
                          <div key={idx} className="rounded-md border bg-muted/40 p-2 text-sm">
                            {item}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">Nenhum rodapé identificado.</div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="fields">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-lg font-semibold">Campos literais rastreáveis</div>
                  <Badge variant="secondary">{(analysis.campos_literais || []).length} campo(s)</Badge>
                </div>

                {(analysis.campos_literais || []).length ? (
                  <div className="space-y-3">
                    {(analysis.campos_literais || []).map((field, idx) => (
                      <div key={idx} className="rounded-lg border p-4">
                        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_100px_110px]">
                          <FieldCell label="Campo" value={field.nome || "—"} />
                          <FieldCell label="Valor" value={field.valor || "—"} />
                          <FieldCell label="Página" value={field.pagina != null ? String(field.pagina) : "—"} />
                          <FieldCell label="Score" value={percent(field.score)} />
                        </div>
                        {field.trecho ? (
                          <div className="mt-3 rounded-md border bg-muted/40 p-3 text-sm">
                            “{field.trecho}”
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Nenhum campo literal disponível.</div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="taxonomy">
              <Card className="p-5">
                <div className="mb-4 text-lg font-semibold">Taxonomia do conteúdo</div>
                {(analysis.taxonomia_blocos || []).length ? (
                  <div className="space-y-3">
                    {(analysis.taxonomia_blocos || []).map((block, idx) => (
                      <div key={idx} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{block.categoria || "categoria"}</Badge>
                          {block.pagina != null ? <Badge variant="outline">pg {block.pagina}</Badge> : null}
                        </div>
                        <div className="mt-3 font-medium">{block.bloco || "Bloco sem descrição"}</div>
                        {block.evidencia ? (
                          <div className="mt-2 rounded-md border bg-muted/40 p-3 text-sm">
                            “{block.evidencia}”
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Nenhuma taxonomia disponível.</div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="inferences">
              <Card className="p-5">
                <div className="mb-4 text-lg font-semibold">Inferências transparentes</div>
                {(analysis.inferencias || []).length ? (
                  <div className="space-y-4">
                    {(analysis.inferencias || []).map((inf, idx) => (
                      <div key={idx} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">Inferência</Badge>
                          {inf.score != null ? (
                            <Badge variant={forensicStatusTone(inf.score) as any}>{percent(inf.score)}</Badge>
                          ) : null}
                        </div>
                        <div className="mt-3 text-sm text-muted-foreground">
                          {inf.chave?.replace(/_/g, " ") || "chave"}
                        </div>
                        <div className="mt-1 text-lg font-semibold">{inf.valor || "—"}</div>
                        {inf.justificativa ? (
                          <div className="mt-3 text-sm text-muted-foreground">{inf.justificativa}</div>
                        ) : null}
                        {Array.isArray(inf.evidencias) && inf.evidencias.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {inf.evidencias.map((ev, j) => (
                              <div key={j} className="rounded-md border bg-muted/40 p-2 text-sm">
                                “{ev}”
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Nenhuma inferência disponível.</div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="raw">
              <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="p-5">
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <ScanText className="h-5 w-5" />
                    Mapa do texto bruto
                  </div>
                  <div className="space-y-2">
                    {chunks.length ? (
                      chunks.map((chunk) => (
                        <div key={chunk.id} className="rounded-md border p-3 text-sm">
                          <div className="font-medium">Bloco {chunk.index}</div>
                          <div className="text-muted-foreground">{chunk.length} caracteres</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">Documento sem texto bruto disponível.</div>
                    )}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="mb-4 text-lg font-semibold">Texto bruto segmentado</div>
                  <div className="space-y-4 max-h-[70vh] overflow-auto">
                    {chunks.length ? (
                      chunks.map((chunk) => (
                        <div key={chunk.id} className="rounded-lg border p-4">
                          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                            Bloco {chunk.index}
                          </div>
                          <pre className="whitespace-pre-wrap break-words text-sm">{chunk.text}</pre>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">Sem conteúdo textual.</div>
                    )}
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function TopMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 line-clamp-2 text-lg font-semibold">{value || "—"}</div>
      {helper ? <div className="mt-1 text-xs text-muted-foreground">{helper}</div> : null}
    </Card>
  );
}

function ScoreCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "secondary" | "destructive";
}) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <div className="text-2xl font-semibold">{value}</div>
        <Badge variant={tone as any}>{value}</Badge>
      </div>
    </Card>
  );
}

function SectionCard({
  title,
  body,
  tone,
}: {
  title: string;
  body?: string | null;
  tone?: "warning" | "primary";
}) {
  const cls =
    tone === "warning"
      ? "border-warning/30 bg-warning/10"
      : tone === "primary"
      ? "border-primary/20 bg-primary/5"
      : "";

  return (
    <Card className={`p-5 ${cls}`}>
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
        {body || "—"}
      </div>
    </Card>
  );
}

function FieldCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value || "—"}</div>
    </div>
  );
}
