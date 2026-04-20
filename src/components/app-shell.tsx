import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Upload, FileText, Users, Building2, Wrench, BarChart3,
  Map, Brain, GitCompare, ClipboardCheck, BookOpen, ListChecks,
  ShieldCheck, Settings, LogOut, Search, Lightbulb, Target,
  RefreshCw, Tag, Home, Swords,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/changelog";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const nav: { section: string; items: NavItem[] }[] = [
  { section: "Visão geral", items: [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  ]},
  { section: "Documentos", items: [
    { to: "/app/upload/cncode", label: "Upload CN Code (casa)", icon: Home },
    { to: "/app/upload", label: "Upload Concorrentes", icon: Upload, exact: true },
    { to: "/app/documents", label: "Documentos", icon: FileText },
    { to: "/app/queue", label: "Fila de processamento", icon: ListChecks },
  ]},
  { section: "Inteligência", items: [
    { to: "/app/proposals", label: "Propostas", icon: FileText },
    { to: "/app/clients", label: "Clientes", icon: Users },
    { to: "/app/competitors", label: "Concorrentes", icon: Building2 },
    { to: "/app/equipments", label: "Equipamentos", icon: Wrench },
  ]},
  { section: "Análise", items: [
    { to: "/app/dashboards/commercial", label: "Comercial", icon: BarChart3 },
    { to: "/app/dashboards/technical", label: "Técnico", icon: Wrench },
    { to: "/app/dashboards/contractual", label: "Contratual", icon: ShieldCheck },
    { to: "/app/dashboards/geographic", label: "Geográfico", icon: Map },
    { to: "/app/dashboards/strategic", label: "Estratégico", icon: Brain },
    { to: "/app/dashboards/head-to-head", label: "Head-to-Head", icon: Swords },
  ]},
  { section: "Inteligência de Mercado", items: [
    { to: "/app/market", label: "Mercado & Produto", icon: Lightbulb },
    { to: "/app/recommend", label: "Recomendação", icon: Target },
  ]},
  { section: "Operação", items: [
    { to: "/app/compare", label: "Comparação", icon: GitCompare },
    { to: "/app/review", label: "Revisão humana", icon: ClipboardCheck },
    { to: "/app/dictionaries", label: "Dicionários", icon: BookOpen },
    { to: "/app/audit", label: "Auditoria", icon: ShieldCheck },
  ]},
  { section: "Configurações", items: [
    { to: "/app/settings", label: "Conta", icon: Settings, exact: true },
    { to: "/app/settings/users", label: "Usuários", icon: Users },
    { to: "/app/settings/versions", label: "Versões & Revisões", icon: Tag },
  ]},
];

async function handleHardReload() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    toast.success("Cache limpo, recarregando...");
  } catch {
    // ignore — still reload
  }
  setTimeout(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("_v", Date.now().toString());
    window.location.replace(url.toString());
  }, 300);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <Link to="/app" className="flex items-center gap-2">
            <div className="size-8 rounded-md gradient-primary shadow-glow flex items-center justify-center">
              <Brain className="size-4 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight text-sidebar-foreground">DocIntel</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Competitive Intelligence</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5">
          {nav.map((g) => (
            <div key={g.section}>
              <div className="px-2 mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{g.section}</div>
              <div className="space-y-0.5">
                {g.items.map((it) => {
                  const active = it.exact ? location.pathname === it.to : location.pathname.startsWith(it.to);
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="size-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{user?.email}</div>
              <div className="text-[10px] text-muted-foreground">analista</div>
            </div>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => signOut()}>
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 shrink-0 border-b border-border bg-background/60 backdrop-blur flex items-center px-6 gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input placeholder="Busca global em documentos, clientes, equipamentos..." className="pl-8 h-9 bg-muted/30 border-border" />
          </div>
          <Link
            to="/app/settings/versions"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            title="Ver changelog"
          >
            <Tag className="size-3" />
            v{APP_VERSION}
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleHardReload}
            className="h-8 gap-1.5 text-xs"
            title="Atualizar limpando cache do navegador"
          >
            <RefreshCw className="size-3.5" />
            Atualizar
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </div>
      </main>
    </div>
  );
}
