import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard-bits";
import { formatBRL, formatBytes, formatDate, statusLabel } from "@/lib/format";
import { splitRawText } from "@/lib/document-forensic";

export const Route = createFileRoute("/app/documents/$id")({
  component: DocumentDetailPage,
});

function DocumentDetailPage() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["document-detail", id],
    queryFn: async () => {
      const { data: doc } = await supabase
        .from("documents")
        .select("*, competitor:competitors(nome), client:clients(*)")
        .eq("id", id)
        .maybeSingle();

      const { data: prop } = await supabase
        .from("proposals")
        .select("*")
        .eq("document_id", id)
        .maybeSingle();

      const { data: equips } = prop
        ? await supabase.from("equipments").select("*").eq("proposal_id", prop.id)
        : { data: [] as any[] };

      return {
        doc,
        prop,
        equips: equips || [],
      };
    },
  });

  const downloadFile = async () => {
    if (!data?.doc) return;
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(data.doc.file_path, 60);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando documento...</div>;
  }

  if (!data?.doc) {
    return <div className="p-6 text-sm text-muted-foreground">Documento não encontrado.</div>;
  }

  const d = data.doc;
  const p = data.prop;
  const chunks = splitRawText(d.raw_text);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={d.file_name || "Documento"}
        description="Visão consolidada do documento, proposta extraída e texto bruto"
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/app/documents">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>

            {d.tem_analise_forense ? (
              <Link to="/app/documents/$id/forensic" params={{ id }}>
                <Button>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Abrir Navegador Forense
                </Button>
              </Link>
            ) : (
              <Link to="/app/documents/$id/forensic" params={{ id }}>
                <Button variant="outline">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Executar análise forense
                </Button>
              </Link>
            )}

            <Button variant="outline" onClick={downloadFile}>
              <Download className="mr-2 h-4 w-4" />
              Baixar
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <InfoCard label="Status" value={statusLabel[d.status] || d.status || "—"} />
        <InfoCard label="Tipo" value={d.file_type || "—"} />
        <InfoCard label="Tamanho" value={formatBytes(d.file_size)} />
        <InfoCard label="Criado em" value={formatDate(d.created_at)} />
      </div>

      {d.error_message ? (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Erro de processamento: {d.error_message}
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="text-lg font-semibold">Resumo do documento</div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Concorrente" value={d.competitor?.nome} />
              <Field label="Cliente" value={d.client?.nome} />
              <Field label="Estado" value={d.client?.estado} />
              <Field label="Forense" value={d.tem_analise_forense ? "Sim" : "Não"} />
              <Field label="Hash" value={d.file_hash || "—"} />
              <Field label="Upload" value={formatDate(d.created_at)} />
            </div>
          </Card>

          {p ? (
            <>
              <Card className="p-5 space-y-4">
                <div className="text-lg font-semibold">Resumo comercial da proposta</div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Número" value={p.numero} />
                  <Field label="Valor total" value={formatBRL(p.valor_total)} />
                  <Field label="Pagamento" value={p.condicao_pagamento} />
                  <Field label="Prazo (dias)" value={p.prazo_entrega_dias} />
                  <Field label="Garantia (meses)" value={p.garantia_meses} />
                  <Field label="Frete" value={p.frete_tipo} />
                  <Field label="Vendedor" value={p.vendedor} />
                  <Field label="Status" value={p.status_proposta} />
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <div className="text-lg font-semibold">Dados técnicos</div>
                {p.dados_tecnicos && Object.keys(p.dados_tecnicos).length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(p.dados_tecnicos || {}).map(([key, value]) => (
                      <Field key={key} label={key} value={value == null ? "—" : String(value)} />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Sem dados técnicos estruturados.</div>
                )}
              </Card>

              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">Equipamentos</div>
                  <Badge variant="secondary">{data.equips.length}</Badge>
                </div>

                {data.equips.length ? (
                  <div className="space-y-3">
                    {data.equips.map((e: any) => (
                      <div key={e.id} className="rounded-lg border p-4">
                        <div className="grid gap-3 md:grid-cols-4">
                          <Field label="Tipo" value={e.tipo} />
                          <Field label="Modelo" value={e.modelo} />
                          <Field label="Quantidade" value={e.quantidade} />
                          <Field label="HP" value={e.potencia_hp} />
                          <Field label="kcal/h" value={e.capacidade_kcal} />
                          <Field label="Compressor" value={e.compressor} />
                          <Field label="Gás" value={e.gas_refrigerante} />
                          <Field label="Observação" value={e.observacoes} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Nenhum equipamento estruturado.</div>
                )}
              </Card>

              {p.observacoes ? (
                <Card className="p-5">
                  <div className="text-lg font-semibold">Observações</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{p.observacoes}</div>
                </Card>
              ) : null}

              {p.riscos ? (
                <Card className="border-warning/30 bg-warning/10 p-5">
                  <div className="text-lg font-semibold">Riscos identificados</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{p.riscos}</div>
                </Card>
              ) : null}
            </>
          ) : (
            <Card className="p-5 text-sm text-muted-foreground">
              Sem proposta extraída para este documento.
            </Card>
          )}
        </div>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5" />
            Texto extraído segmentado
          </div>

          {chunks.length ? (
            <div className="space-y-4 max-h-[75vh] overflow-auto">
              {chunks.map((chunk) => (
                <div key={chunk.id} className="rounded-lg border p-4">
                  <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Bloco {chunk.index} · {chunk.length} caracteres
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-sm">{chunk.text}</pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sem texto extraído disponível.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value || "—"}</div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">
        {value === null || value === undefined || value === "" ? "—" : String(value)}
      </div>
    </div>
  );
}
