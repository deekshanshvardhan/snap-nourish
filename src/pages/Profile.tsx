import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Moon, Sun, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BottomNav from "@/components/BottomNav";
import AnimatedNumber from "@/components/AnimatedNumber";

const Profile = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("auth-user") || "{}"); }
    catch { return {}; }
  });

  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem("nutrition-profile") || "{}"); }
    catch { return {}; }
  });

  const [name, setName] = useState(user.name || "User");
  const [height, setHeight] = useState(profile.height || "");
  const [weight, setWeight] = useState(profile.weight || "");
  const [age, setAge] = useState(profile.age || "");
  const [goal, setGoal] = useState(profile.goal || "");
  const [calorieGoal, setCalorieGoal] = useState(profile.calorieGoal || "2000");
  const [proteinGoal, setProteinGoal] = useState(profile.proteinGoal || "120");
  const [carbGoal, setCarbGoal] = useState(profile.carbGoal || "250");
  const [fatGoal, setFatGoal] = useState(profile.fatGoal || "70");
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const stats = useMemo(() => {
    try {
      const meals: { timestamp: string }[] = JSON.parse(localStorage.getItem("meals") || "[]");
      const totalMeals = meals.length;
      const daysSet = new Set(meals.map((m) => new Date(m.timestamp).toDateString()));
      const daysTracked = daysSet.size;

      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 60; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (daysSet.has(d.toDateString())) {
          streak++;
        } else if (i === 0) {
          continue;
        } else {
          break;
        }
      }
      return { totalMeals, daysTracked, streak };
    } catch {
      return { totalMeals: 0, daysTracked: 0, streak: 0 };
    }
  }, []);

  const initials = name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const providerLabel = user.provider === "google" ? "Google" : user.provider === "apple" ? "Apple" : "Email";

  // Persist profile changes on blur
  const saveProfile = () => {
    const updated = { ...profile, height, weight, age, goal, calorieGoal, proteinGoal, carbGoal, fatGoal };
    localStorage.setItem("nutrition-profile", JSON.stringify(updated));
    localStorage.setItem("personalization-completed", "true");
    setProfile(updated);
  };

  const saveName = () => {
    const updated = { ...user, name };
    localStorage.setItem("auth-user", JSON.stringify(updated));
    setUser(updated);
  };

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogout = () => {
    localStorage.removeItem("auth-user");
    localStorage.removeItem("auth-provider");
    localStorage.removeItem("onboarded");
    navigate("/onboarding", { replace: true });
  };


  return (
    <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto pb-24 scrollbar-hide">
      <div className="px-6 pt-12 pb-2 safe-top">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl text-foreground">Profile</h1>
        </motion.div>
      </div>

      {/* Avatar & Name */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="px-6 py-6 flex items-center gap-4"
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-lg">
          <span className="text-xl font-display text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            className="border-0 bg-transparent p-0 h-auto text-xl font-display text-foreground focus-visible:ring-0 focus-visible:outline-none"
            aria-label="Your name"
          />
          <p className="text-sm text-muted-foreground font-body">
            Signed in with {providerLabel}
          </p>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-6 mb-6"
      >
        <div className="bg-card rounded-2xl border border-border p-4 flex justify-around">
          {[
            { label: "Meals", value: stats.totalMeals },
            { label: "Days", value: stats.daysTracked },
            { label: "Streak", value: stats.streak },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <span className="text-2xl font-display text-foreground">
                <AnimatedNumber value={stat.value} />
              </span>
              <span className="text-[11px] text-muted-foreground font-body">{stat.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Body Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="px-6 mb-4"
      >
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <p className="font-body font-medium text-foreground text-sm">Body Metrics</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-body text-muted-foreground">Height (cm)</Label>
              <Input
                type="number"
                placeholder="170"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                onBlur={saveProfile}
                className="h-10 rounded-xl bg-secondary border-0 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-body text-muted-foreground">Weight (kg)</Label>
              <Input
                type="number"
                placeholder="70"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onBlur={saveProfile}
                className="h-10 rounded-xl bg-secondary border-0 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-body text-muted-foreground">Age</Label>
              <Input
                type="number"
                placeholder="25"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                onBlur={saveProfile}
                className="h-10 rounded-xl bg-secondary border-0 text-sm"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Goal */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="px-6 mb-4"
      >
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <p className="font-body font-medium text-foreground text-sm">Goal</p>
          <Select
            value={goal}
            onValueChange={(v) => {
              setGoal(v);
              const updated = { ...profile, height, weight, age, goal: v, calorieGoal, proteinGoal, carbGoal, fatGoal };
              localStorage.setItem("nutrition-profile", JSON.stringify(updated));
              setProfile(updated);
            }}
          >
            <SelectTrigger className="h-11 rounded-xl bg-secondary border-0 text-sm">
              <SelectValue placeholder="Select a goal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lose">Lose weight</SelectItem>
              <SelectItem value="maintain">Maintain weight</SelectItem>
              <SelectItem value="gain">Gain weight</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Nutrition Goals */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="px-6 mb-4"
      >
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <p className="font-body font-medium text-foreground text-sm">Daily Targets</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Calories (kcal)", value: calorieGoal, setter: setCalorieGoal, color: "border-l-nutrition-calories" },
              { label: "Protein (g)", value: proteinGoal, setter: setProteinGoal, color: "border-l-nutrition-protein" },
              { label: "Carbs (g)", value: carbGoal, setter: setCarbGoal, color: "border-l-nutrition-carbs" },
              { label: "Fat (g)", value: fatGoal, setter: setFatGoal, color: "border-l-nutrition-fat" },
            ].map((item) => (
              <div key={item.label} className={`space-y-1.5 border-l-[3px] ${item.color} pl-3`}>
                <Label className="text-[11px] font-body text-muted-foreground">{item.label}</Label>
                <Input
                  type="number"
                  value={item.value}
                  onChange={(e) => item.setter(e.target.value)}
                  onBlur={saveProfile}
                  className="h-10 rounded-xl bg-secondary border-0 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Appearance */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="px-6 mb-4"
      >
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark ? (
                <Moon className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Sun className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <p className="font-body font-medium text-foreground text-sm">Dark Mode</p>
                <p className="text-[11px] text-muted-foreground font-body">
                  {isDark ? "On" : "Off"}
                </p>
              </div>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={toggleDarkMode}
              aria-label="Toggle dark mode"
            />
          </div>
        </div>
      </motion.div>

      {/* Account Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="px-6 mb-4 space-y-2"
      >
        <button
          onClick={handleLogout}
          className="w-full bg-card rounded-2xl border border-border p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <LogOut className="w-4 h-4 text-muted-foreground" />
            <span className="font-body text-sm text-foreground">Log Out</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

      </motion.div>

      {/* App version */}
      <div className="px-6 pt-4 pb-8 text-center">
        <p className="text-[11px] text-muted-foreground/40 font-body">Snap Nourish v1.0</p>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
