import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ProfileSetup = () => {
  const navigate = useNavigate();
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState("");

  const handleSubmit = () => {
    const profile: Record<string, string> = {};
    if (age) profile.age = age;
    if (height) profile.height = height;
    if (weight) profile.weight = weight;
    if (goal) profile.goal = goal;
    if (Object.keys(profile).length > 0) {
      localStorage.setItem("nutrition-profile", JSON.stringify(profile));
    }
    localStorage.setItem("onboarded", "true");
    navigate("/home", { replace: true });
  };

  const handleSkip = () => {
    localStorage.setItem("onboarded", "true");
    navigate("/home", { replace: true });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background px-6 py-12 max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-1"
      >
        <h1 className="font-display text-3xl mb-2 text-foreground">About you</h1>
        <p className="text-muted-foreground font-body mb-8">
          Help us personalize your nutrition insights. All fields are optional.
        </p>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="age" className="text-sm font-body font-medium text-foreground">Age</Label>
            <Input
              id="age"
              type="number"
              placeholder="25"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="h-14 rounded-xl text-lg bg-card"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="height" className="text-sm font-body font-medium text-foreground">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                placeholder="170"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="h-14 rounded-xl text-lg bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight" className="text-sm font-body font-medium text-foreground">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                placeholder="70"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="h-14 rounded-xl text-lg bg-card"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-body font-medium text-foreground">Goal (optional)</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger className="h-14 rounded-xl text-lg bg-card">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lose">Lose weight</SelectItem>
                <SelectItem value="maintain">Maintain weight</SelectItem>
                <SelectItem value="gain">Gain weight</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-10 space-y-3">
          <Button
            onClick={handleSubmit}
            className="w-full h-14 text-lg rounded-2xl"
            size="lg"
          >
            Continue
          </Button>
          <button
            onClick={handleSkip}
            className="w-full text-center text-muted-foreground text-sm font-body"
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileSetup;
