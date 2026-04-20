import { supabase } from "@/integrations/supabase/client";

export type EquipmentRow = {
  id: string;
  tipo?: string | null;
  modelo?: string | null;
  quantidade?: number | null;
  potencia_hp?: number | null;
  capacidade_kcal?: number | null;
  compressor?: string | null;
  gas_refrigerante?: string | null;
  observacoes?: string | null;
  proposal?: {
    id?: string | null;
    numero?: string | null;
    valor_total?: number | null;
    data_proposta?: string | null;
    status_proposta?: string | null;
    dados_tecnicos?: Record<string, any> | null;
    client?: {
      nome?: string | null;
      estado?: string | null;
      cidade?: string | null;
    } | null;
    competitor?: {
      nome?: string | null;
    } | null;
  } | null;
};

export type EquipmentAggregateItem = {
  label: string;
  value: number;
};

export type ProposalEquipmentSummary = {
  proposalId: string;
  numero: string;
  cliente: string;
  estado: string;
  concorrente: string;
  totalEquipments: number;
  totalHp: number;
  totalKcal: number;
  valueTotal: number;
  gasSet: string[];
  compressorSet: string[];
  modelSet: string[];
};

export type EquipmentIntelligenceData = {
  rows: EquipmentRow[];
  totalRows: number;
  totalEquipments: number;
  totalHp: number;
  totalKcal: number;
  topModels: EquipmentAggregateItem[];
  topGases: EquipmentAggregateItem[];
  topCompressors: EquipmentAggregateItem[];
  byState: EquipmentAggregateItem[];
  byCompetitor: EquipmentAggregateItem[];
  topTechnicalCombos: EquipmentAggregateItem[];
  proposals: ProposalEquipmentSummary[];
  insights: string[];
};

function inc(map: Record<string, number>, key: string, value = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + value;
}

