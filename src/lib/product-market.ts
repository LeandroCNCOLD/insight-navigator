import { supabase } from "@/integrations/supabase/client";

export type MarketMetric = {
  label: string;
  value: number;
};

export type ProductPattern = {
  key: string;
  count: number;
  avgValue: number;
  avgHp: number;
  avgKcal: number;
  avgEquipments: number;
  states: string[];
  competitors: string[];
  models: string[];
  gases: string[];
  compressors: string[];
};

export type RegionalOpportunity = {
  state: string;
  proposals: number;
  totalValue: number;
  avgValue: number;
  avgHp: number;
  avgKcal: number;
  avgEquipments: number;
  competitors: string[];
  dominantModels: string[];
};

export type ProductSuggestion = {
  id: string;
  title: string;
  rationale: string;
  confidence: "low" | "medium" | "high";
  targetRegion?: string;
  targetPattern?: string;
  expectedPriceBand?: string;
  evidence: string[];
};

export type MarketProposalRow = {
  id: string;
  numero?: string | null;
  valor_total?: number | null;
  data_proposta?: string | null;
  status_proposta?: string | null;
  score_confianca?: number | null;
  competitor?: { nome?: string | null } | null;
  client?: {
    nome?: string | null;
    estado?: string | null;
    cidade?: string | null;
    segmento?: string | null;
  } | null;
  equipments?: Array<{
    quantidade?: number | null;
    potencia_hp?: number | null;
    capacidade_kcal?: number | null;
    modelo?: string | null;
    compressor?: string | null;
    gas_refrigerante?: string | null;
    tipo?: string | null;
  }>;
};

export type ProductMarketData = {
  totalProposals: number;
  totalValue: number;
  avgTicket: number;
  avgConfidence: number;
  totalEquipments: number;
  totalHp: number;
  totalKcal: number;
  byState: MarketMetric[];
  byCompetitor: MarketMetric[];
  byModel: MarketMetric[];
  byGas: MarketMetric[];
  byCompressor: MarketMetric[];
  priceBands: MarketMetric[];
  recurrentPatterns: ProductPattern[];
  regionalOpportunities: RegionalOpportunity[];
  productSuggestions: ProductSuggestion[];
  topProposalsByValue: MarketProposalRow[];
  rawRows: MarketProposalRow[];
};

function inc(map: Record<string, number>, key: string, amount = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + amount;
}

