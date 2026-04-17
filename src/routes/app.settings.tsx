import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard-bits";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
  head: () => ({ meta: [{ title: "Configurações — DocIntel" }] }),
});

function Settings() {
  const { user } = useAuth();
  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Configurações" description="Conta, workspace e integrações." />
      <Card className="p-5 gradient-surface border-border">
        <div className="text-sm font-medium mb-3">Conta</div>
        <div className="text-sm text-muted-foreground">E-mail: <span className="text-foreground">{user?.email}</span></div>
        <div className="text-sm text-muted-foreground mt-1">ID: <span className="font-mono text-xs">{user?.id}</span></div>
      </Card>
    </div>
  );
}
