import { layoutTop, scrollToPosition } from "../lib/smoothScroll";
import { isLayoutPending } from "./layoutPending";

const STORAGE_KEY = "site:reload-position:v1";
type Position = { url: string; key: string; y: number; section: string; offset: number };

export function capturePosition(key: string): Position {
  const y = window.scrollY;
  const header = document.querySelector(".siteHeader")?.getBoundingClientRect().height ?? 0;
  const sections = Array.from(document.querySelectorAll<HTMLElement>("main section[id]"));
  const section = sections.filter((el) => layoutTop(el) <= y + header + 1).slice(-1)[0];
  return {
    url: window.location.href,
    key,
    y,
    section: section?.id ?? "",
    offset: section ? y - layoutTop(section) : 0
  };
}

export function saveReloadPosition(position: Position) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch {
    /* Storage may be disabled. */
  }
}

export function readReloadPosition(): Position | null {
  try {
    if (
      (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming)?.type !==
      "reload"
    )
      return null;
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Position | null;
    if (
      !saved ||
      saved.url !== window.location.href ||
      typeof saved.key !== "string" ||
      typeof saved.section !== "string" ||
      !Number.isFinite(saved.y) ||
      saved.y < 0 ||
      !Number.isFinite(saved.offset)
    )
      return null;
    return saved;
  } catch {
    return null;
  }
}

/** Resolve the same section after asynchronous content, without animating through other sections. */
export function restoreReloadPosition(saved: Position) {
  if (saved.y <= 1) {
    scrollToPosition(0);
    return () => {};
  }
  const root = document.documentElement;
  root.dataset.scrollRestoring = "true";
  let frame = 0;
  let stableSince = performance.now();
  const started = stableSince;
  let previousTarget = -1;
  let stopped = false;
  const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    clearTimeout(deadline);
    delete root.dataset.scrollRestoring;
    for (const event of events) window.removeEventListener(event, stop);
  };
  const target = () => {
    const section = saved.section ? document.getElementById(saved.section) : null;
    if (!section) return saved.y;
    const offset = saved.offset < section.offsetHeight ? saved.offset : 0;
    return Math.max(0, layoutTop(section) + offset);
  };
  const finish = () => {
    scrollToPosition(target());
    stop();
  };
  const tick = () => {
    if (stopped) return;
    const next = target();
    if (next !== previousTarget || isLayoutPending()) stableSince = performance.now();
    previousTarget = next;
    if (Math.abs(window.scrollY - next) > 1) scrollToPosition(next);
    if (performance.now() - stableSince >= 250 && performance.now() - started >= 300) return stop();
    frame = requestAnimationFrame(tick);
  };
  const deadline = window.setTimeout(finish, 5000);
  for (const event of events) window.addEventListener(event, stop, { passive: true });
  tick();
  return stop;
}
