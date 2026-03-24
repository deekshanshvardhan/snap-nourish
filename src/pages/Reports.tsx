import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Upload, ArrowUpRight, ArrowDownRight, TrendingUp, ChevronDown, Lightbulb, Flame, Droplet } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import BottomNav from "@/components/BottomNav";
import FloatingLogButton from "@/components/FloatingLogButton";
import AnimatedNumber from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";

interface Meal {
  id: number;
  timestamp: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

type Tab = "daily" | "weekly" | "monthly" | "custom";

const DatePickerButton = ({
  date, onSelect, label,
}: { date: Date | undefined; onSelect: (d: Date | undefined) => void; label: string }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button className="flex-1 bg-secondary rounded-xl px-3 py-2.5 text-left">
        <p className="text-[10px] text-muted-foreground font-body">{label}</p>
        <p className="text-sm font-body text-foreground">
          {date ? format(date, "MMM d, yyyy") : "Select"}
        </p>
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={date} onSelect={onSelect} className={cn("p-3 pointer-events-auto")} />
    </PopoverContent>
  </Popover>
);

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-foreground text-background rounded-xl px-3 py-2 shadow-xl text-xs font-body">
      <p className="font-medium mb-0.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="opacity-80">
          {p.value} {p.dataKey === "calories" ? "kcal" : p.dataKey === "meals" ? "meals" : "g"}
        </p>
      ))}
    </div>
  );
};

const metricIcons: Record<string, React.ReactNode> = {
  calories: <Flame className="w-3 h-3" />,
  protein: <span className="text-[10px] font-bold">P</span>,
  carbs: <span className="text-[10px] font-bold">C</span>,
  fat: <Droplet className="w-3 h-3" />,
};

const metricGradients: Record<string, string> = {
  calories: "from-nutrition-calories/5 to-transparent",
  protein: "from-nutrition-protein/5 to-transparent",
  carbs: "from-nutrition-carbs/5 to-transparent",
  fat: "from-nutrition-fat/5 to-transparent",
};

