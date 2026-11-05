import { type RefObject, useLayoutEffect } from "react";

/**
 * The tech stack's scroll motion (Stage 26), modelled on a GSAP ScrollTrigger timeline:
 *
 * - Entrance: one progress for the whole stack, from its top at 80% of the viewport to its bottom at
 *   80%. Category headings and technologies take turns in document order: each rises for 0.5 of the
 *   timeline, the next starting 0.4 later, so one or two move at a time and scrolling back up hides
 *   them one by one in reverse.
 * - Exit: the whole section rises 150px and fades out while its bottom goes from 50% to 10% of the
 *   viewport (and comes back when scrolling up).
 * - Both follow the scroll with a short catch-up (0.5s for the entrance, 1s for the exit, easing
 *   out), like GSAP's `scrub`, instead of jumping with every scroll event.
 *
 * Opacity and transform are written on the elements themselves and removed once an element is fully
 * shown, so nothing is left behind (no transform: no containing block for fixed descendants).
 * Without JavaScript, with reduced motion or when printing (see globals.css) everything is shown.
 */
const ENTRANCE = { duration: 0.5, stagger: 0.4, start: 0.8, end: 0.8, distance: 40, catchUp: 0.5 };
const EXIT = { start: 0.5, end: 0.1, distance: 150, catchUp: 1 };

const ITEMS = ".stackGroupHead, .stackItems > li";
const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Writes an element's state; `null` (fully shown) removes the inline styles. */
function paint(el: HTMLElement, opacity: number | null, y: number) {
  if (opacity === null) {
    el.style.removeProperty("opacity");
    el.style.removeProperty("transform");
    return;
  }
  el.style.opacity = opacity.toFixed(3);
  el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
}

export function useStackScrub(
  listRef: RefObject<HTMLDivElement | null>,
  active: boolean,
  key: unknown
) {
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!active || !list) return;
    const section = list.closest<HTMLElement>("section") ?? list;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    let items: HTMLElement[] = [];
    let total = 1;
    let entrance = 0;
    let exit = 0;
    let frame = 0;
    let running = false;
    const shown = new Map<HTMLElement, number>();
    let exitShown = 0;

    /** Where the scroll position says the two progresses should be. */
    const targets = () => {
      const vh = window.innerHeight;
      const box = list.getBoundingClientRect();
      const outer = section.getBoundingClientRect();
      return {
        entrance: clamp(
          (vh * ENTRANCE.start - box.top) /
            Math.max(1, box.height + vh * (ENTRANCE.start - ENTRANCE.end))
        ),
        exit: clamp((vh * EXIT.start - outer.bottom) / (vh * (EXIT.start - EXIT.end)))
      };
    };

    const render = () => {
      const time = entrance * total;
      items.forEach((el, i) => {
        const t = clamp((time - ENTRANCE.stagger * i) / ENTRANCE.duration);
        if (shown.get(el) === t) return;
        shown.set(el, t);
        paint(el, t >= 1 ? null : t, (1 - t) * ENTRANCE.distance);
      });
      if (exitShown !== exit) {
        exitShown = exit;
        paint(section, exit <= 0 ? null : 1 - exit, -exit * EXIT.distance);
      }
    };

    // Catch-up like GSAP's `scrub`: whenever the target moves, ease from where the motion is to the
    // new target over exactly `catchUp` seconds (ease-out), so it always arrives.
    type Follower = { value: number; from: number; to: number; since: number };
    const entranceMotion: Follower = { value: 0, from: 0, to: 0, since: 0 };
    const exitMotion: Follower = { value: 0, from: 0, to: 0, since: 0 };
    const follow = (m: Follower, target: number, now: number, catchUp: number) => {
      if (target !== m.to) Object.assign(m, { from: m.value, to: target, since: now });
      const k = Math.min(1, (now - m.since) / (catchUp * 1000));
      m.value = k >= 1 ? m.to : m.from + (m.to - m.from) * (1 - (1 - k) ** 3);
      return m.value;
    };

    const tick = (now: number) => {
      const target = targets();
      entrance = follow(entranceMotion, target.entrance, now, ENTRANCE.catchUp);
      exit = follow(exitMotion, target.exit, now, EXIT.catchUp);
      render();
      if (entrance !== target.entrance || exit !== target.exit) frame = requestAnimationFrame(tick);
      else running = false;
    };

    const wake = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      items = [...list.querySelectorAll<HTMLElement>(ITEMS)];
      total = ENTRANCE.duration + ENTRANCE.stagger * Math.max(0, items.length - 1);
      shown.clear();
      exitShown = 0;
      // Start where the page is (a reload or an anchor jump mid-page), without catching up.
      ({ entrance, exit } = targets());
      Object.assign(entranceMotion, { value: entrance, from: entrance, to: entrance });
      Object.assign(exitMotion, { value: exit, from: exit, to: exit });
      render();
      window.addEventListener("scroll", wake, { passive: true });
      window.addEventListener("resize", wake);
      layout.observe(document.body);
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      running = false;
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
      layout.disconnect();
      for (const el of items) paint(el, null, 0);
      paint(section, null, 0);
    };

    // Content above can change height without scrolling (the hero title re-wraps, images load).
    const layout = new ResizeObserver(wake);
    const onPreference = () => (reduced?.matches ? stop() : start());

    if (!reduced?.matches) start();
    reduced?.addEventListener?.("change", onPreference);
    return () => {
      reduced?.removeEventListener?.("change", onPreference);
      stop();
    };
  }, [listRef, active, key]);
}
