import { useEffect, useRef, type RefObject } from "react";
import { audioVisualization } from "../../data/audio-visualization";
import {
  clamp,
  gaussian,
  HOVER_PEAK,
  LINE_START,
  PLAYING_AMPLITUDE,
  REST_LENGTH,
  SEGMENTS,
  syntheticEnergy
} from "./model";

/**
 * One loop for pointer, scroll and music; SVG writes only, no React render on animation frames. While
 * music plays the lines move with a simulated signal (the audio itself is never read) and settle back
 * when it stops.
 */
export function useWaveMotion(
  svg: RefObject<SVGSVGElement | null>,
  maxScroll: RefObject<number>,
  enabled: boolean,
  audioEnabled: boolean,
  fpsCap: number
) {
  const pointer = useRef<number | null>(null);
  const wake = useRef(() => {});
  useEffect(() => {
    const root = svg.current;
    if (!root || !enabled) return;
    const lines = Array.from(root.querySelectorAll<SVGLineElement>("line"));
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const levels = new Float32Array(SEGMENTS);
    let frame = 0,
      previous = 0,
      lastDraw = 0,
      pointerLevel = 0,
      pointerPosition = 0;
    const tick = (now: number) => {
      frame = 0;
      if (document.hidden) return;
      if (pointer.current === null && now - lastDraw < 1000 / fpsCap) {
        frame = requestAnimationFrame(tick);
        return;
      }
      lastDraw = now;
      const dt = previous ? Math.min(0.06, (now - previous) / 1000) : 0.016;
      previous = now;
      const reduced = motion.matches;
      const current = audioVisualization.get();
      const targetPointer = !reduced && pointer.current !== null ? 1 : 0;
      if (reduced) pointerLevel = 0;
      else pointerLevel += (targetPointer - pointerLevel) * Math.min(1, dt * 13);
      if (pointer.current !== null)
        pointerPosition += (pointer.current - pointerPosition) * Math.min(1, dt * 18);
      const playing = !reduced && audioEnabled && current.playing;
      root.dataset.audio = playing ? "synthetic" : "none";
      const progress = maxScroll.current > 0 ? clamp(window.scrollY / maxScroll.current) : 0;
      let settling = false;
      lines.forEach((line, index) => {
        const raw = playing ? syntheticEnergy(now / 1000, index) : 0;
        levels[index] = reduced
          ? 0
          : levels[index]! +
            (raw - levels[index]!) * Math.min(1, dt * (raw > levels[index]! ? 9 : 4));
        if (levels[index]! > 0.005) settling = true;
        const hover = gaussian(index - pointerPosition) * pointerLevel;
        const width =
          LINE_START +
          REST_LENGTH +
          HOVER_PEAK * hover +
          PLAYING_AMPLITUDE * levels[index]! * (1 - hover);
        line.setAttribute("x2", String(width));
        line.setAttribute(
          "class",
          index === Math.round(progress * (SEGMENTS - 1))
            ? "current"
            : index < progress * (SEGMENTS - 1)
              ? "passed"
              : ""
        );
      });
      if (playing || (!reduced && pointerLevel > 0.005) || settling)
        frame = requestAnimationFrame(tick);
      else previous = 0;
    };
    const start = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
    };
    wake.current = start;
    const unsubscribe = audioVisualization.subscribe(start);
    window.addEventListener("scroll", start, { passive: true });
    document.addEventListener("visibilitychange", start);
    motion.addEventListener("change", start);
    start();
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      window.removeEventListener("scroll", start);
      document.removeEventListener("visibilitychange", start);
      motion.removeEventListener("change", start);
      wake.current = () => {};
    };
  }, [svg, maxScroll, enabled, audioEnabled, fpsCap]);
  return { pointer, wake };
}
