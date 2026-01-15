import { useEffect, useMemo, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

const THEME_KEY = "theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function readInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (isThemeMode(saved)) return saved;
  } catch {
    // ignore
  }

  const attr = document.documentElement.getAttribute("data-theme");
  if (isThemeMode(attr)) return attr;

  return "system";
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => readInitialTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const cycleTheme = useMemo(() => {
    return () => {
      setTheme((prev) => (prev === "system" ? "light" : prev === "light" ? "dark" : "system"));
    };
  }, []);

  return { theme, setTheme, cycleTheme };
}
