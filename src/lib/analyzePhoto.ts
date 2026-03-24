import { supabase, supabaseConfigured } from "./supabaseClient";
import { preprocessImage } from "./imagePreprocess";

export interface PhotoAnalysisResult {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  items: any[];
  photo_analysis_id?: string;
  photoUrl?: string;
}

const DEMO_MEALS = [
  { description: "Grilled chicken breast with steamed broccoli and rice", calories: 485, protein: 42, carbs: 48, fat: 12 },
  { description: "Caesar salad with croutons and parmesan", calories: 320, protein: 18, carbs: 22, fat: 19 },
  { description: "Salmon fillet with asparagus and quinoa", calories: 520, protein: 38, carbs: 35, fat: 22 },
  { description: "Turkey sandwich with avocado and mixed greens", calories: 440, protein: 28, carbs: 38, fat: 18 },
  { description: "Oatmeal with banana, blueberries, and honey", calories: 350, protein: 10, carbs: 62, fat: 7 },
  { description: "Steak with mashed potatoes and green beans", calories: 620, protein: 45, carbs: 42, fat: 28 },
  { description: "Pasta with marinara sauce and grilled vegetables", calories: 480, protein: 16, carbs: 72, fat: 14 },
  { description: "Yogurt parfait with granola and strawberries", calories: 290, protein: 14, carbs: 44, fat: 8 },
];

function generateDemoResult(): PhotoAnalysisResult {
  const meal = DEMO_MEALS[Math.floor(Math.random() * DEMO_MEALS.length)];
  return {
    ...meal,
    confidence: 0.85,
    items: [{ name: meal.description, quantity: 1 }],
  };
}

export async function analyzePhoto(
  imageSource: File | Blob,
  mealLabel?: string
): Promise<PhotoAnalysisResult> {
  const processedImage = await preprocessImage(imageSource);

  if (!supabaseConfigured) {
    await new Promise(r => setTimeout(r, 1200));
    const photoUrl = URL.createObjectURL(processedImage);
    return { ...generateDemoResult(), photoUrl };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated — sign in to use photo analysis.");
  }

  const formData = new FormData();
  formData.append("image", processedImage, "meal.jpg");
  if (mealLabel) {
    formData.append("mealLabel", mealLabel);
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(
    `${supabaseUrl}/functions/v1/analyze-photo`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Analysis failed (${response.status})`);
  }

  return response.json();
}
