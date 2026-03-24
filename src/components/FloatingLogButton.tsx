import { Plus, Camera, Zap, Type, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const FloatingLogButton = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const hasMealsToday = useMemo(() => {
    try {
      const meals = JSON.parse(localStorage.getItem("meals") || "[]");
      const today = new Date().toDateString();
      return meals.some((m: { timestamp: string }) => new Date(m.timestamp).toDateString() === today);
    } catch {
      return false;
    }
  }, []);

  const actions = [
    { icon: Camera, label: "Photo", color: "bg-primary", textColor: "text-primary-foreground", action: () => navigate("/home"), x: 5, y: -80 },
    { icon: Zap, label: "Quick", color: "bg-accent", textColor: "text-accent-foreground", action: () => navigate("/home"), x: -55, y: -58 },
    { icon: Type, label: "Text", color: "bg-secondary-foreground", textColor: "text-secondary", action: () => navigate("/home"), x: -78, y: -5 },
  ];

  return (
    <div className="fixed bottom-20 right-4 z-40 max-w-md">
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
              onClick={() => setOpen(false)}
            />
            {actions.map((a, i) => (
              <motion.button
                key={a.label}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
                animate={{ opacity: 1, x: a.x, y: a.y, scale: 1 }}
                exit={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 22,
                  delay: i * 0.05,
                }}
                onClick={() => { setOpen(false); a.action(); }}
                className={`absolute bottom-0 right-0 z-50 flex items-center gap-2 ${a.color} rounded-full shadow-lg pl-3 pr-4 py-2.5`}
                aria-label={a.label}
              >
                <a.icon className={`w-4 h-4 ${a.textColor}`} />
                <span className={`text-sm font-body font-medium ${a.textColor}`}>{a.label}</span>
              </motion.button>
            ))}
          </>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center z-50 relative"
        aria-label={open ? "Close menu" : "Log a meal"}
      >
        {!hasMealsToday && !open && (
          <span className="absolute inset-0 rounded-full bg-primary/40 animate-ring-pulse" />
        )}
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: "spring", damping: 12, stiffness: 200 }}
        >
          {open ? (
            <X className="w-6 h-6 text-primary-foreground" />
          ) : (
            <Plus className="w-6 h-6 text-primary-foreground" />
          )}
        </motion.div>
      </motion.button>
    </div>
  );
};

export default FloatingLogButton;
