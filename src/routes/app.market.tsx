import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Brain,
  Lightbulb,
  Loader2,
  MapPinned,
  Send,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/dashboard-bits";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchProductMarketData } from "@/lib/product-market";
import {
  MARKET_SUGGESTIONS,
  streamMarketAnswer,
  type MarketMessage,
} from "@/lib/market-intelligence";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/app/market")({
  component: ProductMarketEnginePage,
  head: () => ({
    meta: [{ title: "Product & Market Engine — DocIntel" }],
  }),
});

function ProductMarketEnginePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["product-market"],
    queryFn: fetchProductMarketData,
  });

  const [messages, setMessages] = useState<MarketMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingAsk, setLoadingAsk] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !loadingAsk,
    [input, loadingAsk],
  );

  async function ask(text: string) {
    const content = text.trim();
    if (!content || loadingAsk) return;

    const userMessage: MarketMessage = { role: "user", content };
    const nextMessages = [...messages, userMessage];

    setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    setLoadingAsk(true);

    try {
      await streamMarketAnswer(nextMessages, (accumulated) => {
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

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Carregando Product & Market Engine...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Sem dados suficientes para análise.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Product & Market Engine"
        description="Padrões de produto, oportunidades regionais, sugestões automáticas e perguntas livres sobre o mercado"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total de propostas" value={String(data.totalProposals)} icon={BarChart3} />
        <MetricCard label="Valor total mapeado" value={formatBRL(data.totalValue)} icon={MapPinned} />
        <MetricCard label="Ticket médio" value={formatBRL(data.avgTicket)} icon={Lightbulb} />
        <MetricCard label="Confiança média" value={`${Math.round(data.avgConfidence * 100)}%`} icon={Brain} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="patterns">Padrões</TabsTrigger>
          <TabsTrigger value="regions">Regiões</TabsTrigger>
          <TabsTrigger value="products">Sugestões de produto</TabsTrigger>
          <TabsTrigger value="questions">Perguntas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Top estados" data={data.byState} />
            <ChartCard title="Top concorrentes" data={data.byCompetitor} />
            <ChartCard title="Top modelos" data={data.byModel} />
            <ChartCard title="Faixas de preço" data={data.priceBands} />
          </div>
        </TabsContent>

        <TabsContent value="patterns">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Wrench className="h-5 w-5" />
              Padrões recorrentes de produto
            </div>

            <div className="space-y-4">
              {data.recurrentPatterns.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Sem padrões recorrentes detectados ainda.
                </div>
              ) : (
                data.recurrentPatterns.map((pattern) => (
                  <div key={pattern.key} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{pattern.key}</Badge>
                      <Badge variant="outline">{pattern.count} ocorrência(s)</Badge>
                      <Badge variant="secondary">Ticket médio {formatBRL(pattern.avgValue)}</Badge>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                      <Info label="HP médio" value={pattern.avgHp.toFixed(1)} />
                      <Info label="kcal/h médio" value={pattern.avgKcal.toFixed(0)} />
                      <Info label="Equipamentos médios" value={pattern.avgEquipments.toFixed(1)} />
                    </div>

                    <div className="mt-3 text-sm text-muted-foreground">
                      Estados: {pattern.states.join(", ")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Concorrentes: {pattern.competitors.join(", ")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Modelos: {pattern.models.join(", ")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="regions">
          <Card className="p-5">
            <div className="mb-4 text-lg font-semibold">Oportunidades regionais</div>

            <div className="space-y-4">
              {data.regionalOpportunities.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Sem dados regionais suficientes.
                </div>
              ) : (
                data.regionalOpportunities.map((region) => (
                  <div key={region.state} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{region.state}</Badge>
                      <Badge variant="outline">{region.proposals} proposta(s)</Badge>
                      <Badge variant="secondary">Ticket médio {formatBRL(region.avgValue)}</Badge>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-4 text-sm">
                      <Info label="HP médio" value={region.avgHp.toFixed(1)} />
                      <Info label="kcal médio" value={region.avgKcal.toFixed(0)} />
                      <Info label="Equip. médios" value={region.avgEquipments.toFixed(1)} />
                      <Info label="Valor total" value={formatBRL(region.totalValue)} />
                    </div>

                    <div className="mt-3 text-sm text-muted-foreground">
                      Modelos dominantes: {region.dominantModels.join(", ")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Concorrentes presentes: {region.competitors.join(", ")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card className="p-5">
            <div className="mb-4 text-lg font-semibold">
              Sugestões automáticas de produto e mercado
            </div>

            <div className="space-y-4">
              {data.productSuggestions.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Ainda não há recorrência suficiente para sugerir produtos.
                </div>
              ) : (
                data.productSuggestions.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{item.title}</Badge>
                      <Badge
                        variant={
                          item.confidence === "high"
                            ? "default"
                            : item.confidence === "medium"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {item.confidence === "high"
                          ? "Alta confiança"
                          : item.confidence === "medium"
                          ? "Média confiança"
                          : "Baixa confiança"}
                      </Badge>
                      {item.expectedPriceBand ? (
                        <Badge variant="outline">Referência {item.expectedPriceBand}</Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 text-sm">{item.rationale}</div>

                    <div className="mt-3 space-y-2">
                      {item.evidence.map((ev, idx) => (
                        <div
                          key={idx}
                          className="rounded-md border border-border bg-muted/40 p-2 text-sm"
                        >
                          {ev}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="questions">
          <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <Card className="p-4">
              <div className="mb-4 text-lg font-semibold">Perguntas sugeridas</div>
              <div className="space-y-2">
                {MARKET_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => ask(suggestion)}
                    className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-primary/5"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-4 space-y-4">
              <div className="space-y-4 max-h-[60vh] overflow-auto">
                {messages.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
                    Pergunte sobre produtos, mercado, recorrência, regiões, preços e oportunidades.
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`rounded-xl border border-border px-4 py-3 text-sm whitespace-pre-wrap ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant={message.role === "user" ? "secondary" : "default"}>
                          {message.role === "user" ? "Pergunta" : "Product & Market Engine"}
                        </Badge>
                      </div>
                      {message.content ||
                        (loadingAsk && index === messages.length - 1
                          ? "Analisando mercado..."
                          : "")}
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
                  placeholder="Ex.: Quais produtos deveriam virar catálogo? Em quais estados há melhor oportunidade?"
                  className="resize-none min-h-[56px] max-h-40"
                />

                <Button onClick={() => ask(input)} disabled={!canSend} className="self-end">
                  {loadingAsk ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: any;
}) {
  return (
    <Card className="p-4 gradient-surface border-border">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight font-mono">{value}</div>
        </div>
        <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="size-4" />
        </div>
      </div>
    </Card>
  );
}

function ChartCard({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
}) {
  return (
    <Card className="p-5 gradient-surface border-border">
      <div className="mb-4 text-lg font-semibold">{title}</div>
      <div className="h-[300px] min-h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              angle={-18}
              textAnchor="end"
              height={70}
            />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium font-mono">{value}</div>
    </div>
  );
}
