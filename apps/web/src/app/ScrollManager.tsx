import { useEffect } from "react";
import { useLocation } from "react-router";

import { scrollToElement, scrollToTop } from "../lib/smoothScroll";

/** How long an anchor is followed while the page above it is still loading. */
const FOLLOW_MS = 5000;

export default function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash?.replace(/^#/, "");

    if (hash) {
      let observer: MutationObserver | null = null;
      let timeout = 0;
      let stopFollowing = () => {};

      // The projects, collection and tech stack above an anchor arrive from the API after the jump
      // and push it down: keep going to it while the page grows, until the visitor scrolls themselves.
      const follow = (el: HTMLElement) => {
        const layout = new ResizeObserver(() => scrollToElement(el));
        layout.observe(document.body);
        const stop = () => {
          layout.disconnect();
          clearTimeout(limit);
          for (const type of ["wheel", "touchstart", "keydown", "pointerdown"])
            window.removeEventListener(type, stop);
        };
        const limit = window.setTimeout(stop, FOLLOW_MS);
        for (const type of ["wheel", "touchstart", "keydown", "pointerdown"])
          window.addEventListener(type, stop, { passive: true });
        stopFollowing = stop;
      };

      const scroll = () => {
        const el = document.getElementById(hash);
        if (el) {
          scrollToElement(el);
          follow(el);
          observer?.disconnect();
          clearTimeout(timeout);
          return true;
        }
        return false;
      };
      const frame = requestAnimationFrame(() => {
        if (scroll()) return;
        // Collection anchors mount after their API response; the admin's preview link must wait.
        observer = new MutationObserver(scroll);
        observer.observe(document.getElementById("root") ?? document.body, {
          childList: true,
          subtree: true
        });
        timeout = window.setTimeout(() => observer?.disconnect(), 8000);
      });
      return () => {
        cancelAnimationFrame(frame);
        observer?.disconnect();
        clearTimeout(timeout);
        stopFollowing();
      };
    }

    scrollToTop(false);
  }, [location.pathname, location.hash]);

  return null;
}
