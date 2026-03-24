import { supabase, supabaseConfigured } from "./supabaseClient";

export interface TextAnalysisResult {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  items: any[];
}

const CALORIE_KEYWORDS: Record<string, { cal: number; p: number; c: number; f: number }> = {
  egg: { cal: 78, p: 6, c: 1, f: 5 },
  toast: { cal: 120, p: 4, c: 22, f: 2 },
  rice: { cal: 200, p: 4, c: 44, f: 0 },
  chicken: { cal: 230, p: 35, c: 0, f: 9 },
  salad: { cal: 150, p: 5, c: 12, f: 10 },
  coffee: { cal: 5, p: 0, c: 1, f: 0 },
  milk: { cal: 100, p: 8, c: 12, f: 3 },
  banana: { cal: 105, p: 1, c: 27, f: 0 },
  sandwich: { cal: 350, p: 18, c: 38, f: 14 },
  pasta: { cal: 380, p: 14, c: 62, f: 8 },
  steak: { cal: 400, p: 42, c: 0, f: 24 },
  fish: { cal: 250, p: 30, c: 0, f: 14 },
  yogurt: { cal: 150, p: 12, c: 18, f: 4 },
  oatmeal: { cal: 160, p: 6, c: 28, f: 3 },
  apple: { cal: 95, p: 0, c: 25, f: 0 },
  pizza: { cal: 280, p: 12, c: 34, f: 10 },
  burger: { cal: 540, p: 30, c: 40, f: 28 },
};

function estimateFromText(description: string): TextAnalysisResult {
  const lower = description.toLowerCase();
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  let matched = false;

  for (const [keyword, macros] of Object.entries(CALORIE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      calories += macros.cal;
      protein += macros.p;
      carbs += macros.c;
      fat += macros.f;
      matched = true;
    }
  }

  if (!matched) {
    calories = 300 + Math.floor(Math.random() * 200);
    protein = 15 + Math.floor(Math.random() * 20);
    carbs = 30 + Math.floor(Math.random() * 30);
    fat = 8 + Math.floor(Math.random() * 15);
  }

  return {
    description,
    calories,
    protein,
    carbs,
    fat,
    confidence: matched ? 0.6 : 0.3,
    items: [{ name: description, quantity: 1 }],
  };
}

export async function analyzeText(
  description: string,
  mealLabel?: string
): Promise<TextAnalysisResult> {
  if (!supabaseConfigured) {
    await new Promise(r => setTimeout(r, 800));
    return estimateFromText(description);
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated — sign in to use text analysis.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(
    `${supabaseUrl}/functions/v1/analyze-text`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description, mealLabel }),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Analysis failed (${response.status})`);
  }

  return response.json();
}
