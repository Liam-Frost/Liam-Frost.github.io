import { useEffect } from "react";
import { useLocation } from "react-router";

export default function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash?.replace(/^#/, "");

    if (hash) {
      let observer: MutationObserver | null = null;
      let timeout = 0;
      const scroll = () => {
        const el = document.getElementById(hash);
        if (el) {
          const prefersReduced =
            window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
          el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
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
      };
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.hash]);

  return null;
}
