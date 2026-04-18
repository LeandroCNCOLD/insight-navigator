import { supabase } from "@/integrations/supabase/client";

export type ForensicSection = {
  ordem?: number | null;
  titulo?: string | null;
  tipo?: string | null;
  pagina_inicio?: number | null;
  pagina_fim?: number | null;
};

export type LiteralField = {
  nome?: string | null;
  valor?: string | null;
  pagina?: number | null;
  trecho?: string | null;
  score?: number | null;
};

export type TaxonomyBlock = {
  categoria?: string | null;
  bloco?: string | null;
  evidencia?: string | null;
  pagina?: number | null;
};

export type InferenceItem = {
  chave?: string | null;
  valor?: string | null;
  justificativa?: string | null;
  evidencias?: string[] | null;
  score?: number | null;
};

export type ConflictItem = {
  campo?: string | null;
  observacao?: string | null;
  trechos?: string[] | null;
};

export type ForensicAnalysis = {
  id: string;
  document_id: string;
  versao: number;
  modelo_ia?: string | null;
  score_estrutura?: number | null;
  score_rastreabilidade?: number | null;
  score_analiticidade?: number | null;
  score_confianca_global?: number | null;
  tem_assinatura?: boolean | null;
  tem_docusign?: boolean | null;
  tem_carimbo?: boolean | null;
  tem_tabelas?: boolean | null;
  tem_formulario?: boolean | null;
  secoes?: ForensicSection[] | null;
  cabecalhos?: string[] | null;
  rodapes?: string[] | null;
  campos_literais?: LiteralField[] | null;
  taxonomia_blocos?: TaxonomyBlock[] | null;
  resumo_executivo?: string | null;
  resumo_tecnico?: string | null;
  resumo_comercial?: string | null;
  resumo_contratual?: string | null;
  riscos_operacionais?: string | null;
  riscos_juridicos?: string | null;
  padrao_posicionamento?: string | null;
  padrao_transferencia_risco?: string | null;
  padrao_pagamento?: string | null;
  padrao_garantia?: string | null;
  padrao_tecnico?: string | null;
  insights_benchmarking?: string | null;
  inferencias?: InferenceItem[] | null;
  conflitos_documentais?: ConflictItem[] | null;
  created_at?: string | null;
};

export type ForensicNavigatorData = {
  document: any | null;
  proposal: any | null;
  equipments: any[];
  analyses: ForensicAnalysis[];
};

export async function fetchForensicNavigatorData(documentId: string): Promise<ForensicNavigatorData> {
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("*, competitor:competitors(nome), client:clients(*)")
    .eq("id", documentId)
    .maybeSingle();

  if (docError) throw docError;

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("*")
    .eq("document_id", documentId)
    .maybeSingle();

  if (proposalError) throw proposalError;

  const { data: equipments, error: equipError } = proposal
    ? await supabase.from("equipments").select("*").eq("proposal_id", proposal.id)
    : { data: [], error: null as any };

  if (equipError) throw equipError;

  const { data: analyses, error: analysesError } = await supabase
    .from("forensic_analyses")
    .select("*")
    .eq("document_id", documentId)
    .order("versao", { ascending: false });

  if (analysesError) throw analysesError;

  return {
    document: document || null,
    proposal: proposal || null,
    equipments: equipments || [],
    analyses: (analyses || []) as ForensicAnalysis[],
  };
}

export function splitRawText(rawText?: string | null) {
  if (!rawText) return [];
  return rawText
    .split(/\n{2,}/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => ({
      id: `chunk-${index + 1}`,
      index: index + 1,
      text: chunk,
      length: chunk.length,
    }));
}

export function forensicStatusTone(score?: number | null) {
  if (score == null) return "secondary";
  if (score >= 0.8) return "default";
  if (score >= 0.6) return "secondary";
  return "destructive";
}

export function percent(score?: number | null) {
  if (score == null) return "—";
  return `${Math.round(score * 100)}%`;
}
