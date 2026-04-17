import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Brain, AlertTriangle, TrendingUp, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/app/dashboards/strategic")({
  component: Strategic,
  head: () => ({ meta: [{ title: "Painel estratégico — DocIntel" }] }),
});

function Strategic() {
  const { data } = useQuery({
    queryKey: ["dash-strategic"],
    queryFn: async () => (await supabase.from("insights").select("*").order("created_at",{ascending:false})).data || [],
  });

  const icons: Record<string, any> = { padrao: TrendingUp, anomalia: AlertTriangle, oportunidade: Lightbulb };

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Painel estratégico" description="Insights automáticos da IA: padrões, anomalias e oportunidades." />
      {!data?.length ? <EmptyState icon={Brain} title="Sem insights ainda" description="Os insights estratégicos serão gerados automaticamente após o processamento de mais documentos." /> : (
        <div className="grid md:grid-cols-2 gap-3">
          {data.map((i: any) => {
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
    </div>
  );
}
