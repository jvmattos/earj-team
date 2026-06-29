import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: cors });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: profile, error: profileError } = await callerClient
      .from("profiles")
      .select("role")
      .single();

    if (profileError || profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso negado: apenas admins" }), { status: 403, headers: cors });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { action, user_id, password } = await req.json();

    if (!action || !user_id) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), { status: 400, headers: cors });
    }

    if (action === "delete") {
      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw error;
      await adminClient.from("profiles").delete().eq("id", user_id);
    } else if (action === "ban") {
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });
      if (error) throw error;
      await adminClient.from("profiles").update({ disabled: true }).eq("id", user_id);
    } else if (action === "unban") {
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "none" });
      if (error) throw error;
      await adminClient.from("profiles").update({ disabled: false }).eq("id", user_id);
    } else if (action === "set_password") {
      if (!password) {
        return new Response(JSON.stringify({ error: "Senha é obrigatória" }), { status: 400, headers: cors });
      }
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;
    } else {
      return new Response(JSON.stringify({ error: "Ação desconhecida" }), { status: 400, headers: cors });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
