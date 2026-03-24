import { supabase } from './supabaseClient';
import { getMeals, getStoredTemplates, getProfile, getDismissedPrompts, getFlag, setFlag } from './storage';

function frontendMealToDb(meal: any, userId: string) {
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

function frontendProfileToDb(profile: Record<string, string>, userId: string) {
  return {
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
  };
}

export async function migrateLocalDataToServer() {
  const migrated = localStorage.getItem('migrationComplete');
  if (migrated === 'true') return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const meals = getMeals();
  if (meals.length > 0) {
    const dbMeals = meals.map(m => frontendMealToDb(m, user.id));
    await supabase.from('meals').upsert(dbMeals, {
      onConflict: 'user_id,client_id',
      ignoreDuplicates: true,
    });
  }

  const templates = getStoredTemplates();
  if (templates.length > 0) {
    const dbTemplates = templates.map(t => ({
      user_id: user.id,
      client_id: t.id,
      name: t.name,
      calories: t.calories,
      protein: t.protein,
      carbs: t.carbs,
      fat: t.fat,
      count: t.count,
      last_logged: t.lastLogged,
      meal_timing: t.mealTiming,
    }));
    await supabase.from('meal_templates').upsert(dbTemplates, {
      onConflict: 'user_id,client_id',
      ignoreDuplicates: true,
    });
  }

  const profile = getProfile();
  if (Object.keys(profile).length > 0) {
    await supabase.from('user_profiles').upsert(
      frontendProfileToDb(profile, user.id),
      { onConflict: 'user_id' }
    );
  }

  const prefs: Record<string, unknown> = { user_id: user.id };
  const theme = getFlag('theme');
  if (theme) prefs.theme = theme;
  if (getFlag('personalizationCompleted') === 'true') prefs.personalization_completed = true;
  if (getFlag('personalizationDismissed') === 'true') prefs.personalization_dismissed = true;
  const dismissed = getDismissedPrompts();
  if (dismissed.length > 0) prefs.template_prompts_dismissed = dismissed;
  await supabase.from('user_preferences').upsert(prefs, { onConflict: 'user_id' });

  localStorage.setItem('migrationComplete', 'true');
}
