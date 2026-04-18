import { supabase } from "@/integrations/supabase/client";
import { buildIntelligenceDataset, serializeIntelligenceContext } from "./intelligence-data";

export const INTELLIGENCE_SYSTEM_PROMPT = `Você é um analista técnico especialista em refrigeração industrial e benchmarking de propostas.

Sua função é analisar uma base de propostas estruturadas contendo:
- cliente
- concorrente
- equipamentos
- potência (HP)
- capacidade (kcal)
- gás refrigerante
- compressor
- valores comerciais

Sua tarefa:
1. Interpretar a pergunta do usuário
2. Analisar o dataset fornecido
3. Identificar padrões técnicos, comerciais e operacionais
4. Gerar insights objetivos
5. Apontar possíveis riscos ou inconsistências

Regras:
- Não inventar dados
- Basear-se somente no dataset
- Ser técnico e direto
- Quando possível, comparar
- Quando possível, quantificar

Saída:
- resposta direta
- insights
- padrões identificados
- riscos (se houver)`;

export type IntelligenceQueryResult = {
  answer: string;
  insights?: string[];
  patterns?: string[];
  risks?: string[];
  raw?: unknown;
};

export async function runIntelligenceQuery(question: string): Promise<IntelligenceQueryResult> {
  const normalizedQuestion = question.trim();

  if (!normalizedQuestion) {
    throw new Error("Informe uma pergunta para consultar a base.");
  }

  const dataset = await buildIntelligenceDataset();
  const context = serializeIntelligenceContext(dataset);

  const { data, error } = await supabase.functions.invoke("chat-analytics", {
    body: {
      mode: "intelligence-brain",
      question: normalizedQuestion,
      context,
      systemPrompt: INTELLIGENCE_SYSTEM_PROMPT,
      datasetSize: dataset.length,
    },
  });

  if (error) {
    throw new Error(error.message || "Falha ao consultar o backend de IA.");
  }

  if (typeof data?.answer === "string") {
    return {
      answer: data.answer,
      insights: Array.isArray(data.insights) ? data.insights : undefined,
      patterns: Array.isArray(data.patterns) ? data.patterns : undefined,
      risks: Array.isArray(data.risks) ? data.risks : undefined,
      raw: data,
    };
  }

  if (typeof data?.content === "string") {
    return {
      answer: data.content,
      raw: data,
    };
  }

  return {
    answer: typeof data === "string" ? data : JSON.stringify(data, null, 2),
    raw: data,
  };
}
