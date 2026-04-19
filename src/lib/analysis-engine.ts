import { supabase } from "@/integrations/supabase/client";

export type IntelligenceMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function streamIntelligenceAnswer(
  messages: IntelligenceMessage[],
  onDelta: (text: string) => void,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-analytics`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok || !resp.body) {
    if (resp.status === 429) {
      throw new Error("Limite de requisições. Aguarde um instante.");
    }
    if (resp.status === 402) {
      throw new Error("Créditos de IA esgotados.");
    }
    const text = await resp.text().catch(() => "");
    throw new Error(text || "Falha ao consultar inteligência analítica.");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;

      const payload = line.slice(6).trim();
      if (payload === "[DONE]") {
        reader.cancel();
        return accumulated;
      }

      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          onDelta(accumulated);
        }
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  return accumulated;
}

export type IntelligenceQueryResult = {
  answer: string;
  insights: string[];
  patterns: string[];
  risks: string[];
};

export async function runIntelligenceQuery(question: string): Promise<IntelligenceQueryResult> {
  let answer = "";
  await streamIntelligenceAnswer(
    [{ role: "user", content: question }],
    (text) => {
      answer = text;
    },
  );

  const extractSection = (label: RegExp): string[] => {
    const match = answer.match(label);
    if (!match) return [];
    return match[1]
      .split(/\n+/)
      .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean);
  };

  return {
    answer,
    insights: extractSection(/insights?[:\s]*\n([\s\S]*?)(?=\n\s*(?:padr[õo]es|riscos|$))/i),
    patterns: extractSection(/padr[õo]es[^:]*[:\s]*\n([\s\S]*?)(?=\n\s*(?:riscos|insights?|$))/i),
    risks: extractSection(/riscos[:\s]*\n([\s\S]*?)(?=\n\s*(?:insights?|padr[õo]es|$))/i),
  };
}

export const INTELLIGENCE_SUGGESTIONS = [
  "Qual concorrente tem maior valor total mapeado na base?",
  "Quais estados concentram mais propostas?",
  "Quais modelos de equipamento aparecem com maior frequência?",
  "Quais combinações de gás e compressor são mais recorrentes?",
  "Qual o ticket médio das propostas acima de 500 mil?",
  "Qual concorrente parece usar a política comercial mais agressiva?",
  "Quais propostas têm maior HP total instalado?",
  "Existe padrão técnico recorrente por estado ou concorrente?",
];
