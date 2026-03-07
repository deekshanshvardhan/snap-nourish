import { Camera, Type, Pencil } from "lucide-react";
import { Meal, inferMealLabel, roundApprox } from "@/lib/mealUtils";

const MealCard = ({
  meal,
  label,
  onEdit,
}: {
  meal: Meal;
  label?: string;
  onEdit?: () => void;
}) => {
  const time = new Date(meal.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const mealType = meal.mealLabel || inferMealLabel(meal.timestamp);

  return (
    <div className="bg-card rounded-2xl p-4 border border-border flex items-center gap-4">
      {meal.photoUrl ? (
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
          <img src={meal.photoUrl} alt={meal.description} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
          {meal.type === "photo" ? (
            <Camera className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Type className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-body font-medium text-primary uppercase tracking-wide">{mealType}</p>
        <p className="font-body text-sm text-foreground truncate">{meal.description}</p>
        <p className="text-[10px] text-muted-foreground font-body">
          {label || "Meal Logged"} · Logged at {time}
        </p>
      </div>
      <div className="text-right shrink-0 flex items-center gap-3">
        <div>
          <p className="font-display text-lg text-foreground">~{roundApprox(meal.calories)}</p>
          <p className="text-xs text-muted-foreground font-body">kcal est.</p>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
};

export default MealCard;
