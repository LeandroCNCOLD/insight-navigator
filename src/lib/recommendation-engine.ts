import { supabase } from "@/integrations/supabase/client";

export type RecommendationInput = {
  state?: string;
  city?: string;
  segment?: string;
  competitor?: string;
  targetDimensions?: string;
  targetCapacityKcal?: number;
  targetHp?: number;
  targetEquipmentCount?: number;
  targetPrice?: number;
  notes?: string;
};

export type SimilarCase = {
  proposalId: string;
  numero: string;
  clientName: string;
  state: string;
  competitor: string;
  valueTotal: number;
  totalHp: number;
  totalKcal: number;
  totalEquipments: number;
  models: string[];
  gases: string[];
  compressors: string[];
  similarityScore: number;
};

export type RecommendationOutput = {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  avgHp: number;
  avgKcal: number;
  avgEquipments: number;
  dominantModels: string[];
  dominantGases: string[];
  dominantCompressors: string[];
  likelyCompetitors: string[];
  similarCases: SimilarCase[];
  recommendationSummary: string[];
  riskFlags: string[];
};

type ProposalRow = {
  id: string;
  numero?: string | null;
  valor_total?: number | null;
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
  }>;
};

function hpTotal(items: ProposalRow["equipments"] = []) {
  return (items || []).reduce(
    (acc, item) => acc + ((item.potencia_hp || 0) * (item.quantidade || 1)),
    0,
  );
}

function kcalTotal(items: ProposalRow["equipments"] = []) {
  return (items || []).reduce(
    (acc, item) => acc + ((item.capacidade_kcal || 0) * (item.quantidade || 1)),
    0,
  );
}

function eqTotal(items: ProposalRow["equipments"] = []) {
  return (items || []).reduce((acc, item) => acc + (item.quantidade || 1), 0);
}

