import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { History, ShieldCheck, FileSearch, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/settings/versions")({
  component: VersionsTab,
});

const subtabs = [
  { id: "reviews", label: "Revisões de propostas", icon: History },
  { id: "audit", label: "Log de auditoria", icon: ShieldCheck },
  { id: "forensic", label: "Versões forenses", icon: FileSearch },
] as const;

type SubTab = (typeof subtabs)[number]["id"];

function VersionsTab() {
  const [tab, setTab] = useState<SubTab>("reviews");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {subtabs.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setTab(s.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 border",
                tab === s.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3 w-3" />
              {s.label}
            </button>
          );
        })}
      </div>
      {tab === "reviews" && <ReviewsTable />}
      {tab === "audit" && <AuditTable />}
      {tab === "forensic" && <ForensicTable />}
    </div>
  );
}

function ReviewsTable() {
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["proposal-review-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("proposal_review_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });
  const filtered = (data ?? []).filter(
    (r) =>
      !filter ||
      r.action?.toLowerCase().includes(filter.toLowerCase()) ||
      r.field_name?.toLowerCase().includes(filter.toLowerCase())
  );
  return (
    <Card className="gradient-surface border-border overflow-hidden">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Filtrar:</Label>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="ação ou campo..."
          className="h-7 text-xs max-w-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} registro(s)
        </span>
      </div>
      {isLoading ? (
        <Loading />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Quando</th>
              <th className="text-left px-4 py-2.5 font-medium">Ação</th>
              <th className="text-left px-4 py-2.5 font-medium">Campo</th>
              <th className="text-left px-4 py-2.5 font-medium">Valor anterior</th>
              <th className="text-left px-4 py-2.5 font-medium">Novo valor</th>
              <th className="text-left px-4 py-2.5 font-medium">Comentário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(r.created_at)}
                </td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className="text-[10px]">{r.action}</Badge>
                </td>
                <td className="px-4 py-2 text-xs">{r.field_name ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground max-w-[180px] truncate">
                  {jsonPreview(r.old_value)}
                </td>
                <td className="px-4 py-2 text-xs max-w-[180px] truncate">
                  {jsonPreview(r.new_value)}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{r.comment ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && <Empty colSpan={6} />}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function AuditTable() {
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });
  const filtered = (data ?? []).filter(
    (r) =>
      !filter ||
      r.acao?.toLowerCase().includes(filter.toLowerCase()) ||
      r.entidade?.toLowerCase().includes(filter.toLowerCase())
  );
  return (
    <Card className="gradient-surface border-border overflow-hidden">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Filtrar:</Label>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="ação ou entidade..."
          className="h-7 text-xs max-w-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} registro(s)
        </span>
      </div>
      {isLoading ? (
        <Loading />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Quando</th>
              <th className="text-left px-4 py-2.5 font-medium">Ação</th>
              <th className="text-left px-4 py-2.5 font-medium">Entidade</th>
              <th className="text-left px-4 py-2.5 font-medium">ID</th>
              <th className="text-left px-4 py-2.5 font-medium">Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(l.created_at)}
                </td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className="text-[10px]">{l.acao}</Badge>
                </td>
                <td className="px-4 py-2 text-xs">{l.entidade ?? "—"}</td>
                <td className="px-4 py-2 text-[10px] font-mono text-muted-foreground">
                  {l.entidade_id?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground max-w-[300px] truncate">
                  {jsonPreview(l.payload)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <Empty colSpan={5} />}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ForensicTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["forensic-versions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("forensic_analyses")
        .select("id, document_id, versao, modelo_ia, score_global, tipo_documento, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });
  return (
    <Card className="gradient-surface border-border overflow-hidden">
      {isLoading ? (
        <Loading />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Documento</th>
              <th className="text-left px-4 py-2.5 font-medium">Versão</th>
              <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
              <th className="text-left px-4 py-2.5 font-medium">Modelo IA</th>
              <th className="text-left px-4 py-2.5 font-medium">Score</th>
              <th className="text-left px-4 py-2.5 font-medium">Atualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-2 text-[10px] font-mono text-muted-foreground">
                  {f.document_id?.slice(0, 8)}
                </td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className="text-[10px]">v{f.versao}</Badge>
                </td>
                <td className="px-4 py-2 text-xs">{f.tipo_documento ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{f.modelo_ia ?? "—"}</td>
                <td className="px-4 py-2 text-xs">
                  {f.score_global != null ? Number(f.score_global).toFixed(1) : "—"}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(f.updated_at)}
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && <Empty colSpan={6} />}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function Loading() {
  return (
    <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
    </div>
  );
}

function Empty({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-xs text-muted-foreground">
        Nenhum registro encontrado.
      </td>
    </tr>
  );
}

function jsonPreview(v: any): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
