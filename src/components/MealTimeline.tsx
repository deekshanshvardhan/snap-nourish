import { Camera, Type, Zap, Plus, Pin, Pencil, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { getTemplates, MealTemplate } from "@/lib/mealTemplates";
import { Meal, inferMealLabel, roundApprox, updateMealInStorage } from "@/lib/mealUtils";
import { Input } from "@/components/ui/input";

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
  pinnedMeals?: Record<string, string[]>;
  onTogglePin?: (templateId: string, slotKey: string) => void;
  onMealUpdated?: () => void;
}

const SLOTS: Omit<MealSlot, "meals">[] = [
  { label: "Breakfast", key: "breakfast", hourRange: [5, 11] },
  { label: "Lunch", key: "lunch", hourRange: [11, 15] },
  { label: "Snacks", key: "snack", hourRange: [15, 17] },
  { label: "Dinner", key: "dinner", hourRange: [17, 24] },
];

const MEAL_LABELS = ["Breakfast", "Lunch", "Dinner", "Snack"];

const getSlotForMeal = (meal: Meal): string => {
  const hour = new Date(meal.timestamp).getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 17) return "snack";
  return "dinner";
};

const MealTimeline = ({ meals, onLogMeal, onQuickLog, pinnedMeals = {}, onTogglePin, onMealUpdated }: MealTimelineProps) => {
  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const templates = getTemplates();

  const slots: MealSlot[] = SLOTS.map((slot) => ({
    ...slot,
    meals: meals.filter((m) => getSlotForMeal(m) === slot.key),
  }));

  const startEdit = (meal: Meal) => {
    setEditingMealId(meal.id);
    setEditDesc(meal.description);
    setEditLabel(meal.mealLabel || inferMealLabel(meal.timestamp));
  };

  const saveEdit = (meal: Meal) => {
    const updated = { ...meal, description: editDesc.trim() || meal.description, mealLabel: editLabel };
    updateMealInStorage(updated);
    setEditingMealId(null);
    onMealUpdated?.();
  };

  const cancelEdit = () => setEditingMealId(null);

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
                    {slot.meals.length} meal{slot.meals.length !== 1 ? "s" : ""} · ~{roundApprox(slotTotal)} kcal
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
                  const label = meal.mealLabel || inferMealLabel(meal.timestamp);
                  const isEditing = editingMealId === meal.id;

                  if (isEditing) {
                    return (
                      <div key={meal.id} className="bg-secondary/50 rounded-xl p-3 space-y-2">
                        <div className="flex gap-1.5 flex-wrap">
                          {MEAL_LABELS.map((l) => (
                            <button
                              key={l}
                              onClick={() => setEditLabel(l)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-body transition-colors ${
                                editLabel === l
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                        <Input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="border-0 bg-card h-8 rounded-lg font-body text-xs"
                          placeholder="Meal description"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(meal)}
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={cancelEdit} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => saveEdit(meal)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                            <Check className="w-3.5 h-3.5 text-primary" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={meal.id} className="flex items-center gap-3 py-1.5">
                      {/* Thumbnail or icon */}
                      {meal.photoUrl ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                          <img src={meal.photoUrl} alt={meal.description} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          {meal.type === "photo" ? (
                            <Camera className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Type className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-body font-medium text-primary uppercase tracking-wide">{label}</p>
                        <p className="text-sm font-body text-foreground truncate">{meal.description}</p>
                        <p className="text-[10px] text-muted-foreground font-body">Logged at {time}</p>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <p className="text-sm font-display text-foreground">~{roundApprox(meal.calories)}</p>
                          <p className="text-[9px] text-muted-foreground font-body">kcal est.</p>
                        </div>
                        <button
                          onClick={() => startEdit(meal)}
                          className="p-1 rounded-lg hover:bg-secondary transition-colors"
                        >
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
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
