import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { Users, Phone, Mail, MessageCircle, Building2, MapPin, Pencil, X, Check, Globe } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/clients")({
  component: Clients,
  head: () => ({ meta: [{ title: "Clientes — DocIntel" }] }),
});

type ClientRow = {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  contato_nome: string | null;
  contato_cargo: string | null;
  site: string | null;
  segmento: string | null;
  notas: string | null;
  stats: { count: number; total: number; ultima: string | null };
  origens: { house: boolean; concorrente: boolean };
  proposals: Array<{ id: string; numero: string | null; valor_total: number | null; data_proposta: string | null; padrao_camara: string | null; resumo_executivo: string | null; is_house: boolean; competitor_nome: string | null }>;
};

function Clients() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"todos" | "house" | "concorrentes">("todos");

  const { data } = useQuery({
    queryKey: ["clients-crm"],
    queryFn: async (): Promise<ClientRow[]> => {
      const [{ data: clients }, { data: props }, { data: comps }] = await Promise.all([
        supabase.from("clients").select("*").order("nome"),
        supabase
          .from("proposals")
          .select("id,client_id,competitor_id,numero,valor_total,data_proposta,padrao_camara,resumo_executivo,created_at"),
        supabase.from("competitors").select("id,nome,is_house"),
      ]);
      const compMap = new Map<string, { nome: string; is_house: boolean }>();
      (comps || []).forEach((c: any) => compMap.set(c.id, { nome: c.nome, is_house: !!c.is_house }));

      const byClient: Record<string, any[]> = {};
      (props || []).forEach((p) => {
        if (!p.client_id) return;
        const meta = p.competitor_id ? compMap.get(p.competitor_id) : null;
        (byClient[p.client_id] ||= []).push({
          ...p,
          is_house: meta?.is_house ?? false,
          competitor_nome: meta?.nome ?? null,
        });
      });
      return (clients || []).map((c: any) => {
        const list = byClient[c.id] || [];
        const total = list.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
        const ultima = list
          .map((p) => p.data_proposta || p.created_at)
          .filter(Boolean)
          .sort()
          .reverse()[0] || null;
        const house = list.some((p) => p.is_house);
        const concorrente = list.some((p) => !p.is_house);
        return {
          ...c,
          stats: { count: list.length, total, ultima },
          origens: { house, concorrente },
          proposals: list.sort((a, b) => (b.data_proposta || "").localeCompare(a.data_proposta || "")),
        };
      });
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.toLowerCase();
    const byTab = data.filter((c) => {
      if (tab === "house") return c.origens.house;
      if (tab === "concorrentes") return c.origens.concorrente && !c.origens.house;
      return true;
    });
    return !term
      ? byTab
      : byTab.filter(
          (c) =>
            c.nome?.toLowerCase().includes(term) ||
            c.cnpj?.toLowerCase().includes(term) ||
            c.cidade?.toLowerCase().includes(term) ||
            c.email?.toLowerCase().includes(term),
        );
  }, [data, q, tab]);

  const counts = useMemo(() => {
    const all = data || [];
    return {
      todos: all.length,
      house: all.filter((c) => c.origens.house).length,
      concorrentes: all.filter((c) => c.origens.concorrente && !c.origens.house).length,
    };
  }, [data]);

  const open = filtered.find((c) => c.id === openId) || null;

  const onSaved = () => qc.invalidateQueries({ queryKey: ["clients-crm"] });

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Clientes" description={`${data?.length || 0} cliente(s) · CRM de prospecção`} />

      <Input
        placeholder="Buscar por nome, CNPJ, cidade ou e-mail…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />

      {!filtered.length ? (
        <EmptyState
          icon={Users}
          title="Sem clientes"
          description="Os clientes serão criados automaticamente conforme a IA processa propostas. Reprocesse documentos para enriquecer dados de contato."
        />
      ) : (
        <Card className="gradient-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium">CNPJ</th>
                <th className="text-left px-4 py-2.5 font-medium">Contato</th>
                <th className="text-left px-4 py-2.5 font-medium">Telefone</th>
                <th className="text-left px-4 py-2.5 font-medium">E-mail</th>
                <th className="text-left px-4 py-2.5 font-medium">Cidade/UF</th>
                <th className="text-right px-4 py-2.5 font-medium">Propostas</th>
                <th className="text-right px-4 py-2.5 font-medium">Total cotado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setOpenId(c.id)}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{c.nome}</div>
                        {c.segmento && <div className="text-[10px] text-muted-foreground">{c.segmento}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{c.cnpj || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {c.contato_nome ? (
                      <div>
                        <div>{c.contato_nome}</div>
                        {c.contato_cargo && <div className="text-[10px] text-muted-foreground">{c.contato_cargo}</div>}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      {c.telefone && <span>{c.telefone}</span>}
                      {c.whatsapp && (
                        <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" onClick={(e) => e.stopPropagation()} className="text-success hover:underline">
                          <MessageCircle className="size-3.5 inline" />
                        </a>
                      )}
                      {!c.telefone && !c.whatsapp && "—"}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary truncate max-w-[180px] inline-block">
                        {c.email}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {c.cidade ? `${c.cidade}${c.estado ? "/" + c.estado : ""}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{c.stats.count}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatBRL(c.stats.total)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="sm" className="h-7" onClick={(e) => { e.stopPropagation(); setOpenId(c.id); }}>
                      <Pencil className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ClientDrawer client={open} onClose={() => setOpenId(null)} onSaved={onSaved} />
    </div>
  );
}

function ClientDrawer({
  client,
  onClose,
  onSaved,
}: {
  client: ClientRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [edit, setEdit] = useState<Partial<ClientRow>>({});
  const [saving, setSaving] = useState(false);

  // Reset form whenever the open client changes
  const formKey = client?.id || "none";
  useMemoOnce(formKey, () => setEdit({}));

  if (!client) return null;
  const v = (k: keyof ClientRow) => (edit[k] !== undefined ? (edit[k] as any) : (client[k] as any)) ?? "";

  const save = async () => {
    if (!Object.keys(edit).length) { onClose(); return; }
    setSaving(true);
    // Strip computed fields before sending
    const { stats: _s, proposals: _p, id: _i, ...payload } = edit as any;
    const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
    setSaving(false);
    if (error) { toast.error("Falha ao salvar", { description: error.message }); return; }
    toast.success("Cliente atualizado");
    setEdit({});
    onSaved();
    onClose();
  };

  return (
    <Sheet open={!!client} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="size-4" />{client.nome}
          </SheetTitle>
          <SheetDescription>
            {client.stats.count} proposta(s) · {formatBRL(client.stats.total)} cotado
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <section>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Contato rápido</div>
            <div className="flex flex-wrap gap-2">
              {client.telefone && <a href={`tel:${client.telefone}`}><Button size="sm" variant="outline"><Phone className="size-3.5 mr-2" />{client.telefone}</Button></a>}
              {client.whatsapp && <a href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}`} target="_blank"><Button size="sm" variant="outline"><MessageCircle className="size-3.5 mr-2" />WhatsApp</Button></a>}
              {client.email && <a href={`mailto:${client.email}`}><Button size="sm" variant="outline"><Mail className="size-3.5 mr-2" />E-mail</Button></a>}
              {client.site && <a href={client.site.startsWith("http") ? client.site : `https://${client.site}`} target="_blank"><Button size="sm" variant="outline"><Globe className="size-3.5 mr-2" />Site</Button></a>}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <Field label="Nome / Fantasia"><Input value={v("nome")} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
            <Field label="Razão social"><Input value={v("razao_social")} onChange={(e) => setEdit({ ...edit, razao_social: e.target.value })} /></Field>
            <Field label="CNPJ"><Input value={v("cnpj")} onChange={(e) => setEdit({ ...edit, cnpj: e.target.value })} /></Field>
            <Field label="Segmento"><Input value={v("segmento")} onChange={(e) => setEdit({ ...edit, segmento: e.target.value })} /></Field>
            <Field label="Contato (nome)"><Input value={v("contato_nome")} onChange={(e) => setEdit({ ...edit, contato_nome: e.target.value })} /></Field>
            <Field label="Cargo"><Input value={v("contato_cargo")} onChange={(e) => setEdit({ ...edit, contato_cargo: e.target.value })} /></Field>
            <Field label="Telefone"><Input value={v("telefone")} onChange={(e) => setEdit({ ...edit, telefone: e.target.value })} /></Field>
            <Field label="WhatsApp"><Input value={v("whatsapp")} onChange={(e) => setEdit({ ...edit, whatsapp: e.target.value })} /></Field>
            <Field label="E-mail"><Input value={v("email")} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Site"><Input value={v("site")} onChange={(e) => setEdit({ ...edit, site: e.target.value })} /></Field>
            <Field label="Endereço" className="col-span-2"><Input value={v("endereco")} onChange={(e) => setEdit({ ...edit, endereco: e.target.value })} /></Field>
            <Field label="Bairro"><Input value={v("bairro")} onChange={(e) => setEdit({ ...edit, bairro: e.target.value })} /></Field>
            <Field label="CEP"><Input value={v("cep")} onChange={(e) => setEdit({ ...edit, cep: e.target.value })} /></Field>
            <Field label="Cidade"><Input value={v("cidade")} onChange={(e) => setEdit({ ...edit, cidade: e.target.value })} /></Field>
            <Field label="UF"><Input value={v("estado")} onChange={(e) => setEdit({ ...edit, estado: e.target.value })} /></Field>
            <Field label="Notas de prospecção" className="col-span-2">
              <Textarea rows={3} value={v("notas")} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} />
            </Field>
          </section>

          <section>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Histórico de propostas</div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
              {client.proposals.length === 0 && <div className="text-xs text-muted-foreground">Nenhuma proposta vinculada.</div>}
              {client.proposals.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-muted/20 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{p.numero || "—"} · {p.data_proposta || "sem data"}</div>
                    {p.padrao_camara && <Badge variant="outline" className="mt-1 text-[9px]">{p.padrao_camara}</Badge>}
                    {p.resumo_executivo && <div className="text-muted-foreground line-clamp-2 mt-0.5">{p.resumo_executivo}</div>}
                  </div>
                  <div className="font-mono ml-3 shrink-0">{formatBRL(p.valor_total || 0)}</div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={onClose}><X className="size-4 mr-2" />Cancelar</Button>
            <Button onClick={save} disabled={saving}><Check className="size-4 mr-2" />Salvar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

// Small helper: re-run a callback only when the key changes (poor man's useEffect on key)
let lastKey = "";
function useMemoOnce(key: string, fn: () => void) {
  if (lastKey !== key) {
    lastKey = key;
    fn();
  }
}
