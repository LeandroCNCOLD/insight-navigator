import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard-bits";
import { ArrowLeft, FileText, Download } from "lucide-react";
import { formatBRL, formatBytes, formatDate, statusLabel } from "@/lib/format";

export const Route = createFileRoute("/app/documents/$id")({
  component: DocDetail,
});

function DocDetail() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data: doc } = await supabase.from("documents").select("*,competitor:competitors(nome),client:clients(*)").eq("id", id).maybeSingle();
      const { data: prop } = await supabase.from("proposals").select("*").eq("document_id", id).maybeSingle();
      const { data: equips } = prop ? await supabase.from("equipments").select("*").eq("proposal_id", prop.id) : { data: [] };
      return { doc, prop, equips: equips || [] };
    },
  });

  const downloadFile = async () => {
    if (!data?.doc) return;
    const { data: signed } = await supabase.storage.from("documents").createSignedUrl(data.doc.file_path, 60);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  };

  if (!data?.doc) return <div className="p-6">Carregando...</div>;
  const d = data.doc; const p = data.prop;

  return (
    <div className="p-6 space-y-5">
      <Link to="/app/documents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />Voltar
      </Link>

      <PageHeader title={d.file_name} description={`${d.file_type.toUpperCase()} · ${formatBytes(d.file_size)} · ${formatDate(d.created_at)}`}
        action={<div className="flex gap-2">
          <Badge variant={d.status === "extracted" ? "default" : d.status === "failed" ? "destructive" : "secondary"}>{statusLabel[d.status] || d.status}</Badge>
          <Button variant="outline" size="sm" onClick={downloadFile}><Download className="size-3.5 mr-2" />Baixar</Button>
        </div>} />

      {d.error_message && (
        <Card className="p-4 bg-destructive/10 border-destructive/30 text-sm text-destructive-foreground">
          <strong>Erro de processamento:</strong> {d.error_message}
        </Card>
      )}

      {p ? (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="p-5 gradient-surface border-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Comercial</div>
              <Field label="Cliente" value={data.doc.client?.nome} />
              <Field label="Cidade/UF" value={data.doc.client ? `${data.doc.client.cidade || "—"}/${data.doc.client.estado || "—"}` : "—"} />
              <Field label="Nº Proposta" value={p.numero} />
              <Field label="Data" value={formatDate(p.data_proposta)} />
              <Field label="Valor total" value={formatBRL(p.valor_total)} />
              <Field label="Vendedor" value={p.vendedor} />
              <Field label="Status" value={p.status_proposta} />
            </Card>
            <Card className="p-5 gradient-surface border-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Pagamento e prazo</div>
              <Field label="Condição" value={p.condicao_pagamento} />
              <Field label="Parcelas" value={p.parcelas} />
              <Field label="Prazo fabricação" value={p.prazo_fabricacao_dias ? `${p.prazo_fabricacao_dias} dias` : null} />
              <Field label="Prazo entrega" value={p.prazo_entrega_dias ? `${p.prazo_entrega_dias} dias` : null} />
              <Field label="Prazo instalação" value={p.prazo_instalacao_dias ? `${p.prazo_instalacao_dias} dias` : null} />
              <Field label="Garantia" value={p.garantia_meses ? `${p.garantia_meses} meses` : null} />
              <Field label="Frete" value={`${p.frete_tipo || "—"}${p.frete_incluso ? " (incluso)" : ""}`} />
            </Card>
            <Card className="p-5 gradient-surface border-border">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Técnico</div>
              {Object.entries(p.dados_tecnicos || {}).map(([k, v]) => (
                <Field key={k} label={k.replace(/_/g, " ")} value={v as any} />
              ))}
              <Field label="Score IA" value={p.score_confianca ? `${(p.score_confianca * 100).toFixed(0)}%` : null} />
            </Card>
          </div>

          {data.equips.length > 0 && (
            <Card className="gradient-surface border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border text-sm font-medium">Equipamentos ({data.equips.length})</div>
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Tipo</th>
                    <th className="text-left px-4 py-2 font-medium">Modelo</th>
                    <th className="text-left px-4 py-2 font-medium">Qtd</th>
                    <th className="text-left px-4 py-2 font-medium">HP</th>
                    <th className="text-left px-4 py-2 font-medium">kcal/h</th>
                    <th className="text-left px-4 py-2 font-medium">Compressor</th>
                    <th className="text-left px-4 py-2 font-medium">Gás</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.equips.map((e: any) => (
                    <tr key={e.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2">{e.tipo || "—"}</td>
                      <td className="px-4 py-2 font-mono text-xs">{e.modelo || "—"}</td>
                      <td className="px-4 py-2">{e.quantidade || "—"}</td>
                      <td className="px-4 py-2">{e.potencia_hp || "—"}</td>
                      <td className="px-4 py-2">{e.capacidade_kcal || "—"}</td>
                      <td className="px-4 py-2">{e.compressor || "—"}</td>
                      <td className="px-4 py-2">{e.gas_refrigerante || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {p.observacoes && <Card className="p-5 gradient-surface border-border"><div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Observações</div><div className="text-sm">{p.observacoes}</div></Card>}
          {p.riscos && <Card className="p-5 bg-warning/10 border-warning/30"><div className="text-xs uppercase tracking-wider text-warning mb-2">Riscos identificados</div><div className="text-sm">{p.riscos}</div></Card>}
        </>
      ) : (
        <Card className="p-8 text-center text-sm text-muted-foreground">Sem proposta extraída para este documento.</Card>
      )}

      {d.raw_text && (
        <Card className="gradient-surface border-border">
          <div className="px-5 py-3 border-b border-border text-sm font-medium flex items-center gap-2"><FileText className="size-4" />Texto extraído</div>
          <pre className="p-5 text-xs whitespace-pre-wrap max-h-96 overflow-y-auto scrollbar-thin font-mono text-muted-foreground">{d.raw_text.slice(0, 5000)}{d.raw_text.length > 5000 ? "\n\n[...truncado...]" : ""}</pre>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground capitalize">{label}</span>
      <span className="text-xs font-medium text-right">{value === null || value === undefined || value === "" ? "—" : String(value)}</span>
    </div>
  );
}
