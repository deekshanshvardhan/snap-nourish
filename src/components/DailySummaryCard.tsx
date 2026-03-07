import { motion } from "framer-motion";
import NutritionRing from "./NutritionRing";

interface DailySummaryProps {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  calorieGoal?: number;
  proteinGoal?: number;
  carbGoal?: number;
  fatGoal?: number;
}

const MiniRing = ({ value, max, label, color }: { value: number; max: number; label: string; color: string }) => {
  const progress = Math.min(value / max, 1);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 50 50" className="w-full h-full -rotate-90">
          <circle cx="25" cy="25" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          <circle
            cx="25" cy="25" r={radius} fill="none"
            stroke={color}
            strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-body font-medium text-foreground">~{value}</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground font-body">{label}</span>
    </div>
  );
};

const DailySummaryCard = ({
  calories, protein, carbs, fat,
  calorieGoal = 2000, proteinGoal = 120, carbGoal = 250, fatGoal = 70,
}: DailySummaryProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.1 }}
    className="bg-card rounded-3xl p-6 border border-border shadow-sm"
  >
    <div className="flex items-center gap-6">
      <NutritionRing value={calories} max={calorieGoal} />
      <div className="flex-1">
        <p className="text-3xl font-display text-foreground">~{Math.round(calories / 10) * 10}</p>
        <p className="text-muted-foreground font-body text-sm">of ~{calorieGoal} kcal</p>
      </div>
    </div>
    <div className="flex justify-around mt-5 pt-4 border-t border-border">
      <MiniRing value={protein} max={proteinGoal} label="Protein" color="hsl(var(--nutrition-protein))" />
      <MiniRing value={carbs} max={carbGoal} label="Carbs" color="hsl(var(--nutrition-carbs))" />
      <MiniRing value={fat} max={fatGoal} label="Fat" color="hsl(var(--nutrition-fat))" />
    </div>
  </motion.div>
);

export default DailySummaryCard;
