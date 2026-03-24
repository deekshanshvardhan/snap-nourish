import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lookupNutrition } from "../_shared/nutritionLookup.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEXT_PARSE_SYSTEM_PROMPT = `You are a food parsing system. Given a user's meal description (which may be informal, use shorthand, or mix languages), extract individual food items with quantities.

Rules:
1. Split compound descriptions into individual items.
2. If no quantity is specified, assume one standard serving.
3. Infer reasonable defaults: "coffee" = 1 cup black coffee; "toast" = 1 slice white bread.
4. Handle shorthand: "2 eggs + toast" = 2 eggs AND 1 slice toast.
5. Handle Indian food descriptions: "dal chawal" = dal (1 katori) + rice (1 cup).
6. Handle Hindi/Hinglish: "2 roti aur sabzi" = 2 roti + 1 katori vegetable sabzi.
7. Separate condiments and additions: "toast with butter" = 1 slice toast + 1 pat butter.
8. Return ONLY valid JSON. No markdown, no explanation.

Output JSON schema:
{
  "items": [
    { "name": "food item in English", "quantity": "amount with unit", "preparation": "cooking method or 'as described'" }
  ],
  "normalized_description": "clean, complete description of the meal in English"
}`;

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

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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

  let body: { description?: string; mealLabel?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const { description, mealLabel } = body;

  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "Description is required" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
  if (description.length > 500) {
    return new Response(
      JSON.stringify({ error: "Description too long (max 500 chars)" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let parsed: any;
  try {
    const parseResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: TEXT_PARSE_SYSTEM_PROMPT },
            {
              role: "user",
              content: `Parse this meal description into individual food items: "${description.trim()}"`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 400,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!parseResponse.ok) {
      throw new Error(`OpenAI API error: ${parseResponse.status}`);
    }

    const parseData = await parseResponse.json();
    parsed = JSON.parse(parseData.choices[0].message.content);
  } catch (err) {
    console.error("Text parsing error:", err);
    return new Response(
      JSON.stringify({ error: "Unable to parse meal description" }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let totalCalories = 0,
    totalProtein = 0,
    totalCarbs = 0,
    totalFat = 0;
  const nutritionItems = [];

  for (const item of parsed.items || []) {
    const nutrition = await lookupNutrition(supabaseAdmin, item);
    nutritionItems.push({ ...item, ...nutrition });
    totalCalories += nutrition.calories;
    totalProtein += nutrition.protein;
    totalCarbs += nutrition.carbs;
    totalFat += nutrition.fat;
  }

  return new Response(
    JSON.stringify({
      description: parsed.normalized_description || description.trim(),
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein),
      carbs: Math.round(totalCarbs),
      fat: Math.round(totalFat),
      confidence: 0.85,
      items: nutritionItems,
    }),
    {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
});