function toSortedArray(map: Record<string, number>, top = 10): EquipmentAggregateItem[] {
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

function normalizeText(value?: string | null) {
  return value?.trim() || "â";
}

function buildInsights(data: Omit<EquipmentIntelligenceData, "insights">): string[] {
  const insights: string[] = [];

  if (data.topModels[0]) {
    insights.push(
      `O modelo mais recorrente Ã© ${data.topModels[0].label}, com ${data.topModels[0].value} ocorrÃªncia(s).`,
    );
  }

  if (data.topGases[0]) {
    insights.push(
      `O gÃ¡s refrigerante mais recorrente Ã© ${data.topGases[0].label}, com ${data.topGases[0].value} ocorrÃªncia(s).`,
    );
  }

  if (data.topCompressors[0]) {
    insights.push(
      `O tipo de compressor mais recorrente Ã© ${data.topCompressors[0].label}, com ${data.topCompressors[0].value} ocorrÃªncia(s).`,
    );
  }

  if (data.byState[0]) {
    insights.push(
      `O estado com maior concentraÃ§Ã£o de equipamentos Ã© ${data.byState[0].label}.`,
    );
  }

  if (data.byCompetitor[0]) {
    insights.push(
      `O concorrente com mais equipamentos estruturados na base Ã© ${data.byCompetitor[0].label}.`,
    );
  }

  if (data.topTechnicalCombos[0]) {
    insights.push(
      `O combo tÃ©cnico mais recorrente hoje Ã© ${data.topTechnicalCombos[0].label}.`,
    );
  }

  const averageHpPerProposal = data.proposals.length
    ? data.proposals.reduce((acc, item) => acc + item.totalHp, 0) / data.proposals.length
    : 0;

  if (averageHpPerProposal > 0) {
    insights.push(
      `A mÃ©dia de HP total por proposta estruturada Ã© ${averageHpPerProposal.toFixed(1)} HP.`,
    );
  }

  const averageEquipmentsPerProposal = data.proposals.length
    ? data.proposals.reduce((acc, item) => acc + item.totalEquipments, 0) / data.proposals.length
    : 0;

  if (averageEquipmentsPerProposal > 0) {
    insights.push(
      `A mÃ©dia de quantidade de equipamentos por proposta Ã© ${averageEquipmentsPerProposal.toFixed(1)} unidade(s).`,
    );
  }

  if (!insights.length) {
    insights.push("Ainda nÃ£o hÃ¡ densidade suficiente de equipamentos para gerar insights automÃ¡ticos.");
  }

  return insights;
}

export async function fetchEquipmentIntelligenceData(): Promise<EquipmentIntelligenceData> {
  const { data, error } = await supabase
    .from("equipments")
    .select(`
      *,
      proposal:proposals(
        id,
        numero,
        valor_total,
        data_proposta,
        status_proposta,
        dados_tecnicos,
        client:clients(nome,estado,cidade),
        competitor:competitors!competitor_id(nome)
      )
    `);

  if (error) throw error;

  const rows = (data || []) as EquipmentRow[];

  const byModel: Record<string, number> = {};
  const byGas: Record<string, number> = {};
  const byCompressor: Record<string, number> = {};
  const byStateMap: Record<string, number> = {};
  const byCompetitorMap: Record<string, number> = {};
  const comboMap: Record<string, number> = {};

  let totalEquipments = 0;
  let totalHp = 0;
  let totalKcal = 0;

  const proposalMap = new Map<string, ProposalEquipmentSummary>();

  rows.forEach((row) => {
    const qty = row.quantidade || 1;
    totalEquipments += qty;
    totalHp += (row.potencia_hp || 0) * qty;
    totalKcal += (row.capacidade_kcal || 0) * qty;

    const model = normalizeText(row.modelo || row.tipo);
    const gas = normalizeText(row.gas_refrigerante);
    const compressor = normalizeText(row.compressor);
    const state = normalizeText(row.proposal?.client?.estado);
    const competitor = normalizeText(row.proposal?.competitor?.nome);

    inc(byModel, model, qty);
    inc(byGas, gas, qty);
    inc(byCompressor, compressor, qty);
    inc(byStateMap, state, qty);
    inc(byCompetitorMap, competitor, qty);

    const combo = `${model} Â· ${gas} Â· ${compressor}`;
    inc(comboMap, combo, qty);

    const proposalId = row.proposal?.id;
    if (proposalId) {
      if (!proposalMap.has(proposalId)) {
        proposalMap.set(proposalId, {
          proposalId,
          numero: row.proposal?.numero || "â",
          cliente: row.proposal?.client?.nome || "â",
          estado: row.proposal?.client?.estado || "â",
          concorrente: row.proposal?.competitor?.nome || "â",
          totalEquipments: 0,
          totalHp: 0,
          totalKcal: 0,
          valueTotal: row.proposal?.valor_total || 0,
          gasSet: [],
          compressorSet: [],
          modelSet: [],
        });
      }

      const proposalSummary = proposalMap.get(proposalId)!;
      proposalSummary.totalEquipments += qty;
      proposalSummary.totalHp += (row.potencia_hp || 0) * qty;
      proposalSummary.totalKcal += (row.capacidade_kcal || 0) * qty;

      if (row.gas_refrigerante && !proposalSummary.gasSet.includes(row.gas_refrigerante)) {
        proposalSummary.gasSet.push(row.gas_refrigerante);
      }
      if (row.compressor && !proposalSummary.compressorSet.includes(row.compressor)) {
        proposalSummary.compressorSet.push(row.compressor);
      }
      const modelLabel = row.modelo || row.tipo;
      if (modelLabel && !proposalSummary.modelSet.includes(modelLabel)) {
        proposalSummary.modelSet.push(modelLabel);
      }
    }
  });

  const proposals = Array.from(proposalMap.values()).sort((a, b) => b.totalHp - a.totalHp);

  const base = {
    rows,
    totalRows: rows.length,
    totalEquipments,
    totalHp,
    totalKcal,
    topModels: toSortedArray(byModel, 12),
    topGases: toSortedArray(byGas, 12),
    topCompressors: toSortedArray(byCompressor, 12),
    byState: toSortedArray(byStateMap, 12),
    byCompetitor: toSortedArray(byCompetitorMap, 12),
    topTechnicalCombos: toSortedArray(comboMap, 12),
    proposals,
  };

  return {
    ...base,
    insights: buildInsights(base),
  };
}
