import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Building2, Plus } from "lucide-react";
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
    queryKey: ["competitors"],
    queryFn: async () => {
      const { data } = await supabase.from("competitors").select("*").order("nome");
      return data || [];
    },
  });

  const create = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("competitors").insert({ owner_id: u.user.id, nome, descricao: desc });
    if (error) return toast.error(error.message);
    toast.success("Concorrente criado");
    setOpen(false); setNome(""); setDesc("");
    qc.invalidateQueries({ queryKey: ["competitors"] });
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Concorrentes" description={`${data?.length || 0} concorrente(s) monitorado(s)`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo concorrente</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div><Label>Descrição</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              </div>
              <DialogFooter><Button onClick={create} disabled={!nome}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      {!data?.length ? <EmptyState icon={Building2} title="Sem concorrentes" description="Cadastre concorrentes para vincular a documentos." /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((c) => (
            <Card key={c.id} className="p-5 gradient-surface border-border">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Building2 className="size-4" /></div>
                <div>
                  <div className="font-medium">{c.nome}</div>
                  <div className="text-xs text-muted-foreground">{c.descricao || "—"}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
