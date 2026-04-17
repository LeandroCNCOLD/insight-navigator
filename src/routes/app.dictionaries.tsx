import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dictionaries")({
  component: Dicts,
  head: () => ({ meta: [{ title: "Dicionários — DocIntel" }] }),
});

function Dicts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(""); const [t, setT] = useState(""); const [v, setV] = useState("");

  const { data } = useQuery({
    queryKey: ["dictionaries"],
    queryFn: async () => (await supabase.from("dictionaries").select("*").order("categoria")).data || [],
  });

  const create = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("dictionaries").insert({ owner_id: u.user.id, categoria: cat, termo: t, valor_canonico: v });
    if (error) return toast.error(error.message);
    toast.success("Termo adicionado");
    setOpen(false); setCat(""); setT(""); setV("");
    qc.invalidateQueries({ queryKey: ["dictionaries"] });
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Dicionários" description="Mapeie sinônimos e variações para normalização técnica."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Novo termo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo termo</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Categoria</Label><Input value={cat} onChange={(e)=>setCat(e.target.value)} placeholder="ex: gas, compressor, equipamento" /></div>
                <div><Label>Termo encontrado</Label><Input value={t} onChange={(e)=>setT(e.target.value)} placeholder="ex: R-404a" /></div>
                <div><Label>Valor canônico</Label><Input value={v} onChange={(e)=>setV(e.target.value)} placeholder="ex: R404A" /></div>
              </div>
              <DialogFooter><Button onClick={create} disabled={!cat||!t||!v}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />
      {!data?.length ? <EmptyState icon={BookOpen} title="Sem termos no dicionário" description="Adicione termos para padronizar nomenclaturas técnicas e melhorar a extração." /> : (
        <Card className="gradient-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-2.5 font-medium">Categoria</th><th className="text-left px-4 py-2.5 font-medium">Termo</th><th className="text-left px-4 py-2.5 font-medium">Valor canônico</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2.5"><Badge>{d.categoria}</Badge></td>
                  <td className="px-4 py-2.5 font-mono text-xs">{d.termo}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">{d.valor_canonico}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-primary/10 text-primary">{children}</span>;
}
