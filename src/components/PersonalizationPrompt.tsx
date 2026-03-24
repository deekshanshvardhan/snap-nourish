import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  onDismiss: () => void;
  onSave: () => void;
}

const PersonalizationPrompt = ({ onDismiss, onSave }: Props) => {
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [goal, setGoal] = useState("");

  const handleSave = () => {
    const profile: Record<string, string> = {};
    if (height) profile.height = height;
    if (weight) profile.weight = weight;
    if (age) profile.age = age;
    if (goal) profile.goal = goal;
    localStorage.setItem("nutrition-profile", JSON.stringify(profile));
    localStorage.setItem("personalization-completed", "true");
    onSave();
  };

  const handleSkip = () => {
    localStorage.setItem("personalization-dismissed", "true");
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
    >
      <div className="absolute inset-0 bg-foreground/40" onClick={handleSkip} />
      <div className="relative w-full max-w-md bg-card rounded-t-3xl p-6 pb-10 shadow-xl">
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-muted-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className="font-display text-xl text-foreground">
            Get more accurate insights
          </h3>
        </div>
        <p className="text-muted-foreground text-sm font-body mb-6">
          Help us personalize your nutrition tracking.
        </p>

        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-body text-muted-foreground">Height (cm)</Label>
              <Input
                type="number"
                placeholder="170"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="h-11 rounded-xl bg-secondary border-0 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-body text-muted-foreground">Weight (kg)</Label>
              <Input
                type="number"
                placeholder="70"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="h-11 rounded-xl bg-secondary border-0 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-body text-muted-foreground">Age</Label>
              <Input
                type="number"
                placeholder="25"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="h-11 rounded-xl bg-secondary border-0 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-body text-muted-foreground">Goal (optional)</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger className="h-11 rounded-xl bg-secondary border-0 text-sm">
                <SelectValue placeholder="Select a goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lose">Lose weight</SelectItem>
                <SelectItem value="maintain">Maintain weight</SelectItem>
                <SelectItem value="gain">Gain weight</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            className="flex-1 h-12 rounded-xl text-base"
          >
            Improve my insights
          </Button>
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="h-12 rounded-xl text-sm text-muted-foreground"
          >
            Skip
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default PersonalizationPrompt;
