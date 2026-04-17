import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Wrench } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/app/equipments")({
  component: Equipments,
  head: () => ({ meta: [{ title: "Equipamentos — DocIntel" }] }),
});

function Equipments() {
  const { data } = useQuery({
    queryKey: ["equipments"],
    queryFn: async () => {
      const { data } = await supabase.from("equipments").select("*");
      return data || [];
    },
  });

  // Group by modelo
  const byModel: Record<string, number> = {};
  const byGas: Record<string, number> = {};
  const byCompressor: Record<string, number> = {};
  (data || []).forEach((e) => {
    if (e.modelo) byModel[e.modelo] = (byModel[e.modelo] || 0) + (e.quantidade || 1);
    if (e.gas_refrigerante) byGas[e.gas_refrigerante] = (byGas[e.gas_refrigerante] || 0) + 1;
    if (e.compressor) byCompressor[e.compressor] = (byCompressor[e.compressor] || 0) + 1;
  });
  const topModels = Object.entries(byModel).map(([modelo, n]) => ({ modelo, n })).sort((a, b) => b.n - a.n).slice(0, 10);
  const gasData = Object.entries(byGas).map(([gas, n]) => ({ gas, n }));
  const compData = Object.entries(byCompressor).map(([compressor, n]) => ({ compressor, n }));

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Equipamentos" description={`${data?.length || 0} equipamentos catalogados`} />
      {!data?.length ? <EmptyState icon={Wrench} title="Sem equipamentos" description="Equipamentos aparecerão aqui após o processamento." /> : (
        <>
          <Card className="p-5 gradient-surface border-border">
            <h3 className="font-medium text-sm mb-4">Top modelos mais usados</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topModels} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} horizontal={false} />
                  <XAxis type="number" stroke="oklch(0.66 0.012 260)" fontSize={11} />
                  <YAxis type="category" dataKey="modelo" stroke="oklch(0.66 0.012 260)" fontSize={11} width={120} />
                  <Tooltip contentStyle={{ background: "oklch(0.19 0.006 260)", border: "1px solid oklch(0.27 0.008 260)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="n" fill="oklch(0.65 0.20 250)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5 gradient-surface border-border">
              <h3 className="font-medium text-sm mb-4">Gases refrigerantes</h3>
              <div className="h-56"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={gasData}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                  <XAxis dataKey="gas" stroke="oklch(0.66 0.012 260)" fontSize={11} />
                  <YAxis stroke="oklch(0.66 0.012 260)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.19 0.006 260)", border: "1px solid oklch(0.27 0.008 260)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="n" fill="oklch(0.68 0.17 152)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer></div>
            </Card>
            <Card className="p-5 gradient-surface border-border">
              <h3 className="font-medium text-sm mb-4">Tipos de compressor</h3>
              <div className="h-56"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={compData}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                  <XAxis dataKey="compressor" stroke="oklch(0.66 0.012 260)" fontSize={11} />
                  <YAxis stroke="oklch(0.66 0.012 260)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.19 0.006 260)", border: "1px solid oklch(0.27 0.008 260)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="n" fill="oklch(0.78 0.15 75)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer></div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
