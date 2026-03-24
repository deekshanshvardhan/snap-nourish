import { useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Lightbulb, RefreshCw } from "lucide-react";
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

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
};

const Insights = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mealsVersion, setMealsVersion] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isToday = isSameDay(selectedDate, new Date());
  const dateLabel = isToday
    ? "Today"
    : isSameDay(selectedDate, subDays(new Date(), 1))
    ? "Yesterday"
    : format(selectedDate, "EEEE");

  const userName = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem("auth-user") || "{}");
      return user.name || null;
    } catch {
      return null;
    }
  }, []);

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

  const datesWithMeals = useMemo(() => {
    const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
    const set = new Set<string>();
    meals.forEach((m) => set.add(new Date(m.timestamp).toDateString()));
    return set;
  }, [mealsVersion]);

  const pinnedMeals: Record<string, string[]> = useMemo(() => {
    return JSON.parse(localStorage.getItem("pinnedMeals") || "{}");
  }, [mealsVersion]);

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    if (d <= new Date()) setSelectedDate(d);
  };

  const handleLogMeal = () => navigate("/home");

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

  const handleDeleteMeal = (mealId: number) => {
    const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
    const filtered = meals.filter((m) => m.id !== mealId);
    localStorage.setItem("meals", JSON.stringify(filtered));
    setMealsVersion((v) => v + 1);
  };

  // Swipe date navigation
  const dateTouchStart = useRef(0);
  const handleDateTouchStart = (e: React.TouchEvent) => {
    dateTouchStart.current = e.touches[0].clientX;
  };
  const handleDateTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - dateTouchStart.current;
    if (diff > 50) navigateDate(-1);
    else if (diff < -50) navigateDate(1);
  };

  // Pull to refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current || containerRef.current.scrollTop > 0) return;
    const dist = e.touches[0].clientY - touchStartY.current;
    if (dist > 0) setPullDistance(Math.min(dist * 0.4, 80));
  };
  const handleTouchEnd = () => {
    if (pullDistance > 50) {
      setRefreshing(true);
      setMealsVersion((v) => v + 1);
      setTimeout(() => {
        setRefreshing(false);
        setPullDistance(0);
      }, 600);
    } else {
      setPullDistance(0);
    }
  };

  // Date dots - check nearby dates
  const nearbyDateHasMeals = useCallback(
    (offset: number) => {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + offset);
      return datesWithMeals.has(d.toDateString());
    },
    [selectedDate, datesWithMeals]
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col min-h-screen bg-background max-w-md mx-auto pb-24 overflow-y-auto scrollbar-hide"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || refreshing) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: pullDistance || 40, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? "animate-spin" : ""}`} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with greeting */}
      <div className="px-6 pt-12 pb-4 safe-top">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground font-body text-sm mb-1">
            {getGreeting()}{userName ? `, ${userName}` : ""}
          </p>
          <h1 className="text-3xl text-foreground">Daily Insights</h1>
        </motion.div>
      </div>

      {/* Date selector - swipeable */}
      <div className="px-6 mb-4">
        <div
          className="flex items-center justify-between bg-card rounded-2xl px-4 py-2.5 border border-border"
          onTouchStart={handleDateTouchStart}
          onTouchEnd={handleDateTouchEnd}
        >
          <button onClick={() => navigateDate(-1)} className="p-1" aria-label="Previous day">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="text-center">
            <p className="text-sm font-body font-medium text-foreground">{dateLabel}</p>
            <p className="text-[10px] text-muted-foreground font-body">{format(selectedDate, "MMM d, yyyy")}</p>
            {/* Meal dots for nearby dates */}
            <div className="flex gap-1 justify-center mt-1">
              {[-1, 0, 1].map((offset) => (
                <div
                  key={offset}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    offset === 0
                      ? datesWithMeals.has(selectedDate.toDateString())
                        ? "bg-primary"
                        : "bg-muted-foreground/20"
                      : nearbyDateHasMeals(offset)
                      ? "bg-primary/40"
                      : "bg-transparent"
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => navigateDate(1)}
            disabled={isToday}
            className="p-1 disabled:opacity-30"
            aria-label="Next day"
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

      {/* Interpretation as insight card */}
      {interpretation && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 mb-4">
          <div className="bg-card rounded-2xl p-4 border-l-[3px] border-l-primary border border-border flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm text-foreground font-body leading-relaxed">
              {interpretation}
            </p>
          </div>
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
        <RecentlyLogged meals={dayMeals} onDelete={handleDeleteMeal} />
      </div>

      <FloatingLogButton />
      <BottomNav />
    </div>
  );
};

export default Insights;
