import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image, Type, X, Send, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BottomNav from "@/components/BottomNav";
import QuickLog from "@/components/QuickLog";
import MealOverlay from "@/components/MealOverlay";
import PersonalizationPrompt from "@/components/PersonalizationPrompt";
import {
  detectTemplateCandidates,
  createTemplateFromMeal,
  saveTemplate,
  dismissTemplatePrompt,
  MealTemplate,
} from "@/lib/mealTemplates";
import { Meal, getSimulatedDescription, inferMealLabel } from "@/lib/mealUtils";

const Home = () => {
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [flash, setFlash] = useState(false);
  const [overlay, setOverlay] = useState<Meal | null>(null);
  const [quickLogKey, setQuickLogKey] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  const [templateCandidate, setTemplateCandidate] = useState<Meal | null>(null);
  const [templateName, setTemplateName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const checkTemplates = () => {
    setTemplateCandidate(detectTemplateCandidates());
  };

  useEffect(() => {
    checkTemplates();
    if (localStorage.getItem("show-first-hint") === "true") {
      setShowHint(true);
      localStorage.removeItem("show-first-hint");
      setTimeout(() => setShowHint(false), 4000);
    }
  }, []);

  const maybeShowPersonalization = () => {
    if (localStorage.getItem("personalization-completed") === "true") return;
    if (localStorage.getItem("personalization-dismissed") === "true") return;
    const meals = JSON.parse(localStorage.getItem("meals") || "[]");
    if (meals.length >= 1) setShowPersonalization(true);
  };

  const generateMeal = (description: string, type: string): Meal => {
    const timestamp = new Date().toISOString();
    return {
      id: Date.now(),
      type,
      timestamp,
      description,
      calories: Math.floor(Math.random() * 400 + 200),
      protein: Math.floor(Math.random() * 25 + 10),
      carbs: Math.floor(Math.random() * 50 + 20),
      fat: Math.floor(Math.random() * 20 + 5),
      mealLabel: inferMealLabel(timestamp),
    };
  };

  const saveMeal = (meal: Meal) => {
    const meals = JSON.parse(localStorage.getItem("meals") || "[]");
    meals.push(meal);
    localStorage.setItem("meals", JSON.stringify(meals));
    setQuickLogKey((k) => k + 1);
    checkTemplates();
    setTimeout(maybeShowPersonalization, 1500);
  };

  const showOverlay = (meal: Meal) => setOverlay(meal);

  const handleOverlayConfirm = (meal: Meal, text: string) => {
    if (text.trim()) {
      const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
      const idx = meals.findIndex((m) => m.id === meal.id);
      if (idx !== -1) {
        meals[idx].description = text.trim();
        localStorage.setItem("meals", JSON.stringify(meals));
        setQuickLogKey((k) => k + 1);
      }
    }
    setOverlay(null);
  };

  const handleCapture = () => {
    setFlash(true);
    setShowHint(false);
    setTimeout(() => setFlash(false), 150);
    const meal = generateMeal(getSimulatedDescription(), "photo");
    saveMeal(meal);
    showOverlay(meal);
  };

  const handleRetake = (meal: Meal) => {
    const meals: Meal[] = JSON.parse(localStorage.getItem("meals") || "[]");
    const idx = meals.findIndex((m) => m.id === meal.id);
    if (idx !== -1) {
      meals.splice(idx, 1);
      localStorage.setItem("meals", JSON.stringify(meals));
    }
    setOverlay(null);
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
    setTemplateSaved(true);
    setTimeout(() => {
      setTemplateCandidate(null);
      setTemplateName("");
      setTemplateSaved(false);
      setQuickLogKey((k) => k + 1);
    }, 1200);
  };

  const handleDismissTemplate = () => {
    if (!templateCandidate) return;
    dismissTemplatePrompt(templateCandidate.description);
    setTemplateCandidate(null);
    setTemplateName("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const meal = generateMeal(getSimulatedDescription(), "photo");
      saveMeal(meal);
      showOverlay(meal);
    }
    e.target.value = "";
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
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, scale: 1.03 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-background z-50"
            />
          )}
        </AnimatePresence>

        {/* Viewfinder */}
        <div className="relative z-10 w-64 h-64 animate-breathe">
          {/* Corner brackets - thicker */}
          <div className="absolute top-0 left-0 w-12 h-12 border-t-[3px] border-l-[3px] border-primary/60 rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-12 h-12 border-t-[3px] border-r-[3px] border-primary/60 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[3px] border-l-[3px] border-primary/60 rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[3px] border-r-[3px] border-primary/60 rounded-br-xl" />

          {/* Scanning line */}
          <div className="absolute inset-4 overflow-hidden">
            <div
              className="absolute left-0 right-0 h-[1px] animate-scan-line"
              style={{
                background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.5), transparent)",
              }}
            />
          </div>

          <div className="flex items-center justify-center h-full">
            <AnimatePresence>
              {showHint ? (
                <motion.p
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-primary/70 font-body text-sm text-center px-4"
                >
                  Point at your meal to log it
                </motion.p>
              ) : (
                <p className="text-primary/40 font-body text-sm">Point at your meal</p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Meal overlay */}
        <AnimatePresence>
          {overlay && (
            <MealOverlay
              meal={overlay}
              onConfirm={handleOverlayConfirm}
              onRetake={handleRetake}
            />
          )}
        </AnimatePresence>

        {/* Text input overlay */}
        <AnimatePresence>
          {showTextInput && !overlay && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-foreground/40 z-15"
              />
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="absolute bottom-4 left-4 right-4 z-20"
              >
                <div className="bg-card rounded-2xl p-3 shadow-lg">
                  <div className="flex gap-2 items-center">
                    <Input
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="e.g. 2 eggs + toast"
                      className="border-0 bg-secondary h-12 rounded-xl font-body"
                      onKeyDown={(e) => e.key === "Enter" && handleTextLog()}
                      autoFocus
                    />
                    <Button size="icon" className="h-12 w-12 rounded-xl shrink-0" onClick={handleTextLog} aria-label="Send">
                      <Send className="w-5 h-5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-12 w-12 rounded-xl shrink-0 text-muted-foreground"
                      onClick={() => setShowTextInput(false)}
                      aria-label="Close text input"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                  {!textInput && (
                    <p className="text-[11px] text-muted-foreground/40 font-body mt-2 ml-1">
                      Try: &quot;2 eggs, toast, coffee&quot;
                    </p>
                  )}
                </div>
              </motion.div>
            </>
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
              {templateSaved ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-card/95 backdrop-blur-md rounded-2xl p-5 shadow-lg border border-primary/20 flex flex-col items-center gap-2"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 12 }}
                    className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
                  >
                    <Check className="w-6 h-6 text-primary" />
                  </motion.div>
                  <p className="text-sm font-body font-medium text-foreground">Meal saved!</p>
                </motion.div>
              ) : (
                <div className="bg-card/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <p className="text-sm font-body font-medium text-foreground">
                      Save as a quick meal?
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground font-body mb-3">
                    You&apos;ve logged &quot;{templateCandidate.description}&quot; multiple times.
                  </p>
                  <Input
                    ref={templateInputRef}
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder={templateCandidate.description}
                    className="border-0 bg-secondary/80 h-9 rounded-xl font-body text-xs mb-3"
                    onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 rounded-xl text-xs" onClick={handleSaveTemplate}>
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
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gradient fade at bottom of viewfinder */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-foreground to-transparent pointer-events-none z-5" />
      </div>

      {/* Camera controls */}
      <div className="bg-foreground/95 backdrop-blur-sm pb-28 pt-6 px-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="flex flex-col items-center gap-1"
            aria-label="Add text"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Type className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] text-primary/60 font-body">Add Text</span>
          </button>

          {/* Camera button with ring pulse */}
          <button
            type="button"
            data-testid="camera-capture"
            onClick={handleCapture}
            className="relative w-[92px] h-[92px] rounded-full border-4 border-primary flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Capture photo"
          >
            <span className="absolute inset-[-4px] rounded-full border-2 border-primary/30 animate-ring-pulse" />
            <div className="w-[76px] h-[76px] rounded-full bg-primary flex items-center justify-center">
              <Camera className="w-9 h-9 text-primary-foreground" />
            </div>
          </button>

          {/* Gallery button with file input */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1"
            aria-label="Open gallery"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              <Image className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] text-primary/60 font-body">Gallery</span>
          </button>
        </div>

        <QuickLog
          onLogTemplate={handleLogTemplate}
          onLogMeal={handleLogFromHistory}
          refreshKey={quickLogKey}
        />
      </div>

      <BottomNav />

      <AnimatePresence>
        {showPersonalization && (
          <PersonalizationPrompt
            onDismiss={() => setShowPersonalization(false)}
            onSave={() => setShowPersonalization(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
