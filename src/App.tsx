import { Component, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import ProfileSetup from "./pages/ProfileSetup";
import Home from "./pages/Home";
import Insights from "./pages/Insights";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
          <p className="text-lg font-semibold text-foreground mb-2">Something went wrong</p>
          <p className="text-sm text-muted-foreground mb-4">{this.state.error.message}</p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = "/home"; }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm"
          >
            Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="/profile-setup" element={<ProfileSetup />} />
    <Route path="/home" element={<Home />} />
    <Route path="/insights" element={<Insights />} />
    <Route path="/reports" element={<Reports />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <ErrorBoundary>
          <Routes location={location}>
            <Route path="/" element={<Index />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/profile-setup" element={<ProfileSetup />} />
            <Route path="/home" element={<Home />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </motion.div>
    </AnimatePresence>
  );
};

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
