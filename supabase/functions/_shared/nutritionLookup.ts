const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const USDA_API_KEY = Deno.env.get("USDA_API_KEY")!;
const NUTRITIONIX_APP_ID = Deno.env.get("NUTRITIONIX_APP_ID")!;
const NUTRITIONIX_APP_KEY = Deno.env.get("NUTRITIONIX_APP_KEY")!;

const SERVING_CONVERSIONS: Record<string, number> = {
  cup: 240, tablespoon: 15, tbsp: 15, teaspoon: 5, tsp: 5,
  slice: 30, piece: 100, oz: 28.35,
  "large egg": 50, "medium egg": 44,
  roti: 30, chapati: 30, naan: 90,
  katori: 150, bowl: 250,
  idli: 40, dosa: 80, vada: 50,
  paratha: 60, puri: 25,
};

export interface FoodItem {
  name: string;
  quantity: string;
  preparation: string;
}

export interface NutritionResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  estimated?: boolean;
}

export async function lookupNutrition(
  supabase: any,
  item: FoodItem
): Promise<NutritionResult> {
  const normalized = item.name.toLowerCase().trim().replace(/\s+/g, " ");

  // 1. Check local cache
  const { data: cached } = await supabase
    .from("nutrition_cache")
    .select("*")
    .eq("normalized_name", normalized)
    .limit(1)
    .single();

  if (cached) {
    return scaleToServing(cached, item.quantity);
  }

  // 2. Try USDA
  try {
    const usdaRes = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
        item.name
      )}&pageSize=1&dataType=Survey%20(FNDDS)&api_key=${USDA_API_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const usdaData = await usdaRes.json();
    if (usdaData.foods?.length > 0) {
      const food = usdaData.foods[0];
      const nutrients = extractUSDANutrients(food);
      await cacheNutrition(
        supabase, item.name, normalized, "usda", String(food.fdcId), nutrients
      );
      return scaleToServing(nutrients, item.quantity);
    }
  } catch {
    // fall through to next source
  }

  // 3. Try Nutritionix
  try {
    const nixRes = await fetch(
      "https://trackapi.nutritionix.com/v2/natural/nutrients",
      {
        method: "POST",
        headers: {
          "x-app-id": NUTRITIONIX_APP_ID,
          "x-app-key": NUTRITIONIX_APP_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: `${item.quantity} ${item.name}` }),
        signal: AbortSignal.timeout(5000),
      }
    );
    const nixData = await nixRes.json();
    if (nixData.foods?.length > 0) {
      const food = nixData.foods[0];
      const result: NutritionResult = {
        calories: food.nf_calories,
        protein: food.nf_protein,
        carbs: food.nf_total_carbohydrate,
        fat: food.nf_total_fat,
      };
      if (food.serving_weight_grams > 0) {
        await cacheNutrition(supabase, item.name, normalized, "nutritionix", null, {
          calories_per_100g: (food.nf_calories / food.serving_weight_grams) * 100,
          protein_per_100g: (food.nf_protein / food.serving_weight_grams) * 100,
          carbs_per_100g: (food.nf_total_carbohydrate / food.serving_weight_grams) * 100,
          fat_per_100g: (food.nf_total_fat / food.serving_weight_grams) * 100,
        });
      }
      return result;
    }
  } catch {
    // fall through to LLM
  }

  // 4. LLM estimation (last resort)
  try {
    const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Estimate the nutrition for: ${item.quantity} ${item.name} (${item.preparation}). Return JSON: {"calories": number, "protein": number, "carbs": number, "fat": number}. Numbers only, no explanation.`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 100,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const llmData = await llmRes.json();
    const result = JSON.parse(llmData.choices[0].message.content);
    result.estimated = true;
    return result;
  } catch {
    return { calories: 200, protein: 10, carbs: 25, fat: 8, estimated: true };
  }
}

function extractUSDANutrients(food: any) {
  const get = (name: string) =>
    food.foodNutrients?.find((n: any) => n.nutrientName === name)?.value || 0;
  return {
    calories_per_100g: get("Energy"),
    protein_per_100g: get("Protein"),
    carbs_per_100g: get("Carbohydrate, by difference"),
    fat_per_100g: get("Total lipid (fat)"),
  };
}

function scaleToServing(
  per100g: any,
  quantity: string
): NutritionResult {
  const grams = estimateGrams(quantity);
  const scale = grams / 100;
  return {
    calories: Math.round((per100g.calories_per_100g || 0) * scale),
    protein: Math.round((per100g.protein_per_100g || 0) * scale),
    carbs: Math.round((per100g.carbs_per_100g || 0) * scale),
    fat: Math.round((per100g.fat_per_100g || 0) * scale),
  };
}

function estimateGrams(quantity: string): number {
  const q = quantity.toLowerCase();
  const numMatch = q.match(/^([\d.]+(?:\/[\d.]+)?)/);
  let num = 1;
  if (numMatch) {
    const parts = numMatch[1].split("/");
    num = parts.length === 2
      ? parseFloat(parts[0]) / parseFloat(parts[1])
      : parseFloat(parts[0]);
  }

  if (q.includes("cup")) return num * 240;
  if (q.includes("tablespoon") || q.includes("tbsp")) return num * 15;
  if (q.includes("teaspoon") || q.includes("tsp")) return num * 5;
  if (q.includes("slice")) return num * 30;
  if (q.includes("piece") || q.includes("whole")) return num * 100;
  if (q.includes("katori") || q.includes("bowl")) return num * 150;
  if (q.includes("roti") || q.includes("chapati")) return num * 30;
  if (q.includes("naan")) return num * 90;
  if (q.includes("large") && q.includes("egg")) return num * 50;
  if (q.includes("medium") && q.includes("egg")) return num * 44;
  if (q.includes("oz")) return num * 28.35;
  if (q.includes("g") || q.includes("gram")) return num;

  return num * 100;
}

async function cacheNutrition(
  supabase: any,
  name: string,
  normalized: string,
  source: string,
  sourceId: string | null,
  data: any
) {
  await supabase
    .from("nutrition_cache")
    .upsert(
      {
        food_name: name,
        normalized_name: normalized,
        source,
        source_id: sourceId,
        calories_per_100g: data.calories_per_100g,
        protein_per_100g: data.protein_per_100g,
        carbs_per_100g: data.carbs_per_100g,
        fat_per_100g: data.fat_per_100g,
      },
      { onConflict: "normalized_name,source" }
    )
    .then(() => {});
}
