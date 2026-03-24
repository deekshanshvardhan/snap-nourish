import { useState } from "react";
import { Camera, Type, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Meal, inferMealLabel, roundApprox } from "@/lib/mealUtils";
import { getMeals, saveMeals } from "@/lib/storage";

interface Props {
  meals: Meal[];
  onDelete?: (mealId: string) => void;
}

const RecentlyLogged = ({ meals, onDelete }: Props) => {
  const [swipedId, setSwipedId] = useState<string | null>(null);

  if (meals.length === 0) return null;

  const handleDelete = (mealId: string) => {
    if (onDelete) {
      onDelete(mealId);
    } else {
      const stored = getMeals();
      const filtered = stored.filter((m) => m.id !== mealId);
      saveMeals(filtered);
    }
    setSwipedId(null);
  };

  return (
    <div>
      <h3 className="text-sm font-body font-medium text-muted-foreground mb-3">Recently Logged</h3>
      <div className="space-y-2">
        <AnimatePresence>
          {meals.slice(0, 5).map((meal) => {
            const time = new Date(meal.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            const label = meal.mealLabel || inferMealLabel(meal.timestamp);

            return (
              <motion.div
                key={meal.id}
                layout
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25 }}
                className="relative overflow-hidden rounded-2xl"
              >
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-destructive flex items-center justify-center rounded-r-2xl">
                  <Trash2 className="w-4 h-4 text-destructive-foreground" />
                </div>

                <motion.div
                  drag="x"
                  dragConstraints={{ left: -80, right: 0 }}
                  dragElastic={0.15}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -60) {
                      handleDelete(meal.id);
                    }
                  }}
                  className="bg-card rounded-2xl p-3 border border-border flex items-center gap-3 relative cursor-grab active:cursor-grabbing"
                >
                  {meal.photoUrl ? (
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
                      <img src={meal.photoUrl} alt={meal.description} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      {meal.type === "photo" ? (
                        <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <Type className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-body font-medium text-primary uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-body text-foreground truncate">{meal.description}</p>
                    <p className="text-[10px] text-muted-foreground font-body">
                      ~{roundApprox(meal.calories)} kcal · {meal.protein}g P · {meal.carbs}g C · {meal.fat}g F
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-body shrink-0">{time}</p>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RecentlyLogged;
