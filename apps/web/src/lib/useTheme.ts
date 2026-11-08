import { useSiteSettings } from "../data/useSiteSettings";
import { useEffect, useCallback, useState } from "react";

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
  const settings = useSiteSettings();
  const [choice, setChoice] = useState<ThemeMode | null>(() => {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return isThemeMode(value) ? value : null;
    } catch {
      return null;
    }
  });
  const theme = choice ?? settings?.preferences.theme ?? readInitialTheme();
  const setTheme = useCallback((next: ThemeMode) => {
    setChoice(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const cycleTheme = useCallback(
    () => setTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system"),
    [theme, setTheme]
  );
  return { theme, setTheme, cycleTheme };
}
