import { supabase } from "@/integrations/supabase/client";

export type RadarInsight = {
  id: string;
  category:
    | "commercial"
    | "technical"
    | "regional"
    | "competitor"
    | "risk"
    | "quality";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  evidence?: string[];
  metricLabel?: string;
  metricValue?: string;
};

export type RadarMetric = {
  label: string;
  value: number;
};

export type RadarProposal = {
  id: string;
  numero?: string | null;
  valor_total?: number | null;
  score_confianca?: number | null;
  prazo_entrega_dias?: number | null;
  garantia_meses?: number | null;
  frete_tipo?: string | null;
  status_proposta?: string | null;
  competitor?: { nome?: string | null } | null;
  client?: { nome?: string | null; estado?: string | null } | null;
  equipments?: Array<{
    quantidade?: number | null;
    potencia_hp?: number | null;
    capacidade_kcal?: number | null;
    modelo?: string | null;
    compressor?: string | null;
    gas_refrigerante?: string | null;
  }>;
};

export type InsightRadarData = {
  totalProposals: number;
  totalValue: number;
  totalEquipments: number;
  avgConfidence: number;
  byCompetitor: RadarMetric[];
  byState: RadarMetric[];
  byModel: RadarMetric[];
  byGas: RadarMetric[];
  byCompressor: RadarMetric[];
  topValueProposals: RadarProposal[];
  lowestConfidenceProposals: RadarProposal[];
  highestHpProposals: Array<RadarProposal & { totalHp: number; totalKcal: number }>;
  insights: RadarInsight[];
};

function inc(map: Record<string, number>, key: string, amount = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + amount;
}

