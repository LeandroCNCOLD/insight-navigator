import { supabase } from "@/integrations/supabase/client";

export type ReviewQueueItem = {
  id: string;
  numero: string | null;
  valor_total: number | null;
  vendedor: string | null;
  garantia_meses: number | null;
  condicao_pagamento: string | null;
  prazo_entrega_dias: number | null;
  frete_tipo: string | null;
  status_proposta: string | null;
  score_confianca: number | null;
  created_at?: string | null;
  client?: {
    nome?: string | null;
    estado?: string | null;
  } | null;
  document?: {
    id?: string | null;
    file_name?: string | null;
    status?: string | null;
    tem_analise_forense?: boolean | null;
  } | null;
  competitor?: {
    nome?: string | null;
  } | null;
};

export type ReviewFilters = {
  search: string;
  maxConfidence?: number;
  status?: string;
  onlyForensic?: boolean;
};

export type ReviewEvent = {
  id: string;
  proposal_id: string;
  document_id: string | null;
  action: "field_update" | "approve" | "reject" | "request_reprocess" | "comment";
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
  comment: string | null;
  created_by: string | null;
  created_at: string;
};

export async function fetchReviewQueue(filters: ReviewFilters): Promise<ReviewQueueItem[]> {
  let query = supabase
    .from("proposals")
    .select(`
      id,
      numero,
      valor_total,
      vendedor,
      garantia_meses,
      condicao_pagamento,
      prazo_entrega_dias,
      frete_tipo,
      status_proposta,
      score_confianca,
      created_at,
      client:clients(nome,estado),
      competitor:competitors!competitor_id(nome),
      document:documents(id,file_name,status,tem_analise_forense)
    `)
    .order("score_confianca", { ascending: true })
    .order("created_at", { ascending: false });

  if (typeof filters.maxConfidence === "number") {
    query = query.lte("score_confianca", filters.maxConfidence);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status_proposta", filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data || []) as ReviewQueueItem[];

  if (filters.onlyForensic) {
    rows = rows.filter((row) => Boolean(row.document?.tem_analise_forense));
  }

  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    rows = rows.filter((row) => {
      return [
        row.numero,
        row.client?.nome,
        row.client?.estado,
        row.document?.file_name,
        row.vendedor,
        row.competitor?.nome,
        row.status_proposta,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }

  return rows;
}

export async function fetchReviewEvents(proposalId: string): Promise<ReviewEvent[]> {
  const { data, error } = await supabase
    .from("proposal_review_events")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as ReviewEvent[];
}

export async function updateProposalField(
  proposalId: string,
  documentId: string | null,
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
) {
  const patch: any = { [fieldName]: newValue };

  const { error } = await supabase.from("proposals").update(patch).eq("id", proposalId);
  if (error) throw error;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("proposal_review_events").insert({
    proposal_id: proposalId,
    document_id: documentId,
    action: "field_update",
    field_name: fieldName,
    old_value: oldValue as any,
    new_value: newValue as any,
    comment: null,
    created_by: user?.id ?? null,
  });
}

export async function approveProposal(proposalId: string, documentId: string | null, comment?: string) {
  const { error } = await supabase
    .from("proposals")
    .update({
      score_confianca: 1,
      status_proposta: "revisada_aprovada",
    })
    .eq("id", proposalId);

  if (error) throw error;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("proposal_review_events").insert({
    proposal_id: proposalId,
    document_id: documentId,
    action: "approve",
    field_name: null,
    old_value: null,
    new_value: { score_confianca: 1, status_proposta: "revisada_aprovada" } as any,
    comment: comment || null,
    created_by: user?.id ?? null,
  });
}

export async function rejectProposal(proposalId: string, documentId: string | null, comment?: string) {
  const { error } = await supabase
    .from("proposals")
    .update({
      status_proposta: "revisao_pendente",
    })
    .eq("id", proposalId);

  if (error) throw error;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("proposal_review_events").insert({
    proposal_id: proposalId,
    document_id: documentId,
    action: "reject",
    field_name: null,
    old_value: null,
    new_value: { status_proposta: "revisao_pendente" } as any,
    comment: comment || null,
    created_by: user?.id ?? null,
  });
}

export async function requestReprocess(proposalId: string, documentId: string | null, comment?: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("proposal_review_events").insert({
    proposal_id: proposalId,
    document_id: documentId,
    action: "request_reprocess",
    field_name: null,
    old_value: null,
    new_value: null,
    comment: comment || null,
    created_by: user?.id ?? null,
  });
}

export function calculateReviewHealth(item: ReviewQueueItem) {
  const fields = [
    item.numero,
    item.valor_total,
    item.vendedor,
    item.garantia_meses,
    item.condicao_pagamento,
    item.prazo_entrega_dias,
    item.frete_tipo,
    item.status_proposta,
    item.client?.nome,
    item.document?.file_name,
  ];

  const filled = fields.filter((value) => value !== null && value !== undefined && value !== "").length;
  return Math.round((filled / fields.length) * 100);
}
