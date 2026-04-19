import { supabase } from "@/integrations/supabase/client";

/**
 * Chat (Assistant) — standalone conversational product.
 * NOT part of the Insight Navigator analytical flow.
 * Lives under /assistant and is intentionally decoupled from /app.
 */
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function streamChatAnswer(
  messages: ChatMessage[],
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
    if (resp.status === 429) throw new Error("Limite de requisições. Aguarde um instante.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados.");
    const text = await resp.text().catch(() => "");
    throw new Error(text || "Falha ao consultar o Assistant.");
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

export const CHAT_SUGGESTIONS = [
  "Como você pode me ajudar?",
  "Resuma as principais funcionalidades disponíveis.",
  "Quais perguntas eu posso fazer?",
];
