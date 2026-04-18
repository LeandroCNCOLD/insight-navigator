import { supabase } from "@/integrations/supabase/client";

export type RecommendationMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function streamRecommendationAnswer(
  messages: RecommendationMessage[],
  onDelta: (text: string) => void,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recommendation-engine`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    throw new Error(text || "Falha ao consultar o Recommendation Engine.");
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

export const RECOMMENDATION_SUGGESTIONS = [
  "Com base na base histórica, qual configuração parece mais adequada para uma solução de 2 máquinas e 14 HP totais?",
  "Se um cliente está no MT, qual faixa de preço parece mais coerente para uma solução padrão recorrente?",
  "Quais concorrentes mais aparecem em cenários parecidos com os meus?",
  "Quais modelos e gases parecem mais aderentes aos casos comparáveis?",
  "Meu preço-alvo está agressivo ou arriscado para o padrão observado na base?",
  "Vale tratar esse cenário como produto padrão ou proposta customizada?",
];
