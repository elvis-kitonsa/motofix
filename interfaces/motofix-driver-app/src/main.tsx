import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { expireIfInactive } from "@/utils/sessionTimeout";

// Apply the theme before first paint (light is the default) to avoid a dark flash.
const theme = localStorage.getItem("motofix_theme2") || "light";
document.documentElement.classList.remove("dark", "light");
document.documentElement.classList.add(theme);

// Sign out a session idle past the 15-minute window, before anything reads the token.
expireIfInactive();

createRoot(document.getElementById("root")!).render(<App />);
