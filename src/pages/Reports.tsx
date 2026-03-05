import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Upload, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import BottomNav from "@/components/BottomNav";

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
  date,
  onSelect,
  label,
}: {
  date: Date | undefined;
  onSelect: (d: Date | undefined) => void;
  label: string;
}) => (
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
      <Calendar
        mode="single"
        selected={date}
        onSelect={onSelect}
        className="p-3 pointer-events-auto"
      />
    </PopoverContent>
  </Popover>
);

const Reports = () => {
  const [tab, setTab] = useState<Tab>("daily");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [compareMode, setCompareMode] = useState(false);
  const [p2Start, setP2Start] = useState<Date | undefined>();
  const [p2End, setP2End] = useState<Date | undefined>();

  const meals: Meal[] = useMemo(
    () => JSON.parse(localStorage.getItem("meals") || "[]"),
    []
  );

  const today = new Date().toDateString();
  const todayMeals = meals.filter((m) => new Date(m.timestamp).toDateString() === today);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekMeals = meals.filter((m) => new Date(m.timestamp) >= weekAgo);

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthMeals = meals.filter((m) => new Date(m.timestamp) >= monthAgo);

  const sumMeals = (list: Meal[]) =>
    list.reduce(
      (a, m) => ({
        calories: a.calories + m.calories,
        protein: a.protein + m.protein,
        carbs: a.carbs + m.carbs,
        fat: a.fat + m.fat,
        count: a.count + 1,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 }
    );

  const filterByRange = (start: Date | undefined, end: Date | undefined) => {
    if (!start || !end) return [];
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    return meals.filter((m) => {
      const d = new Date(m.timestamp);
      return d >= s && d <= e;
    });
  };

  const daysBetween = (start: Date | undefined, end: Date | undefined) => {
    if (!start || !end) return 1;
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  };

  const customMeals = filterByRange(customStart, customEnd);
  const customDays = daysBetween(customStart, customEnd);
  const p2Meals = filterByRange(p2Start, p2End);
  const p2Days = daysBetween(p2Start, p2End);

  const data = {
    daily: { ...sumMeals(todayMeals), label: "Today", period: "today" },
    weekly: { ...sumMeals(weekMeals), label: "This Week", period: "7 days" },
    monthly: { ...sumMeals(monthMeals), label: "This Month", period: "30 days" },
    custom: { ...sumMeals(customMeals), label: "Custom Range", period: `${customDays} days` },
  };

  const current = data[tab];
  const hasSufficientData =
    tab === "custom"
      ? customStart && customEnd && current.count >= 1
      : current.count >= (tab === "daily" ? 1 : tab === "weekly" ? 3 : 7);

  const tabs: { key: Tab; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "custom", label: "Custom" },
  ];

  const metrics = [
    { label: "Calories", key: "calories" as const, unit: "kcal", color: "bg-nutrition-calories" },
    { label: "Protein", key: "protein" as const, unit: "g", color: "bg-nutrition-protein" },
    { label: "Carbs", key: "carbs" as const, unit: "g", color: "bg-nutrition-carbs" },
    { label: "Fat", key: "fat" as const, unit: "g", color: "bg-nutrition-fat" },
  ];

  const p1Summary = sumMeals(customMeals);
  const p2Summary = sumMeals(p2Meals);

  return (
    <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto pb-24">
      <div className="px-6 pt-12 pb-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground font-body text-sm mb-1">Reports</p>
          <h1 className="text-3xl text-foreground">Nutrition Reports</h1>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="px-6 mb-6">
        <div className="bg-secondary rounded-2xl p-1 flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 rounded-xl text-sm font-body font-medium transition-all ${
                tab === t.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report content */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6"
      >
        {tab === "custom" ? (
          <div className="space-y-4">
            {/* Date range pickers */}
            <div className="bg-card rounded-3xl p-5 border border-border space-y-4">
              <p className="font-body font-medium text-foreground text-sm">Select Date Range</p>
              <div className="flex gap-2">
                <DatePickerButton date={customStart} onSelect={setCustomStart} label="Start" />
                <DatePickerButton date={customEnd} onSelect={setCustomEnd} label="End" />
              </div>

              {hasSufficientData && (
                <div className="space-y-3 pt-2">
                  {metrics.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span className="font-body text-sm text-foreground">{item.label}</span>
                      </div>
                      <span className="font-display text-lg text-foreground">
                        {Math.round(current[item.key] / customDays)}
                        <span className="text-xs text-muted-foreground font-body ml-1">
                          {item.unit}/day avg
                        </span>
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="font-body text-sm text-muted-foreground">Total meals</span>
                    <span className="font-display text-lg text-foreground">{current.count}</span>
                  </div>
                </div>
              )}

              {!hasSufficientData && customStart && customEnd && (
                <p className="text-sm text-muted-foreground font-body text-center py-2">
                  No meals found in this range.
                </p>
              )}
            </div>

            {/* Compare toggle */}
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`w-full py-3 rounded-2xl text-sm font-body font-medium transition-all border ${
                compareMode
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border text-muted-foreground"
              }`}
            >
              {compareMode ? "Hide Comparison" : "Compare Periods"}
            </button>

            {/* Compare mode */}
            {compareMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-card rounded-3xl p-5 border border-border space-y-4"
              >
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
                              <span>P1: {avg1}{item.unit}/day</span>
                              <span className="mx-2">→</span>
                              <span>P2: {avg2}{item.unit}/day</span>
                            </div>
                            <div className={`flex items-center gap-1 text-xs font-body font-medium ${
                              diff === 0
                                ? "text-muted-foreground"
                                : isPositive
                                ? "text-primary"
                                : "text-destructive"
                            }`}>
                              {diff !== 0 && (
                                isPositive
                                  ? <ArrowUpRight className="w-3 h-3" />
                                  : <ArrowDownRight className="w-3 h-3" />
                              )}
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
        ) : hasSufficientData ? (
          <div className="space-y-4">
            <div className="bg-card rounded-3xl p-6 border border-border">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-body font-medium text-foreground">{current.label}</p>
                  <p className="text-xs text-muted-foreground font-body">
                    {current.count} meals over {current.period}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {metrics.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <span className="font-body text-sm text-foreground">{item.label}</span>
                    </div>
                    <span className="font-display text-lg text-foreground">
                      {tab !== "daily" ? Math.round(current[item.key] / (current.count || 1)) : current[item.key]}
                      <span className="text-xs text-muted-foreground font-body ml-1">
                        {item.unit}
                        {tab !== "daily" && "/day avg"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-3xl p-8 text-center border border-border">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-body text-foreground font-medium mb-2">Not enough data</p>
            <p className="text-sm text-muted-foreground font-body">
              Log more meals to unlock {tab} insights.
            </p>
          </div>
        )}
      </motion.div>

      {/* Blood report upload */}
      <div className="px-6 mt-8">
        <div className="bg-card rounded-3xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-3">
            <Upload className="w-5 h-5 text-accent" />
            <p className="font-body font-medium text-foreground">Blood Report</p>
          </div>
          <p className="text-sm text-muted-foreground font-body mb-4">
            Upload your blood report to connect nutrition with biomarkers.
          </p>
          <Button variant="outline" className="rounded-xl w-full">
            Upload Report
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Reports;
