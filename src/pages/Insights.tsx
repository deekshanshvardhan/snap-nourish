import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import NutritionRing from "@/components/NutritionRing";
import MealCard from "@/components/MealCard";

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

const getMealLabel = (meal: Meal): string => {
  const hour = new Date(meal.timestamp).getHours();
  if (hour >= 5 && hour < 11) return "Breakfast";
  if (hour >= 11 && hour < 15) return "Lunch";
  if (hour >= 15 && hour < 17) return "Snack";
  if (hour >= 17 && hour < 22) return "Dinner";
  return "Meal Logged";
};

const Insights = () => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [mealsVersion, setMealsVersion] = useState(0);

  const todayMeals = useMemo(() => {
    const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
    const today = new Date().toDateString();
    return meals.filter((m) => new Date(m.timestamp).toDateString() === today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealsVersion]);

  const totals = useMemo(() => {
    return todayMeals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [todayMeals]);

  const goal = 2000;
  const proteinGoal = 120;
  const carbGoal = 250;

  const interpretation = useMemo(() => {
    if (todayMeals.length === 0) return null;
    if (totals.calories > goal) return "You've exceeded your calorie target today.";
    if (totals.protein < proteinGoal * 0.5 && todayMeals.length >= 2)
      return "Your protein intake is low today.";
    if (totals.carbs > carbGoal) return "Your carb intake is higher than usual.";
    if (totals.calories >= goal * 0.7 && totals.calories <= goal)
      return "You are within your calorie target today.";
    if (totals.calories < goal * 0.4 && todayMeals.length >= 1)
      return "You're well under your calorie goal — keep logging.";
    return "Keep logging to see your full daily picture.";
  }, [totals, todayMeals.length]);

  const startEdit = (meal: Meal) => {
    setEditingId(meal.id);
    setEditText(meal.description);
  };

  const saveEdit = () => {
    if (editingId === null) return;
    const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
    const idx = meals.findIndex((m) => m.id === editingId);
    if (idx !== -1 && editText.trim()) {
      meals[idx].description = editText.trim();
      localStorage.setItem("meals", JSON.stringify(meals));
      setMealsVersion((v) => v + 1);
    }
    setEditingId(null);
    setEditText("");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto pb-24">
      <div className="px-6 pt-12 pb-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground font-body text-sm mb-1">Today</p>
          <h1 className="text-3xl text-foreground">Daily Insights</h1>
        </motion.div>
      </div>

      {/* Calorie ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="px-6 mb-4"
      >
        <div className="bg-card rounded-3xl p-8 flex items-center gap-8 shadow-sm border border-border">
          <NutritionRing value={totals.calories} max={goal} />
          <div>
            <p className="text-4xl font-display text-foreground">{totals.calories}</p>
            <p className="text-muted-foreground font-body text-sm">of {goal} kcal</p>
            <p className="text-xs text-muted-foreground mt-1 font-body">
              {todayMeals.length} meal{todayMeals.length !== 1 ? "s" : ""} logged
            </p>
          </div>
        </div>
      </motion.div>

      {/* Interpretation */}
      {interpretation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="px-6 mb-6"
        >
          <p className="text-sm text-muted-foreground font-body italic px-1">
            💡 {interpretation}
          </p>
        </motion.div>
      )}

      {/* Macros */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="px-6 mb-8"
      >
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Protein", value: totals.protein, unit: "g", color: "bg-nutrition-protein" },
            { label: "Carbs", value: totals.carbs, unit: "g", color: "bg-nutrition-carbs" },
            { label: "Fat", value: totals.fat, unit: "g", color: "bg-nutrition-fat" },
          ].map((macro) => (
            <div key={macro.label} className="bg-card rounded-2xl p-4 border border-border">
              <div className={`w-2 h-2 rounded-full ${macro.color} mb-3`} />
              <p className="text-2xl font-display text-foreground">
                {macro.value}
                <span className="text-sm text-muted-foreground font-body">{macro.unit}</span>
              </p>
              <p className="text-xs text-muted-foreground font-body">{macro.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Today's meals */}
      <div className="px-6">
        <h2 className="text-xl font-display text-foreground mb-4">Today's Meals</h2>
        {todayMeals.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center border border-border">
            <p className="text-muted-foreground font-body">No meals logged yet today.</p>
            <p className="text-sm text-muted-foreground font-body mt-1">
              Head to the camera to log your first meal.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayMeals.map((meal) => (
              <div key={meal.id}>
                <MealCard
                  meal={meal}
                  label={getMealLabel(meal)}
                  onEdit={() => startEdit(meal)}
                />
                <AnimatePresence>
                  {editingId === meal.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-card rounded-b-2xl px-4 pb-3 -mt-1 border border-t-0 border-border flex gap-2">
                        <input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm font-body text-foreground outline-none"
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          className="text-xs font-body font-medium text-primary px-3"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs font-body text-muted-foreground px-2"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Insights;
