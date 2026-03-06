export interface MealTemplate {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number; // times logged
  lastLogged: string;
  mealTiming: "breakfast" | "lunch" | "dinner" | "snack";
}

interface Meal {
  id: number;
  type: string;
  timestamp: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const TEMPLATES_KEY = "mealTemplates";
const TEMPLATE_PROMPT_KEY = "templatePromptsDismissed";

export const getTemplates = (): MealTemplate[] =>
  JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]");

export const saveTemplate = (template: MealTemplate) => {
  const templates = getTemplates();
  const existing = templates.findIndex((t) => t.id === template.id);
  if (existing !== -1) {
    templates[existing] = template;
  } else {
    templates.push(template);
  }
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
};

export const removeTemplate = (id: string) => {
  const templates = getTemplates().filter((t) => t.id !== id);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
};

const getTimingFromHour = (hour: number): MealTemplate["mealTiming"] => {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 17) return "snack";
  return "dinner";
};

const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

/**
 * Check if any meal description has been logged 3+ times and hasn't been
 * prompted yet. Returns the first candidate found.
 */
export const detectTemplateCandidates = (): Meal | null => {
  const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
  const templates = getTemplates();
  const dismissed: string[] = JSON.parse(localStorage.getItem(TEMPLATE_PROMPT_KEY) || "[]");

  const counts: Record<string, { count: number; meal: Meal }> = {};
  for (const m of meals) {
    if (m.description === "Photo meal") continue;
    const key = normalize(m.description);
    if (!counts[key]) counts[key] = { count: 0, meal: m };
    counts[key].count++;
  }

  for (const [key, { count, meal }] of Object.entries(counts)) {
    if (count >= 3) {
      const alreadySaved = templates.some((t) => normalize(t.name) === key);
      const alreadyDismissed = dismissed.includes(key);
      if (!alreadySaved && !alreadyDismissed) return meal;
    }
  }
  return null;
};

export const dismissTemplatePrompt = (description: string) => {
  const dismissed: string[] = JSON.parse(localStorage.getItem(TEMPLATE_PROMPT_KEY) || "[]");
  dismissed.push(normalize(description));
  localStorage.setItem(TEMPLATE_PROMPT_KEY, JSON.stringify(dismissed));
};

export const createTemplateFromMeal = (meal: Meal, name: string): MealTemplate => {
  const hour = new Date(meal.timestamp).getHours();
  return {
    id: `tpl_${Date.now()}`,
    name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    count: 1,
    lastLogged: new Date().toISOString(),
    mealTiming: getTimingFromHour(hour),
  };
};

export const getCurrentTimeSuggestionLabel = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "Suggested for Breakfast";
  if (hour >= 11 && hour < 15) return "Suggested for Lunch";
  if (hour >= 15 && hour < 17) return "Suggested for Snack";
  return "Suggested for Dinner";
};

export const getTimeSuggestedTemplates = (): MealTemplate[] => {
  const templates = getTemplates();
  const hour = new Date().getHours();
  const timing = getTimingFromHour(hour);
  return templates.filter((t) => t.mealTiming === timing).sort((a, b) => b.count - a.count);
};

export const getFrequentTemplates = (): MealTemplate[] => {
  return getTemplates().sort((a, b) => b.count - a.count).slice(0, 6);
};

/** Build quick-log items from raw meals when no templates exist yet */
export const getFrequentMealsFromHistory = (): { description: string; meal: Meal }[] => {
  const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
  const counts: Record<string, { count: number; meal: Meal }> = {};
  for (const m of meals) {
    if (m.description === "Photo meal") continue;
    const key = normalize(m.description);
    if (!counts[key]) counts[key] = { count: 0, meal: m };
    counts[key].count++;
  }
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(({ meal }) => ({ description: meal.description, meal }));
};
