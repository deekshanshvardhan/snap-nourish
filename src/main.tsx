import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getFlag } from "@/lib/storage";

const theme = getFlag("theme");
if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
