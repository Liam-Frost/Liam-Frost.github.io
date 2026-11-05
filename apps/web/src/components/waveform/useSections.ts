import { useEffect, useRef, useState } from "react";
import { type SectionGeometry } from "./model";

export function useSections(enabled: boolean, homeTitle: string) {
  const geometry = useRef<SectionGeometry[]>([]);
  const maxScroll = useRef(0);
  const [sections, setSections] = useState<SectionGeometry[]>([]);
  useEffect(() => {
    if (!enabled) {
      geometry.current = [];
      setSections([]);
      return;
    }
    const main = document.getElementById("main");
    if (!main) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = Array.from(main.querySelectorAll<HTMLElement>("section.section[id]"))
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            id: el.id,
            title:
              el.id === "top" ? homeTitle : el.querySelector("h1,h2")?.textContent?.trim() || el.id,
            summary: el.querySelector(".sectionSubtitle, .heroSubtitle")?.textContent?.trim() || "",
            top: rect.top + window.scrollY,
            bottom: rect.bottom + window.scrollY
          };
        });
      geometry.current = next;
      maxScroll.current = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      setSections((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(main);
    const mutation = new MutationObserver(schedule);
    mutation.observe(main, { childList: true, subtree: true, characterData: false });
    main.addEventListener("load", schedule, true);
    window.addEventListener("resize", schedule, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutation.disconnect();
      main.removeEventListener("load", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [enabled, homeTitle]);
  return { sections, geometry, maxScroll };
}
