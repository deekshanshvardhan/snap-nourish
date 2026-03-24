import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Smartphone, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";

type Step = "intro" | "auth" | "camera-permission";

const Onboarding = () => {
  const [step, setStep] = useState<Step>("intro");
  const navigate = useNavigate();

  const handleAuth = (provider: string) => {
    localStorage.setItem("auth-provider", provider);
    localStorage.setItem("auth-user", JSON.stringify({ provider, name: "User", loggedIn: true }));
    setStep("camera-permission");
  };

  const handleCameraPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
    } catch {
      // Permission denied or unavailable — continue anyway
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

  return (
    <div className="flex flex-col min-h-screen bg-background max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {step === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-8">
              <Camera className="w-9 h-9 text-primary" />
            </div>
            <h1 className="font-display text-4xl text-foreground mb-3 leading-tight">
              Track your nutrition<br />in seconds
            </h1>
            <p className="text-muted-foreground font-body text-lg mb-12">
              Just snap your meals
            </p>
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
            className="flex-1 flex flex-col items-center justify-center px-8"
          >
            <h2 className="font-display text-3xl text-foreground mb-2">Sign in</h2>
            <p className="text-muted-foreground font-body text-sm mb-10">
              Create your account to save your data
            </p>

            <div className="w-full space-y-3">
              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl text-base font-body gap-3 border-border"
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

              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl text-base font-body gap-3 border-border"
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
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-8">
              <Smartphone className="w-9 h-9 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-foreground mb-3">
              Camera access
            </h2>
            <p className="text-muted-foreground font-body text-sm mb-10 max-w-xs">
              We need camera access to log your meals
            </p>
            <Button
              onClick={handleCameraPermission}
              className="w-full h-14 text-lg rounded-2xl mb-3"
              size="lg"
            >
              Allow Camera
            </Button>
            <button
              onClick={handleSkipCamera}
              className="text-muted-foreground text-sm font-body"
            >
              Skip for now
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