const Reports = () => {
  const [tab, setTab] = useState<Tab>("weekly");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [compareMode, setCompareMode] = useState(false);
  const [p2Start, setP2Start] = useState<Date | undefined>();
  const [p2End, setP2End] = useState<Date | undefined>();
  const [trendRange, setTrendRange] = useState<7 | 30 | 90>(7);
  const [showTrends, setShowTrends] = useState(false);

  const meals: Meal[] = useMemo(() => JSON.parse(localStorage.getItem("meals") || "[]"), []);

  const today = new Date().toDateString();
  const todayMeals = meals.filter((m) => new Date(m.timestamp).toDateString() === today);

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekMeals = meals.filter((m) => new Date(m.timestamp) >= weekAgo);

  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
  const monthMeals = meals.filter((m) => new Date(m.timestamp) >= monthAgo);

  const sumMeals = (list: Meal[]) =>
    list.reduce(
      (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat, count: a.count + 1 }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 }
    );

  const filterByRange = (start: Date | undefined, end: Date | undefined) => {
    if (!start || !end) return [];
    const s = new Date(start); s.setHours(0, 0, 0, 0);
    const e = new Date(end); e.setHours(23, 59, 59, 999);
    return meals.filter((m) => { const d = new Date(m.timestamp); return d >= s && d <= e; });
  };

  const daysBetween = (start: Date | undefined, end: Date | undefined) => {
    if (!start || !end) return 1;
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  };

  const customMeals = filterByRange(customStart, customEnd);
  const customDays = daysBetween(customStart, customEnd);
  const p2Meals = filterByRange(p2Start, p2End);
  const p2Days = daysBetween(p2Start, p2End);

  const periodDays = { daily: 1, weekly: 7, monthly: 30, custom: customDays };

  const data = {
    daily: { ...sumMeals(todayMeals), label: "Today", period: "today" },
    weekly: { ...sumMeals(weekMeals), label: "This Week", period: "7 days" },
    monthly: { ...sumMeals(monthMeals), label: "This Month", period: "30 days" },
    custom: { ...sumMeals(customMeals), label: "Custom Range", period: `${customDays} days` },
  };

  const current = data[tab];
  const days = periodDays[tab];
  const avgCalories = current.count > 0 ? Math.round(current.calories / days) : 0;
  const avgProtein = current.count > 0 ? Math.round(current.protein / days) : 0;
  const avgCarbs = current.count > 0 ? Math.round(current.carbs / days) : 0;
  const avgFat = current.count > 0 ? Math.round(current.fat / days) : 0;

  const hasSufficientData = tab === "custom"
    ? customStart && customEnd && current.count >= 1
    : current.count >= 1;

  const tabs: { key: Tab; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "custom", label: "Custom" },
  ];

  const metrics = [
    { label: "Calories", key: "calories" as const, unit: "kcal", color: "bg-nutrition-calories", textColor: "text-nutrition-calories" },
    { label: "Protein", key: "protein" as const, unit: "g", color: "bg-nutrition-protein", textColor: "text-nutrition-protein" },
    { label: "Carbs", key: "carbs" as const, unit: "g", color: "bg-nutrition-carbs", textColor: "text-nutrition-carbs" },
    { label: "Fat", key: "fat" as const, unit: "g", color: "bg-nutrition-fat", textColor: "text-nutrition-fat" },
  ];

  const avgValues: Record<string, number> = { calories: avgCalories, protein: avgProtein, carbs: avgCarbs, fat: avgFat };

  const p1Summary = sumMeals(customMeals);
  const p2Summary = sumMeals(p2Meals);

  const userGoal = useMemo(() => {
    try {
      const profile = JSON.parse(localStorage.getItem("nutrition-profile") || "{}");
      return profile.goal || "maintain";
    } catch { return "maintain"; }
  }, []);

  const getComparisonColor = (key: string, diff: number): string => {
    if (diff === 0) return "text-muted-foreground";
    if (key === "protein") return diff > 0 ? "text-primary" : "text-destructive";
    if (key === "calories") {
      if (userGoal === "lose") return diff < 0 ? "text-primary" : "text-destructive";
      if (userGoal === "gain") return diff > 0 ? "text-primary" : "text-destructive";
      return "text-muted-foreground";
    }
    return "text-muted-foreground";
  };

  const insights = useMemo(() => {
    const items: string[] = [];
    if (current.count === 0) return items;
    if (avgProtein < 50) items.push("Protein intake is below recommended levels");
    else if (avgProtein > 100) items.push("Great protein intake — keep it up!");
    if (avgCalories > 0 && avgCalories < 1200) items.push("Calorie intake seems low — make sure you're eating enough");
    else if (avgCalories > 2500) items.push("Calorie intake is on the higher side");
    const last7 = meals.filter(m => new Date(m.timestamp) >= subDays(new Date(), 7));
    const loggedLast7 = new Set(last7.map(m => new Date(m.timestamp).toDateString())).size;
    if (loggedLast7 >= 5) items.push("Logging consistency is strong this week");
    else if (loggedLast7 >= 3) items.push("Logging consistency is improving — keep going");
    else if (meals.length > 0) items.push("Try logging meals more consistently for better insights");
    return items.slice(0, 3);
  }, [current, avgProtein, avgCalories, meals]);

  const trendData = useMemo(() => {
    const result: { date: string; calories: number; protein: number; carbs: number; fat: number; meals: number }[] = [];
    for (let i = trendRange - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const ds = d.toDateString();
      const dayMeals = meals.filter((m) => new Date(m.timestamp).toDateString() === ds);
      const sum = sumMeals(dayMeals);
      result.push({ date: format(d, "MMM d"), calories: sum.calories, protein: sum.protein, carbs: sum.carbs, fat: sum.fat, meals: sum.count });
    }
    return result;
  }, [meals, trendRange]);

  const hasTrendData = trendData.some((d) => d.meals > 0);

  const chartConfigs = [
    { key: "calories" as const, label: "Calories / day", gradId: "calGrad", color: "hsl(var(--nutrition-calories))", height: "h-32" },
    { key: "protein" as const, label: "Protein (g) / day", gradId: "protGrad", color: "hsl(var(--nutrition-protein))", height: "h-28" },
    { key: "meals" as const, label: "Meals logged / day", gradId: "mealGrad", color: "hsl(var(--accent))", height: "h-20" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto pb-24 scrollbar-hide">
      <div className="px-6 pt-12 pb-6 safe-top">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground font-body text-sm mb-1">Reports</p>
          <h1 className="text-3xl text-foreground">Nutrition Reports</h1>
        </motion.div>
      </div>

      {/* Tabs with sliding pill */}
      <div className="px-6 mb-6">
        <div className="bg-secondary rounded-2xl p-1 flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-3 rounded-xl text-sm font-body font-medium relative z-10 transition-colors"
            >
              {tab === t.key && (
                <motion.div
                  layoutId="report-tab-pill"
                  className="absolute inset-0 bg-card rounded-xl shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className={`relative z-10 ${tab === t.key ? "text-foreground" : "text-muted-foreground"}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range picker */}
      {tab === "custom" && (
        <div className="px-6 mb-4">
          <div className="bg-card rounded-3xl p-5 border border-border space-y-4">
            <p className="font-body font-medium text-foreground text-sm">Select Date Range</p>
            <div className="flex gap-2">
              <DatePickerButton date={customStart} onSelect={setCustomStart} label="Start" />
              <DatePickerButton date={customEnd} onSelect={setCustomEnd} label="End" />
            </div>
          </div>
        </div>
      )}

      {/* Summary Card */}
      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-6 mb-4">
        {hasSufficientData ? (
          <div className="bg-card rounded-3xl p-6 border border-border hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-body font-medium text-foreground">{current.label}</p>
                <p className="text-xs text-muted-foreground font-body">{current.count} meals · {current.period}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {metrics.map((item) => {
                const avg = tab === "daily" ? current[item.key] : Math.round(current[item.key] / days);
                return (
                  <div key={item.label} className={`bg-gradient-to-br ${metricGradients[item.key]} rounded-2xl p-3.5`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-5 h-5 rounded-full ${item.color} flex items-center justify-center text-white`}>
                        {metricIcons[item.key]}
                      </div>
                      <span className="text-[11px] text-muted-foreground font-body">{item.label}</span>
                    </div>
                    <p className="font-display text-xl text-foreground">
                      <AnimatedNumber value={avg} />
                      <span className="text-xs text-muted-foreground font-body ml-1">{item.unit}</span>
                    </p>
                    {tab !== "daily" && (
                      <p className="text-[10px] text-muted-foreground font-body mt-0.5">per day avg</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <span className="font-body text-sm text-muted-foreground">Meals logged</span>
              <span className="font-display text-lg text-foreground">{current.count}</span>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-3xl p-8 text-center border border-border">
            <div className="flex justify-center mb-4">
              <svg viewBox="0 0 64 64" className="w-16 h-16 text-muted-foreground/20">
                <rect x="8" y="8" width="48" height="48" rx="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M20 40 L28 28 L36 36 L44 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="24" cy="22" r="3" fill="currentColor" opacity="0.3" />
              </svg>
            </div>
            <p className="font-body text-foreground font-medium mb-2">Not enough data</p>
            <p className="text-sm text-muted-foreground font-body">
              {tab === "custom" && (!customStart || !customEnd)
                ? "Select a date range above to view your report."
                : "Log more meals to unlock insights."}
            </p>
          </div>
        )}
      </motion.div>

      {/* Insights */}
      {hasSufficientData && insights.length > 0 && (
        <div className="px-6 mb-4">
          <div className="bg-card rounded-3xl p-5 border border-border space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="w-4 h-4 text-primary" />
              <p className="font-body font-medium text-foreground text-sm">Insights</p>
            </div>
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <p className="text-sm text-muted-foreground font-body leading-snug">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Trends toggle */}
      <div className="px-6 mb-4">
        <button
          onClick={() => setShowTrends(!showTrends)}
          className={`w-full flex items-center justify-between py-3.5 px-5 rounded-2xl text-sm font-body font-medium transition-all border ${
            showTrends ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-foreground"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-4 h-4" />
            <span>View Trends</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${showTrends ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Trend Graphs */}
      <AnimatePresence>
        {showTrends && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 mb-4 overflow-hidden"
          >
            <div className="bg-card rounded-3xl p-5 border border-border">
              <div className="flex items-center justify-between mb-4">
                <p className="font-body font-medium text-foreground text-sm">Nutrition Trends</p>
                {/* Trend range with sliding pill */}
                <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
                  {([7, 30, 90] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setTrendRange(r)}
                      className="relative px-2.5 py-1 rounded-md text-[10px] font-body font-medium"
                    >
                      {trendRange === r && (
                        <motion.div
                          layoutId="trend-range-pill"
                          className="absolute inset-0 bg-card rounded-md shadow-sm"
                          transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        />
                      )}
                      <span className={`relative z-10 ${trendRange === r ? "text-primary" : "text-muted-foreground"}`}>
                        {r}d
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {hasTrendData ? (
                <div className="space-y-4">
                  {chartConfigs.map((cfg) => (
                    <div key={cfg.key}>
                      <p className="text-[10px] text-muted-foreground font-body mb-2">{cfg.label}</p>
                      <div className={cfg.height} style={{ filter: "drop-shadow(0 2px 8px hsl(var(--primary) / 0.08))" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trendData}>
                            <defs>
                              <linearGradient id={cfg.gradId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={cfg.color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis hide />
                            <Tooltip content={<ChartTooltip />} />
                            <Area
                              type="monotone"
                              dataKey={cfg.key}
                              stroke={cfg.color}
                              fill={`url(#${cfg.gradId})`}
                              strokeWidth={2}
                              dot={{ r: 2.5, fill: cfg.color, strokeWidth: 0 }}
                              activeDot={{ r: 4, fill: cfg.color, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground font-body text-center py-6">
                  Log meals to see nutrition trends over time.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compare Periods (custom tab) */}
      {tab === "custom" && hasSufficientData && (
        <div className="px-6 mb-4 space-y-4">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`w-full py-3 rounded-2xl text-sm font-body font-medium transition-all border ${
              compareMode ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground"
            }`}
          >
            {compareMode ? "Hide Comparison" : "Compare Periods"}
          </button>

          {compareMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-card rounded-3xl p-5 border border-border space-y-4">
              <p className="font-body font-medium text-foreground text-sm">Period 2</p>
              <div className="flex gap-2">
                <DatePickerButton date={p2Start} onSelect={setP2Start} label="Start" />
                <DatePickerButton date={p2End} onSelect={setP2End} label="End" />
              </div>
              {p1Summary.count > 0 && p2Summary.count > 0 && p2Start && p2End && (
                <div className="space-y-3 pt-2">
                  {metrics.map((item) => {
                    const avg1 = Math.round(p1Summary[item.key] / customDays);
                    const avg2 = Math.round(p2Summary[item.key] / p2Days);
                    const diff = avg2 - avg1;
                    const isPositive = diff > 0;
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${item.color}`} />
                          <span className="font-body text-sm text-foreground">{item.label}</span>
                        </div>
                        <div className="flex items-center justify-between pl-4">
                          <div className="text-xs text-muted-foreground font-body">
                            <span>P1: <AnimatedNumber value={avg1} />{item.unit}/day</span>
                            <span className="mx-2">→</span>
                            <span>P2: <AnimatedNumber value={avg2} />{item.unit}/day</span>
                          </div>
                          <div className={`flex items-center gap-1 text-xs font-body font-medium ${getComparisonColor(item.key, diff)}`}>
                            {diff !== 0 && (isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
                            {diff > 0 ? "+" : ""}{diff}{item.unit}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Blood report - Coming Soon */}
      <div className="px-6 mt-4">
        <div className="bg-card rounded-3xl p-6 border border-border opacity-50 relative pointer-events-none">
          <div className="absolute top-4 right-4">
            <span className="bg-muted text-muted-foreground px-2.5 py-1 rounded-full text-[10px] font-body font-medium">
              Coming Soon
            </span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <Upload className="w-5 h-5 text-accent" />
            <p className="font-body font-medium text-foreground">Blood Report</p>
          </div>
          <p className="text-sm text-muted-foreground font-body">
            Upload your blood report to connect nutrition with biomarkers.
          </p>
        </div>
      </div>

      <FloatingLogButton />
      <BottomNav />
    </div>
  );
};

export default Reports;
