import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalClickSound } from "./hooks/useSoundEffects";

// Initialize global click sounds for buttons
initGlobalClickSound();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
