import { Meal } from "@/lib/mealUtils";
import { MealTemplate } from "@/lib/mealTemplates";
import { syncEngine } from "@/lib/syncEngine";

const STORAGE_KEYS = {
  meals: "meals",
  templates: "mealTemplates",
  templatesDismissed: "templatePromptsDismissed",
  profile: "nutrition-profile",
  authUser: "auth-user",
  authProvider: "auth-provider",
  pinnedMeals: "pinnedMeals",
  onboarded: "onboarded",
  personalizationCompleted: "personalization-completed",
  personalizationDismissed: "personalization-dismissed",
  showFirstHint: "show-first-hint",
  theme: "theme",
  photoOptIn: "photo-storage-opt-in",
} as const;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function getCurrentUserId(): string | null {
  try {
    const authUser = readJSON<Record<string, unknown>>(STORAGE_KEYS.authUser, {});
    return (authUser.id as string) || null;
  } catch {
    return null;
  }
}

function frontendMealToDb(meal: Meal, userId: string) {
  return {
    user_id: userId,
    client_id: meal.id,
    type: meal.type,
    timestamp: meal.timestamp,
    description: meal.description,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    photo_url: meal.photoUrl || null,
    meal_label: meal.mealLabel || null,
  };
}

function frontendTemplateToDb(template: MealTemplate, userId: string) {
  return {
    user_id: userId,
    client_id: template.id,
    name: template.name,
    calories: template.calories,
    protein: template.protein,
    carbs: template.carbs,
    fat: template.fat,
    count: template.count,
    last_logged: template.lastLogged,
    meal_timing: template.mealTiming,
  };
}

// --- Reads: synchronous from localStorage (unchanged) ---

export function getMeals(): Meal[] {
  return readJSON<Meal[]>(STORAGE_KEYS.meals, []);
}

export function getStoredTemplates(): MealTemplate[] {
  return readJSON<MealTemplate[]>(STORAGE_KEYS.templates, []);
}

export function getDismissedPrompts(): string[] {
  return readJSON<string[]>(STORAGE_KEYS.templatesDismissed, []);
}

export function getProfile(): Record<string, string> {
  return readJSON<Record<string, string>>(STORAGE_KEYS.profile, {});
}

export function getAuthUser(): Record<string, unknown> {
  return readJSON<Record<string, unknown>>(STORAGE_KEYS.authUser, {});
}

export function getPinnedMeals(): Record<string, string[]> {
  return readJSON<Record<string, string[]>>(STORAGE_KEYS.pinnedMeals, {});
}

export function getFlag(key: keyof typeof STORAGE_KEYS): string | null {
  return localStorage.getItem(STORAGE_KEYS[key]);
}

// --- Local-only writes (used by sync engine to apply server changes) ---

export function saveMealsLocal(meals: Meal[]): void {
  writeJSON(STORAGE_KEYS.meals, meals);
}

export function saveStoredTemplatesLocal(templates: MealTemplate[]): void {
  writeJSON(STORAGE_KEYS.templates, templates);
}

// --- Writes: localStorage + sync queue ---

export function saveMeals(meals: Meal[]): void {
  const previous = readJSON<Meal[]>(STORAGE_KEYS.meals, []);
  writeJSON(STORAGE_KEYS.meals, meals);

  const userId = getCurrentUserId();
  if (!userId) return;

  const previousIds = new Set(previous.map(m => m.id));
  const currentIds = new Set(meals.map(m => m.id));

  for (const meal of meals) {
    if (!previousIds.has(meal.id)) {
      syncEngine.enqueue({
        table: 'meals',
        action: 'INSERT',
        payload: frontendMealToDb(meal, userId),
      });
    }
  }

  for (const prev of previous) {
    if (!currentIds.has(prev.id)) {
      syncEngine.enqueue({
        table: 'meals',
        action: 'DELETE',
        payload: { id: prev.id },
      });
    }
  }

  for (const meal of meals) {
    if (previousIds.has(meal.id)) {
      const old = previous.find(m => m.id === meal.id);
      if (old && JSON.stringify(old) !== JSON.stringify(meal)) {
        syncEngine.enqueue({
          table: 'meals',
          action: 'UPDATE',
          payload: { id: meal.id, ...frontendMealToDb(meal, userId) },
        });
      }
    }
  }
}

export function saveStoredTemplates(templates: MealTemplate[]): void {
  const previous = readJSON<MealTemplate[]>(STORAGE_KEYS.templates, []);
  writeJSON(STORAGE_KEYS.templates, templates);

  const userId = getCurrentUserId();
  if (!userId) return;

  const previousIds = new Set(previous.map(t => t.id));
  const currentIds = new Set(templates.map(t => t.id));

  for (const template of templates) {
    if (!previousIds.has(template.id)) {
      syncEngine.enqueue({
        table: 'meal_templates',
        action: 'INSERT',
        payload: frontendTemplateToDb(template, userId),
      });
    }
  }

  for (const prev of previous) {
    if (!currentIds.has(prev.id)) {
      syncEngine.enqueue({
        table: 'meal_templates',
        action: 'DELETE',
        payload: { id: prev.id },
      });
    }
  }

  for (const template of templates) {
    if (previousIds.has(template.id)) {
      const old = previous.find(t => t.id === template.id);
      if (old && JSON.stringify(old) !== JSON.stringify(template)) {
        syncEngine.enqueue({
          table: 'meal_templates',
          action: 'UPDATE',
          payload: { id: template.id, ...frontendTemplateToDb(template, userId) },
        });
      }
    }
  }
}

export function saveDismissedPrompts(dismissed: string[]): void {
  writeJSON(STORAGE_KEYS.templatesDismissed, dismissed);
}

export function saveProfile(profile: Record<string, string>): void {
  writeJSON(STORAGE_KEYS.profile, profile);
  localStorage.setItem(STORAGE_KEYS.personalizationCompleted, "true");

  const userId = getCurrentUserId();
  if (!userId) return;

  syncEngine.enqueue({
    table: 'user_profiles',
    action: 'UPDATE',
    payload: {
      id: userId,
      user_id: userId,
      name: profile.name || null,
      height: profile.height || null,
      weight: profile.weight || null,
      age: profile.age || null,
      goal: profile.goal || null,
      calorie_goal: profile.calorieGoal || '2000',
      protein_goal: profile.proteinGoal || '120',
      carb_goal: profile.carbGoal || '250',
      fat_goal: profile.fatGoal || '70',
    },
  });
}

export function saveAuthUser(user: Record<string, unknown>): void {
  writeJSON(STORAGE_KEYS.authUser, user);
}

export function savePinnedMeals(pinned: Record<string, string[]>): void {
  writeJSON(STORAGE_KEYS.pinnedMeals, pinned);
}

export function setFlag(key: keyof typeof STORAGE_KEYS, value: string): void {
  localStorage.setItem(STORAGE_KEYS[key], value);
}

export function removeFlag(key: keyof typeof STORAGE_KEYS): void {
  localStorage.removeItem(STORAGE_KEYS[key]);
}
