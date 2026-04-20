// Admin user management — only callable by users with role=admin.
// Uses service role to create users without signing out the caller.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type AppRole = "admin" | "analyst" | "viewer";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "list") {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
      const users = list?.users ?? [];
      const ids = users.map((u) => u.id);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        admin.from("profiles").select("user_id, display_name").in("user_id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const pMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) ?? []);
      const rMap = new Map<string, AppRole>();
      roles?.forEach((r) => rMap.set(r.user_id, r.role as AppRole));
      const result = users.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: pMap.get(u.id) ?? null,
        role: rMap.get(u.id) ?? "analyst",
        last_sign_in_at: u.last_sign_in_at,
        created_at: u.created_at,
      }));
      return new Response(JSON.stringify({ users: result }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (action === "create") {
      const { email, password, display_name, role } = body as {
        email: string;
        password: string;
        display_name?: string;
        role: AppRole;
      };
      if (!email || !password || !role) {
        return new Response(JSON.stringify({ error: "missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: display_name ?? email.split("@")[0] },
      });
      if (cErr || !created.user) {
        return new Response(JSON.stringify({ error: cErr?.message ?? "create failed" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      // handle_new_user trigger created profile + analyst role; fix role if needed
      if (role !== "analyst") {
        await admin.from("user_roles").update({ role }).eq("user_id", created.user.id);
      }
      await admin.from("audit_logs").insert({
        user_id: caller.id,
        acao: "user.create",
        entidade: "auth.users",
        entidade_id: created.user.id,
        payload: { email, role, display_name },
      });
      return new Response(JSON.stringify({ id: created.user.id }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (action === "update_role") {
      const { user_id, role } = body as { user_id: string; role: AppRole };
      const { error } = await admin
        .from("user_roles")
        .upsert({ user_id, role }, { onConflict: "user_id" });
      if (error) throw error;
      await admin.from("audit_logs").insert({
        user_id: caller.id,
        acao: "user.role_change",
        entidade: "user_roles",
        entidade_id: user_id,
        payload: { role },
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const { user_id, password } = body as { user_id: string; password: string };
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;
      await admin.from("audit_logs").insert({
        user_id: caller.id,
        acao: "user.reset_password",
        entidade: "auth.users",
        entidade_id: user_id,
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = body as { user_id: string };
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "cannot delete self" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      await admin.from("audit_logs").insert({
        user_id: caller.id,
        acao: "user.delete",
        entidade: "auth.users",
        entidade_id: user_id,
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
