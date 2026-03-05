import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, BarChart3, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const slides = [
  {
    icon: Camera,
    title: "Log meals instantly",
    description: "Take a photo of your food. No manual tracking required.",
  },
  {
    icon: BarChart3,
    title: "Understand your nutrition",
    description: "We analyze calories and nutrients automatically.",
  },
  {
    icon: TrendingUp,
    title: "Track your patterns",
    description: "Weekly and monthly insights help you understand your diet.",
  },
];

const Onboarding = () => {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  const next = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      navigate("/profile-setup");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background px-6 py-12 justify-between max-w-md mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center text-center"
          >
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-8">
              {(() => {
                const Icon = slides[current].icon;
                return <Icon className="w-10 h-10 text-primary" />;
              })()}
            </div>
            <h1 className="text-4xl mb-4 text-foreground">{slides[current].title}</h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xs">
              {slides[current].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? "w-8 bg-primary" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>
        <Button onClick={next} className="w-full h-14 text-lg rounded-2xl" size="lg">
          {current === slides.length - 1 ? "Get Started" : "Continue"}
        </Button>
        {current < slides.length - 1 && (
          <button
            onClick={() => navigate("/profile-setup")}
            className="w-full text-center text-muted-foreground text-sm"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
