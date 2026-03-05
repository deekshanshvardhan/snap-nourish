import { Camera, BarChart3, FileText } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const items = [
  { path: "/home", icon: Camera, label: "Camera" },
  { path: "/insights", icon: BarChart3, label: "Insights" },
  { path: "/reports", icon: FileText, label: "Reports" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/95 backdrop-blur-lg border-t border-border px-6 py-3 z-50">
      <div className="flex justify-around">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-body font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
