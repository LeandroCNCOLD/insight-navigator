import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/settings/")({
  component: AccountTab,
});

function AccountTab() {
  const { user } = useAuth();
  const { data: role } = useQuery({
    queryKey: ["my-role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.role ?? "analyst";
    },
  });
  return (
    <Card className="p-5 gradient-surface border-border space-y-2">
      <div className="text-sm font-medium mb-3">Conta</div>
      <div className="text-sm text-muted-foreground">
        E-mail: <span className="text-foreground">{user?.email}</span>
      </div>
      <div className="text-sm text-muted-foreground">
        Papel: {role ? <Badge variant="outline">{role}</Badge> : "—"}
      </div>
      <div className="text-sm text-muted-foreground">
        ID: <span className="font-mono text-xs">{user?.id}</span>
      </div>
    </Card>
  );
}
