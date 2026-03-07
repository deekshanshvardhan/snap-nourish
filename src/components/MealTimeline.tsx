import { Camera, Type, Zap, Plus, Pin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { getTemplates, MealTemplate } from "@/lib/mealTemplates";

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

interface MealSlot {
  label: string;
  key: string;
  hourRange: [number, number];
  meals: Meal[];
}

interface MealTimelineProps {
  meals: Meal[];
  onLogMeal: (slotKey: string) => void;
  onQuickLog: (template: MealTemplate, slotKey: string) => void;
  pinnedMeals?: Record<string, string[]>; // slotKey -> template ids
  onTogglePin?: (templateId: string, slotKey: string) => void;
}

const SLOTS: Omit<MealSlot, "meals">[] = [
  { label: "Breakfast", key: "breakfast", hourRange: [5, 11] },
  { label: "Lunch", key: "lunch", hourRange: [11, 15] },
  { label: "Snacks", key: "snack", hourRange: [15, 17] },
  { label: "Dinner", key: "dinner", hourRange: [17, 24] },
];

const getSlotForMeal = (meal: Meal): string => {
  const hour = new Date(meal.timestamp).getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 17) return "snack";
  return "dinner";
};

const MealTimeline = ({ meals, onLogMeal, onQuickLog, pinnedMeals = {}, onTogglePin }: MealTimelineProps) => {
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const templates = getTemplates();

  const slots: MealSlot[] = SLOTS.map((slot) => ({
    ...slot,
    meals: meals.filter((m) => getSlotForMeal(m) === slot.key),
  }));

  return (
    <div className="space-y-3">
      {slots.map((slot, i) => {
        const slotTotal = slot.meals.reduce((a, m) => a + m.calories, 0);
        const pinned = (pinnedMeals[slot.key] || [])
          .map((id) => templates.find((t) => t.id === id))
          .filter(Boolean) as MealTemplate[];

        return (
          <motion.div
            key={slot.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-2xl border border-border overflow-hidden"
          >
            {/* Slot header */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-body text-sm font-medium text-foreground">{slot.label}</p>
                {slot.meals.length > 0 && (
                  <p className="text-xs text-muted-foreground font-body">
                    {slot.meals.length} meal{slot.meals.length !== 1 ? "s" : ""} · ~{Math.round(slotTotal / 10) * 10} kcal
                  </p>
                )}
              </div>
              <button
                onClick={() => onLogMeal(slot.key)}
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <Plus className="w-4 h-4 text-primary" />
              </button>
            </div>

            {/* Logged meals */}
            {slot.meals.length > 0 && (
              <div className="px-4 pb-2 space-y-2">
                {slot.meals.map((meal) => {
                  const time = new Date(meal.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div key={meal.id} className="flex items-center gap-3 py-1.5">
                      <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        {meal.type === "photo" ? (
                          <Camera className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <Type className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body text-foreground truncate">{meal.description}</p>
                        <p className="text-[10px] text-muted-foreground font-body">{time}</p>
                      </div>
                      <p className="text-sm font-display text-foreground shrink-0">~{Math.round(meal.calories / 10) * 10}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pinned meals */}
            {pinned.length > 0 && (
              <div className="px-4 pb-3">
                <div className="flex items-center gap-1 mb-1.5">
                  <Pin className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-body">Pinned</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {pinned.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onQuickLog(t, slot.key)}
                      className="bg-secondary rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <Zap className="w-2.5 h-2.5 text-primary" />
                      <span className="text-xs font-body text-foreground truncate max-w-[100px]">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {slot.meals.length === 0 && pinned.length === 0 && (
              <div className="px-4 pb-3">
                <button
                  onClick={() => onLogMeal(slot.key)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs text-muted-foreground font-body hover:bg-secondary/50 transition-colors"
                >
                  Log Meal
                </button>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default MealTimeline;
