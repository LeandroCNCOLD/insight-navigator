import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/proposals")({
  component: Proposals,
  head: () => ({ meta: [{ title: "Propostas — DocIntel" }] }),
});

function Proposals() {
  const { data } = useQuery({
    queryKey: ["proposals"],
    queryFn: async () => {
      const { data } = await supabase.from("proposals")
        .select("*,document:documents(file_name),client:clients(nome,estado),competitor:competitors(nome)")
        .order("data_proposta", { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Propostas" description={`${data?.length || 0} proposta(s) extraída(s)`} />
      {!data?.length ? <EmptyState icon={FileText} title="Sem propostas" description="As propostas aparecerão aqui após o processamento de documentos." /> : (
        <Card className="gradient-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Nº / Documento</th>
                <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium">UF</th>
                <th className="text-left px-4 py-2.5 font-medium">Data</th>
                <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                <th className="text-left px-4 py-2.5 font-medium">Pagamento</th>
                <th className="text-left px-4 py-2.5 font-medium">Garantia</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((p: any) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <Link to="/app/documents/$id" params={{ id: p.document_id }} className="hover:text-primary">
                      <div className="font-mono text-xs">{p.numero || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-xs">{p.document?.file_name}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{p.client?.nome || "—"}</td>
                  <td className="px-4 py-2.5">{p.client?.estado || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(p.data_proposta)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatBRL(p.valor_total)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.condicao_pagamento || "—"}</td>
                  <td className="px-4 py-2.5">{p.garantia_meses ? `${p.garantia_meses}m` : "—"}</td>
                  <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[10px]">{p.status_proposta || "—"}</Badge></td>
                  <td className="px-4 py-2.5"><Badge className="text-[10px]" variant={p.score_confianca > 0.7 ? "default" : "secondary"}>{p.score_confianca ? `${(p.score_confianca*100).toFixed(0)}%` : "—"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
