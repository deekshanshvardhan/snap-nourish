import { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, subDays, isSameDay } from "date-fns";
import BottomNav from "@/components/BottomNav";
import FloatingLogButton from "@/components/FloatingLogButton";
import DailySummaryCard from "@/components/DailySummaryCard";
import MealTimeline from "@/components/MealTimeline";
import LoggingStreak from "@/components/LoggingStreak";
import RecentlyLogged from "@/components/RecentlyLogged";
import { MealTemplate, saveTemplate } from "@/lib/mealTemplates";
import { useNavigate } from "react-router-dom";

import { Meal } from "@/lib/mealUtils";

const DATE_OPTIONS = [
  { label: "Today", offset: 0 },
  { label: "Yesterday", offset: 1 },
];

const Insights = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mealsVersion, setMealsVersion] = useState(0);
  const navigate = useNavigate();

  const isToday = isSameDay(selectedDate, new Date());
  const dateLabel = isToday ? "Today" : isSameDay(selectedDate, subDays(new Date(), 1)) ? "Yesterday" : format(selectedDate, "EEEE");

  const dayMeals = useMemo(() => {
    const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
    const target = selectedDate.toDateString();
    return meals
      .filter((m) => new Date(m.timestamp).toDateString() === target)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [selectedDate, mealsVersion]);

  const totals = useMemo(() => {
    return dayMeals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [dayMeals]);

  const interpretation = useMemo(() => {
    if (dayMeals.length === 0) return null;
    const goal = 2000;
    if (totals.calories > goal) return "You've exceeded your calorie target today.";
    if (totals.protein < 60 && dayMeals.length >= 2) return "Your protein intake is low today.";
    if (totals.carbs > 250) return "Your carb intake is higher than usual.";
    if (totals.calories >= goal * 0.7) return "You are within your calorie target today.";
    if (totals.calories < goal * 0.4) return "You're well under your calorie goal — keep logging.";
    return "Keep logging to see your full daily picture.";
  }, [totals, dayMeals.length]);

  const pinnedMeals: Record<string, string[]> = useMemo(() => {
    return JSON.parse(localStorage.getItem("pinnedMeals") || "{}");
  }, [mealsVersion]);

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    if (d <= new Date()) setSelectedDate(d);
  };

  const handleLogMeal = (slotKey: string) => {
    navigate("/home");
  };

  const handleQuickLog = (template: MealTemplate, slotKey: string) => {
    const hour = slotKey === "breakfast" ? 8 : slotKey === "lunch" ? 12 : slotKey === "snack" ? 16 : 19;
    const ts = new Date(selectedDate);
    ts.setHours(hour, 0, 0, 0);

    const meal: Meal = {
      id: Date.now(),
      type: "template",
      timestamp: ts.toISOString(),
      description: template.name,
      calories: template.calories,
      protein: template.protein,
      carbs: template.carbs,
      fat: template.fat,
    };
    const meals = JSON.parse(localStorage.getItem("meals") || "[]");
    meals.push(meal);
    localStorage.setItem("meals", JSON.stringify(meals));

    template.count++;
    template.lastLogged = new Date().toISOString();
    saveTemplate(template);

    setMealsVersion((v) => v + 1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground font-body text-sm mb-1">Insights</p>
          <h1 className="text-3xl text-foreground">Daily Insights</h1>
        </motion.div>
      </div>

      {/* Date selector */}
      <div className="px-6 mb-4">
        <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-2.5 border border-border">
          <button onClick={() => navigateDate(-1)} className="p-1">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="text-center">
            <p className="text-sm font-body font-medium text-foreground">{dateLabel}</p>
            <p className="text-[10px] text-muted-foreground font-body">{format(selectedDate, "MMM d, yyyy")}</p>
          </div>
          <button
            onClick={() => navigateDate(1)}
            disabled={isToday}
            className="p-1 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Streak */}
      <div className="px-6 mb-4">
        <LoggingStreak />
      </div>

      {/* Summary card */}
      <div className="px-6 mb-4">
        <DailySummaryCard
          calories={totals.calories}
          protein={totals.protein}
          carbs={totals.carbs}
          fat={totals.fat}
        />
      </div>

      {/* Interpretation */}
      {interpretation && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 mb-4">
          <p className="text-sm text-muted-foreground font-body italic px-1">💡 {interpretation}</p>
        </motion.div>
      )}

      {/* Timeline */}
      <div className="px-6 mb-6">
        <h2 className="text-xl font-display text-foreground mb-3">Meal Timeline</h2>
        <MealTimeline
          meals={dayMeals}
          onLogMeal={handleLogMeal}
          onQuickLog={handleQuickLog}
          pinnedMeals={pinnedMeals}
          onMealUpdated={() => setMealsVersion((v) => v + 1)}
        />
      </div>

      {/* Recently logged */}
      <div className="px-6 mb-6">
        <RecentlyLogged meals={dayMeals} />
      </div>

      <FloatingLogButton />
      <BottomNav />
    </div>
  );
};

export default Insights;
