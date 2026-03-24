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

const VISION_SYSTEM_PROMPT = `You are a food nutrition analysis system. Given a photo of food, identify each distinct food item, estimate portion sizes, and note preparation methods.

Rules:
1. Identify every distinct food item visible in the image.
2. Estimate portion size using common units: cups, tablespoons, pieces, slices, oz, grams. For Indian foods, use: katori (150ml bowl), roti (1 piece ≈ 30g), cup rice (≈ 180g cooked).
3. Note the preparation method if visible: grilled, fried, steamed, raw, sautéed, baked, boiled, etc.
4. If you cannot identify a food item with at least moderate confidence, describe its appearance instead.
5. Account for visible oils, sauces, dressings, and condiments as separate items.
6. For mixed dishes (curries, stir-fries, casseroles), identify the dish name and estimate total volume.
7. Estimate conservatively — slightly under rather than over on portions.
8. Return ONLY valid JSON. No markdown, no code fences, no explanation.

Output JSON schema:
{
  "items": [
    {
      "name": "food item name (in English)",
      "quantity": "estimated amount with unit",
      "preparation": "cooking method or 'raw'"
    }
  ],
  "meal_description": "natural language summary of the full meal",
  "confidence": 0.85
}

Confidence: 0.9-1.0 = clear photo, 0.7-0.89 = some ambiguity, 0.5-0.69 = significant uncertainty, <0.5 = cannot identify.`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const startTime = Date.now();

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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid form data" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const imageFile = formData.get("image") as File;
  const mealLabel = formData.get("mealLabel") as string | null;

  if (!imageFile) {
    return new Response(
      JSON.stringify({ error: "No image provided" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  if (imageFile.size > 1_000_000) {
    return new Response(
      JSON.stringify({ error: "Image too large (max 1MB)" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const storagePath = `temp/${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("meal-photos-temp")
    .upload(storagePath, imageFile, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return new Response(
      JSON.stringify({ error: "Upload failed" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const { data: analysis } = await supabaseAdmin
    .from("photo_analyses")
    .insert({
      user_id: user.id,
      storage_path: storagePath,
      status: "processing",
    })
    .select()
    .single();

  const imageBytes = await imageFile.arrayBuffer();
  const base64Image = btoa(
    String.fromCharCode(...new Uint8Array(imageBytes))
  );

  let visionResult: any;
  let modelUsed = "gpt-4o-mini";

  try {
    const response = await fetch(
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
            { role: "system", content: VISION_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                    detail: "low",
                  },
                },
                {
                  type: "text",
                  text: "Identify the food items in this photo and estimate portions.",
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 500,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    visionResult = JSON.parse(data.choices[0].message.content);

    if (visionResult.confidence < 0.5) {
      modelUsed = "gpt-4o";
      const retryResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: VISION_SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${base64Image}`,
                      detail: "high",
                    },
                  },
                  {
                    type: "text",
                    text: "Identify the food items in this photo and estimate portions.",
                  },
                ],
              },
            ],
            response_format: { type: "json_object" },
            max_tokens: 500,
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(20000),
        }
      );

      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        visionResult = JSON.parse(retryData.choices[0].message.content);
      }
    }
  } catch (err) {
    console.error("Vision analysis error:", err);
    if (analysis) {
      await supabaseAdmin
        .from("photo_analyses")
        .update({ status: "failed" })
        .eq("id", analysis.id);
    }
    return new Response(
      JSON.stringify({ error: "Unable to analyze photo", fallback: "text" }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const nutritionItems = [];
  let totalCalories = 0,
    totalProtein = 0,
    totalCarbs = 0,
    totalFat = 0;

  for (const item of visionResult.items || []) {
    const nutrition = await lookupNutrition(supabaseAdmin, item);
    nutritionItems.push({ ...item, ...nutrition });
    totalCalories += nutrition.calories;
    totalProtein += nutrition.protein;
    totalCarbs += nutrition.carbs;
    totalFat += nutrition.fat;
  }

  const processingMs = Date.now() - startTime;
  if (analysis) {
    await supabaseAdmin
      .from("photo_analyses")
      .update({
        status: "completed",
        raw_response: visionResult,
        parsed_items: nutritionItems,
        confidence: visionResult.confidence,
        model_used: modelUsed,
        processing_ms: processingMs,
      })
      .eq("id", analysis.id);
  }

  const { data: signedUrl } = await supabaseAdmin.storage
    .from("meal-photos-temp")
    .createSignedUrl(storagePath, 86400);

  return new Response(
    JSON.stringify({
      description: visionResult.meal_description,
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein),
      carbs: Math.round(totalCarbs),
      fat: Math.round(totalFat),
      confidence: visionResult.confidence,
      items: nutritionItems,
      photo_analysis_id: analysis?.id,
      photoUrl: signedUrl?.signedUrl || null,
    }),
    {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
});
