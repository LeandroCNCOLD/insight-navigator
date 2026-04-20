import { supabase } from "@/integrations/supabase/client";

export type IntelligenceDatasetRow = {
  id: string;
  numero?: string | null;
  status_proposta?: string | null;
  objeto?: string | null;
  valor_total?: number | null;
  margem_estimada?: number | null;
  score_confianca?: number | null;
  created_at?: string | null;
  client?: {
    nome?: string | null;
    estado?: string | null;
  } | null;
  competitor?: {
    nome?: string | null;
  } | null;
  equipments?: Array<Record<string, unknown>> | null;
};

export async function buildIntelligenceDataset(): Promise<IntelligenceDatasetRow[]> {
  const { data, error } = await supabase.from("proposals").select(`
      *,
      client:clients(nome,estado),
      competitor:competitors!competitor_id(nome),
      equipments(*)
    `);

  if (error) {
    throw new Error(error.message || "Falha ao consolidar dataset de inteligência.");
  }

  return (data || []) as IntelligenceDatasetRow[];
}

export function serializeIntelligenceContext(dataset: IntelligenceDatasetRow[], limit = 15000) {
  return JSON.stringify(dataset, null, 2).slice(0, limit);
}
