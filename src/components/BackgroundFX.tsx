import { useEffect, useRef } from "react";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function BackgroundFX() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
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

    if (prefersReduced || !supportsHover || !finePointer) return;

    let raf = 0;
    let targetX = 50;
    let targetY = 35;
    let currentX = 50;
    let currentY = 35;

    const onMove = (e: PointerEvent) => {
      if (window.innerWidth <= 0 || window.innerHeight <= 0) return;
      targetX = (e.clientX / window.innerWidth) * 100;
      targetY = (e.clientY / window.innerHeight) * 100;
    };

    const onBlur = () => {
      targetX = 50;
      targetY = 35;
    };

    const tick = () => {
      // Exponential smoothing (a.k.a. low-pass filter)
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      // Subtle idle drift, even if the mouse stays still
      const t = performance.now();
      const driftX = Math.sin(t / 2600) * 19.6;
      const driftY = Math.cos(t / 3100) * 29.4;

      setVars(currentX + driftX, currentY + driftY);
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
  }, []);

  return <div ref={ref} className="bgFx" aria-hidden="true" />;
}