function frequencyTop(values: string[], limit = 5) {
  const map: Record<string, number> = {};
  values.forEach((v) => {
    const key = v?.trim() || "—";
    map[key] = (map[key] || 0) + 1;
  });

  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

function similarity(input: RecommendationInput, row: ProposalRow) {
  let score = 0;

  const state = row.client?.estado || "";
  const city = row.client?.cidade || "";
  const segment = row.client?.segmento || "";
  const competitor = row.competitor?.nome || "";

  const hp = hpTotal(row.equipments);
  const kcal = kcalTotal(row.equipments);
  const eq = eqTotal(row.equipments);

  if (input.state && state.toLowerCase() === input.state.toLowerCase()) score += 20;
  if (input.city && city.toLowerCase() === input.city.toLowerCase()) score += 10;
  if (input.segment && segment.toLowerCase().includes(input.segment.toLowerCase())) score += 10;
  if (input.competitor && competitor.toLowerCase().includes(input.competitor.toLowerCase())) score += 10;

  if (input.targetHp && hp > 0) {
    const diff = Math.abs(hp - input.targetHp) / Math.max(input.targetHp, 1);
    score += Math.max(0, 20 - diff * 20);
  }

  if (input.targetCapacityKcal && kcal > 0) {
    const diff = Math.abs(kcal - input.targetCapacityKcal) / Math.max(input.targetCapacityKcal, 1);
    score += Math.max(0, 20 - diff * 20);
  }

  if (input.targetEquipmentCount && eq > 0) {
    const diff = Math.abs(eq - input.targetEquipmentCount);
    score += Math.max(0, 10 - diff * 3);
  }

  if (input.targetPrice && row.valor_total) {
    const diff = Math.abs((row.valor_total || 0) - input.targetPrice) / Math.max(input.targetPrice, 1);
    score += Math.max(0, 10 - diff * 10);
  }

  return Math.max(0, Math.round(score));
}

export async function generateRecommendation(input: RecommendationInput): Promise<RecommendationOutput> {
  const { data, error } = await supabase
    .from("proposals")
    .select(`
      id,
      numero,
      valor_total,
      competitor:competitors(nome),
      client:clients(nome,estado,cidade,segmento),
      equipments(
        quantidade,
        potencia_hp,
        capacidade_kcal,
        modelo,
        compressor,
        gas_refrigerante
      )
    `)
    .limit(1500);

  if (error) throw error;

  const rows = ((data || []) as ProposalRow[]).map((row) => ({
    ...row,
    equipments: row.equipments || [],
  }));

  const ranked = rows
    .map((row) => {
      const totalHp = hpTotal(row.equipments);
      const totalKcal = kcalTotal(row.equipments);
      const totalEquipments = eqTotal(row.equipments);

      return {
        row,
        similarityScore: similarity(input, row),
        totalHp,
        totalKcal,
        totalEquipments,
      };
    })
    .filter((item) => item.similarityScore > 0)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 25);

  const similarCases: SimilarCase[] = ranked.map((item) => ({
    proposalId: item.row.id,
    numero: item.row.numero || "—",
    clientName: item.row.client?.nome || "—",
    state: item.row.client?.estado || "—",
    competitor: item.row.competitor?.nome || "—",
    valueTotal: item.row.valor_total || 0,
    totalHp: item.totalHp,
    totalKcal: item.totalKcal,
    totalEquipments: item.totalEquipments,
    models: (item.row.equipments || []).map((e) => e.modelo || "—"),
    gases: (item.row.equipments || []).map((e) => e.gas_refrigerante || "—"),
    compressors: (item.row.equipments || []).map((e) => e.compressor || "—"),
    similarityScore: item.similarityScore,
  }));

  const values = similarCases.map((c) => c.valueTotal).filter((v) => v > 0);
  const hps = similarCases.map((c) => c.totalHp).filter((v) => v > 0);
  const kcals = similarCases.map((c) => c.totalKcal).filter((v) => v > 0);
  const eqs = similarCases.map((c) => c.totalEquipments).filter((v) => v > 0);

  const avgPrice = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const avgHp = hps.length ? hps.reduce((a, b) => a + b, 0) / hps.length : 0;
  const avgKcal = kcals.length ? kcals.reduce((a, b) => a + b, 0) / kcals.length : 0;
  const avgEquipments = eqs.length ? eqs.reduce((a, b) => a + b, 0) / eqs.length : 0;

  const allModels = similarCases.flatMap((c) => c.models);
  const allGases = similarCases.flatMap((c) => c.gases);
  const allCompressors = similarCases.flatMap((c) => c.compressors);
  const allCompetitors = similarCases.map((c) => c.competitor);

  const recommendationSummary: string[] = [];
  const riskFlags: string[] = [];

  if (similarCases.length) {
    recommendationSummary.push(
      `Foram encontrados ${similarCases.length} casos comparáveis na base.`,
    );
  }

  if (avgHp > 0) {
    recommendationSummary.push(
      `A média observada dos casos comparáveis é de ${avgHp.toFixed(1)} HP totais.`,
    );
  }

  if (avgKcal > 0) {
    recommendationSummary.push(
      `A capacidade média observada é de ${avgKcal.toFixed(0)} kcal/h.`,
    );
  }

  if (avgPrice > 0) {
    recommendationSummary.push(
      `A faixa de preço comparável gira em torno de ${Math.round(avgPrice).toLocaleString("pt-BR")} reais.`,
    );
  }

  if (similarCases.length < 5) {
    riskFlags.push("Poucos casos comparáveis. A recomendação deve ser tratada com cautela.");
  }

  if (input.targetPrice && avgPrice > 0) {
    if (input.targetPrice < avgPrice * 0.8) {
      riskFlags.push("O preço-alvo informado está consideravelmente abaixo da média comparável.");
    }
    if (input.targetPrice > avgPrice * 1.2) {
      riskFlags.push("O preço-alvo informado está consideravelmente acima da média comparável.");
    }
  }

  if (input.targetHp && avgHp > 0) {
    if (input.targetHp < avgHp * 0.7 || input.targetHp > avgHp * 1.3) {
      riskFlags.push("O HP-alvo informado destoa da média dos casos comparáveis.");
    }
  }

  return {
    avgPrice,
    minPrice: values.length ? Math.min(...values) : 0,
    maxPrice: values.length ? Math.max(...values) : 0,
    avgHp,
    avgKcal,
    avgEquipments,
    dominantModels: frequencyTop(allModels),
    dominantGases: frequencyTop(allGases),
    dominantCompressors: frequencyTop(allCompressors),
    likelyCompetitors: frequencyTop(allCompetitors),
    similarCases,
    recommendationSummary,
    riskFlags,
  };
}
