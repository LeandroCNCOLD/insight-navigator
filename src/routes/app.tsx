import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/lib/auth-context";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-sm text-muted-foreground">Carregando…</div>
    </div>
  ),
  component: () => (
    <AuthProvider>
      <AppShell><Outlet /></AppShell>
    </AuthProvider>
  ),
});
