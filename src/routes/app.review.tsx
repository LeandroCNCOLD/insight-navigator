import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { toast } from "sonner";
import {
  approveProposal,
  calculateReviewHealth,
  fetchReviewEvents,
  fetchReviewQueue,
  rejectProposal,
  requestReprocess,
  updateProposalField,
  type ReviewQueueItem,
} from "@/lib/review-center";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/review")({
  component: ReviewCenterPage,
  head: () => ({
    meta: [{ title: "Central de Revisão — DocIntel" }],
  }),
});

function ReviewCenterPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [onlyForensic, setOnlyForensic] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["review-queue", search, statusFilter, onlyForensic],
    queryFn: () =>
      fetchReviewQueue({
        search,
        status: statusFilter,
        onlyForensic,
        maxConfidence: 0.85,
      }),
  });

  const selected = useMemo(
    () => (data || []).find((item) => item.id === selectedId) ?? (data || [])[0] ?? null,
    [data, selectedId],
  );

  const eventsQuery = useQuery({
    queryKey: ["review-events", selected?.id],
    queryFn: () => fetchReviewEvents(selected!.id),
    enabled: Boolean(selected?.id),
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["review-queue"] });
    if (selected?.id) {
      qc.invalidateQueries({ queryKey: ["review-events", selected.id] });
    }
  };

  const approveMutation = useMutation({
    mutationFn: async (item: ReviewQueueItem) => {
      await approveProposal(item.id, item.document?.id ?? null, "Aprovado pela central de revisão");
    },
    onSuccess: () => {
      toast.success("Proposta aprovada");
      refreshAll();
    },
    onError: (error: any) => toast.error(error.message || "Falha ao aprovar"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (item: ReviewQueueItem) => {
      await rejectProposal(item.id, item.document?.id ?? null, "Revisão manual solicitada");
    },
    onSuccess: () => {
      toast.success("Proposta enviada para revisão pendente");
      refreshAll();
    },
    onError: (error: any) => toast.error(error.message || "Falha ao rejeitar"),
  });

  const reprocessMutation = useMutation({
    mutationFn: async (item: ReviewQueueItem) => {
      await requestReprocess(item.id, item.document?.id ?? null, "Reprocessamento solicitado pela revisão");
    },
    onSuccess: () => {
      toast.success("Solicitação de reprocessamento registrada");
      refreshAll();
    },
    onError: (error: any) => toast.error(error.message || "Falha ao solicitar reprocessamento"),
  });

  const summary = useMemo(() => {
    const rows = data || [];
    const low = rows.filter((r) => (r.score_confianca ?? 0) < 0.5).length;
    const medium = rows.filter((r) => (r.score_confianca ?? 0) >= 0.5 && (r.score_confianca ?? 0) < 0.75).length;
    const withForensic = rows.filter((r) => Boolean(r.document?.tem_analise_forense)).length;
    return {
      total: rows.length,
      low,
      medium,
      withForensic,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader
          title="Central de Revisão"
          description="Validação humana das propostas extraídas pela IA"
        />
        <Card className="p-8 text-sm text-muted-foreground">Carregando fila de revisão...</Card>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Central de Revisão"
          description="Validação humana das propostas extraídas pela IA"
        />
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhuma proposta precisa de revisão agora"
          description="Quando a extração gerar baixa confiança, os itens aparecerão aqui."
          action={
            <Link to="/app/proposals">
              <Button>Ir para propostas</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Central de Revisão"
        description="Aprove, ajuste, rejeite ou peça reprocessamento das propostas com baixa confiança"
        action={
          <div className="flex items-center gap-2">
            <Link to="/app/proposals">
              <Button variant="outline">Ver propostas</Button>
            </Link>
            <Button variant="outline" onClick={refreshAll}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Na fila" value={String(summary.total)} icon={ClipboardCheck} />
        <SummaryCard label="Críticas" value={String(summary.low)} icon={AlertTriangle} />
        <SummaryCard label="Médias" value={String(summary.medium)} icon={Sparkles} />
        <SummaryCard label="Com forense" value={String(summary.withForensic)} icon={FileSearch} />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.4fr_180px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, proposta, arquivo, vendedor..."
              className="pl-9"
            />
          </div>

          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos os status</option>
            <option value="extraida">Extraída</option>
            <option value="revisao_pendente">Revisão pendente</option>
            <option value="revisada_aprovada">Revisada aprovada</option>
            <option value="contratada">Contratada</option>
          </select>

          <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
            <input
              type="checkbox"
              checked={onlyForensic}
              onChange={(e) => setOnlyForensic(e.target.checked)}
            />
            Só com forense
          </label>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-3 space-y-3 max-h-[75vh] overflow-auto">
          {(data || []).map((item) => {
            const active = selected?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">{item.client?.nome || "Cliente desconhecido"}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.document?.file_name || "Sem documento"}
                    </div>
                  </div>
                  <ConfidenceBadge score={item.score_confianca} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">{item.numero || "Sem nº"}</Badge>
                  <Badge variant="outline">{item.client?.estado || "UF —"}</Badge>
                  <Badge variant="outline">{item.status_proposta || "status —"}</Badge>
                  {item.document?.tem_analise_forense ? (
                    <Badge>Forense</Badge>
                  ) : (
                    <Badge variant="secondary">Sem forense</Badge>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Valor: {formatBRL(item.valor_total)}</div>
                  <div>Saúde: {calculateReviewHealth(item)}%</div>
                  <div>Vendedor: {item.vendedor || "—"}</div>
                  <div>Garantia: {item.garantia_meses ? `${item.garantia_meses}m` : "—"}</div>
                </div>
              </button>
            );
          })}
        </Card>

        {selected ? (
          <ReviewDetailPanel
            item={selected}
            events={eventsQuery.data || []}
            onApprove={() => approveMutation.mutate(selected)}
            onReject={() => rejectMutation.mutate(selected)}
            onRequestReprocess={() => reprocessMutation.mutate(selected)}
            onRefresh={refreshAll}
          />
        ) : null}
      </div>
    </div>
  );
}

function ReviewDetailPanel({
  item,
  events,
  onApprove,
  onReject,
  onRequestReprocess,
  onRefresh,
}: {
  item: ReviewQueueItem;
  events: any[];
  onApprove: () => void;
  onReject: () => void;
  onRequestReprocess: () => void;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();

  const saveField = useMutation({
    mutationFn: async ({
      field,
      oldValue,
      newValue,
    }: {
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }) => {
      await updateProposalField(item.id, item.document?.id ?? null, field, oldValue, newValue);
    },
    onSuccess: () => {
      toast.success("Campo atualizado");
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      qc.invalidateQueries({ queryKey: ["review-events", item.id] });
      onRefresh();
    },
    onError: (error: any) => toast.error(error.message || "Falha ao salvar campo"),
  });

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">{item.client?.nome || "Cliente desconhecido"}</div>
            <div className="text-sm text-muted-foreground">
              {item.document?.file_name || "Sem documento vinculado"}
            </div>
          </div>
          <ConfidenceBadge score={item.score_confianca} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <EditableField
            label="Número da proposta"
            value={item.numero}
            onSave={(next) =>
              saveField.mutate({
                field: "numero",
                oldValue: item.numero,
                newValue: next,
              })
            }
          />
          <EditableField
            label="Valor total"
            type="number"
            value={item.valor_total}
            onSave={(next) =>
              saveField.mutate({
                field: "valor_total",
                oldValue: item.valor_total,
                newValue: next === "" ? null : Number(next),
              })
            }
          />
          <EditableField
            label="Vendedor"
            value={item.vendedor}
            onSave={(next) =>
              saveField.mutate({
                field: "vendedor",
                oldValue: item.vendedor,
                newValue: next,
              })
            }
          />
          <EditableField
            label="Garantia (meses)"
            type="number"
            value={item.garantia_meses}
            onSave={(next) =>
              saveField.mutate({
                field: "garantia_meses",
                oldValue: item.garantia_meses,
                newValue: next === "" ? null : Number(next),
              })
            }
          />
          <EditableField
            label="Condição de pagamento"
            value={item.condicao_pagamento}
            onSave={(next) =>
              saveField.mutate({
                field: "condicao_pagamento",
                oldValue: item.condicao_pagamento,
                newValue: next,
              })
            }
          />
          <EditableField
            label="Prazo de entrega (dias)"
            type="number"
            value={item.prazo_entrega_dias}
            onSave={(next) =>
              saveField.mutate({
                field: "prazo_entrega_dias",
                oldValue: item.prazo_entrega_dias,
                newValue: next === "" ? null : Number(next),
              })
            }
          />
          <EditableField
            label="Frete"
            value={item.frete_tipo}
            onSave={(next) =>
              saveField.mutate({
                field: "frete_tipo",
                oldValue: item.frete_tipo,
                newValue: next,
              })
            }
          />
          <EditableField
            label="Status da proposta"
            value={item.status_proposta}
            onSave={(next) =>
              saveField.mutate({
                field: "status_proposta",
                oldValue: item.status_proposta,
                newValue: next,
              })
            }
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {item.document?.id ? (
            <Link to="/app/documents/$id" params={{ id: item.document.id }}>
              <Button variant="outline">Abrir documento</Button>
            </Link>
          ) : null}

          {item.document?.id && item.document?.tem_analise_forense ? (
            <Link to="/app/documents/$id/forensic" params={{ id: item.document.id }}>
              <Button variant="outline">
                <FileSearch className="mr-2 h-4 w-4" />
                Abrir forense
              </Button>
            </Link>
          ) : null}

          <Button onClick={onApprove}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Aprovar
          </Button>

          <Button variant="outline" onClick={onReject}>
            <XCircle className="mr-2 h-4 w-4" />
            Marcar revisão pendente
          </Button>

          <Button variant="outline" onClick={onRequestReprocess}>
            <Sparkles className="mr-2 h-4 w-4" />
            Solicitar reprocessamento
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">Resumo técnico-operacional</div>
          <Badge variant="secondary">Saúde {calculateReviewHealth(item)}%</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <InfoRow label="Cliente" value={item.client?.nome} />
          <InfoRow label="UF" value={item.client?.estado} />
          <InfoRow label="Concorrente" value={item.competitor?.nome} />
          <InfoRow label="Documento" value={item.document?.file_name} />
          <InfoRow label="Status documento" value={item.document?.status} />
          <InfoRow label="Criado em" value={formatDate(item.created_at)} />
          <InfoRow label="Valor" value={formatBRL(item.valor_total)} />
          <InfoRow label="Confiança" value={`${Math.round((item.score_confianca ?? 0) * 100)}%`} />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">Histórico de revisão</div>
          <Badge variant="outline">{events.length} evento(s)</Badge>
        </div>

        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Ainda não há eventos de revisão para esta proposta.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{labelForEvent(event.action)}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(event.created_at)}</div>
                </div>

                {event.field_name ? (
                  <div className="mt-2 text-muted-foreground">
                    Campo: <span className="font-medium text-foreground">{event.field_name}</span>
                  </div>
                ) : null}

                {event.comment ? (
                  <div className="mt-2 text-muted-foreground">{event.comment}</div>
                ) : null}

                {event.old_value !== null || event.new_value !== null ? (
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <JsonBox title="Valor anterior" value={event.old_value} />
                    <JsonBox title="Novo valor" value={event.new_value} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function EditableField({
  label,
  value,
  type = "text",
  onSave,
}: {
  label: string;
  value: unknown;
  type?: "text" | "number";
  onSave: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value == null ? "" : String(value));

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex gap-2">
        <Input
          type={type}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => onSave(localValue)}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({
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
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </Card>
  );
}

function ConfidenceBadge({ score }: { score?: number | null }) {
  const pct = Math.round((score ?? 0) * 100);

  if (pct >= 85) return <Badge><ShieldCheck className="mr-1 h-3 w-3" />{pct}%</Badge>;
  if (pct >= 65) return <Badge variant="secondary">{pct}%</Badge>;
  return <Badge variant="destructive">{pct}%</Badge>;
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value == null || value === "" ? "—" : String(value)}</div>
    </div>
  );
}

function JsonBox({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <pre className="whitespace-pre-wrap break-words text-xs">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function labelForEvent(action: string) {
  switch (action) {
    case "field_update":
      return "Campo atualizado";
    case "approve":
      return "Proposta aprovada";
    case "reject":
      return "Marcada como revisão pendente";
    case "request_reprocess":
      return "Reprocessamento solicitado";
    case "comment":
      return "Comentário";
    default:
      return action;
  }
}
