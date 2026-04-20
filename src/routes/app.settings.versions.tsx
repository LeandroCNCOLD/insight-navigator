import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHANGELOG, APP_VERSION, APP_BUILD_DATE, type ChangelogEntry } from "@/lib/changelog";
import { Sparkles, Bug, Wrench, AlertTriangle, Tag, Calendar } from "lucide-react";

export const Route = createFileRoute("/app/settings/versions")({
  component: VersionsPage,
  head: () => ({ meta: [{ title: "Versões & Revisões — DocIntel" }] }),
});

const typeConfig: Record<ChangelogEntry["type"], { label: string; icon: typeof Sparkles; className: string }> = {
  feature: { label: "Funcionalidade", icon: Sparkles, className: "bg-primary/15 text-primary border-primary/30" },
  improvement: { label: "Melhoria", icon: Wrench, className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  fix: { label: "Correção", icon: Bug, className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  breaking: { label: "Mudança crítica", icon: AlertTriangle, className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

function VersionsPage() {
  return (
    <div className="space-y-5">
      <Card className="p-5 gradient-surface border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Tag className="size-3" />
              Versão atual do sistema
            </div>
            <div className="text-2xl font-semibold tracking-tight mt-1">v{APP_VERSION}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Calendar className="size-3" />
              Build de {new Date(APP_BUILD_DATE).toLocaleDateString("pt-BR")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Histórico</div>
            <div className="text-sm font-medium">{CHANGELOG.length} versões publicadas</div>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {CHANGELOG.map((entry, i) => {
          const cfg = typeConfig[entry.type];
          const Icon = cfg.icon;
          const isLatest = i === 0;
          return (
            <Card key={entry.version} className="p-5 gradient-surface border-border">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
                    <Icon className="size-4 text-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">v{entry.version}</h3>
                      <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                      {isLatest && (
                        <Badge className="bg-primary/20 text-primary border-primary/30">Atual</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium mt-1">{entry.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(entry.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>
              <ul className="space-y-1.5 ml-12">
                {entry.changes.map((c, j) => (
                  <li key={j} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
