import { useMemo } from "react";
import { Zap, UtensilsCrossed } from "lucide-react";
import { motion } from "framer-motion";
import {
  getTimeSuggestedTemplates,
  getFrequentTemplates,
  getFrequentMealsFromHistory,
  getCurrentTimeSuggestionLabel,
  MealTemplate,
} from "@/lib/mealTemplates";
import { roundApprox } from "@/lib/mealUtils";

interface QuickLogProps {
  onLogTemplate: (template: MealTemplate) => void;
  onLogMeal: (description: string, calories: number, protein: number, carbs: number, fat: number) => void;
  refreshKey?: number;
}

const timingColors: Record<string, string> = {
  breakfast: "border-l-primary",
  lunch: "border-l-accent",
  dinner: "border-l-nutrition-protein",
  snack: "border-l-nutrition-fat",
};

const QuickLog = ({ onLogTemplate, onLogMeal, refreshKey }: QuickLogProps) => {
  const timeSuggested = useMemo(() => getTimeSuggestedTemplates(), [refreshKey]);
  const frequent = useMemo(() => getFrequentTemplates(), [refreshKey]);
  const historyMeals = useMemo(() => getFrequentMealsFromHistory(), [refreshKey]);

  const hasTemplates = timeSuggested.length > 0 || frequent.length > 0;
  const hasHistory = historyMeals.length > 0;

  if (!hasTemplates && !hasHistory) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <UtensilsCrossed className="w-4 h-4 text-primary/50" />
        </div>
        <p className="text-primary/40 text-xs font-body text-center">
          Your favorites will appear here
        </p>
      </div>
    );
  }

  const timeLabel = getCurrentTimeSuggestionLabel();

  const renderPill = (t: MealTemplate, onLog: () => void) => (
    <motion.button
      key={t.id}
      whileTap={{ scale: 0.95 }}
      onClick={onLog}
      className={`bg-primary/10 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 shrink-0 border-l-[3px] ${timingColors[t.mealTiming] || "border-l-primary"}`}
    >
      <Zap className="w-3.5 h-3.5 text-primary" />
      <div className="flex flex-col items-start">
        <span className="text-primary text-xs font-body font-medium truncate max-w-[120px]">
          {t.name}
        </span>
        <span className="text-primary/40 text-[10px] font-body">
          ~{roundApprox(t.calories)} kcal
        </span>
      </div>
    </motion.button>
  );

  return (
    <div className="space-y-3">
      {timeSuggested.length > 0 && (
        <div>
          <p className="text-primary/50 text-xs font-body mb-2">{timeLabel}</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {timeSuggested.map((t) => renderPill(t, () => onLogTemplate(t)))}
          </div>
        </div>
      )}

      {frequent.length > 0 && (
        <div>
          <p className="text-primary/50 text-xs font-body mb-2">Frequent Meals</p>
          <div className="flex gap-2 overflow-x-auto flex-wrap">
            {frequent
              .filter((f) => !timeSuggested.some((ts) => ts.id === f.id))
              .slice(0, 4)
              .map((t) => renderPill(t, () => onLogTemplate(t)))}
          </div>
        </div>
      )}

      {!hasTemplates && hasHistory && (
        <div>
          <p className="text-primary/50 text-xs font-body mb-2">Quick Log</p>
          <div className="flex gap-2 overflow-x-auto flex-wrap">
            {historyMeals.map(({ description, meal }) => (
              <motion.button
                key={description}
                whileTap={{ scale: 0.95 }}
                onClick={() => onLogMeal(description, meal.calories, meal.protein, meal.carbs, meal.fat)}
                className="bg-primary/10 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 shrink-0 border-l-[3px] border-l-primary/30"
              >
                <Zap className="w-3.5 h-3.5 text-primary/60" />
                <div className="flex flex-col items-start">
                  <span className="text-primary text-xs font-body font-medium truncate max-w-[120px]">
                    {description}
                  </span>
                  <span className="text-primary/40 text-[10px] font-body">
                    ~{roundApprox(meal.calories)} kcal
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickLog;
