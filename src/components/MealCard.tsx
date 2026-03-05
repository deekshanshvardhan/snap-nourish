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

const MealCard = ({ meal }: { meal: Meal }) => {
  const time = new Date(meal.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-card rounded-2xl p-4 border border-border flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
        {meal.type === "photo" ? (
          <Camera className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Type className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm text-foreground truncate">{meal.description}</p>
        <p className="text-xs text-muted-foreground font-body">{time}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-display text-lg text-foreground">{meal.calories}</p>
        <p className="text-xs text-muted-foreground font-body">kcal</p>
      </div>
    </div>
  );
};

export default MealCard;
