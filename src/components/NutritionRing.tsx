import { useId } from "react";

interface Props {
  value: number;
  max: number;
}

const NutritionRing = ({ value, max }: Props) => {
  const gradientId = useId();
  const progress = Math.min(value / max, 1);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;
  const percentage = Math.round(progress * 100);

  return (
    <div
      className="relative w-28 h-28"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      aria-label={`${percentage}% of calorie goal`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.35)" />
            <stop offset="100%" stopColor="hsl(var(--primary))" />
          </linearGradient>
        </defs>
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="hsl(var(--muted))" strokeWidth="8"
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke={`url(#${gradientId})`}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.25))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-display text-foreground leading-none">
          {percentage}%
        </span>
      </div>
    </div>
  );
};

export default NutritionRing;
