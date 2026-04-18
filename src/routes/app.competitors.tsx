import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Building2, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/competitors")({
  component: Competitors,
  head: () => ({ meta: [{ title: "Concorrentes — DocIntel" }] }),
});

function Competitors() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(""); const [desc, setDesc] = useState("");

  const { data } = useQuery({
    queryKey: ["competitors-with-counts"],
    queryFn: async () => {
      const { data: comps } = await supabase.from("competitors").select("*").order("nome");
      if (!comps?.length) return [];
      const ids = comps.map((c) => c.id);
      const { data: docs } = await supabase
        .from("documents")
        .select("competitor_id")
        .in("competitor_id", ids);
      const counts: Record<string, number> = {};
      (docs || []).forEach((d: any) => {
        if (d.competitor_id) counts[d.competitor_id] = (counts[d.competitor_id] || 0) + 1;
      });
      return comps.map((c) => ({ ...c, doc_count: counts[c.id] || 0 }));
    },
  });

  const create = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("competitors").insert({ owner_id: u.user.id, nome, descricao: desc });
    if (error) return toast.error(error.message);
    toast.success("Concorrente criado");
    setOpen(false); setNome(""); setDesc("");
    qc.invalidateQueries({ queryKey: ["competitors-with-counts"] });
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Concorrentes" description={`${data?.length || 0} fabricante(s) na base — clique em uma pasta para ver documentos e padrões`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo concorrente</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Conela, Thermopro, Kit Frigor, DNS…" /></div>
                <div><Label>Descrição</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              </div>
              <DialogFooter><Button onClick={create} disabled={!nome}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      {!data?.length ? <EmptyState icon={Building2} title="Sem concorrentes" description="Cadastre concorrentes ou faça upload — a IA detecta o fabricante automaticamente (fallback Conela)." /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((c: any) => (
            <Link key={c.id} to="/app/competitors/$nome" params={{ nome: encodeURIComponent(c.nome) }}>
              <Card className="p-5 gradient-surface border-border hover:border-primary/40 transition-colors cursor-pointer h-full">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Building2 className="size-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.descricao || "—"}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="size-3.5" />
                  {c.doc_count} documento(s) na pasta
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
