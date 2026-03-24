import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import NutritionRing from "./NutritionRing";
import AnimatedNumber from "./AnimatedNumber";

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
    <div
      className="flex flex-col items-center gap-1"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      aria-label={`${label}: ${value}g of ${max}g`}
    >
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
          <AnimatedNumber value={value} className="text-xs font-body font-semibold text-foreground" suffix="g" />
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground font-body">{label}</span>
    </div>
  );
};

const DailySummaryCard = ({
  calories, protein, carbs, fat,
  calorieGoal = 2000, proteinGoal = 120, carbGoal = 250, fatGoal = 70,
}: DailySummaryProps) => {
  const celebrated = useRef(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (calories >= calorieGoal && calories > 0 && !celebrated.current) {
      celebrated.current = true;
      setShowConfetti(true);
      toast("Goal reached!", { description: "You've hit your daily calorie target" });
      setTimeout(() => setShowConfetti(false), 1500);
    }
  }, [calories, calorieGoal]);

  const confettiParticles = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      x: (Math.random() - 0.5) * 160,
      y: -(Math.random() * 100 + 40),
      size: 5 + Math.random() * 5,
      colorIdx: i % 4,
      duration: 0.8 + Math.random() * 0.6,
    }))
  ).current;

  const confettiColors = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(var(--nutrition-protein))",
    "hsl(var(--nutrition-fat))",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
      className="bg-card rounded-3xl p-6 border border-border shadow-sm relative overflow-hidden hover:shadow-md transition-shadow"
    >
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {confettiParticles.map((p, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full left-1/2 top-1/2"
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
              transition={{ duration: p.duration, ease: "easeOut" }}
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: confettiColors[p.colorIdx],
              }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-6">
        <NutritionRing value={calories} max={calorieGoal} />
        <div className="flex-1">
          <div className="flex items-baseline gap-1">
            <AnimatedNumber value={Math.round(calories / 10) * 10} className="text-3xl font-display text-foreground" prefix="~" />
          </div>
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
};

export default DailySummaryCard;
