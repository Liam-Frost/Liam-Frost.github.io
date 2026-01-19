import { useEffect, useRef, useState } from "react";

const THEME_ATTR = "data-theme";
const PREFERS_LIGHT_MQ = "(prefers-color-scheme: light)";

import { useQuality } from "../perf/useQuality";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function BackgroundFX() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { config, reducedMotion, tier } = useQuality();

  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    const onThemeChange = () => setThemeTick((v) => v + 1);

    const obs = new MutationObserver(onThemeChange);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: [THEME_ATTR] });

    const mq = window.matchMedia?.(PREFERS_LIGHT_MQ);
    mq?.addEventListener?.("change", onThemeChange);

    return () => {
      obs.disconnect();
      mq?.removeEventListener?.("change", onThemeChange);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const supportsHover = window.matchMedia?.("(hover: hover)")?.matches ?? false;
    const finePointer = window.matchMedia?.("(pointer: fine)")?.matches ?? false;

    const prefersLight = window.matchMedia?.(PREFERS_LIGHT_MQ)?.matches ?? false;
    const themeAttr = document.documentElement.getAttribute(THEME_ATTR);
    const isEffectiveDark = themeAttr === "dark" || (themeAttr === "system" && !prefersLight);

    const setVars = (xPercent: number, yPercent: number) => {
      const x = clamp(xPercent, 0, 100);
      const y = clamp(yPercent, 0, 100);

      const tx = (x - 50) * 0.1;
      const ty = (y - 50) * 0.1;

      el.style.setProperty("--mxp", `${x.toFixed(2)}%`);
      el.style.setProperty("--myp", `${y.toFixed(2)}%`);
      el.style.setProperty("--tx", `${tx.toFixed(2)}px`);
      el.style.setProperty("--ty", `${ty.toFixed(2)}px`);
    };

    setVars(50, 35);

    // Light mode: disable this background motion (you said you'll replace with a different animation later)
    if (!isEffectiveDark) return;

    // Only allow motion when theme is effectively dark.
    // White/Day mode stays still by design.

    // Hard rules:
    // - data-theme="light": always off
    // - data-theme="system" + OS not light: on (subject to perf/debug gates)
    // - data-theme="dark": on at tier2/3 (subject to perf/debug gates)
    if (!isEffectiveDark) return;

    // Respect debug/perf config gates.
    if (!config.enableDecorativeAnimations) return;
    if (tier <= 1) return;
    if (reducedMotion || !supportsHover || !finePointer) return;

    let raf = 0;
    let frame = 0;

    let targetX = 50;
    let targetY = 35;
    let currentX = 50;
    let currentY = 35;

    let lastWorkTs = 0;

    const onMove = (e: PointerEvent) => {
      if (window.innerWidth <= 0 || window.innerHeight <= 0) return;
      targetX = (e.clientX / window.innerWidth) * 100;
      targetY = (e.clientY / window.innerHeight) * 100;
    };

    const onBlur = () => {
      targetX = 50;
      targetY = 35;
    };

    const tick = (now: number) => {
      frame++;

      // fpsCap is a *work* cap, not an rAF cap.
      // fpsCap=0 means "do not do heavy updates".
      const minWorkIntervalMs = config.fpsCap > 0 ? 1000 / config.fpsCap : Infinity;
      const canDoWork = now - lastWorkTs >= minWorkIntervalMs;
      const frameGate = frame % Math.max(1, config.updateEveryNFrames) === 0;

      if (canDoWork && frameGate) {
        lastWorkTs = now;

        // Exponential smoothing (a.k.a. low-pass filter)
        currentX += (targetX - currentX) * 0.12;
        currentY += (targetY - currentY) * 0.12;

        // Subtle idle drift, even if the mouse stays still.
        const amp = 1.0 * config.decorativeMultiplier;
        const driftX = Math.sin(now / 2600) * 19.6 * amp;
        const driftY = Math.cos(now / 3100) * 29.4 * amp;

        setVars(currentX + driftX, currentY + driftY);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("blur", onBlur);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("blur", onBlur);
    };
  }, [config.decorativeMultiplier, config.enableDecorativeAnimations, config.fpsCap, config.updateEveryNFrames, reducedMotion, tier, themeTick]);

  return <div ref={ref} className="bgFx" aria-hidden="true" />;
}
