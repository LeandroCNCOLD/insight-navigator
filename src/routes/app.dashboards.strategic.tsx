import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Brain, AlertTriangle, TrendingUp, Lightbulb, Snowflake, Thermometer, Layers } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/dashboards/strategic")({
  component: Strategic,
  head: () => ({ meta: [{ title: "Painel estratégico — DocIntel" }] }),
});

function Strategic() {
  const { data: insights } = useQuery({
    queryKey: ["dash-strategic-insights"],
    queryFn: async () => (await supabase.from("insights").select("*").order("created_at", { ascending: false })).data || [],
  });

  const { data: patterns } = useQuery({
    queryKey: ["dash-camara-patterns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("proposals")
        .select("padrao_camara,valor_total,client_id,analise_tecnica_profunda")
        .not("padrao_camara", "is", null);
      const map = new Map<string, { count: number; total: number; clients: Set<string>; samples: any[] }>();
      (data || []).forEach((p: any) => {
        const k = p.padrao_camara as string;
        const cur = map.get(k) || { count: 0, total: 0, clients: new Set(), samples: [] };
        cur.count++;
        cur.total += Number(p.valor_total) || 0;
        if (p.client_id) cur.clients.add(p.client_id);
        if (cur.samples.length < 3 && p.analise_tecnica_profunda) cur.samples.push(p.analise_tecnica_profunda);
        map.set(k, cur);
      });
      return Array.from(map.entries())
        .map(([padrao, v]) => ({ padrao, count: v.count, total: v.total, clientes: v.clients.size, samples: v.samples }))
        .sort((a, b) => b.count - a.count);
    },
  });

  // Aggregate temperatures + isolations from camaras inside proposals
  const { data: aggregates } = useQuery({
    queryKey: ["dash-camara-aggregates"],
    queryFn: async () => {
      const { data } = await supabase.from("proposals").select("analise_tecnica_profunda");
      const temps: number[] = [];
      const isolamentos: Record<string, number> = {};
      const espessuras: Record<string, number> = {};
      let totalCamaras = 0;
      (data || []).forEach((p: any) => {
        const camaras = p?.analise_tecnica_profunda?.camaras || [];
        camaras.forEach((c: any) => {
          totalCamaras++;
          if (typeof c.temperatura_alvo_c === "number") temps.push(c.temperatura_alvo_c);
          if (c.isolamento_tipo) isolamentos[c.isolamento_tipo] = (isolamentos[c.isolamento_tipo] || 0) + 1;
          if (c.isolamento_espessura_mm) {
            const k = `${c.isolamento_espessura_mm}mm`;
            espessuras[k] = (espessuras[k] || 0) + 1;
          }
        });
      });
      const tempBuckets: Record<string, number> = { "Congelados (≤-15°C)": 0, "Resfriados (-5 a 5°C)": 0, "Climatizados (5-15°C)": 0, "Outros": 0 };
      temps.forEach((t) => {
        if (t <= -15) tempBuckets["Congelados (≤-15°C)"]++;
        else if (t >= -5 && t <= 5) tempBuckets["Resfriados (-5 a 5°C)"]++;
        else if (t > 5 && t <= 15) tempBuckets["Climatizados (5-15°C)"]++;
        else tempBuckets["Outros"]++;
      });
      return { totalCamaras, temps: tempBuckets, isolamentos, espessuras };
    },
  });

  const icons: Record<string, any> = { padrao: TrendingUp, anomalia: AlertTriangle, oportunidade: Lightbulb };
  const topPattern = patterns?.[0];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Painel estratégico"
        description="Padrões de câmaras, distribuição técnica e insights automáticos da IA forense."
      />

      {/* Highlight: top pattern */}
      {topPattern && (
        <Card className="p-6 gradient-surface border-primary/30">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-md bg-primary/15 text-primary flex items-center justify-center">
              <Snowflake className="size-6" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Padrão dominante</div>
              <div className="text-xl font-semibold mt-0.5">{topPattern.padrao}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {topPattern.count} proposta(s) · {topPattern.clientes} cliente(s) · {formatBRL(topPattern.total)} cotado
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Top patterns */}
      <section>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
          <Layers className="size-3.5" />Top padrões de câmara
        </div>
        {!patterns?.length ? (
          <EmptyState
            icon={Snowflake}
            title="Sem padrões mapeados ainda"
            description="Reprocesse documentos em /app/documents para a IA gerar a assinatura técnica de cada câmara."
          />
        ) : (
          <Card className="gradient-surface border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Assinatura</th>
                  <th className="text-right px-4 py-2.5 font-medium">Propostas</th>
                  <th className="text-right px-4 py-2.5 font-medium">Clientes únicos</th>
                  <th className="text-right px-4 py-2.5 font-medium">Valor total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patterns.slice(0, 10).map((p) => (
                  <tr key={p.padrao} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">
                      <Badge variant="outline" className="border-primary/40 text-foreground">{p.padrao}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{p.count}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{p.clientes}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatBRL(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Distributions */}
      {aggregates && aggregates.totalCamaras > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          <DistroCard
            title="Faixas de temperatura"
            icon={Thermometer}
            entries={Object.entries(aggregates.temps).filter(([, v]) => v > 0)}
            total={aggregates.totalCamaras}
          />
          <DistroCard
            title="Tipos de isolamento"
            icon={Layers}
            entries={Object.entries(aggregates.isolamentos)}
            total={Object.values(aggregates.isolamentos).reduce((a, b) => a + b, 0)}
          />
          <DistroCard
            title="Espessuras de painel"
            icon={Snowflake}
            entries={Object.entries(aggregates.espessuras).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))}
            total={Object.values(aggregates.espessuras).reduce((a, b) => a + b, 0)}
          />
        </div>
      )}

      {/* IA insights */}
      <section>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Insights gerados pela IA</div>
        {!insights?.length ? (
          <EmptyState icon={Brain} title="Sem insights ainda" description="Os insights serão gerados após o processamento de mais documentos." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {insights.map((i: any) => {
              const Icon = icons[i.tipo] || Brain;
              return (
                <Card key={i.id} className="p-5 gradient-surface border-border">
                  <div className="flex items-start gap-3">
                    <div className={`size-9 rounded-md flex items-center justify-center ${i.severidade === "alto" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{i.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-1">{i.descricao}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DistroCard({
  title,
  icon: Icon,
  entries,
  total,
}: {
  title: string;
  icon: any;
  entries: [string, number][];
  total: number;
}) {
  return (
    <Card className="p-5 gradient-surface border-border">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-3">
        <Icon className="size-3.5" />{title}
      </div>
      <div className="space-y-2">
        {entries.length === 0 && <div className="text-xs text-muted-foreground">Sem dados ainda.</div>}
        {entries.map(([k, v]) => {
          const pct = total ? Math.round((v / total) * 100) : 0;
          return (
            <div key={k}>
              <div className="flex justify-between text-xs mb-0.5">
                <span>{k}</span>
                <span className="font-mono text-muted-foreground">{v} · {pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
