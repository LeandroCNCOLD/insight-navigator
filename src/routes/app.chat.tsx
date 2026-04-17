import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dashboard-bits";
import { Send, Loader2, Brain, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/chat")({
  component: Chat,
  head: () => ({ meta: [{ title: "Chat analítico — DocIntel" }] }),
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Qual concorrente vendeu mais em 2024?",
  "Em quais estados tem mais propostas mapeadas?",
  "Qual o ticket médio acima de 500 mil?",
  "Quais modelos aparecem em mais propostas?",
];

function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput(""); setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-analytics`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Limite de requisições. Aguarde um instante.");
        if (resp.status === 402) throw new Error("Créditos de IA esgotados.");
        throw new Error("Falha no chat");
      }

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = ""; let acc = "";
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { reader.cancel(); break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((p) => p.map((m, i) => (i === p.length - 1 ? { ...m, content: acc } : m)));
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4 flex flex-col h-full">
      <PageHeader title="Chat analítico" description="Pergunte em linguagem natural sobre sua base de propostas." />

      <Card className="flex-1 flex flex-col gradient-surface border-border overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Comece com uma pergunta:</div>
              <div className="grid md:grid-cols-2 gap-2">
                {SUGESTOES.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-left text-sm px-4 py-3 rounded-md border border-border hover:border-primary hover:bg-primary/5 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`size-8 shrink-0 rounded-md flex items-center justify-center ${m.role === "user" ? "bg-muted" : "gradient-primary"}`}>
                {m.role === "user" ? <UserIcon className="size-4" /> : <Brain className="size-4 text-primary-foreground" />}
              </div>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-lg text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50 border border-border"}`}>
                {m.content || (loading && i === messages.length - 1 ? <Loader2 className="size-3.5 animate-spin" /> : "")}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="border-t border-border p-3 flex gap-2">
          <Textarea
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Digite sua pergunta..."
            className="resize-none min-h-[44px] max-h-32"
          />
          <Button onClick={() => send(input)} disabled={loading || !input.trim()} className="self-end">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}
