import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Moon, Sun, ChevronRight, Download, Trash2, Camera, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BottomNav from "@/components/BottomNav";
import AnimatedNumber from "@/components/AnimatedNumber";
import { Meal } from "@/lib/mealUtils";
import { getAuthUser, saveAuthUser, getProfile as getStoredProfile, saveProfile as saveStoredProfile, getMeals, setFlag, getFlag, removeFlag } from "@/lib/storage";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

const Profile = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    try { return getAuthUser(); }
    catch { return {}; }
  });

  const [profile, setProfile] = useState(() => {
    try { return getStoredProfile(); }
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
  const [photoOptIn, setPhotoOptIn] = useState(() => {
    const stored = getFlag("photoOptIn");
    return stored !== null ? stored === "true" : true;
  });
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const stats = useMemo(() => {
    try {
      const meals: Meal[] = getMeals();
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
  const handleSaveProfile = () => {
    const updated = { ...profile, height, weight, age, goal, calorieGoal, proteinGoal, carbGoal, fatGoal };
    saveStoredProfile(updated);
    setProfile(updated);
  };

  const saveName = () => {
    const updated = { ...user, name };
    saveAuthUser(updated);
    setUser(updated);
  };

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    setFlag("theme", next ? "dark" : "light");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    removeFlag("authUser");
    removeFlag("authProvider");
    removeFlag("onboarded");
    localStorage.clear();
    navigate("/onboarding", { replace: true });
  };

  const handleTogglePhotoOptIn = async (checked: boolean) => {
    setPhotoOptIn(checked);
    setFlag("photoOptIn", String(checked));
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase
        .from("user_preferences")
        .update({ photo_storage_opt_in: checked })
        .eq("user_id", session.user.id);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to export data.");
        return;
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/export-data`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (!response.ok) throw new Error("Export failed");
      const result = await response.json();
      if (result.download_url) {
        window.open(result.download_url, "_blank");
        toast.success("Export ready! Download should start shortly.");
      }
    } catch {
      toast.error("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to delete your account.");
        return;
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
      });
      if (!response.ok) throw new Error("Delete failed");
      localStorage.clear();
      navigate("/onboarding", { replace: true });
      toast.success("Account deleted successfully.");
    } catch {
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
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
                onBlur={handleSaveProfile}
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
                onBlur={handleSaveProfile}
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
                onBlur={handleSaveProfile}
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
              saveStoredProfile(updated);
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
                  onBlur={handleSaveProfile}
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

      {/* Photo Storage */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="px-6 mb-4"
      >
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="w-4 h-4 text-primary" />
              <div>
                <p className="font-body font-medium text-foreground text-sm">Save Meal Photos</p>
                <p className="text-[11px] text-muted-foreground font-body">
                  {photoOptIn ? "On — photos kept to improve accuracy" : "Off — photos deleted after 24h"}
                </p>
              </div>
            </div>
            <Switch
              checked={photoOptIn}
              onCheckedChange={handleTogglePhotoOptIn}
              aria-label="Toggle photo storage"
            />
          </div>
          {photoOptIn ? (
            <div className="bg-primary/5 rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-primary/80 font-body leading-relaxed">
                Your meal photos help us improve nutrition recognition for everyone. Photos are stored securely and never shared publicly. You can turn this off anytime.
              </p>
            </div>
          ) : (
            <div className="bg-secondary rounded-xl px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground font-body leading-relaxed">
                Photos are deleted after analysis. Turning this on helps improve accuracy for you and other users.
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Account Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="px-6 mb-4 space-y-2"
      >
        <button
          onClick={handleExportData}
          disabled={isExporting}
          className="w-full bg-card rounded-2xl border border-border p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            {isExporting ? (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="font-body text-sm text-foreground">Export My Data</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

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

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full bg-card rounded-2xl border border-destructive/30 p-4 flex items-center justify-between hover:bg-destructive/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-4 h-4 text-destructive" />
              <span className="font-body text-sm text-destructive">Delete Account</span>
            </div>
            <ChevronRight className="w-4 h-4 text-destructive/50" />
          </button>
        ) : (
          <div className="bg-card rounded-2xl border border-destructive/30 p-5 space-y-3">
            <p className="font-body text-sm text-foreground font-medium">
              Are you sure? This cannot be undone.
            </p>
            <p className="text-[11px] text-muted-foreground font-body">
              All your meals, templates, profile data, and photos will be permanently deleted.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 rounded-xl"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                Delete Everything
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
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
