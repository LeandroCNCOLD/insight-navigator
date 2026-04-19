import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bot, BrainCircuit, Database, LoaderCircle, Sparkles } from "lucide-react";

import { runAnalysisQuery, type AnalysisQueryResult } from "@/lib/analysis-engine";

export const Route = createFileRoute("/app/intelligence")({
  component: IntelligencePage,
  head: () => ({
    meta: [{ title: "Intelligence Brain — DocIntel" }],
  }),
});

const SUGGESTIONS = [
  "Qual padrão de máquina o concorrente X usa para túnel de congelamento?",
  "Qual a média de HP por proposta em SP?",
  "Qual proposta tem melhor custo-benefício?",
  "Qual configuração técnica mais aparece para amendoim?",
];

function IntelligencePage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnalysisQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(
    () => [
      { title: "Insights", items: result?.insights || [] },
      { title: "Padrões identificados", items: result?.patterns || [] },
      { title: "Riscos", items: result?.risks || [] },
    ].filter((section) => section.items.length > 0),
    [result],
  );

  async function handleAsk() {
    try {
      setLoading(true);
      setError(null);
      const response = await runAnalysisQuery(question);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao consultar a inteligência.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                <BrainCircuit className="h-4 w-4" />
                Intelligence Brain
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Perguntas inteligentes sobre toda a base</h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Consulte propostas, equipamentos, clientes e concorrentes em uma única camada de inteligência,
                  com resposta explicada, padrões, insights e riscos baseados no dataset real.
                </p>
              </div>
            </div>

            <div className="grid gap-3 text-sm text-muted-foreground md:w-[320px]">
              <FeatureCard icon={Database} title="Base consolidada" description="Usa propostas, clientes, concorrentes e equipamentos do Supabase." />
              <FeatureCard icon={Bot} title="Engine com IA" description="Interpreta a pergunta e envia contexto técnico estruturado ao backend." />
              <FeatureCard icon={Sparkles} title="Resposta explicada" description="Entrega resposta direta, insights, padrões identificados e riscos." />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <label className="mb-3 block text-sm font-medium">Faça uma pergunta sobre sua base</label>
            <textarea
              className="min-h-[180px] w-full rounded-xl border bg-background p-4 text-sm outline-none ring-0 placeholder:text-muted-foreground"
              placeholder="Ex.: Qual concorrente usa mais R404 vs R410 e em quais tipos de proposta isso aparece?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuestion(suggestion)}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={handleAsk}
                disabled={loading || !question.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                {loading ? "Analisando base..." : "Perguntar"}
              </button>

              <span className="text-xs text-muted-foreground">
                A resposta considera somente os dados estruturados disponíveis no dataset consolidado.
              </span>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Como a resposta é construída</h2>
            <div className="mt-4 space-y-4 text-sm">
              <StepCard number="1" title="Consolidação" description="A base é montada com propostas, clientes, concorrentes e equipamentos relacionados." />
              <StepCard number="2" title="Contextualização" description="A pergunta e um recorte técnico do dataset são enviados ao backend de IA." />
              <StepCard number="3" title="Explicação" description="O retorno prioriza resposta direta, padrões, insights e riscos sem inventar dados." />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Resposta da inteligência</h2>
              <p className="text-sm text-muted-foreground">
                Resultado orientado a decisão técnica, comercial e operacional.
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : null}

          {result?.answer ? (
            <div className="space-y-6">
              <div className="rounded-xl border bg-background p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resposta direta</h3>
                <div className="whitespace-pre-wrap text-sm leading-6">{result.answer}</div>
              </div>

              {sections.length ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  {sections.map((section) => (
                    <div key={section.title} className="rounded-xl border bg-background p-5">
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.title}
                      </h3>
                      <div className="space-y-2 text-sm">
                        {section.items.map((item: string, index: number) => (
                          <div key={`${section.title}-${index}`} className="rounded-lg border p-3">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Faça uma pergunta para ativar a camada de inteligência sobre toda a base.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BrainCircuit;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-3 rounded-xl border bg-background p-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
        {number}
      </div>
      <div>
        <div className="font-medium">{title}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
