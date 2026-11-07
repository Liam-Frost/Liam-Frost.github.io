import { useQuality } from "../perf/useQuality";
import { type RefObject, useEffect } from "react";

/**
 * The tech stack's scroll motion (Stage 26), ported from the reference site's own code
 * (github.com/Tajmirul/portfolio-2.0, app/_components/Skills.tsx, MIT) with GSAP ScrollTrigger:
 *
 * - Entrance: one ScrollTrigger timeline for the whole section, from its top at 80% of the viewport
 *   to its bottom at 80%, scrubbed with a 0.5s catch-up. Category headings and technologies come in
 *   in document order (`stagger: 0.4`, each rising 40px with `ease: "none"`), so they appear one by
 *   one as the page scrolls down and disappear one by one when scrolling up.
 * - Exit: while the section's bottom goes from 50% to 10% of the viewport, the section rises 150px
 *   and fades out (1s catch-up).
 *
 * Differences from the reference: GSAP is loaded only when the stack mounts (it is below the fold; the
 * first page load does not wait for it), reduced motion turns it off (gsap.matchMedia, also when
 * switched on while the page is open), print shows everything (globals.css), and an element's inline
 * transform and opacity are removed once it is fully shown (GSAP would leave `translate(0px, 0px)`,
 * which makes it a containing block for fixed descendants). If GSAP fails to load, the stack is shown
 * as it is.
 */
const ITEMS = ".stackGroupHead, .stackItems > li";

export function useStackScrub(
  listRef: RefObject<HTMLDivElement | null>,
  active: boolean,
  key: unknown
) {
  const { config } = useQuality();
  const enabled = active && config.enableDecorativeAnimations;
  useEffect(() => {
    const list = listRef.current;
    if (!enabled || !list) return;
    const section = list.closest<HTMLElement>("section") ?? list;
    const items = [...list.querySelectorAll<HTMLElement>(ITEMS)];
    if (!items.length) return;

    let cancelled = false;
    let cleanup = () => {};

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ default: gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const clear = (targets: gsap.TweenTarget) =>
          gsap.set(targets, { clearProps: "transform,opacity" });

        const media = gsap.matchMedia();
        media.add("(prefers-reduced-motion: no-preference)", () => {
          // GSAP leaves `translate(0px, 0px)` and `opacity: 1` on finished elements, and puts them
          // back whenever ScrollTrigger recalculates; remove them from every finished element.
          const STAGGER = 0.4;
          const DURATION = 0.5;
          // Filled in below; ScrollTrigger may refresh while they are being created.
          const timelines: { entrance?: gsap.core.Timeline; exit?: gsap.core.Timeline } = {};
          const sweep = () => {
            const { entrance, exit } = timelines;
            if (!entrance || !exit) return;
            const time = entrance.time();
            items.forEach((el, i) => {
              if (time >= i * STAGGER + DURATION - 1e-6 && el.style.transform) clear(el);
            });
            if (exit.progress() === 0 && section.style.transform) clear(section);
          };

          timelines.entrance = gsap
            .timeline({
              scrollTrigger: {
                trigger: section,
                start: "top 80%",
                end: "bottom 80%",
                scrub: 0.5,
                onRefresh: () => sweep()
              },
              onUpdate: () => sweep()
            })
            .from(items, { opacity: 0, y: 40, ease: "none", stagger: STAGGER, duration: DURATION });

          timelines.exit = gsap
            .timeline({
              scrollTrigger: {
                trigger: section,
                start: "bottom 50%",
                end: "bottom 10%",
                scrub: 1,
                onRefresh: () => sweep()
              },
              onUpdate: () => sweep()
            })
            .to(section, { y: -150, opacity: 0 });

          return () => clear([...items, section]);
        });

        // Content above changes height without a resize (the hero title re-wraps, images and the
        // collection load): keep the start and end positions in step.
        let pending = 0;
        const layout = new ResizeObserver(() => {
          window.clearTimeout(pending);
          pending = window.setTimeout(() => ScrollTrigger.refresh(), 200);
        });
        layout.observe(document.body);

        cleanup = () => {
          layout.disconnect();
          window.clearTimeout(pending);
          media.revert();
        };
      })
      .catch(() => {
        // Without GSAP the stack simply stays as it is.
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [listRef, enabled, key]);
}
