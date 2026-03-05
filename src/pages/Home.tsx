import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image, Type, RotateCcw, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BottomNav from "@/components/BottomNav";
import RecentMeals from "@/components/RecentMeals";

const Home = () => {
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [flash, setFlash] = useState(false);

  const handleCapture = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
    // Simulate meal logging
    const meals = JSON.parse(localStorage.getItem("meals") || "[]");
    meals.push({
      id: Date.now(),
      type: "photo",
      timestamp: new Date().toISOString(),
      description: "Photo meal",
      calories: Math.floor(Math.random() * 400 + 200),
      protein: Math.floor(Math.random() * 25 + 10),
      carbs: Math.floor(Math.random() * 50 + 20),
      fat: Math.floor(Math.random() * 20 + 5),
    });
    localStorage.setItem("meals", JSON.stringify(meals));
  };

  const handleTextLog = () => {
    if (!textInput.trim()) return;
    const meals = JSON.parse(localStorage.getItem("meals") || "[]");
    meals.push({
      id: Date.now(),
      type: "text",
      timestamp: new Date().toISOString(),
      description: textInput,
      calories: Math.floor(Math.random() * 400 + 200),
      protein: Math.floor(Math.random() * 25 + 10),
      carbs: Math.floor(Math.random() * 50 + 20),
      fat: Math.floor(Math.random() * 20 + 5),
    });
    localStorage.setItem("meals", JSON.stringify(meals));
    setTextInput("");
    setShowTextInput(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-foreground max-w-md mx-auto relative">
      {/* Camera viewfinder area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Simulated camera background */}
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

        {/* Text input overlay */}
        <AnimatePresence>
          {showTextInput && (
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
            className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <Type className="w-5 h-5 text-primary" />
          </button>

          <button
            onClick={handleCapture}
            className="w-20 h-20 rounded-full border-4 border-primary flex items-center justify-center active:scale-95 transition-transform"
          >
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Camera className="w-7 h-7 text-primary-foreground" />
            </div>
          </button>

          <button className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Image className="w-5 h-5 text-primary" />
          </button>
        </div>

        {/* Recent meals */}
        <RecentMeals />
      </div>

      <BottomNav />
    </div>
  );
};

export default Home;
