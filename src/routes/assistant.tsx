import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, User as UserIcon, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CHAT_SUGGESTIONS,
  streamChatAnswer,
  type ChatMessage,
} from "@/assistant/chat-engine";

export const Route = createFileRoute("/assistant")({
  component: AssistantPage,
  head: () => ({
    meta: [{ title: "Assistant — Chat" }],
  }),
});

function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    const userMessage: ChatMessage = { role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      await streamChatAnswer(nextMessages, (accumulated) => {
        setMessages((prev) =>
          prev.map((msg, index) =>
            index === prev.length - 1 ? { ...msg, content: accumulated } : msg,
          ),
        );
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao consultar o Assistant");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md border p-2">
              <Bot className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
              <p className="text-sm text-muted-foreground">
                Experiência conversacional independente do Insight Navigator.
              </p>
            </div>
          </div>
          <Link to="/app">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 size-4" /> Insight Navigator
            </Button>
          </Link>
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap gap-2">
            {CHAT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => send(suggestion)}
                className="rounded-md border px-3 py-2 text-sm text-left hover:bg-primary/5 hover:border-primary transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Comece uma conversa com o Assistant.
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="mt-1 rounded-full border p-2">
                      <Bot className="size-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-xl border px-4 py-3 whitespace-pre-wrap text-sm ${
                      message.role === "user" ? "bg-primary text-primary-foreground" : "bg-background"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      {message.role === "user" ? (
                        <>
                          <UserIcon className="size-4" />
                          <Badge variant="secondary">Você</Badge>
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4" />
                          <Badge>Assistant</Badge>
                        </>
                      )}
                    </div>
                    {message.content ||
                      (loading && index === messages.length - 1 ? "Pensando..." : "")}
                  </div>

                  {message.role === "user" && (
                    <div className="mt-1 rounded-full border p-2">
                      <UserIcon className="size-4" />
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Escreva sua mensagem..."
              className="resize-none min-h-[54px] max-h-40"
            />
            <Button onClick={() => send(input)} disabled={!canSend} className="self-end">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
