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

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [meals, templates, profile, preferences] = await Promise.all([
    supabaseAdmin.from("meals").select("*").eq("user_id", user.id).is("deleted_at", null),
    supabaseAdmin.from("meal_templates").select("*").eq("user_id", user.id).is("deleted_at", null),
    supabaseAdmin.from("user_profiles").select("*").eq("user_id", user.id).single(),
    supabaseAdmin.from("user_preferences").select("*").eq("user_id", user.id).single(),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    email: user.email,
    meals: meals.data || [],
    meal_templates: templates.data || [],
    profile: profile.data || {},
    preferences: preferences.data || {},
  };

  const fileName = `exports/${user.id}/export-${new Date().toISOString().slice(0, 10)}.json`;
  const fileContent = new TextEncoder().encode(JSON.stringify(exportData, null, 2));

  await supabaseAdmin.storage
    .from("meal-photos-temp")
    .upload(fileName, fileContent, {
      contentType: "application/json",
      upsert: true,
    });

  const { data: signedUrl } = await supabaseAdmin.storage
    .from("meal-photos-temp")
    .createSignedUrl(fileName, 3600);

  return new Response(
    JSON.stringify({
      download_url: signedUrl?.signedUrl,
      expires_in: 3600,
    }),
    {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
});
