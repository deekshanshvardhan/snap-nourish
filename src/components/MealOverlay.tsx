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

const IDLE_DELAY = 2000; // 2s before ring starts
const RING_DURATION = 3000; // 3s to fill ring

interface MealOverlayProps {
  meal: Meal;
  onConfirm: (meal: Meal, text: string) => void;
  onRetake: (meal: Meal) => void;
}

const MealOverlay = ({ meal, onConfirm, onRetake }: MealOverlayProps) => {
  const [text, setText] = useState("");
  const [interactive, setInteractive] = useState(false);
  const [ringProgress, setRingProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

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
    setConfirmed(true);
    clearTimers();
    setTimeout(() => onConfirm(meal, text), 800);
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

  // Start idle timer on mount
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

  const handleManualConfirm = () => {
    doConfirm();
  };

  // Ring SVG params
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - ringProgress * circumference;

  if (confirmed) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="absolute inset-x-4 bottom-4 z-30"
      >
        <div className="bg-card/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-border flex items-center justify-center gap-2">
          <Check className="w-4 h-4 text-primary" />
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
      <div className="bg-card/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-body font-medium text-foreground">Meal Detected</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleRetake(); }}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              title="Retake"
            >
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleManualConfirm(); }}
              className="relative p-1.5 rounded-lg hover:bg-secondary transition-colors"
              title="Confirm"
            >
              {/* Ring progress indicator */}
              {!interactive && ringProgress > 0 && (
                <svg
                  className="absolute inset-0 w-full h-full -rotate-90"
                  viewBox="0 0 28 28"
                >
                  <circle
                    cx="14"
                    cy="14"
                    r={radius}
                    fill="none"
                    stroke="hsl(var(--primary) / 0.2)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="14"
                    cy="14"
                    r={radius}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                  />
                </svg>
              )}
              <Check className="w-3.5 h-3.5 text-primary relative z-10" />
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-body mb-3">
          Estimated: ~{roundApprox(meal.calories)} kcal · {meal.protein}g protein
        </p>
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            goInteractive();
          }}
          onFocus={goInteractive}
          placeholder="Add details (optional)"
          className="border-0 bg-secondary/80 h-9 rounded-xl font-body text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleManualConfirm();
          }}
        />
      </div>
    </motion.div>
  );
};

export default MealOverlay;
