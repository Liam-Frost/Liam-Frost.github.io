import { useEffect, useRef, type RefObject } from "react";
import { audioVisualization } from "../../data/audio-visualization";
import { clamp, gaussian, SEGMENTS, syntheticEnergy } from "./model";

/** One loop for pointer, scroll and audio; SVG writes only, no React render on animation frames. */
export function useWaveMotion(
  svg: RefObject<SVGSVGElement | null>,
  maxScroll: RefObject<number>,
  enabled: boolean,
  audioEnabled: boolean
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
      pointerLevel = 0,
      pointerPosition = 0,
      quietSince = 0;
    let samples = new Uint8Array(128);
    const tick = (now: number) => {
      frame = 0;
      if (document.hidden) return;
      const dt = previous ? Math.min(0.06, (now - previous) / 1000) : 0.016;
      previous = now;
      const reduced = motion.matches;
      const current = audioVisualization.get();
      const targetPointer = !reduced && pointer.current !== null ? 1 : 0;
      if (reduced) pointerLevel = 0;
      else pointerLevel += (targetPointer - pointerLevel) * Math.min(1, dt * 13);
      if (pointer.current !== null)
        pointerPosition += (pointer.current - pointerPosition) * Math.min(1, dt * 18);
      let hasSignal = false;
      if (!reduced && audioEnabled && current.playing && current.analyser) {
        if (samples.length !== current.analyser.frequencyBinCount)
          samples = new Uint8Array(current.analyser.frequencyBinCount);
        current.analyser.getByteFrequencyData(samples);
        hasSignal = samples.some((value) => value > 12);
      }
      if (hasSignal) quietSince = 0;
      else if (!quietSince) quietSince = now;
      const useSynthetic =
        current.playing && (!current.analyser || (!hasSignal && now - quietSince > 2000));
      root.dataset.audio =
        reduced || !audioEnabled || !current.playing
          ? "none"
          : useSynthetic
            ? "synthetic"
            : current.analyser
              ? "real"
              : "none";
      const progress = maxScroll.current > 0 ? clamp(window.scrollY / maxScroll.current) : 0;
      let settling = false;
      lines.forEach((line, index) => {
        const band = Math.floor(1 + (samples.length - 2) * (index / (SEGMENTS - 1)) ** 2);
        const raw =
          current.playing && audioEnabled && !reduced
            ? useSynthetic
              ? syntheticEnergy(now / 1000, index)
              : hasSignal
                ? clamp((samples[band]! - 12) / 150)
                : 0
            : 0;
        levels[index] = reduced
          ? 0
          : levels[index]! +
            (raw - levels[index]!) * Math.min(1, dt * (raw > levels[index]! ? 9 : 4));
        if (levels[index]! > 0.005) settling = true;
        const hover = gaussian(index - pointerPosition) * pointerLevel;
        const width = 12 + 44 * hover + 8 * levels[index]! * (1 - hover);
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
      if ((!reduced && ((audioEnabled && current.playing) || pointerLevel > 0.005)) || settling)
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
  }, [svg, maxScroll, enabled, audioEnabled]);
  return { pointer, wake };
}
