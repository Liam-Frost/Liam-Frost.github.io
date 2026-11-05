import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router";

const positions = new Map<string, number>();

export default function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const key = location.key;
    const save = () => {
      positions.delete(key);
      positions.set(key, window.scrollY);
      if (positions.size > 100) positions.delete(positions.keys().next().value!);
    };
    const restored = navigationType === "POP" ? positions.get(key) : undefined;
    if (restored !== undefined) {
      window.scrollTo({ top: restored, left: 0, behavior: "instant" });
      return save;
    }
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
        save();
      };
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return save;
  }, [location.pathname, location.hash, location.key, navigationType]);

  return null;
}
