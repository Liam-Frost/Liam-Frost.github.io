import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";
import { isQueryOnlyNavigation, restoreScroll } from "./restoreScroll";

const positions = new Map<string, number>();

export default function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef<{ key: string; pathname: string; hash: string } | null>(null);

  useEffect(() => {
    const key = location.key;
    const before = previous.current;
    previous.current = { key, pathname: location.pathname, hash: location.hash };
    // The next route may already have shortened the document by effect cleanup time.
    let lastScroll = window.scrollY;
    const record = () => {
      lastScroll = window.scrollY;
    };
    window.addEventListener("scroll", record, { passive: true });
    // Capture the final position before a click or keyboard navigation changes the DOM.
    window.addEventListener("pointerdown", record, true);
    window.addEventListener("keydown", record, true);
    const save = () => {
      window.removeEventListener("scroll", record);
      window.removeEventListener("pointerdown", record, true);
      window.removeEventListener("keydown", record, true);
      positions.delete(key);
      positions.set(key, lastScroll);
      if (positions.size > 100) positions.delete(positions.keys().next().value!);
    };
    // Query-only changes open panels, switch filters or move through photos on the same page.
    if (isQueryOnlyNavigation(before, { key, pathname: location.pathname, hash: location.hash }))
      return save;
    // Strict Mode repeats mount effects for the same entry; do not mistake that for Back/Forward.
    const restored =
      navigationType === "POP" && before?.key !== key ? positions.get(key) : undefined;
    if (restored !== undefined) {
      const cancel = restoreScroll(restored, location.hash?.replace(/^#/, ""));
      return () => {
        cancel();
        save();
      };
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
