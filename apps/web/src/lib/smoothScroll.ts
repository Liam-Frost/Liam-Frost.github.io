import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Smooth scrolling for the whole public site (Stage 26), as on the reference site: Lenis with
 * `lerp: 0.1`, so a wheel notch glides instead of jumping and scroll-linked motion (the tech stack)
 * moves continuously. Touch scrolling stays native (Lenis' default), and Lenis turns itself off for
 * reduced motion (`respectReducedMotion`, its default).
 *
 * Everything that scrolls the page goes through the helpers below, which fall back to native
 * scrolling when Lenis is not running: Lenis keeps its own scroll position and would otherwise glide
 * back to it.
 */
let lenis: Lenis | null = null;
let locks = 0;

export function startSmoothScroll() {
  if (lenis || typeof window === "undefined") return () => {};
  lenis = new Lenis({
    lerp: 0.1,
    autoRaf: true,
    // Drawers, lists and horizontal rows that scroll on their own keep doing so.
    allowNestedScroll: true
  });
  if (locks > 0) lenis.stop();
  return () => {
    lenis?.destroy();
    lenis = null;
  };
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

/** To the top of the page: instantly (new page), or gliding (back to top) unless motion is reduced. */
export function scrollToTop(smooth: boolean) {
  const glide = smooth && !prefersReducedMotion();
  if (lenis) {
    lenis.resize();
    lenis.scrollTo(0, { immediate: !glide, force: true });
  } else window.scrollTo({ top: 0, left: 0, behavior: glide ? "smooth" : "auto" });
}

/**
 * Where an element sits in the page, from layout (offsetTop) rather than getBoundingClientRect: a
 * section moved by an animation (the tech stack's exit rises 150px) must not move its anchor.
 */
export function layoutTop(element: HTMLElement) {
  let top = 0;
  for (let node: HTMLElement | null = element; node; node = node.offsetParent as HTMLElement | null)
    top += node.offsetTop;
  return top;
}

/** To an anchor, below the sticky header (the element's `scroll-margin-top`). */
export function scrollToElement(element: HTMLElement, immediate = false) {
  const glide = !immediate && !prefersReducedMotion();
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  const top = Math.max(0, layoutTop(element) - margin);
  if (lenis) {
    // Lenis re-measures the page on a delay; the page may just have grown (content loading above).
    lenis.resize();
    lenis.scrollTo(top, { immediate: !glide, force: true });
  } else window.scrollTo({ top, left: 0, behavior: glide ? "smooth" : "instant" });
}

/** Restore an exact history position and synchronize Lenis' internal scroll state. */
export function scrollToPosition(top: number) {
  if (lenis) {
    lenis.resize();
    lenis.scrollTo(top, { immediate: true, force: true });
  } else window.scrollTo({ top, left: 0, behavior: "instant" });
}

/** While a dialog or drawer is open the page does not scroll (nested by count). */
export function lockScroll() {
  locks++;
  lenis?.stop();
  return () => {
    locks = Math.max(0, locks - 1);
    if (locks === 0) lenis?.start();
  };
}
