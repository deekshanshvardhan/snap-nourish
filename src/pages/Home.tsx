import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image, Type, X, Send, Sparkles, Check, Loader2 } from "lucide-react";
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
import { Meal, inferMealLabel } from "@/lib/mealUtils";
import { getMeals, saveMeals, getFlag, removeFlag } from "@/lib/storage";
import { useCamera } from "@/hooks/useCamera";
import { analyzePhoto } from "@/lib/analyzePhoto";
import { analyzeText } from "@/lib/analyzeText";
import { toast } from "sonner";

const Home = () => {
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [flash, setFlash] = useState(false);
  const [overlay, setOverlay] = useState<Meal | null>(null);
  const [quickLogKey, setQuickLogKey] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [templateCandidate, setTemplateCandidate] = useState<Meal | null>(null);
  const [templateName, setTemplateName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const { videoRef, isActive: cameraActive, error: cameraError, start: startCamera, captureFrame } = useCamera();

  useEffect(() => {
    startCamera();
  }, [startCamera]);

  const checkTemplates = () => {
    setTemplateCandidate(detectTemplateCandidates());
  };

  useEffect(() => {
    checkTemplates();
    if (getFlag("showFirstHint") === "true") {
      setShowHint(true);
      removeFlag("showFirstHint");
      setTimeout(() => setShowHint(false), 4000);
    }
  }, []);

  const maybeShowPersonalization = () => {
    if (getFlag("personalizationCompleted") === "true") return;
    if (getFlag("personalizationDismissed") === "true") return;
    const meals = getMeals();
    if (meals.length >= 1) setShowPersonalization(true);
  };

  const saveMeal = (meal: Meal) => {
    const meals = getMeals();
    meals.push(meal);
    saveMeals(meals);
    setQuickLogKey((k) => k + 1);
    checkTemplates();
    setTimeout(maybeShowPersonalization, 1500);
  };

  const showOverlay = (meal: Meal) => setOverlay(meal);

  const handleOverlayConfirm = (meal: Meal, text: string) => {
    if (text.trim()) {
      const meals = getMeals();
      const idx = meals.findIndex((m) => m.id === meal.id);
      if (idx !== -1) {
        meals[idx].description = text.trim();
        saveMeals(meals);
        setQuickLogKey((k) => k + 1);
      }
    }
    setOverlay(null);
  };

  const handleCapture = async () => {
    if (isAnalyzing) return;

    setFlash(true);
    setShowHint(false);
    setTimeout(() => setFlash(false), 150);

    const frameBlob = await captureFrame();
    if (!frameBlob) {
      toast.error("Could not capture frame. Please try again.");
      return;
    }

    setIsAnalyzing(true);
    const timestamp = new Date().toISOString();
    const mealLabel = inferMealLabel(timestamp);

    try {
      const result = await analyzePhoto(frameBlob, mealLabel);
      const meal: Meal = {
        id: crypto.randomUUID(),
        type: "photo",
        timestamp,
        description: result.description,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        photoUrl: result.photoUrl,
        mealLabel,
      };
      saveMeal(meal);
      showOverlay(meal);
    } catch (err: any) {
      toast.error(err.message || "Photo analysis failed. Try typing your meal instead.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetake = (meal: Meal) => {
    const meals = getMeals();
    const idx = meals.findIndex((m) => m.id === meal.id);
    if (idx !== -1) {
      meals.splice(idx, 1);
      saveMeals(meals);
    }
    setOverlay(null);
  };

  const handleTextLog = async () => {
    if (!textInput.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    const timestamp = new Date().toISOString();
    const mealLabel = inferMealLabel(timestamp);
    const description = textInput.trim();

    setTextInput("");
    setShowTextInput(false);

    try {
      const result = await analyzeText(description, mealLabel);
      const meal: Meal = {
        id: crypto.randomUUID(),
        type: "text",
        timestamp,
        description: result.description,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        mealLabel,
      };
      saveMeal(meal);
      showOverlay(meal);
    } catch {
      const meal: Meal = {
        id: crypto.randomUUID(),
        type: "text",
        timestamp,
        description,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        mealLabel,
      };
      saveMeal(meal);
      showOverlay(meal);
      toast.error("Could not analyze nutrition. Meal saved — you can edit the values.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLogTemplate = (template: MealTemplate) => {
    const meal: Meal = {
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isAnalyzing) {
      e.target.value = "";
      return;
    }

    setIsAnalyzing(true);
    const timestamp = new Date().toISOString();
    const mealLabel = inferMealLabel(timestamp);

    try {
      const result = await analyzePhoto(file, mealLabel);
      const meal: Meal = {
        id: crypto.randomUUID(),
        type: "photo",
        timestamp,
        description: result.description,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        photoUrl: result.photoUrl,
        mealLabel,
      };
      saveMeal(meal);
      showOverlay(meal);
    } catch (err: any) {
      toast.error(err.message || "Photo analysis failed. Try typing your meal instead.");
    } finally {
      setIsAnalyzing(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-foreground max-w-md mx-auto relative overflow-hidden">
      {/* Full-screen camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      {/* Fallback gradient when camera is not active */}
      {!cameraActive && (
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/90 to-foreground z-0" />
      )}

      {/* Camera viewfinder area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">

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

        {/* Analysis loading overlay */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-foreground/60 backdrop-blur-sm z-40 flex flex-col items-center justify-center gap-3"
            >
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-primary/80 font-body text-sm">Analyzing your meal...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Viewfinder */}
        <div className="relative z-10 w-64 h-64 animate-breathe">
          {/* Corner brackets */}
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
              {cameraError ? (
                <motion.p
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-primary/70 font-body text-sm text-center px-4"
                >
                  {cameraError}. Use text or gallery instead.
                </motion.p>
              ) : showHint ? (
                <motion.p
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-primary/70 font-body text-sm text-center px-4"
                >
                  Point at your meal to log it
                </motion.p>
              ) : !cameraActive ? (
                <p className="text-primary/40 font-body text-sm">Point at your meal</p>
              ) : null}
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
                    <Button
                      size="icon"
                      className="h-12 w-12 rounded-xl shrink-0"
                      onClick={handleTextLog}
                      disabled={isAnalyzing}
                      aria-label="Send"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
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

      </div>

      {/* Camera controls */}
      <div className="pb-28 pt-6 px-6 relative z-10">
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
            disabled={isAnalyzing}
            className="relative w-[92px] h-[92px] rounded-full border-4 border-primary flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
            aria-label="Capture photo"
          >
            <span className="absolute inset-[-4px] rounded-full border-2 border-primary/30 animate-ring-pulse" />
            <div className="w-[76px] h-[76px] rounded-full bg-primary flex items-center justify-center">
              {isAnalyzing ? (
                <Loader2 className="w-9 h-9 text-primary-foreground animate-spin" />
              ) : (
                <Camera className="w-9 h-9 text-primary-foreground" />
              )}
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
