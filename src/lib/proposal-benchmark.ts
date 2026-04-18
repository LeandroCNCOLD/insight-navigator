import { supabase } from "@/integrations/supabase/client";

export type ProposalCompareCandidate = {
  id: string;
  numero: string | null;
  valor_total: number | null;
  data_proposta: string | null;
  status_proposta: string | null;
  score_confianca: number | null;
  client?: {
    nome?: string | null;
    estado?: string | null;
  } | null;
  competitor?: {
    nome?: string | null;
  } | null;
  document?: {
    file_name?: string | null;
  } | null;
};

export type ProposalEquipment = {
  id: string;
  tipo?: string | null;
  modelo?: string | null;
  quantidade?: number | null;
  potencia_hp?: number | null;
  capacidade_kcal?: number | null;
  compressor?: string | null;
  gas_refrigerante?: string | null;
  observacoes?: string | null;
};

export type ProposalCompareDetail = {
  id: string;
  numero: string | null;
  valor_total: number | null;
  data_proposta: string | null;
  condicao_pagamento: string | null;
  parcelas: string | null;
  prazo_entrega_dias: number | null;
  garantia_meses: number | null;
  frete_tipo: string | null;
  vendedor: string | null;
  status_proposta: string | null;
  score_confianca: number | null;
  observacoes: string | null;
  riscos: string | null;
  dados_tecnicos?: Record<string, any> | null;
  client?: {
    nome?: string | null;
    estado?: string | null;
    cidade?: string | null;
  } | null;
  competitor?: {
    nome?: string | null;
  } | null;
  document?: {
    id?: string | null;
    file_name?: string | null;
    tem_analise_forense?: boolean | null;
  } | null;
  equipments: ProposalEquipment[];
};

export type ComparisonRow = {
  label: string;
  a: string;
  b: string;
  different: boolean;
  critical?: boolean;
};

export async function fetchCompareCandidates(): Promise<ProposalCompareCandidate[]> {
  const { data, error } = await supabase
    .from("proposals")
    .select(`
      id,
      numero,
      valor_total,
      data_proposta,
      status_proposta,
      score_confianca,
      client:clients(nome,estado),
      competitor:competitors(nome),
      document:documents(file_name)
    `)
    .order("data_proposta", { ascending: false });

  if (error) throw error;
  return (data || []) as ProposalCompareCandidate[];
}

export async function fetchProposalCompareDetail(proposalId: string): Promise<ProposalCompareDetail | null> {
  const { data: proposal, error } = await supabase
    .from("proposals")
    .select(`
      *,
      client:clients(nome,estado,cidade),
      competitor:competitors(nome),
      document:documents(id,file_name,tem_analise_forense)
    `)
    .eq("id", proposalId)
    .maybeSingle();

  if (error) throw error;
  if (!proposal) return null;

  const { data: equipments, error: eqError } = await supabase
    .from("equipments")
    .select("*")
    .eq("proposal_id", proposalId);

  if (eqError) throw eqError;

  return {
    ...(proposal as any),
    equipments: (equipments || []) as ProposalEquipment[],
  };
}

export function formatCompareValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return String(value);
  return String(value);
}

export function buildExecutiveRows(a: ProposalCompareDetail | null, b: ProposalCompareDetail | null): ComparisonRow[] {
  const rows: Array<{
    label: string;
    av: unknown;
    bv: unknown;
    critical?: boolean;
  }> = [
    { label: "Cliente", av: a?.client?.nome, bv: b?.client?.nome },
    { label: "UF", av: a?.client?.estado, bv: b?.client?.estado },
    { label: "Concorrente", av: a?.competitor?.nome, bv: b?.competitor?.nome },
    { label: "Documento", av: a?.document?.file_name, bv: b?.document?.file_name },
    { label: "Número", av: a?.numero, bv: b?.numero },
    { label: "Data", av: a?.data_proposta, bv: b?.data_proposta },
    { label: "Valor total", av: a?.valor_total, bv: b?.valor_total, critical: true },
    { label: "Pagamento", av: a?.condicao_pagamento, bv: b?.condicao_pagamento, critical: true },
    { label: "Parcelas", av: a?.parcelas, bv: b?.parcelas },
    { label: "Prazo entrega", av: a?.prazo_entrega_dias, bv: b?.prazo_entrega_dias, critical: true },
    { label: "Garantia", av: a?.garantia_meses, bv: b?.garantia_meses, critical: true },
    { label: "Frete", av: a?.frete_tipo, bv: b?.frete_tipo, critical: true },
    { label: "Vendedor", av: a?.vendedor, bv: b?.vendedor },
    { label: "Status", av: a?.status_proposta, bv: b?.status_proposta },
    { label: "Confiança", av: a?.score_confianca, bv: b?.score_confianca },
  ];

  return rows.map((row) => {
    const aa = formatCompareValue(row.av);
    const bb = formatCompareValue(row.bv);
    return {
      label: row.label,
      a: aa,
      b: bb,
      different: aa !== bb,
      critical: row.critical,
    };
  });
}

