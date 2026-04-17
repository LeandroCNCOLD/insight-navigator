import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/dashboard-bits";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate, statusLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/app/documents/")({
  component: DocsList,
  head: () => ({ meta: [{ title: "Documentos — DocIntel" }] }),
});

function DocsList() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data } = await supabase.from("documents")
        .select("id,file_name,file_type,file_size,status,created_at,competitor:competitors(nome),client:clients(nome,estado)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = (data || []).filter((d) => !q || d.file_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Documentos" description={`${data?.length || 0} documento(s) na base`}
        action={<Link to="/app/upload"><Button><Upload className="size-4 mr-2" />Novo upload</Button></Link>} />

      <Input placeholder="Buscar por nome..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum documento" description="Faça upload do primeiro arquivo para começar." action={
          <Link to="/app/upload"><Button>Fazer upload</Button></Link>
        } />
      ) : (
        <Card className="gradient-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Arquivo</th>
                <th className="text-left px-4 py-2.5 font-medium">Concorrente</th>
                <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Tamanho</th>
                <th className="text-left px-4 py-2.5 font-medium">Data</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d: any) => (
                <tr key={d.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <Link to="/app/documents/$id" params={{ id: d.id }} className="flex items-center gap-2 hover:text-primary">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span className="truncate max-w-xs">{d.file_name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.competitor?.nome || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.client?.nome || "—"}</td>
                  <td className="px-4 py-2.5 uppercase text-xs">{d.file_type}</td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{formatBytes(d.file_size)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={d.status === "extracted" ? "default" : d.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                      {statusLabel[d.status] || d.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
