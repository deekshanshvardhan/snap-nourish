import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image, Type, RotateCcw, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BottomNav from "@/components/BottomNav";

interface Meal {
  id: number;
  type: string;
  timestamp: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const Home = () => {
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [flash, setFlash] = useState(false);
  const [recentMeals, setRecentMeals] = useState<Meal[]>([]);
  const [overlay, setOverlay] = useState<Meal | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadRecentMeals = () => {
    const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
    setRecentMeals(meals.slice(-5).reverse());
  };

  useEffect(() => {
    loadRecentMeals();
  }, []);

  const generateMeal = (description: string, type: string): Meal => ({
    id: Date.now(),
    type,
    timestamp: new Date().toISOString(),
    description,
    calories: Math.floor(Math.random() * 400 + 200),
    protein: Math.floor(Math.random() * 25 + 10),
    carbs: Math.floor(Math.random() * 50 + 20),
    fat: Math.floor(Math.random() * 20 + 5),
  });

  const saveMeal = (meal: Meal) => {
    const meals = JSON.parse(localStorage.getItem("meals") || "[]");
    meals.push(meal);
    localStorage.setItem("meals", JSON.stringify(meals));
    loadRecentMeals();
  };

  const showOverlay = (meal: Meal) => {
    setOverlay(meal);
    setOverlayText("");
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => {
      dismissOverlay();
    }, 3500);
  };

  const dismissOverlay = () => {
    setOverlay((prev) => {
      if (prev && overlayText.trim()) {
        // Update the meal description in storage
        const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
        const idx = meals.findIndex((m) => m.id === prev.id);
        if (idx !== -1) {
          meals[idx].description = overlayText.trim();
          localStorage.setItem("meals", JSON.stringify(meals));
          loadRecentMeals();
        }
      }
      return null;
    });
    setOverlayText("");
  };

  const handleCapture = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
    const meal = generateMeal("Photo meal", "photo");
    saveMeal(meal);
    showOverlay(meal);
  };

  const handleTextLog = () => {
    if (!textInput.trim()) return;
    const meal = generateMeal(textInput, "text");
    saveMeal(meal);
    setTextInput("");
    setShowTextInput(false);
  };

  const handleRepeat = (meal: Meal) => {
    const newMeal = { ...meal, id: Date.now(), timestamp: new Date().toISOString() };
    saveMeal(newMeal);
    showOverlay(newMeal);
  };

  return (
    <div className="flex flex-col min-h-screen bg-foreground max-w-md mx-auto relative">
      {/* Camera viewfinder area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/90 to-foreground" />

        {/* Flash effect */}
        <AnimatePresence>
          {flash && (
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-background z-50"
            />
          )}
        </AnimatePresence>

        {/* Viewfinder frame */}
        <div className="relative z-10 w-64 h-64">
          <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-primary/60 rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-primary/60 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-primary/60 rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-primary/60 rounded-br-xl" />
          <div className="flex items-center justify-center h-full">
            <p className="text-primary/40 font-body text-sm">Point at your meal</p>
          </div>
        </div>

        {/* Post-capture overlay */}
        <AnimatePresence>
          {overlay && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-x-4 bottom-4 z-30"
            >
              <div className="bg-card/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-body font-medium text-foreground">Meal Logged</span>
                </div>
                <p className="text-xs text-muted-foreground font-body mb-3">
                  Estimated: {overlay.calories} kcal · {overlay.protein}g protein
                </p>
                <Input
                  value={overlayText}
                  onChange={(e) => {
                    setOverlayText(e.target.value);
                    // Reset timer when typing
                    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
                    overlayTimerRef.current = setTimeout(dismissOverlay, 4000);
                  }}
                  placeholder="Add details (optional)"
                  className="border-0 bg-secondary/80 h-9 rounded-xl font-body text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") dismissOverlay();
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text input overlay */}
        <AnimatePresence>
          {showTextInput && !overlay && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute bottom-4 left-4 right-4 z-20"
            >
              <div className="bg-card rounded-2xl p-3 flex gap-2 items-center shadow-lg">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="e.g. 2 eggs + toast"
                  className="border-0 bg-secondary h-12 rounded-xl font-body"
                  onKeyDown={(e) => e.key === "Enter" && handleTextLog()}
                  autoFocus
                />
                <Button size="icon" className="h-12 w-12 rounded-xl shrink-0" onClick={handleTextLog}>
                  <Send className="w-5 h-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-12 w-12 rounded-xl shrink-0 text-muted-foreground"
                  onClick={() => setShowTextInput(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Camera controls */}
      <div className="bg-foreground/95 backdrop-blur-sm pb-24 pt-6 px-6 relative z-10">
        {/* Action buttons */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Type className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] text-primary/60 font-body">Add Text</span>
          </button>

          <button
            onClick={handleCapture}
            className="w-[88px] h-[88px] rounded-full border-4 border-primary flex items-center justify-center active:scale-95 transition-transform"
          >
            <div className="w-[72px] h-[72px] rounded-full bg-primary flex items-center justify-center">
              <Camera className="w-8 h-8 text-primary-foreground" />
            </div>
          </button>

          <button className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Image className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] text-primary/60 font-body">Gallery</span>
          </button>
        </div>

        {/* Recent meals */}
        {recentMeals.length > 0 && (
          <div>
            <p className="text-primary/50 text-xs font-body mb-2">Recent Meals</p>
            <div className="flex gap-2 overflow-x-auto">
              {recentMeals.map((meal) => (
                <button
                  key={meal.id}
                  onClick={() => handleRepeat(meal)}
                  className="bg-primary/10 rounded-xl px-3 py-2 flex items-center gap-2 shrink-0"
                >
                  <RotateCcw className="w-3 h-3 text-primary" />
                  <span className="text-primary text-xs font-body truncate max-w-[100px]">
                    {meal.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
