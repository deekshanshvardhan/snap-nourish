import { Flame } from "lucide-react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Meal } from "@/lib/mealUtils";
import { getMeals } from "@/lib/storage";

const LoggingStreak = () => {
  const { streak, weekDays } = useMemo(() => {
    const meals: Meal[] = getMeals();
    const daysWithMeals = new Set(
      meals.map((m) => new Date(m.timestamp).toDateString())
    );

    let currentStreak = 0;
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (daysWithMeals.has(d.toDateString())) {
        currentStreak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }

    const weekDays: boolean[] = [];
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + mondayOffset + i);
      weekDays.push(daysWithMeals.has(d.toDateString()));
    }

    return { streak: currentStreak, weekDays };
  }, []);

  const dayLabels = ["M", "T", "W", "Th", "F", "S", "S"];

  return (
    <div className="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 border border-border hover:shadow-sm transition-shadow">
      <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center relative shrink-0">
        {streak >= 3 && (
          <motion.div
            className="absolute inset-0 rounded-full bg-accent/10"
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <Flame
          className={`w-4 h-4 text-accent relative z-10 ${streak >= 3 ? "animate-pulse-dot" : ""}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-body font-medium text-foreground">
          {streak} Day{streak !== 1 ? "s" : ""} Logged
        </p>
        <div className="flex gap-1.5 mt-1.5">
          {weekDays.map((filled, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className={`w-3.5 h-3.5 rounded-full border-[1.5px] transition-all ${
                  filled
                    ? "bg-primary border-primary"
                    : "bg-transparent border-muted-foreground/20"
                }`}
              />
              <span className="text-[8px] text-muted-foreground/60 font-body">{dayLabels[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoggingStreak;
