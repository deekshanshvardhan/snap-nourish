import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Camera, Apple, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Step = "intro" | "auth" | "camera-permission";
const STEPS: Step[] = ["intro", "auth", "camera-permission"];

const floatingEmojis = [
  { emoji: "🥑", top: "10%", left: "15%", delay: 0 },
  { emoji: "🍳", top: "20%", left: "75%", delay: 0.6 },
  { emoji: "🥗", top: "60%", left: "10%", delay: 1.2 },
  { emoji: "🍎", top: "65%", left: "80%", delay: 0.3 },
  { emoji: "🥕", top: "40%", left: "85%", delay: 0.9 },
];

const StepDots = ({ current, total }: { current: number; total: number }) => (
  <div className="flex gap-2 justify-center">
    {Array.from({ length: total }).map((_, i) => (
      <motion.div
        key={i}
        layout
        className={`h-2 rounded-full transition-all duration-300 ${
          i === current ? "w-6 bg-primary" : "w-2 bg-primary/20"
        }`}
      />
    ))}
  </div>
);

const Onboarding = () => {
  const [step, setStep] = useState<Step>("intro");
  const navigate = useNavigate();
  const currentIdx = STEPS.indexOf(step);

  const goNext = useCallback(() => {
    const nextIdx = currentIdx + 1;
    if (nextIdx < STEPS.length) setStep(STEPS[nextIdx]);
  }, [currentIdx]);

  const goPrev = useCallback(() => {
    const prevIdx = currentIdx - 1;
    if (prevIdx >= 0) setStep(STEPS[prevIdx]);
  }, [currentIdx]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -60) goNext();
    else if (info.offset.x > 60) goPrev();
  };

  const handleAuth = (provider: string) => {
    localStorage.setItem("auth-provider", provider);
    localStorage.setItem("auth-user", JSON.stringify({ provider, name: "User", loggedIn: true }));
    setStep("camera-permission");
  };

  const handleCameraPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
    } catch {
      // continue
    }
    localStorage.setItem("onboarded", "true");
    localStorage.setItem("show-first-hint", "true");
    navigate("/home", { replace: true });
  };

  const handleSkipCamera = () => {
    localStorage.setItem("onboarded", "true");
    localStorage.setItem("show-first-hint", "true");
    navigate("/home", { replace: true });
  };

  const headlineWords = "Track your nutrition in seconds".split(" ");

  return (
    <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto relative safe-top">
      {/* Swipe navigation hints */}
      {currentIdx > 0 && (
        <button
          onClick={goPrev}
          className="absolute top-1/2 left-3 z-30 p-2 rounded-full bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Previous step"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {currentIdx < STEPS.length - 1 && step !== "intro" && (
        <button
          onClick={goNext}
          className="absolute top-1/2 right-3 z-30 p-2 rounded-full bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Next step"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <AnimatePresence mode="wait">
        {step === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            {/* Animated illustration area */}
            <div className="relative w-36 h-36 mb-6">
              {floatingEmojis.map((item, i) => (
                <motion.span
                  key={i}
                  className="absolute text-2xl select-none"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{
                    opacity: [0, 0.7, 0.7, 0],
                    y: [0, -14, -14, 0],
                    scale: [0.5, 1, 1, 0.5],
                  }}
                  transition={{
                    duration: 4,
                    delay: item.delay,
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                  style={{ top: item.top, left: item.left }}
                >
                  {item.emoji}
                </motion.span>
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <Camera className="w-9 h-9 text-primary" />
                </motion.div>
              </div>
            </div>

            {/* Staggered headline */}
            <h1 className="font-display text-4xl text-foreground mb-3 leading-tight">
              {headlineWords.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
                  className="inline-block mr-[0.3em]"
                >
                  {word}
                </motion.span>
              ))}
            </h1>

            <p className="text-muted-foreground font-body text-lg mb-3">
              Just snap your meals
            </p>

            {/* Feature pill */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="inline-flex items-center gap-2 bg-primary/8 border border-primary/15 rounded-full px-4 py-1.5 mb-12"
            >
              <span className="text-xs font-body text-primary/70">AI-powered</span>
              <span className="w-1 h-1 rounded-full bg-primary/30" />
              <span className="text-xs font-body text-primary/70">No manual entry</span>
            </motion.div>

            <Button
              onClick={() => setStep("auth")}
              className="w-full h-14 text-lg rounded-2xl"
              size="lg"
            >
              Get Started
            </Button>
          </motion.div>
        )}

        {step === "auth" && (
          <motion.div
            key="auth"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className="flex-1 flex flex-col items-center justify-center px-8"
          >
            <h2 className="font-display text-3xl text-foreground mb-2">Sign in</h2>
            <p className="text-muted-foreground font-body text-sm mb-6">
              Create your account to save your data
            </p>

            {/* Social proof */}
            <div className="flex items-center justify-center mb-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-background flex items-center justify-center"
                  >
                    <span className="text-[9px] font-body font-semibold text-muted-foreground">
                      {String.fromCharCode(64 + i)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-muted-foreground/60 font-body text-xs mb-8">
              Join 10,000+ users
            </p>

            <div className="w-full space-y-3">
              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl text-base font-body gap-3 border-border hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]"
                onClick={() => handleAuth("google")}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-body">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl text-base font-body gap-3 border-border hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]"
                onClick={() => handleAuth("apple")}
              >
                <Apple className="w-5 h-5" />
                Continue with Apple
              </Button>
            </div>
          </motion.div>
        )}

        {step === "camera-permission" && (
          <motion.div
            key="camera"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            {/* Aperture animation */}
            <div className="relative w-24 h-24 mb-8">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/20"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [0.5, 1.15, 1], opacity: [0, 1, 0.7] }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                initial={{ clipPath: "circle(0% at 50% 50%)" }}
                animate={{ clipPath: "circle(42% at 50% 50%)" }}
                transition={{ duration: 1, delay: 0.3, ease: "easeInOut" }}
                style={{ backgroundColor: "hsl(var(--primary) / 0.08)" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Camera className="w-10 h-10 text-primary" />
                </motion.div>
              </div>
            </div>

            <h2 className="font-display text-3xl text-foreground mb-3">
              Camera access
            </h2>
            <p className="text-muted-foreground font-body text-sm mb-2 max-w-xs">
              Your camera lets you instantly log meals by snapping a photo — no typing needed.
            </p>
            <p className="text-muted-foreground/50 font-body text-xs mb-10 max-w-xs">
              Photos are analyzed on-device and never shared.
            </p>

            <Button
              onClick={handleCameraPermission}
              className="w-full h-14 text-lg rounded-2xl mb-4"
              size="lg"
            >
              Allow Camera
            </Button>
            <button
              onClick={handleSkipCamera}
              className="text-muted-foreground text-sm font-body py-2 px-4 hover:underline underline-offset-4 transition-all hover:text-foreground"
            >
              Skip for now
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <StepDots current={currentIdx} total={STEPS.length} />
      </div>
    </div>
  );
};

export default Onboarding;
