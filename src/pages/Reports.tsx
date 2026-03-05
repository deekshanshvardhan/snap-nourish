import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";

interface Meal {
  id: number;
  timestamp: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

type Tab = "daily" | "weekly" | "monthly";

const Reports = () => {
  const [tab, setTab] = useState<Tab>("daily");

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

  const data = {
    daily: { ...sumMeals(todayMeals), label: "Today", period: "today" },
    weekly: { ...sumMeals(weekMeals), label: "This Week", period: "7 days" },
    monthly: { ...sumMeals(monthMeals), label: "This Month", period: "30 days" },
  };

  const current = data[tab];
  const hasSufficientData = current.count >= (tab === "daily" ? 1 : tab === "weekly" ? 3 : 7);

  const tabs: { key: Tab; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
  ];

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
        {hasSufficientData ? (
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
                {[
                  { label: "Calories", value: current.calories, unit: "kcal", color: "bg-nutrition-calories" },
                  { label: "Protein", value: current.protein, unit: "g", color: "bg-nutrition-protein" },
                  { label: "Carbs", value: current.carbs, unit: "g", color: "bg-nutrition-carbs" },
                  { label: "Fat", value: current.fat, unit: "g", color: "bg-nutrition-fat" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <span className="font-body text-sm text-foreground">{item.label}</span>
                    </div>
                    <span className="font-display text-lg text-foreground">
                      {tab !== "daily" ? Math.round(item.value / (current.count || 1)) : item.value}
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
