import { useEffect, useRef } from "react";

import { useQuality } from "../perf/useQuality";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function BackgroundFX() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { config, reducedMotion, tier } = useQuality();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const supportsHover = window.matchMedia?.("(hover: hover)")?.matches ?? false;
    const finePointer = window.matchMedia?.("(pointer: fine)")?.matches ?? false;

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

    // Reduced motion OR low tiers: keep background static.
    // Tier0 is explicitly "sample-only": no heavy updates.
    if (reducedMotion || !supportsHover || !finePointer) return;
    if (!config.enableDecorativeAnimations || tier <= 1) return;

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
  }, [config.decorativeMultiplier, config.enableDecorativeAnimations, config.fpsCap, config.updateEveryNFrames, reducedMotion, tier]);

  return <div ref={ref} className="bgFx" aria-hidden="true" />;
}
