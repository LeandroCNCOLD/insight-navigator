import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText, Sparkles, Loader2, Trophy } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { OriginFilter, filterByOrigin, isHouseRow, type OriginValue } from "@/components/origin-filter";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/app/proposals")({
  component: Proposals,
  head: () => ({ meta: [{ title: "Propostas — DocIntel" }] }),
});

function Proposals() {
  const qc = useQueryClient();
  const [origin, setOrigin] = useState<OriginValue>("all");
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState<{ proposalId: string; text: string; cliente: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["proposals"],
    queryFn: async () => {
      const { data } = await supabase.from("proposals")
        .select("*,document:documents(file_name),client:clients(nome,estado,cnpj),competitor:competitors!competitor_id(id,nome,is_house),vencedor:competitors!vencedor_competitor_id(nome)")
        .order("data_proposta", { ascending: false });
      return data || [];
    },
  });

  const { data: competitorsList } = useQuery({
    queryKey: ["competitors-rivals"],
    queryFn: async () => {
      const { data } = await supabase.from("competitors").select("id,nome,is_house").order("nome");
      return (data || []).filter((c: any) => !c.is_house);
    },
  });

  const counts = useMemo(() => {
    const list = data || [];
    return {
      all: list.length,
      house: list.filter(isHouseRow).length,
      rival: list.filter((r: any) => !isHouseRow(r)).length,
    };
  }, [data]);

  const filtered = useMemo(() => filterByOrigin((data || []) as any[], origin), [data, origin]);

  async function updateResult(id: string, fields: Record<string, any>) {
    const { error } = await supabase.from("proposals").update(fields as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["proposals"] });
    toast.success("Atualizado");
  }

  async function analyzeDispute(p: any) {
    setAnalyzing(p.id);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");

      // Busca propostas do mesmo cliente (CNPJ ou client_id) por concorrentes
      let rivals: any[] = [];
      if (p.client?.cnpj) {
        const { data } = await supabase.from("proposals")
          .select("*,client:clients(nome,cnpj),competitor:competitors!competitor_id(nome,is_house)")
          .neq("id", p.id);
        rivals = (data || []).filter((r: any) => !r.competitor?.is_house && r.client?.cnpj === p.client.cnpj);
      }
      if (rivals.length === 0 && p.client_id) {
        const { data } = await supabase.from("proposals")
          .select("*,client:clients(nome,cnpj),competitor:competitors!competitor_id(nome,is_house)")
          .eq("client_id", p.client_id).neq("id", p.id);
        rivals = (data || []).filter((r: any) => !r.competitor?.is_house);
      }

      const ctx = {
        cliente: p.client?.nome,
        cnpj: p.client?.cnpj,
        resultado: p.resultado_disputa || "em_aberto",
        vencedor: p.vencedor?.nome,
        motivo: p.motivo_resultado,
        casa: {
          numero: p.numero, valor: p.valor_total, prazo: p.prazo_entrega_dias,
          garantia: p.garantia_meses, pagamento: p.condicao_pagamento, status: p.status_proposta,
          tecnico: p.dados_tecnicos,
        },
        concorrentes: rivals.map((r: any) => ({
          fornecedor: r.competitor?.nome, numero: r.numero, valor: r.valor_total,
          prazo: r.prazo_entrega_dias, garantia: r.garantia_meses, pagamento: r.condicao_pagamento,
          status: r.status_proposta, tecnico: r.dados_tecnicos,
        })),
      };

      const pergunta = p.resultado_disputa === "ganha"
        ? `Esta proposta da CN Cold para ${p.client?.nome} foi GANHA. Compare com as ${rivals.length} proposta(s) concorrente(s) do mesmo cliente e explique de forma estruturada: (1) Por que ganhamos? (preço, prazo, garantia, técnica, pagamento); (2) Diferenciais principais; (3) Lições para reaplicar em outros confrontos. Use bullets e Δ% quando aplicável. Contexto JSON: ${JSON.stringify(ctx)}`
        : p.resultado_disputa === "perdida"
        ? `Esta proposta da CN Cold para ${p.client?.nome} foi PERDIDA${p.vencedor?.nome ? ` para ${p.vencedor.nome}` : ""}. Compare com as ${rivals.length} proposta(s) concorrente(s) e explique: (1) Por que perdemos? (preço, prazo, garantia, técnica, pagamento); (2) Onde ficamos vulneráveis; (3) Recomendações acionáveis para o próximo confronto. Use bullets e Δ%. Contexto JSON: ${JSON.stringify(ctx)}`
        : `Análise comparativa entre a proposta da CN Cold e as ${rivals.length} proposta(s) concorrente(s) para ${p.client?.nome}. Aponte vantagens, riscos e provável motivo de decisão. Contexto JSON: ${JSON.stringify(ctx)}`;

      const { data: ai, error } = await supabase.functions.invoke("market-intelligence", {
        body: { question: pergunta, context: ctx },
      });
      if (error) throw error;
      const answer = (ai as any)?.answer || (ai as any)?.response || (ai as any)?.text || JSON.stringify(ai);

      // Persiste/atualiza disputa
      const { data: existing } = await supabase.from("proposal_disputes")
        .select("id").eq("house_proposal_id", p.id).maybeSingle();

      const payload = {
        owner_id: u.user.id,
        house_proposal_id: p.id,
        client_id: p.client_id,
        titulo: `Disputa ${p.client?.nome || ""}`.trim(),
        resultado: p.resultado_disputa || "em_aberto",
        winner_competitor_id: p.vencedor_competitor_id,
        motivo_resultado: p.motivo_resultado,
        ai_analysis: { text: answer, generated_at: new Date().toISOString(), rivals_count: rivals.length },
        ai_analyzed_at: new Date().toISOString(),
      };
      if (existing?.id) {
        await supabase.from("proposal_disputes").update(payload).eq("id", existing.id);
      } else {
        const { data: disp } = await supabase.from("proposal_disputes").insert(payload).select("id").single();
        if (disp?.id) {
          await supabase.from("dispute_competitors").insert(
            rivals.map((r: any) => ({
              owner_id: u.user.id,
              dispute_id: disp.id,
              competitor_proposal_id: r.id,
              is_winner: p.vencedor_competitor_id ? r.competitor?.id === p.vencedor_competitor_id : false,
            }))
          );
        }
      }

      setAnalysisOpen({ proposalId: p.id, text: answer, cliente: p.client?.nome || "" });
      toast.success(`Análise gerada · ${rivals.length} concorrente(s) considerado(s)`);
    } catch (e: any) {
      toast.error(`Falha: ${e.message || e}`);
    } finally {
      setAnalyzing(null);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Propostas"
        description={`${filtered.length} de ${data?.length || 0} proposta(s)`}
        action={<OriginFilter value={origin} onChange={setOrigin} counts={counts} />}
      />
      {!filtered.length ? <EmptyState icon={FileText} title="Sem propostas" description="As propostas aparecerão aqui após o processamento de documentos." /> : (
        <Card className="gradient-surface border-border overflow-hidden">
          <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Origem</th>
                <th className="text-left px-4 py-2.5 font-medium">Nº / Documento</th>
                <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium">UF</th>
                <th className="text-left px-4 py-2.5 font-medium">Data</th>
                <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                <th className="text-left px-4 py-2.5 font-medium">Resultado</th>
                <th className="text-left px-4 py-2.5 font-medium">Vencedor</th>
                <th className="text-left px-4 py-2.5 font-medium">Análise</th>
                <th className="text-left px-4 py-2.5 font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p: any) => {
                const isHouse = isHouseRow(p);
                return (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    {isHouse ? (
                      <Badge className="text-[10px] bg-success text-success-foreground hover:bg-success">CN Cold</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">{p.competitor?.nome || "Concorrente"}</Badge>
                    )}
                  </td>
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
                  <td className="px-4 py-2.5">
                    {isHouse ? (
                      <select
                        className="h-7 rounded border bg-background px-1 text-xs"
                        value={p.resultado_disputa || ""}
                        onChange={(e) => updateResult(p.id, {
                          resultado_disputa: e.target.value || null,
                          ...(e.target.value !== "perdida" ? { vencedor_competitor_id: null } : {}),
                        })}
                      >
                        <option value="">— em aberto —</option>
                        <option value="ganha">Ganha</option>
                        <option value="perdida">Perdida</option>
                        <option value="em_aberto">Em aberto</option>
                      </select>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {isHouse && p.resultado_disputa === "perdida" ? (
                      <select
                        className="h-7 rounded border bg-background px-1 text-xs max-w-[180px]"
                        value={p.vencedor_competitor_id || ""}
                        onChange={(e) => updateResult(p.id, { vencedor_competitor_id: e.target.value || null })}
                      >
                        <option value="">— quem ganhou? —</option>
                        {(competitorsList || []).map((c: any) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    ) : isHouse && p.resultado_disputa === "ganha" ? (
                      <Badge className="text-[10px] bg-success text-success-foreground hover:bg-success"><Trophy className="size-3 mr-1" />CN Cold</Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {isHouse ? (
                      <Button size="sm" variant="ghost" disabled={analyzing === p.id} onClick={() => analyzeDispute(p)}>
                        {analyzing === p.id ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                        <span className="ml-1 text-xs">Analisar</span>
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5"><Badge className="text-[10px]" variant={p.score_confianca > 0.7 ? "default" : "secondary"}>{p.score_confianca ? `${(p.score_confianca*100).toFixed(0)}%` : "—"}</Badge></td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      <Dialog open={!!analysisOpen} onOpenChange={(v) => !v && setAnalysisOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Análise da disputa — {analysisOpen?.cliente}</DialogTitle>
            <DialogDescription>Comparativo gerado por IA cruzando a proposta CN Cold com as do(s) concorrente(s) do mesmo cliente.</DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{analysisOpen?.text || ""}</ReactMarkdown>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalysisOpen(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
