import { useMemo } from "react";
import { motion } from "framer-motion";
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

const Insights = () => {
  const todayMeals = useMemo(() => {
    const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
    const today = new Date().toDateString();
    return meals.filter((m) => new Date(m.timestamp).toDateString() === today);
  }, []);

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
        className="px-6 mb-8"
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
              <MealCard key={meal.id} meal={meal} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Insights;
