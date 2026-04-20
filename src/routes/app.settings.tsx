import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/dashboard-bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/settings")({
  component: SettingsLayout,
  head: () => ({ meta: [{ title: "Configurações — DocIntel" }] }),
});

const tabs = [
  { to: "/app/settings", label: "Conta", exact: true },
  { to: "/app/settings/users", label: "Usuários" },
  { to: "/app/settings/versions", label: "Versões & Revisões" },
];

function SettingsLayout() {
  const location = useLocation();
  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Configurações"
        description="Conta, usuários, papéis, versionamento e auditoria."
      />
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = t.exact
            ? location.pathname === t.to
            : location.pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "px-4 py-2 text-sm border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
