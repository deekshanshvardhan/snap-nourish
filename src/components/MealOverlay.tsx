import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

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

const IDLE_DELAY = 2000;
const RING_DURATION = 3000;

interface MealOverlayProps {
  meal: Meal;
  onConfirm: (meal: Meal, text: string) => void;
  onRetake: (meal: Meal) => void;
}

const MacroBar = ({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) => {
  const proteinCal = protein * 4;
  const carbsCal = carbs * 4;
  const fatCal = fat * 9;
  const total = proteinCal + carbsCal + fatCal || 1;

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        <div
          className="bg-nutrition-protein transition-all duration-500"
          style={{ width: `${(proteinCal / total) * 100}%` }}
        />
        <div
          className="bg-nutrition-carbs transition-all duration-500"
          style={{ width: `${(carbsCal / total) * 100}%` }}
        />
        <div
          className="bg-nutrition-fat transition-all duration-500"
          style={{ width: `${(fatCal / total) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-body">
        <span className="text-nutrition-protein">{protein}g protein</span>
        <span className="text-nutrition-carbs">{carbs}g carbs</span>
        <span className="text-nutrition-fat">{fat}g fat</span>
      </div>
    </div>
  );
};

const MealOverlay = ({ meal, onConfirm, onRetake }: MealOverlayProps) => {
  const [text, setText] = useState("");
  const [interactive, setInteractive] = useState(false);
  const [ringProgress, setRingProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [showGreenFlash, setShowGreenFlash] = useState(false);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    ringStartRef.current = null;
  }, []);

  const doConfirm = useCallback(() => {
    setShowGreenFlash(true);
    setTimeout(() => {
      setConfirmed(true);
      clearTimers();
      setTimeout(() => onConfirm(meal, text), 800);
    }, 150);
  }, [meal, text, onConfirm, clearTimers]);

  const startRing = useCallback(() => {
    ringStartRef.current = performance.now();
    const animate = (now: number) => {
      if (!ringStartRef.current) return;
      const elapsed = now - ringStartRef.current;
      const progress = Math.min(elapsed / RING_DURATION, 1);
      setRingProgress(progress);
      if (progress >= 1) {
        doConfirm();
      } else {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
  }, [doConfirm]);

  useEffect(() => {
    idleTimerRef.current = setTimeout(() => {
      if (!interactive) startRing();
    }, IDLE_DELAY);
    return clearTimers;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goInteractive = () => {
    if (interactive) return;
    setInteractive(true);
    clearTimers();
    setRingProgress(0);
  };

  const handleRetake = () => {
    clearTimers();
    onRetake(meal);
  };

  const handleManualConfirm = () => doConfirm();

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - ringProgress * circumference;

  if (confirmed) {
    return (
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="absolute inset-x-4 bottom-4 z-30"
      >
        <div className="bg-card/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-border flex items-center justify-center gap-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Check className="w-5 h-5 text-primary" />
          </motion.div>
          <span className="text-sm font-body font-medium text-foreground">Meal logged</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute inset-x-4 bottom-4 z-30"
      onClick={goInteractive}
    >
      <div
        className={`bg-card/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border transition-colors duration-150 ${
          showGreenFlash ? "border-green-500/40 bg-green-500/5" : "border-border"
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse-dot" />
            <span className="text-sm font-body font-medium text-foreground">Meal Detected</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); handleRetake(); }}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              aria-label="Retake photo"
            >
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleManualConfirm(); }}
              className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
              aria-label="Confirm meal"
              role="progressbar"
              aria-valuenow={Math.round(ringProgress * 100)}
              aria-valuemax={100}
            >
              {!interactive && ringProgress > 0 && (
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r={radius} fill="none" stroke="hsl(var(--primary) / 0.15)" strokeWidth="2.5" />
                  <circle
                    cx="20" cy="20" r={radius} fill="none"
                    stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                  />
                </svg>
              )}
              <Check className="w-4 h-4 text-primary relative z-10" />
            </button>
          </div>
        </div>

        {meal.description && (
          <p className="text-base font-body font-medium text-foreground mb-1.5 leading-snug">
            {meal.description}
          </p>
        )}

        <p className="text-xs text-muted-foreground font-body mb-3">
          ~{roundApprox(meal.calories)} kcal estimated
        </p>

        <div className="mb-3">
          <MacroBar protein={meal.protein} carbs={meal.carbs} fat={meal.fat} />
        </div>

        <Input
          value={text}
          onChange={(e) => { setText(e.target.value); goInteractive(); }}
          onFocus={goInteractive}
          placeholder="Add details (optional)"
          className="border-0 bg-secondary/80 h-9 rounded-xl font-body text-xs"
          onKeyDown={(e) => { if (e.key === "Enter") handleManualConfirm(); }}
        />
      </div>
    </motion.div>
  );
};

export default MealOverlay;
