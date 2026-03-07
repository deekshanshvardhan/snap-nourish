import { Flame } from "lucide-react";
import { useMemo } from "react";

interface Meal {
  timestamp: string;
}

const LoggingStreak = () => {
  const { streak, missed } = useMemo(() => {
    const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
    const daysWithMeals = new Set(
      meals.map((m) => new Date(m.timestamp).toDateString())
    );

    let currentStreak = 0;
    let missedDays = 0;
    const today = new Date();

    // Count streak backwards from today
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (daysWithMeals.has(d.toDateString())) {
        currentStreak++;
      } else if (i === 0) {
        // today hasn't been logged yet, don't break streak
        continue;
      } else {
        break;
      }
    }

    // Count missed in last 7 days
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (!daysWithMeals.has(d.toDateString())) {
        missedDays++;
      }
    }

    return { streak: currentStreak, missed: missedDays };
  }, []);

  return (
    <div className="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 border border-border">
      <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center">
        <Flame className="w-4 h-4 text-accent" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-body font-medium text-foreground">
          {streak} Day{streak !== 1 ? "s" : ""} Logged
        </p>
        {missed > 0 && (
          <p className="text-[10px] text-muted-foreground font-body">
            {missed} missed in last 7 days
          </p>
        )}
      </div>
    </div>
  );
};

export default LoggingStreak;
