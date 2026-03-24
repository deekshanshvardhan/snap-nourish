import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(SUPABASE_URL, token, {
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let body: { confirmation?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.confirmation !== "DELETE MY ACCOUNT") {
    return new Response(
      JSON.stringify({ error: "Invalid confirmation. Send { \"confirmation\": \"DELETE MY ACCOUNT\" }" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: tempFiles } = await supabaseAdmin.storage
      .from("meal-photos-temp")
      .list(`temp/${user.id}`);
    if (tempFiles && tempFiles.length > 0) {
      const paths = tempFiles.map((f) => `temp/${user.id}/${f.name}`);
      await supabaseAdmin.storage.from("meal-photos-temp").remove(paths);
    }

    const { data: permFiles } = await supabaseAdmin.storage
      .from("meal-photos-perm")
      .list(`perm/${user.id}`);
    if (permFiles && permFiles.length > 0) {
      const paths = permFiles.map((f) => `perm/${user.id}/${f.name}`);
      await supabaseAdmin.storage.from("meal-photos-perm").remove(paths);
    }
  } catch {
    // Storage cleanup is best-effort
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error("Delete user error:", deleteError);
    return new Response(
      JSON.stringify({ error: "Failed to delete account" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ message: "Account and all data deleted successfully" }),
    {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
});
