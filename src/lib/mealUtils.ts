export interface Meal {
  id: number;
  type: string;
  timestamp: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  photoUrl?: string;
  mealLabel?: string; // user-editable: Breakfast, Lunch, Dinner, Snack
}

export const inferMealLabel = (timestamp: string): string => {
  const hour = new Date(timestamp).getHours();
  if (hour >= 5 && hour < 11) return "Breakfast";
  if (hour >= 11 && hour < 16) return "Lunch";
  if (hour >= 16 && hour < 22) return "Dinner";
  return "Snack";
};

/** Simulated AI food descriptions for photo captures */
const SIMULATED_DESCRIPTIONS = [
  "Scrambled eggs with toast",
  "Grilled chicken with rice",
  "Paneer curry with roti",
  "Mixed vegetable stir fry",
  "Oatmeal with fresh fruits",
  "Caesar salad with croutons",
  "Pasta with tomato sauce",
  "Dal tadka with steamed rice",
  "Avocado toast with egg",
  "Chicken tikka with naan",
  "Greek yogurt with granola",
  "Stir fried noodles with vegetables",
  "Grilled fish with salad",
  "Mushroom risotto with herbs",
  "Smoothie bowl with berries",
];

export const getSimulatedDescription = (): string => {
  return SIMULATED_DESCRIPTIONS[Math.floor(Math.random() * SIMULATED_DESCRIPTIONS.length)];
};

export const roundApprox = (n: number, step = 10) => Math.round(n / step) * step;

/** Update a meal in localStorage */
export const updateMealInStorage = (updatedMeal: Meal) => {
  const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
  const idx = meals.findIndex((m) => m.id === updatedMeal.id);
  if (idx !== -1) {
    meals[idx] = updatedMeal;
    localStorage.setItem("meals", JSON.stringify(meals));
  }
};
