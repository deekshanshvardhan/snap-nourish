import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image, Type, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BottomNav from "@/components/BottomNav";
import QuickLog from "@/components/QuickLog";
import MealOverlay from "@/components/MealOverlay";
import {
  detectTemplateCandidates,
  createTemplateFromMeal,
  saveTemplate,
  dismissTemplatePrompt,
  MealTemplate,
} from "@/lib/mealTemplates";

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

const roundApprox = (n: number, step = 10) => Math.round(n / step) * step;

const Home = () => {
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [flash, setFlash] = useState(false);
  const [overlay, setOverlay] = useState<Meal | null>(null);
  const [quickLogKey, setQuickLogKey] = useState(0);

  // Template prompt state
  const [templateCandidate, setTemplateCandidate] = useState<Meal | null>(null);
  const [templateName, setTemplateName] = useState("");

  const checkTemplates = () => {
    setTemplateCandidate(detectTemplateCandidates());
  };

  useEffect(() => {
    checkTemplates();
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
    setQuickLogKey((k) => k + 1);
    checkTemplates();
  };

  const showOverlay = (meal: Meal) => {
    setOverlay(meal);
    setOverlayText("");
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => dismissOverlay(), 3500);
  };

  const dismissOverlay = () => {
    setOverlay((prev) => {
      if (prev && overlayText.trim()) {
        const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
        const idx = meals.findIndex((m) => m.id === prev.id);
        if (idx !== -1) {
          meals[idx].description = overlayText.trim();
          localStorage.setItem("meals", JSON.stringify(meals));
          setQuickLogKey((k) => k + 1);
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

  const handleRetake = () => {
    if (overlay) {
      // Remove the last logged meal
      const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
      const idx = meals.findIndex((m) => m.id === overlay.id);
      if (idx !== -1) {
        meals.splice(idx, 1);
        localStorage.setItem("meals", JSON.stringify(meals));
      }
    }
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    setOverlay(null);
    setOverlayText("");
  };

  const handleTextLog = () => {
    if (!textInput.trim()) return;
    const meal = generateMeal(textInput, "text");
    saveMeal(meal);
    showOverlay(meal);
    setTextInput("");
    setShowTextInput(false);
  };

  const handleLogTemplate = (template: MealTemplate) => {
    const meal: Meal = {
      id: Date.now(),
      type: "template",
      timestamp: new Date().toISOString(),
      description: template.name,
      calories: template.calories,
      protein: template.protein,
      carbs: template.carbs,
      fat: template.fat,
    };
    saveMeal(meal);
    // Update template count
    template.count++;
    template.lastLogged = new Date().toISOString();
    saveTemplate(template);
    showOverlay(meal);
  };

  const handleLogFromHistory = (desc: string, cal: number, prot: number, carbs: number, fat: number) => {
    const meal: Meal = {
      id: Date.now(),
      type: "quick",
      timestamp: new Date().toISOString(),
      description: desc,
      calories: cal,
      protein: prot,
      carbs,
      fat,
    };
    saveMeal(meal);
    showOverlay(meal);
  };

  const handleSaveTemplate = () => {
    if (!templateCandidate) return;
    const name = templateName.trim() || templateCandidate.description;
    const tpl = createTemplateFromMeal(templateCandidate, name);
    saveTemplate(tpl);
    setTemplateCandidate(null);
    setTemplateName("");
    setQuickLogKey((k) => k + 1);
  };

  const handleDismissTemplate = () => {
    if (!templateCandidate) return;
    dismissTemplatePrompt(templateCandidate.description);
    setTemplateCandidate(null);
    setTemplateName("");
  };

  return (
    <div className="flex flex-col min-h-screen bg-foreground max-w-md mx-auto relative">
      {/* Camera viewfinder area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/90 to-foreground" />

        {/* Flash */}
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

        {/* Viewfinder */}
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
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-body font-medium text-foreground">Meal Detected</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleRetake}
                      className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                      title="Retake"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={dismissOverlay}
                      className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                      title="Confirm"
                    >
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-body mb-3">
                  Estimated: ~{roundApprox(overlay.calories)} kcal · {overlay.protein}g protein
                </p>
                <Input
                  value={overlayText}
                  onChange={(e) => {
                    setOverlayText(e.target.value);
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

        {/* Template save prompt */}
        <AnimatePresence>
          {templateCandidate && !overlay && !showTextInput && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-x-4 bottom-4 z-20"
            >
              <div className="bg-card/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-border">
                <p className="text-sm font-body font-medium text-foreground mb-1">
                  Save this as a meal?
                </p>
                <p className="text-xs text-muted-foreground font-body mb-3">
                  You've logged "{templateCandidate.description}" multiple times.
                </p>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={templateCandidate.description}
                  className="border-0 bg-secondary/80 h-9 rounded-xl font-body text-xs mb-3"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl text-xs"
                    onClick={handleSaveTemplate}
                  >
                    Save Meal
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl text-xs text-muted-foreground"
                    onClick={handleDismissTemplate}
                  >
                    Dismiss
                  </Button>
                </div>
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
            className="w-[92px] h-[92px] rounded-full border-4 border-primary flex items-center justify-center active:scale-95 transition-transform"
          >
            <div className="w-[76px] h-[76px] rounded-full bg-primary flex items-center justify-center">
              <Camera className="w-9 h-9 text-primary-foreground" />
            </div>
          </button>

          <button className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Image className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] text-primary/60 font-body">Gallery</span>
          </button>
        </div>

        {/* Quick Log */}
        <QuickLog
          onLogTemplate={handleLogTemplate}
          onLogMeal={handleLogFromHistory}
          refreshKey={quickLogKey}
        />
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
