import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  Loader2,
  Send,
  Sparkles,
  User as UserIcon,
  BarChart3,
  Wrench,
  MapPinned,
} from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard-bits";
import {
  INTELLIGENCE_SUGGESTIONS,
  streamIntelligenceAnswer,
  type IntelligenceMessage,
} from "@/lib/intelligence-engine";

export const Route = createFileRoute("/app/chat")({
  component: IntelligenceBrainPage,
  head: () => ({
    meta: [{ title: "Intelligence Brain — DocIntel" }],
  }),
});

function IntelligenceBrainPage() {
  const [messages, setMessages] = useState<IntelligenceMessage[]>([]);
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

    const userMessage: IntelligenceMessage = {
      role: "user",
      content,
    };

    const nextMessages = [...messages, userMessage];
    setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      await streamIntelligenceAnswer(nextMessages, (accumulated) => {
        setMessages((prev) =>
          prev.map((msg, index) =>
            index === prev.length - 1 ? { ...msg, content: accumulated } : msg,
          ),
        );
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao consultar a IA");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Intelligence Brain"
        subtitle="Pergunte à IA sobre propostas, equipamentos, concorrentes, clientes, padrões técnicos e benchmark."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <TopCard
          icon={Brain}
          title="Análise estratégica"
          text="Responde perguntas sobre toda a base consolidada."
        />
        <TopCard
          icon={BarChart3}
          title="Benchmark comercial"
          text="Cruza valor, pagamento, prazo, garantia e status."
        />
        <TopCard
          icon={Wrench}
          title="Benchmark técnico"
          text="Cruza equipamentos, HP, kcal/h, gases e compressores."
        />
        <TopCard
          icon={MapPinned}
          title="Leitura regional"
          text="Detecta concentração por estado, cliente e concorrente."
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {INTELLIGENCE_SUGGESTIONS.map((suggestion) => (
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
              Faça uma pergunta sobre a base. Exemplos:
              <div className="mt-3 space-y-1">
                <div>• Qual concorrente tem maior valor total?</div>
                <div>• Quais equipamentos aparecem mais?</div>
                <div>• Qual padrão técnico se repete em determinado estado?</div>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="mt-1 rounded-full border p-2">
                    <Brain className="size-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-xl border px-4 py-3 whitespace-pre-wrap text-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {message.role === "user" ? (
                      <>
                        <UserIcon className="size-4" />
                        <Badge variant="secondary">Pergunta</Badge>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        <Badge>Intelligence Brain</Badge>
                      </>
                    )}
                  </div>

                  {message.content ||
                    (loading && index === messages.length - 1 ? "Analisando base..." : "")}
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
            placeholder="Ex.: Qual concorrente usa mais R404? Qual proposta tem maior HP total?"
            className="resize-none min-h-[54px] max-h-40"
          />

          <Button onClick={() => send(input)} disabled={!canSend} className="self-end">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function TopCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Brain;
  title: string;
  text: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{text}</div>
        </div>
        <Icon className="size-5 text-muted-foreground" />
      </div>
    </Card>
  );
}
