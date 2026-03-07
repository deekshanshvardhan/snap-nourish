import { Camera, Type } from "lucide-react";

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

const RecentlyLogged = ({ meals }: { meals: Meal[] }) => {
  if (meals.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-body font-medium text-muted-foreground mb-3">Recently Logged</h3>
      <div className="space-y-2">
        {meals.slice(0, 5).map((meal) => {
          const time = new Date(meal.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div key={meal.id} className="bg-card rounded-2xl p-3 border border-border flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                {meal.type === "photo" ? (
                  <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <Type className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body text-foreground truncate">{meal.description}</p>
                <p className="text-[10px] text-muted-foreground font-body">
                  ~{Math.round(meal.calories / 10) * 10} kcal · {meal.protein}g protein · {meal.carbs}g carbs · {meal.fat}g fat
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground font-body shrink-0">{time}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentlyLogged;
