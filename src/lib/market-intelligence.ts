import { supabase } from "@/integrations/supabase/client";

export type MarketMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function streamMarketAnswer(
  messages: MarketMessage[],
  onDelta: (text: string) => void,
) {
  const { data: { session } } = await supabase.auth.getSession();

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-intelligence`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    throw new Error(text || "Falha ao consultar o Product & Market Engine.");
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

export const MARKET_SUGGESTIONS = [
  "Quais padrões de produto aparecem mais na base?",
  "Quais estados têm maior recorrência e melhor ticket médio?",
  "Existe oportunidade clara para criar uma linha padrão?",
  "Quais combinações técnicas mais se repetem?",
  "Quais produtos parecem mais promissores para atacar o mercado?",
  "Em quais regiões há recorrência suficiente para desenvolver produto dedicado?",
  "Qual faixa de preço domina em cada região?",
  "Há algum arranjo técnico que valha virar catálogo?",
];