function toMetrics(map: Record<string, number>, limit = 12): MarketMetric[] {
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function avg(sum: number, count: number) {
  return count ? sum / count : 0;
}

function hpTotal(items: MarketProposalRow["equipments"] = []) {
  return (items || []).reduce(
    (acc, item) => acc + ((item.potencia_hp || 0) * (item.quantidade || 1)),
    0,
  );
}

function kcalTotal(items: MarketProposalRow["equipments"] = []) {
  return (items || []).reduce(
    (acc, item) => acc + ((item.capacidade_kcal || 0) * (item.quantidade || 1)),
    0,
  );
}

function equipmentsTotal(items: MarketProposalRow["equipments"] = []) {
  return (items || []).reduce((acc, item) => acc + (item.quantidade || 1), 0);
}

function getPriceBand(value: number) {
  if (value < 100000) return "Até 100k";
  if (value < 250000) return "100k–250k";
  if (value < 500000) return "250k–500k";
  if (value < 1000000) return "500k–1M";
  return "Acima de 1M";
}

function normalize(text?: string | null) {
  return text?.trim() || "—";
}

function buildPatternKey(row: MarketProposalRow) {
  const eqCount = equipmentsTotal(row.equipments);
  const hp = hpTotal(row.equipments);
  const kcal = kcalTotal(row.equipments);

  const hpBand =
    hp < 10 ? "HP<10" :
    hp < 20 ? "HP10-20" :
    hp < 40 ? "HP20-40" : "HP40+";

  const kcalBand =
    kcal < 50000 ? "KCAL<50k" :
    kcal < 100000 ? "KCAL50-100k" :
    kcal < 200000 ? "KCAL100-200k" : "KCAL200k+";

  return `${eqCount} eq · ${hpBand} · ${kcalBand}`;
}

export async function fetchProductMarketData(): Promise<ProductMarketData> {
  const { data, error } = await supabase
    .from("proposals")
    .select(`
      id,
      numero,
      valor_total,
      data_proposta,
      status_proposta,
      score_confianca,
      competitor:competitors!competitor_id(nome),
      client:clients(nome,estado,cidade,segmento),
      equipments(
        quantidade,
        potencia_hp,
        capacidade_kcal,
        modelo,
        compressor,
        gas_refrigerante,
        tipo
      )
    `)
    .order("valor_total", { ascending: false });

  if (error) throw error;

  const rows = ((data || []) as unknown as MarketProposalRow[]).map((row) => ({
    ...row,
    equipments: row.equipments || [],
  }));

  const byStateMap: Record<string, number> = {};
  const byCompetitorMap: Record<string, number> = {};
  const byModelMap: Record<string, number> = {};
  const byGasMap: Record<string, number> = {};
  const byCompressorMap: Record<string, number> = {};
  const priceBandMap: Record<string, number> = {};

  let totalValue = 0;
  let totalEquipments = 0;
  let totalHp = 0;
  let totalKcal = 0;
  let confidenceSum = 0;

  const patternMap = new Map<string, {
    count: number;
    valueSum: number;
    hpSum: number;
    kcalSum: number;
    eqSum: number;
    states: Set<string>;
    competitors: Set<string>;
    models: Set<string>;
    gases: Set<string>;
    compressors: Set<string>;
  }>();

  const regionalMap = new Map<string, {
    proposals: number;
    totalValue: number;
    hpSum: number;
    kcalSum: number;
    eqSum: number;
    competitors: Set<string>;
    models: Record<string, number>;
  }>();

  rows.forEach((row) => {
    const state = normalize(row.client?.estado);
    const competitor = normalize(row.competitor?.nome);
    const value = row.valor_total || 0;
    const hp = hpTotal(row.equipments);
    const kcal = kcalTotal(row.equipments);
    const eqCount = equipmentsTotal(row.equipments);

    totalValue += value;
    totalEquipments += eqCount;
    totalHp += hp;
    totalKcal += kcal;
    confidenceSum += row.score_confianca || 0;

    inc(byStateMap, state, 1);
    inc(byCompetitorMap, competitor, 1);
    inc(priceBandMap, getPriceBand(value), 1);

    (row.equipments || []).forEach((eq) => {
      const qty = eq.quantidade || 1;
      inc(byModelMap, normalize(eq.modelo || eq.tipo), qty);
      inc(byGasMap, normalize(eq.gas_refrigerante), qty);
      inc(byCompressorMap, normalize(eq.compressor), qty);
    });

    const patternKey = buildPatternKey(row);
    if (!patternMap.has(patternKey)) {
      patternMap.set(patternKey, {
        count: 0, valueSum: 0, hpSum: 0, kcalSum: 0, eqSum: 0,
        states: new Set(), competitors: new Set(),
        models: new Set(), gases: new Set(), compressors: new Set(),
      });
    }

    const pattern = patternMap.get(patternKey)!;
    pattern.count += 1;
    pattern.valueSum += value;
    pattern.hpSum += hp;
    pattern.kcalSum += kcal;
    pattern.eqSum += eqCount;
    pattern.states.add(state);
    pattern.competitors.add(competitor);

    (row.equipments || []).forEach((eq) => {
      pattern.models.add(normalize(eq.modelo || eq.tipo));
      pattern.gases.add(normalize(eq.gas_refrigerante));
      pattern.compressors.add(normalize(eq.compressor));
    });

    if (!regionalMap.has(state)) {
      regionalMap.set(state, {
        proposals: 0, totalValue: 0, hpSum: 0, kcalSum: 0, eqSum: 0,
        competitors: new Set(), models: {},
      });
    }

    const region = regionalMap.get(state)!;
    region.proposals += 1;
    region.totalValue += value;
    region.hpSum += hp;
    region.kcalSum += kcal;
    region.eqSum += eqCount;
    region.competitors.add(competitor);

    (row.equipments || []).forEach((eq) => {
      inc(region.models, normalize(eq.modelo || eq.tipo), eq.quantidade || 1);
    });
  });

  const recurrentPatterns: ProductPattern[] = Array.from(patternMap.entries())
    .map(([key, p]) => ({
      key,
      count: p.count,
      avgValue: avg(p.valueSum, p.count),
      avgHp: avg(p.hpSum, p.count),
      avgKcal: avg(p.kcalSum, p.count),
      avgEquipments: avg(p.eqSum, p.count),
      states: Array.from(p.states),
      competitors: Array.from(p.competitors),
      models: Array.from(p.models).slice(0, 6),
      gases: Array.from(p.gases).slice(0, 6),
      compressors: Array.from(p.compressors).slice(0, 6),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const regionalOpportunities: RegionalOpportunity[] = Array.from(regionalMap.entries())
    .map(([state, item]) => ({
      state,
      proposals: item.proposals,
      totalValue: item.totalValue,
      avgValue: avg(item.totalValue, item.proposals),
      avgHp: avg(item.hpSum, item.proposals),
      avgKcal: avg(item.kcalSum, item.proposals),
      avgEquipments: avg(item.eqSum, item.proposals),
      competitors: Array.from(item.competitors),
      dominantModels: toMetrics(item.models, 3).map((m) => m.label),
    }))
    .sort((a, b) => b.proposals - a.proposals);

  const productSuggestions: ProductSuggestion[] = [];

  recurrentPatterns.slice(0, 8).forEach((pattern, index) => {
    if (pattern.count >= 3) {
      productSuggestions.push({
        id: `pattern-${index + 1}`,
        title: `Criar linha padrão para ${pattern.key}`,
        rationale:
          `Há recorrência suficiente para padronização. Esse arranjo aparece ${pattern.count} vez(es), ` +
          `com ticket médio de ${brl(pattern.avgValue)} e média de ${pattern.avgHp.toFixed(1)} HP.`,
        confidence: pattern.count >= 6 ? "high" : pattern.count >= 4 ? "medium" : "low",
        targetPattern: pattern.key,
        expectedPriceBand: brl(pattern.avgValue),
        evidence: [
          `Ocorrências: ${pattern.count}`,
          `Estados: ${pattern.states.join(", ")}`,
          `Modelos: ${pattern.models.join(", ")}`,
          `Gases: ${pattern.gases.join(", ")}`,
          `Compressores: ${pattern.compressors.join(", ")}`,
        ],
      });
    }
  });

  regionalOpportunities.slice(0, 5).forEach((region, index) => {
    if (region.proposals >= 3) {
      productSuggestions.push({
        id: `region-${index + 1}`,
        title: `Explorar ofensiva comercial em ${region.state}`,
        rationale:
          `A região mostra recorrência relevante, com ${region.proposals} proposta(s) e ticket médio de ${brl(region.avgValue)}.`,
        confidence: region.proposals >= 6 ? "high" : "medium",
        targetRegion: region.state,
        expectedPriceBand: brl(region.avgValue),
        evidence: [
          `Propostas: ${region.proposals}`,
          `HP médio: ${region.avgHp.toFixed(1)}`,
          `Modelos dominantes: ${region.dominantModels.join(", ")}`,
          `Concorrentes presentes: ${region.competitors.join(", ")}`,
        ],
      });
    }
  });

  return {
    totalProposals: rows.length,
    totalValue,
    avgTicket: avg(totalValue, rows.length),
    avgConfidence: avg(confidenceSum, rows.length),
    totalEquipments,
    totalHp,
    totalKcal,
    byState: toMetrics(byStateMap, 12),
    byCompetitor: toMetrics(byCompetitorMap, 12),
    byModel: toMetrics(byModelMap, 12),
    byGas: toMetrics(byGasMap, 12),
    byCompressor: toMetrics(byCompressorMap, 12),
    priceBands: toMetrics(priceBandMap, 12),
    recurrentPatterns,
    regionalOpportunities,
    productSuggestions,
    topProposalsByValue: rows.slice(0, 12),
    rawRows: rows,
  };
}
