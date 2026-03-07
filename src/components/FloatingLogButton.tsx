import { Plus, Camera, Zap, Type, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const FloatingLogButton = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const actions = [
    { icon: Camera, label: "Take Photo", action: () => navigate("/home") },
    { icon: Zap, label: "Quick Meal", action: () => navigate("/home") },
    { icon: Type, label: "Add Text", action: () => navigate("/home") },
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-16 right-0 z-50 space-y-2"
            >
              {actions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => { setOpen(false); a.action(); }}
                  className="flex items-center gap-3 bg-card rounded-2xl px-4 py-3 shadow-lg border border-border w-40"
                >
                  <a.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-body text-foreground">{a.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center z-50 relative"
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }}>
          {open ? <X className="w-6 h-6 text-primary-foreground" /> : <Plus className="w-6 h-6 text-primary-foreground" />}
        </motion.div>
      </motion.button>
    </div>
  );
};

export default FloatingLogButton;