export function equipmentMetrics(items: ProposalEquipment[]) {
  const totalEquipments = items.reduce((acc, item) => acc + (item.quantidade || 1), 0);
  const totalHp = items.reduce((acc, item) => acc + ((item.potencia_hp || 0) * (item.quantidade || 1)), 0);
  const totalKcal = items.reduce((acc, item) => acc + ((item.capacidade_kcal || 0) * (item.quantidade || 1)), 0);

  const byModel: Record<string, number> = {};
  const byGas: Record<string, number> = {};
  const byCompressor: Record<string, number> = {};

  items.forEach((item) => {
    const qty = item.quantidade || 1;
    if (item.modelo) byModel[item.modelo] = (byModel[item.modelo] || 0) + qty;
    if (item.gas_refrigerante) byGas[item.gas_refrigerante] = (byGas[item.gas_refrigerante] || 0) + qty;
    if (item.compressor) byCompressor[item.compressor] = (byCompressor[item.compressor] || 0) + qty;
  });

  return {
    totalEquipments,
    totalHp,
    totalKcal,
    byModel,
    byGas,
    byCompressor,
  };
}

export function buildTechnicalRows(a: ProposalCompareDetail | null, b: ProposalCompareDetail | null): ComparisonRow[] {
  const ta = a?.dados_tecnicos || {};
  const tb = b?.dados_tecnicos || {};

  const keys = Array.from(new Set([...Object.keys(ta), ...Object.keys(tb)])).sort();

  return keys.map((key) => {
    const av = formatCompareValue(ta[key]);
    const bv = formatCompareValue(tb[key]);
    return {
      label: key,
      a: av,
      b: bv,
      different: av !== bv,
    };
  });
}

export function buildEquipmentRows(a: ProposalCompareDetail | null, b: ProposalCompareDetail | null): ComparisonRow[] {
  const ma = equipmentMetrics(a?.equipments || []);
  const mb = equipmentMetrics(b?.equipments || []);

  const rows: ComparisonRow[] = [
    {
      label: "Qtd. total de equipamentos",
      a: formatCompareValue(ma.totalEquipments),
      b: formatCompareValue(mb.totalEquipments),
      different: ma.totalEquipments !== mb.totalEquipments,
      critical: true,
    },
    {
      label: "HP total",
      a: formatCompareValue(ma.totalHp),
      b: formatCompareValue(mb.totalHp),
      different: ma.totalHp !== mb.totalHp,
      critical: true,
    },
    {
      label: "Capacidade total kcal/h",
      a: formatCompareValue(ma.totalKcal),
      b: formatCompareValue(mb.totalKcal),
      different: ma.totalKcal !== mb.totalKcal,
      critical: true,
    },
  ];

  const allModels = Array.from(new Set([...Object.keys(ma.byModel), ...Object.keys(mb.byModel)])).sort();
  allModels.forEach((model) => {
    const av = ma.byModel[model] || 0;
    const bv = mb.byModel[model] || 0;
    rows.push({
      label: `Modelo: ${model}`,
      a: formatCompareValue(av),
      b: formatCompareValue(bv),
      different: av !== bv,
    });
  });

  return rows;
}

export function buildBenchmarkInsights(a: ProposalCompareDetail | null, b: ProposalCompareDetail | null): string[] {
  if (!a || !b) return [];

  const insights: string[] = [];
  const ma = equipmentMetrics(a.equipments || []);
  const mb = equipmentMetrics(b.equipments || []);

  if ((a.valor_total || 0) > (b.valor_total || 0)) {
    insights.push("A proposta A tem valor total maior que a proposta B.");
  } else if ((a.valor_total || 0) < (b.valor_total || 0)) {
    insights.push("A proposta B tem valor total maior que a proposta A.");
  } else {
    insights.push("As duas propostas têm o mesmo valor total informado.");
  }

  if ((a.garantia_meses || 0) !== (b.garantia_meses || 0)) {
    insights.push("Há diferença de garantia, o que pode indicar política comercial ou risco operacional distinto.");
  }

  if ((a.prazo_entrega_dias || 0) !== (b.prazo_entrega_dias || 0)) {
    insights.push("O prazo de entrega difere entre as propostas e pode impactar competitividade comercial.");
  }

  if (ma.totalEquipments !== mb.totalEquipments) {
    insights.push("A quantidade total de equipamentos é diferente entre as propostas.");
  }

  if (ma.totalHp !== mb.totalHp) {
    insights.push("O HP total instalado difere entre as propostas, sugerindo arranjos técnicos diferentes.");
  }

  if (ma.totalKcal !== mb.totalKcal) {
    insights.push("A capacidade frigorífica total em kcal/h difere entre as propostas.");
  }

  if ((a.frete_tipo || "—") !== (b.frete_tipo || "—")) {
    insights.push("Há diferença de política de frete entre as propostas.");
  }

  if ((a.condicao_pagamento || "—") !== (b.condicao_pagamento || "—")) {
    insights.push("As condições de pagamento são diferentes e podem sinalizar flexibilidade comercial distinta.");
  }

  if (!insights.length) {
    insights.push("As duas propostas estão muito próximas nos blocos comparados.");
  }

  return insights;
}
