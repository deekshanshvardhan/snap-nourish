import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { Meal } from "@/lib/mealUtils";
import { getMeals, saveMeals } from "@/lib/storage";

const RecentMeals = () => {
  const recent = useMemo(() => {
    const meals = getMeals();
    return meals.slice(-3).reverse();
  }, []);

  if (recent.length === 0) return null;

  const repeatMeal = (meal: Meal) => {
    const meals = getMeals();
    meals.push({ ...meal, id: crypto.randomUUID(), timestamp: new Date().toISOString() });
    saveMeals(meals);
  };

  return (
    <div>
      <p className="text-primary/50 text-xs font-body mb-2">Repeat a meal</p>
      <div className="flex gap-2 overflow-x-auto">
        {recent.map((meal) => (
          <button
            key={meal.id}
            onClick={() => repeatMeal(meal)}
            className="bg-primary/10 rounded-xl px-3 py-2 flex items-center gap-2 shrink-0"
          >
            <RotateCcw className="w-3 h-3 text-primary" />
            <span className="text-primary text-xs font-body truncate max-w-[100px]">
              {meal.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RecentMeals;
