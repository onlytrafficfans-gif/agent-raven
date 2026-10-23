"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "dark" | "light";
const themeEvent = "agent-raven-theme-change";
const subscribe = (listener: () => void) => {
  window.addEventListener(themeEvent, listener);
  return () => window.removeEventListener(themeEvent, listener);
};
const getTheme = (): Theme => document.documentElement.dataset.theme === "light" ? "light" : "dark";
const getServerTheme = (): Theme => "dark";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("agent-raven-theme", next);
    window.dispatchEvent(new Event(themeEvent));
  }

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      <Sun aria-hidden="true" />
      <span className="theme-track"><i className={theme === "light" ? "light" : ""} /></span>
      <Moon aria-hidden="true" />
      {!compact && <span className="theme-label">{theme === "dark" ? "Dark" : "Light"}</span>}
    </button>
  );
}
