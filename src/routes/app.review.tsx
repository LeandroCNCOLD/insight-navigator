import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/review")({
  component: Review,
  head: () => ({ meta: [{ title: "Revisão humana — DocIntel" }] }),
});

function Review() {
  const qc = useQueryClient();
  // Show low-confidence proposals as proxy for review queue
  const { data } = useQuery({
    queryKey: ["review-queue"],
    queryFn: async () => (await supabase.from("proposals").select("*,client:clients(nome),document:documents(file_name)").lt("score_confianca", 0.7).order("score_confianca")).data || [],
  });

  const update = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from("proposals").update({ [field]: value }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    qc.invalidateQueries();
  };

  const approve = async (id: string) => {
    await supabase.from("proposals").update({ score_confianca: 1.0 }).eq("id", id);
    toast.success("Aprovado");
    qc.invalidateQueries();
  };

  if (!data?.length) return <div className="p-6"><EmptyState icon={ClipboardCheck} title="Nada para revisar" description="Não há campos com baixa confiança no momento." /></div>;

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Revisão humana" description="Edite ou aprove campos extraídos com baixa confiança." />
      <div className="space-y-3">
        {data.map((p: any) => (
          <Card key={p.id} className="p-5 gradient-surface border-border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-medium">{p.client?.nome || "Cliente desconhecido"}</div>
                <div className="text-xs text-muted-foreground">{p.document?.file_name}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">Confiança {(p.score_confianca * 100).toFixed(0)}%</Badge>
                <Button size="sm" variant="outline" onClick={() => approve(p.id)}><Check className="size-3.5 mr-1" />Aprovar tudo</Button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <EditField label="Nº proposta" value={p.numero} onSave={(v) => update(p.id, "numero", v)} />
              <EditField label="Valor total" value={p.valor_total} type="number" onSave={(v) => update(p.id, "valor_total", v)} />
              <EditField label="Vendedor" value={p.vendedor} onSave={(v) => update(p.id, "vendedor", v)} />
              <EditField label="Garantia (meses)" value={p.garantia_meses} type="number" onSave={(v) => update(p.id, "garantia_meses", v)} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EditField({ label, value, type, onSave }: { label: string; value: any; type?: string; onSave: (v: any) => void }) {
  const [v, setV] = useState(value ?? "");
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex gap-2 mt-1">
        <Input type={type} value={v} onChange={(e) => setV(e.target.value)} className="h-8 text-sm" />
        <Button size="sm" variant="ghost" className="h-8" onClick={() => onSave(type === "number" ? Number(v) : v)}><Check className="size-3.5" /></Button>
      </div>
    </div>
  );
}
