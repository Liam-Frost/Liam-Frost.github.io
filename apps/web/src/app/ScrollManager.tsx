import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash?.replace(/^#/, "");

    if (hash) {
      requestAnimationFrame(() => {
        const el = document.getElementById(hash);
        if (el) {
          const prefersReduced =
            window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
          el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
        }
      });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.hash]);

  return null;
}
