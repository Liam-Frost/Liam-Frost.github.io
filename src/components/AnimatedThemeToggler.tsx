import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "../lib/cn";
import type { ThemeMode } from "../lib/useTheme";

type Props = {
  theme: ThemeMode;
  cycleTheme: () => void;
  className?: string;
  duration?: number;
  "aria-label"?: string;
  title?: string;
};

function resolvedIsDark(theme: ThemeMode) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  // system
  if (typeof window === "undefined") return true;
  return !window.matchMedia || !window.matchMedia("(prefers-color-scheme: light)").matches;
}

export default function AnimatedThemeToggler({ theme, cycleTheme, className, duration = 420, "aria-label": ariaLabel, title }: Props) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const isDark = useMemo(() => resolvedIsDark(theme), [theme]);

  // Local mirror so we can animate between icon states smoothly.
  const [uiDark, setUiDark] = useState(isDark);
  useEffect(() => setUiDark(isDark), [isDark]);

  const toggleTheme = useCallback(async () => {
    if (!buttonRef.current) return;

    // We keep the project’s existing 3-state cycle (system -> light -> dark)
    // but still play the view-transition animation.
    // ViewTransition is optional; fall back to instant toggle.
    const startTransition = (
      document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
    ).startViewTransition?.bind(document);

    const nextTheme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    const nextIsDark = resolvedIsDark(nextTheme);

    let didRun = false;

    const run = () => {
      didRun = true;

      // Apply theme attribute synchronously so ViewTransition can capture it.
      document.documentElement.setAttribute("data-theme", nextTheme);
      try {
        localStorage.setItem("theme", nextTheme);
      } catch {
        // ignore
      }

      flushSync(() => {
        setUiDark(nextIsDark);
        cycleTheme();
      });
    };

    if (!startTransition) {
      run();
      return;
    }

    try {
      const vt = startTransition(run);
      await vt.ready;
    } catch {
      // Some browsers expose ViewTransition but fail; avoid double-toggle.
      if (!didRun) run();
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const maxRadius = Math.hypot(
      Math.max(rect.left, window.innerWidth - rect.left),
      Math.max(rect.top, window.innerHeight - rect.top)
    );

    try {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`]
        },
        {
          duration,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)"
        }
      );
    } catch {
      // If the pseudo-element animation API isn't supported, keep the theme switch.
    }
  }, [cycleTheme, duration, theme]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggleTheme}
      className={cn("btn btnGhost", "themeToggle", className)}
      aria-label={ariaLabel ?? "Toggle theme"}
      title={title ?? "Toggle theme"}
    >
      {theme === "system" ? <Monitor size={18} /> : uiDark ? <Sun size={18} /> : <Moon size={18} />}
      <span className="srOnly">{ariaLabel ?? "Toggle theme"}</span>
    </button>
  );
}