function toMetrics(map: Record<string, number>, limit = 10): RadarMetric[] {
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function sumHp(items: RadarProposal["equipments"] = []) {
  return (items || []).reduce(
    (acc, item) => acc + ((item.potencia_hp || 0) * (item.quantidade || 1)),
    0,
  );
}

function sumKcal(items: RadarProposal["equipments"] = []) {
  return (items || []).reduce(
    (acc, item) => acc + ((item.capacidade_kcal || 0) * (item.quantidade || 1)),
    0,
  );
}

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export async function fetchInsightRadarData(): Promise<InsightRadarData> {
  const { data, error } = await supabase
    .from("proposals")
    .select(`
      id,
      numero,
      valor_total,
      score_confianca,
      prazo_entrega_dias,
      garantia_meses,
      frete_tipo,
      status_proposta,
      competitor:competitors(nome),
      client:clients(nome,estado),
      equipments(
        quantidade,
        potencia_hp,
        capacidade_kcal,
        modelo,
        compressor,
        gas_refrigerante
      )
    `)
    .order("valor_total", { ascending: false });

  if (error) throw error;

  const proposals = ((data || []) as RadarProposal[]).map((p) => ({
    ...p,
    equipments: p.equipments || [],
  }));

  const byCompetitorMap: Record<string, number> = {};
  const byStateMap: Record<string, number> = {};
  const byModelMap: Record<string, number> = {};
  const byGasMap: Record<string, number> = {};
  const byCompressorMap: Record<string, number> = {};

  let totalValue = 0;
  let totalEquipments = 0;
  let confidenceSum = 0;

  proposals.forEach((proposal) => {
    totalValue += proposal.valor_total || 0;
    confidenceSum += proposal.score_confianca || 0;

    inc(byCompetitorMap, proposal.competitor?.nome || "—", 1);
    inc(byStateMap, proposal.client?.estado || "—", 1);

    (proposal.equipments || []).forEach((eq) => {
      const qty = eq.quantidade || 1;
      totalEquipments += qty;
      inc(byModelMap, eq.modelo || "—", qty);
      inc(byGasMap, eq.gas_refrigerante || "—", qty);
      inc(byCompressorMap, eq.compressor || "—", qty);
    });
  });

  const byCompetitor = toMetrics(byCompetitorMap, 12);
  const byState = toMetrics(byStateMap, 12);
  const byModel = toMetrics(byModelMap, 12);
  const byGas = toMetrics(byGasMap, 12);
  const byCompressor = toMetrics(byCompressorMap, 12);

  const topValueProposals = [...proposals]
    .sort((a, b) => (b.valor_total || 0) - (a.valor_total || 0))
    .slice(0, 10);

  const lowestConfidenceProposals = [...proposals]
    .sort((a, b) => (a.score_confianca || 0) - (b.score_confianca || 0))
    .slice(0, 10);

  const highestHpProposals = proposals
    .map((p) => ({
      ...p,
      totalHp: sumHp(p.equipments),
      totalKcal: sumKcal(p.equipments),
    }))
    .sort((a, b) => b.totalHp - a.totalHp)
    .slice(0, 10);

  const avgConfidence = proposals.length ? confidenceSum / proposals.length : 0;

  const insights: RadarInsight[] = [];

  if (byCompetitor[0]) {
    insights.push({
      id: "top-competitor-count",
      category: "competitor",
      severity: "medium",
      title: "Maior concentração de propostas por concorrente",
      description: `${byCompetitor[0].label} lidera a base em quantidade de propostas mapeadas.`,
      evidence: [`${byCompetitor[0].label}: ${byCompetitor[0].value} proposta(s)`],
      metricLabel: "Propostas",
      metricValue: String(byCompetitor[0].value),
    });
  }

  if (byState[0]) {
    insights.push({
      id: "top-state-count",
      category: "regional",
      severity: "medium",
      title: "Estado com maior concentração",
      description: `${byState[0].label} é o estado com maior volume de propostas estruturadas.`,
      evidence: [`${byState[0].label}: ${byState[0].value} proposta(s)`],
      metricLabel: "Estado líder",
      metricValue: byState[0].label,
    });
  }

  if (byModel[0]) {
    insights.push({
      id: "top-model",
      category: "technical",
      severity: "medium",
      title: "Modelo mais recorrente",
      description: `${byModel[0].label} é o modelo de equipamento mais recorrente na base.`,
      evidence: [`${byModel[0].label}: ${byModel[0].value} ocorrência(s)`],
      metricLabel: "Modelo",
      metricValue: byModel[0].label,
    });
  }

  if (byGas[0]) {
    insights.push({
      id: "top-gas",
      category: "technical",
      severity: "low",
      title: "Gás refrigerante dominante",
      description: `${byGas[0].label} aparece como o gás mais recorrente.`,
      evidence: [`${byGas[0].label}: ${byGas[0].value} ocorrência(s)`],
      metricLabel: "Gás",
      metricValue: byGas[0].label,
    });
  }

  const highValueLowConfidence = proposals
    .filter((p) => (p.valor_total || 0) >= 500000 && (p.score_confianca || 0) < 0.7)
    .sort((a, b) => (b.valor_total || 0) - (a.valor_total || 0));

  if (highValueLowConfidence[0]) {
    insights.push({
      id: "risk-high-value-low-confidence",
      category: "risk",
      severity: "high",
      title: "Propostas de alto valor com baixa confiança",
      description:
        "Existem propostas relevantes financeiramente que ainda carregam baixa confiança estrutural.",
      evidence: highValueLowConfidence.slice(0, 3).map((p) => {
        const cliente = p.client?.nome || "Cliente";
        const numero = p.numero || p.id.slice(0, 6);
        return `${cliente} · ${numero} · ${brl(p.valor_total || 0)} · confiança ${pct(p.score_confianca || 0)}`;
      }),
      metricLabel: "Casos",
      metricValue: String(highValueLowConfidence.length),
    });
  }

  const longLeadTime = proposals
    .filter((p) => (p.prazo_entrega_dias || 0) >= 90)
    .sort((a, b) => (b.prazo_entrega_dias || 0) - (a.prazo_entrega_dias || 0));

  if (longLeadTime[0]) {
    insights.push({
      id: "commercial-long-lead-time",
      category: "commercial",
      severity: "medium",
      title: "Prazo de entrega elevado em parte da base",
      description:
        "Há propostas com prazo de entrega elevado, o que pode impactar competitividade comercial.",
      evidence: longLeadTime.slice(0, 3).map((p) => {
        const cliente = p.client?.nome || "Cliente";
        return `${cliente} · ${p.numero || "sem nº"} · ${p.prazo_entrega_dias || 0} dias`;
      }),
      metricLabel: "Propostas >= 90 dias",
      metricValue: String(longLeadTime.length),
    });
  }

  if (avgConfidence < 0.8) {
    insights.push({
      id: "quality-average-confidence",
      category: "quality",
      severity: "medium",
      title: "Confiabilidade média abaixo do ideal",
      description:
        "A confiança média da base ainda indica espaço para revisão e amadurecimento da extração.",
      evidence: [`Confiança média observada: ${pct(avgConfidence)}`],
      metricLabel: "Confiança média",
      metricValue: pct(avgConfidence),
    });
  }

  return {
    totalProposals: proposals.length,
    totalValue,
    totalEquipments,
    avgConfidence,
    byCompetitor,
    byState,
    byModel,
    byGas,
    byCompressor,
    topValueProposals,
    lowestConfidenceProposals,
    highestHpProposals,
    insights,
  };
}
