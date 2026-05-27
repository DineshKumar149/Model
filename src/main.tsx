import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Inject React globally to fix "React is not defined" in older third-party libraries (like Filerobot dependencies)
(window as any).React = React;

createRoot(document.getElementById("root")!).render(<App />);
