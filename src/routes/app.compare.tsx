import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitCompare } from "lucide-react";
import { useState } from "react";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/compare")({
  component: Compare,
  head: () => ({ meta: [{ title: "Comparação — DocIntel" }] }),
});

function Compare() {
  const [a, setA] = useState<string>(""); const [b, setB] = useState<string>("");
  const { data: list } = useQuery({
    queryKey: ["compare-list"],
    queryFn: async () => (await supabase.from("proposals").select("id,numero,client:clients(nome)").order("created_at", { ascending: false })).data || [],
  });
  const { data: A } = useQuery({ enabled: !!a, queryKey: ["prop", a], queryFn: async () => (await supabase.from("proposals").select("*,client:clients(*),document:documents(file_name)").eq("id", a).maybeSingle()).data });
  const { data: B } = useQuery({ enabled: !!b, queryKey: ["prop", b], queryFn: async () => (await supabase.from("proposals").select("*,client:clients(*),document:documents(file_name)").eq("id", b).maybeSingle()).data });

  if (!list?.length) return <div className="p-6"><EmptyState icon={GitCompare} title="Sem propostas" description="É preciso ter pelo menos 2 propostas extraídas para comparar." /></div>;

  const fields = [
    { k: "Cliente", get: (p: any) => p?.client?.nome },
    { k: "Documento", get: (p: any) => p?.document?.file_name },
    { k: "Nº Proposta", get: (p: any) => p?.numero },
    { k: "Data", get: (p: any) => formatDate(p?.data_proposta) },
    { k: "Valor total", get: (p: any) => formatBRL(p?.valor_total) },
    { k: "Pagamento", get: (p: any) => p?.condicao_pagamento },
    { k: "Parcelas", get: (p: any) => p?.parcelas },
    { k: "Prazo entrega", get: (p: any) => p?.prazo_entrega_dias ? `${p.prazo_entrega_dias} dias` : null },
    { k: "Garantia", get: (p: any) => p?.garantia_meses ? `${p.garantia_meses} meses` : null },
    { k: "Frete", get: (p: any) => p?.frete_tipo },
    { k: "Vendedor", get: (p: any) => p?.vendedor },
    { k: "Status", get: (p: any) => p?.status_proposta },
  ];

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Comparação lado-a-lado" description="Compare duas propostas: valores, prazos, equipamentos e cláusulas." />

      <div className="grid grid-cols-2 gap-4">
        <Select value={a} onValueChange={setA}>
          <SelectTrigger><SelectValue placeholder="Proposta A..." /></SelectTrigger>
          <SelectContent>{list.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.client?.nome || "—"} · {p.numero || p.id.slice(0,6)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={b} onValueChange={setB}>
          <SelectTrigger><SelectValue placeholder="Proposta B..." /></SelectTrigger>
          <SelectContent>{list.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.client?.nome || "—"} · {p.numero || p.id.slice(0,6)}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {a && b && (
        <Card className="gradient-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-2.5 font-medium w-1/4">Campo</th><th className="text-left px-4 py-2.5 font-medium">A</th><th className="text-left px-4 py-2.5 font-medium">B</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fields.map((f) => {
                const va = f.get(A); const vb = f.get(B);
                const diff = va !== vb;
                return (
                  <tr key={f.k} className={diff ? "bg-warning/5" : ""}>
                    <td className="px-4 py-2.5 text-muted-foreground">{f.k}</td>
                    <td className="px-4 py-2.5">{va || "—"}</td>
                    <td className="px-4 py-2.5">{vb || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
