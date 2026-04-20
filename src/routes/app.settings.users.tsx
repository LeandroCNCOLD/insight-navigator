import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus, KeyRound, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/settings/users")({
  component: UsersTab,
});

type AppRole = "admin" | "analyst" | "viewer";
type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: AppRole;
  last_sign_in_at: string | null;
  created_at: string;
};

async function callAdmin<T = any>(body: any): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

function genTempPassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s + "!9";
}

function UsersTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);

  const { data: myRole, isLoading: roleLoading } = useQuery({
    queryKey: ["my-role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data?.role ?? "analyst") as AppRole;
    },
  });

  const isAdmin = myRole === "admin";

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const r = await callAdmin<{ users: UserRow[] }>({ action: "list" });
      return r.users;
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) =>
      callAdmin({ action: "update_role", user_id, role }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delUser = useMutation({
    mutationFn: async (user_id: string) => callAdmin({ action: "delete", user_id }),
    onSuccess: () => {
      toast.success("Usuário excluído");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (roleLoading) {
    return (
      <div className="p-8 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando permissões...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="p-8 gradient-surface border-border text-center space-y-2">
        <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-xs text-muted-foreground">
          Apenas usuários com papel <Badge variant="outline">admin</Badge> podem
          gerenciar usuários. Seu papel atual: <Badge variant="outline">{myRole}</Badge>
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Gestão de usuários</h3>
          <p className="text-xs text-muted-foreground">
            Crie usuários, defina papéis (admin / analyst / viewer) e gerencie acessos.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1" /> Novo usuário
        </Button>
      </div>

      <Card className="gradient-surface border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Usuário</th>
                <th className="text-left px-4 py-2.5 font-medium">E-mail</th>
                <th className="text-left px-4 py-2.5 font-medium">Papel</th>
                <th className="text-left px-4 py-2.5 font-medium">Último acesso</th>
                <th className="text-left px-4 py-2.5 font-medium">Criado</th>
                <th className="text-right px-4 py-2.5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 font-medium">{u.display_name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={u.role}
                      onValueChange={(v) =>
                        updateRole.mutate({ user_id: u.id, role: v as AppRole })
                      }
                      disabled={u.id === user?.id}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="analyst">analyst</SelectItem>
                        <SelectItem value="viewer">viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {u.last_sign_in_at ? formatDate(u.last_sign_in_at) : "nunca"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setResetFor(u)}
                        title="Redefinir senha"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={u.id === user?.id}
                        onClick={() => {
                          if (confirm(`Excluir ${u.email}? Essa ação é irreversível.`))
                            delUser.mutate(u.id);
                        }}
                        title="Excluir usuário"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
      />

      <ResetPasswordDialog
        user={resetFor}
        onClose={() => setResetFor(null)}
      />
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("analyst");
  const [password, setPassword] = useState(genTempPassword());
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEmail("");
    setName("");
    setRole("analyst");
    setPassword(genTempPassword());
  };

  const submit = async () => {
    if (!email || !password) {
      toast.error("E-mail e senha são obrigatórios");
      return;
    }
    setBusy(true);
    try {
      await callAdmin({
        action: "create",
        email,
        password,
        display_name: name || undefined,
        role,
      });
      toast.success("Usuário criado. Compartilhe a senha temporária com segurança.");
      onCreated();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Field label="Nome de exibição">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Opcional" />
          </Field>
          <Field label="E-mail *">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
            />
          </Field>
          <Field label="Papel">
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">admin — controle total</SelectItem>
                <SelectItem value="analyst">analyst — analista (padrão)</SelectItem>
                <SelectItem value="viewer">viewer — apenas leitura</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Senha temporária *">
            <div className="flex gap-2">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPassword(genTempPassword())}
              >
                Gerar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              O usuário deverá trocar a senha no primeiro acesso (recomendado).
            </p>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Criar usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: UserRow | null;
  onClose: () => void;
}) {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir senha — {user.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Field label="Nova senha">
            <div className="flex gap-2">
              <Input value={pwd} onChange={(e) => setPwd(e.target.value)} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPwd(genTempPassword())}
              >
                Gerar
              </Button>
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={busy || !pwd}
            onClick={async () => {
              setBusy(true);
              try {
                await callAdmin({ action: "reset_password", user_id: user.id, password: pwd });
                toast.success("Senha redefinida");
                onClose();
              } catch (e: any) {
                toast.error(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
