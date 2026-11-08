import { useEffect, useRef, useState } from "react";

/** Below this the bar is always expanded. */
const TOP_ZONE = 140;
/** Distance travelled in one direction before the bar changes; up reacts sooner than down. */
const COLLAPSE_AFTER = 64;
const EXPAND_AFTER = 28;

/**
 * Scroll Adaptive: true after scrolling down past the threshold, false after scrolling up. Each
 * direction change restarts the distance, so a small jitter in either direction changes nothing.
 */
export function useScrollAdaptive(enabled: boolean, routeKey: string) {
  const [collapsed, setCollapsed] = useState(false);
  const state = useRef({ last: 0, anchor: 0, direction: 0 });

  useEffect(() => {
    setCollapsed(false);
    if (!enabled) return;
    state.current = { last: window.scrollY, anchor: window.scrollY, direction: 0 };
    const onScroll = () => {
      const current = state.current;
      const y = window.scrollY;
      const delta = y - current.last;
      current.last = y;
      if (y < TOP_ZONE) {
        current.anchor = y;
        setCollapsed(false);
        return;
      }
      if (!delta) return;
      const direction = Math.sign(delta);
      if (direction !== current.direction) {
        current.direction = direction;
        current.anchor = y - delta;
      }
      const travelled = Math.abs(y - current.anchor);
      if (direction > 0 && travelled >= COLLAPSE_AFTER) setCollapsed(true);
      else if (direction < 0 && travelled >= EXPAND_AFTER) setCollapsed(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled, routeKey]);

  return collapsed;
}
