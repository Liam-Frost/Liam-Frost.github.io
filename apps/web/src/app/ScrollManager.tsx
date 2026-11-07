import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";
import { scrollToElement, scrollToPosition, scrollToTop } from "../lib/smoothScroll";
import { isQueryOnlyNavigation, restoreScroll } from "./restoreScroll";
import {
  capturePosition,
  readReloadPosition,
  restoreReloadPosition,
  saveReloadPosition
} from "./reloadPosition";

const positions = new Map<string, number>();
const reloadPosition = readReloadPosition();

/** How long an anchor is followed while the page above it is still loading. */
const FOLLOW_MS = 5000;

export default function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef<{ key: string; pathname: string; hash: string } | null>(null);

  useLayoutEffect(() => {
    const key = location.key;
    const before = previous.current;
    previous.current = { key, pathname: location.pathname, hash: location.hash };
    // The next route may already have shortened the document by effect cleanup time.
    let lastScroll = window.scrollY;
    let lastPosition = capturePosition(key);
    const record = () => {
      lastScroll = window.scrollY;
    };
    const persist = () => {
      if (!document.documentElement.dataset.scrollRestoring) lastPosition = capturePosition(key);
      saveReloadPosition(lastPosition);
    };
    window.addEventListener("pagehide", persist);
    window.addEventListener("scroll", record, { passive: true });
    // Capture the final position before a click or keyboard navigation changes the DOM.
    window.addEventListener("pointerdown", record, true);
    window.addEventListener("keydown", record, true);
    const save = () => {
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("scroll", record);
      window.removeEventListener("pointerdown", record, true);
      window.removeEventListener("keydown", record, true);
      positions.delete(key);
      positions.set(key, lastScroll);
      if (positions.size > 100) positions.delete(positions.keys().next().value!);
    };
    if (reloadPosition?.key === key && (!before || before.key === key)) {
      lastPosition = reloadPosition;
      const cancel = restoreReloadPosition(reloadPosition);
      return () => {
        cancel();
        save();
      };
    }
    // Query-only changes open panels, switch filters or move through photos on the same page.
    if (isQueryOnlyNavigation(before, { key, pathname: location.pathname, hash: location.hash }))
      return save;
    // Strict Mode repeats mount effects for the same entry; do not mistake that for Back/Forward.
    const restored =
      navigationType === "POP" && before?.key !== key ? positions.get(key) : undefined;
    if (restored !== undefined) {
      const cancel = restoreScroll(restored, location.hash?.replace(/^#/, ""), {
        scrollPosition: scrollToPosition,
        scrollAnchor: (element) => scrollToElement(element, true)
      });
      return () => {
        cancel();
        save();
      };
    }
    const hash = location.hash?.replace(/^#/, "");

    if (hash) {
      let observer: MutationObserver | null = null;
      let timeout = 0;
      let stopFollowing = () => {};

      // The projects, collection and tech stack above an anchor arrive from the API after the jump
      // and push it down: keep going to it while the page grows, until the visitor scrolls themselves.
      const follow = (el: HTMLElement) => {
        const layout =
          typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(() => scrollToElement(el, true));
        layout?.observe(document.body);
        const stop = () => {
          layout?.disconnect();
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
          scrollToElement(el, !before || before.key === key);
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
        save();
      };
    }

    scrollToTop(false);
    return save;
  }, [location.pathname, location.hash, location.key, navigationType]);

  return null;
}
