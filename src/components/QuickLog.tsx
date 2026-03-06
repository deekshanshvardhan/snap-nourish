import { useMemo } from "react";
import { Zap } from "lucide-react";
import {
  getTimeSuggestedTemplates,
  getFrequentTemplates,
  getFrequentMealsFromHistory,
  getCurrentTimeSuggestionLabel,
  MealTemplate,
} from "@/lib/mealTemplates";

interface QuickLogProps {
  onLogTemplate: (template: MealTemplate) => void;
  onLogMeal: (description: string, calories: number, protein: number, carbs: number, fat: number) => void;
  refreshKey?: number;
}

const QuickLog = ({ onLogTemplate, onLogMeal, refreshKey }: QuickLogProps) => {
  const timeSuggested = useMemo(() => getTimeSuggestedTemplates(), [refreshKey]);
  const frequent = useMemo(() => getFrequentTemplates(), [refreshKey]);
  const historyMeals = useMemo(() => getFrequentMealsFromHistory(), [refreshKey]);

  const hasTemplates = timeSuggested.length > 0 || frequent.length > 0;
  const hasHistory = historyMeals.length > 0;

  if (!hasTemplates && !hasHistory) {
    return (
      <div>
        <p className="text-primary/50 text-xs font-body mb-2">Quick Log</p>
        <p className="text-primary/30 text-[11px] font-body">
          Meals you log frequently will appear here for quick logging.
        </p>
      </div>
    );
  }

  const timeLabel = getCurrentTimeSuggestionLabel();

  return (
    <div className="space-y-3">
      {/* Time-based suggestions */}
      {timeSuggested.length > 0 && (
        <div>
          <p className="text-primary/50 text-xs font-body mb-2">{timeLabel}</p>
          <div className="flex gap-2 overflow-x-auto">
            {timeSuggested.map((t) => (
              <button
                key={t.id}
                onClick={() => onLogTemplate(t)}
                className="bg-primary/10 rounded-xl px-3 py-2 flex items-center gap-2 shrink-0 active:scale-95 transition-transform"
              >
                <Zap className="w-3 h-3 text-primary" />
                <span className="text-primary text-xs font-body truncate max-w-[120px]">
                  {t.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Frequent meals */}
      {frequent.length > 0 && (
        <div>
          <p className="text-primary/50 text-xs font-body mb-2">Frequent Meals</p>
          <div className="flex gap-2 overflow-x-auto flex-wrap">
            {frequent
              .filter((f) => !timeSuggested.some((ts) => ts.id === f.id))
              .slice(0, 4)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => onLogTemplate(t)}
                  className="bg-primary/10 rounded-xl px-3 py-2 flex items-center gap-2 shrink-0 active:scale-95 transition-transform"
                >
                  <Zap className="w-3 h-3 text-primary/60" />
                  <span className="text-primary text-xs font-body truncate max-w-[120px]">
                    {t.name}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Fallback: frequent from history (before templates are created) */}
      {!hasTemplates && hasHistory && (
        <div>
          <p className="text-primary/50 text-xs font-body mb-2">Quick Log</p>
          <div className="flex gap-2 overflow-x-auto flex-wrap">
            {historyMeals.map(({ description, meal }) => (
              <button
                key={description}
                onClick={() => onLogMeal(description, meal.calories, meal.protein, meal.carbs, meal.fat)}
                className="bg-primary/10 rounded-xl px-3 py-2 flex items-center gap-2 shrink-0 active:scale-95 transition-transform"
              >
                <Zap className="w-3 h-3 text-primary/60" />
                <span className="text-primary text-xs font-body truncate max-w-[120px]">
                  {description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickLog;
