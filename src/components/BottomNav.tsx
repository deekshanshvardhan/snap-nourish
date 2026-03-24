import { Camera, BarChart3, FileText, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const items = [
  { path: "/home", icon: Camera, label: "Camera" },
  { path: "/insights", icon: BarChart3, label: "Insights" },
  { path: "/reports", icon: FileText, label: "Reports" },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/95 backdrop-blur-lg border-t border-border px-6 py-2 z-50 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex justify-around">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              whileTap={{ scale: 0.9 }}
              className="relative flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors"
              aria-label={`Navigate to ${item.label}`}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <item.icon
                className={`w-5 h-5 relative z-10 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-xs font-body font-medium relative z-10 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
              {active && (
                <motion.div
                  layoutId="nav-dot"
                  className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
