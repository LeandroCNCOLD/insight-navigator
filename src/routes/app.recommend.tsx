import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, Target } from "lucide-react";

import { PageHeader } from "@/components/dashboard-bits";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateRecommendation, type RecommendationInput } from "@/lib/recommendation-engine";
import {
  RECOMMENDATION_SUGGESTIONS,
  streamRecommendationAnswer,
  type RecommendationMessage,
} from "@/lib/recommendation-chat";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/app/recommend")({
  component: RecommendationEnginePage,
  head: () => ({
    meta: [{ title: "Recommendation Engine — DocIntel" }],
  }),
});

function RecommendationEnginePage() {
  const [form, setForm] = useState<RecommendationInput>({
    state: "",
    city: "",
    segment: "",
    competitor: "",
    targetCapacityKcal: undefined,
    targetHp: undefined,
    targetEquipmentCount: undefined,
    targetPrice: undefined,
    notes: "",
  });

  const recommendationQuery = useMutation({
    mutationFn: () => generateRecommendation(form),
  });

  const [messages, setMessages] = useState<RecommendationMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingAsk, setLoadingAsk] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canAsk = useMemo(() => input.trim().length > 0 && !loadingAsk, [input, loadingAsk]);

  async function ask(text: string) {
    const content = text.trim();
    if (!content || loadingAsk) return;

    const userMessage: RecommendationMessage = { role: "user", content };
    const nextMessages = [...messages, userMessage];

    setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    setLoadingAsk(true);

    try {
      await streamRecommendationAnswer(nextMessages, (accumulated) => {
        setMessages((prev) =>
          prev.map((msg, index) =>
            index === prev.length - 1 ? { ...msg, content: accumulated } : msg,
          ),
        );
      });
    } catch {
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoadingAsk(false);
    }
  }

  const result = recommendationQuery.data;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Recommendation Engine"
        description="Recomendação de solução, faixa de preço, risco e ação comercial com base na base histórica"
      />

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-5 space-y-4">
          <div className="text-lg font-semibold">Parâmetros do cenário</div>

          <Input
            placeholder="Estado"
            value={form.state || ""}
            onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
          />
          <Input
            placeholder="Cidade"
            value={form.city || ""}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
          />
          <Input
            placeholder="Segmento"
            value={form.segment || ""}
            onChange={(e) => setForm((prev) => ({ ...prev, segment: e.target.value }))}
          />
          <Input
            placeholder="Concorrente"
            value={form.competitor || ""}
            onChange={(e) => setForm((prev) => ({ ...prev, competitor: e.target.value }))}
          />
          <Input
            type="number"
            placeholder="Capacidade alvo (kcal/h)"
            value={form.targetCapacityKcal ?? ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                targetCapacityKcal: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
          <Input
            type="number"
            placeholder="HP alvo"
            value={form.targetHp ?? ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                targetHp: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
          <Input
            type="number"
            placeholder="Quantidade de equipamentos"
            value={form.targetEquipmentCount ?? ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                targetEquipmentCount: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
          <Input
            type="number"
            placeholder="Preço-alvo"
            value={form.targetPrice ?? ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                targetPrice: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
          <Textarea
            placeholder="Observações livres"
            value={form.notes || ""}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />

          <Button
            onClick={() => recommendationQuery.mutate()}
            disabled={recommendationQuery.isPending}
          >
            {recommendationQuery.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Target className="mr-2 h-4 w-4" />
            )}
            Gerar recomendação
          </Button>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4 text-lg font-semibold">Resumo da recomendação</div>

            {!result ? (
              <div className="text-sm text-muted-foreground">
                Preencha os parâmetros e gere a recomendação.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Info label="Preço médio comparável" value={formatBRL(result.avgPrice)} />
                  <Info label="Faixa observada" value={`${formatBRL(result.minPrice)} até ${formatBRL(result.maxPrice)}`} />
                  <Info label="HP médio" value={result.avgHp.toFixed(1)} />
                  <Info label="kcal médio" value={result.avgKcal.toFixed(0)} />
                  <Info label="Equipamentos médios" value={result.avgEquipments.toFixed(1)} />
                  <Info label="Casos comparáveis" value={String(result.similarCases.length)} />
                </div>

                <div className="space-y-2">
                  {result.recommendationSummary.map((item, idx) => (
                    <div key={idx} className="rounded-md border p-3 text-sm">
                      {item}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {result.dominantModels.map((item) => (
                    <Badge key={`m-${item}`}>{item}</Badge>
                  ))}
                  {result.dominantGases.map((item) => (
                    <Badge key={`g-${item}`} variant="secondary">{item}</Badge>
                  ))}
                  {result.dominantCompressors.map((item) => (
                    <Badge key={`c-${item}`} variant="outline">{item}</Badge>
                  ))}
                </div>

                {result.riskFlags.length > 0 ? (
                  <div className="space-y-2">
                    {result.riskFlags.map((risk, idx) => (
                      <div key={idx} className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm">
                        {risk}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-4 text-lg font-semibold">Casos comparáveis</div>

            {!result?.similarCases?.length ? (
              <div className="text-sm text-muted-foreground">Sem casos comparáveis suficientes.</div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-auto">
                {result.similarCases.map((item) => (
                  <div key={item.proposalId} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{item.clientName}</Badge>
                      <Badge variant="outline">{item.state}</Badge>
                      <Badge variant="secondary">{item.competitor}</Badge>
                      <Badge>{item.similarityScore} pts</Badge>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-4 text-sm">
                      <Info label="Proposta" value={item.numero} />
                      <Info label="Valor" value={formatBRL(item.valueTotal)} />
                      <Info label="HP total" value={String(item.totalHp)} />
                      <Info label="kcal total" value={String(item.totalKcal)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="p-4">
          <div className="mb-4 text-lg font-semibold">Perguntas sugeridas</div>
          <div className="space-y-2">
            {RECOMMENDATION_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => ask(suggestion)}
                className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-primary/5"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                Pergunte sobre preço, configuração, risco, padronização e aderência à base.
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`rounded-xl border px-4 py-3 text-sm whitespace-pre-wrap ${
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-background"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant={message.role === "user" ? "secondary" : "default"}>
                      {message.role === "user" ? "Pergunta" : "Recommendation Engine"}
                    </Badge>
                  </div>
                  {message.content ||
                    (loadingAsk && index === messages.length - 1 ? "Analisando casos comparáveis..." : "")}
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
                  ask(input);
                }
              }}
              placeholder="Ex.: Esse preço parece coerente para 14 HP em MT? Vale linha padrão?"
              className="resize-none min-h-[56px] max-h-40"
            />

            <Button onClick={() => ask(input)} disabled={!canAsk} className="self-end">
              {loadingAsk ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
