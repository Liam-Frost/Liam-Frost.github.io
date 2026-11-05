/**
 * Stage 26, phase 2 pilot: the tech stack's categories and technologies follow the scroll (CSS
 * scroll-driven animations): they rise in as they enter the viewport and go back when scrolling up.
 *
 * Turn the pilot off by setting this to false: the stack goes back to the one-time reveal used by the
 * rest of the site. For one visit, `?stackMotion=off` (or `=on`) in the address, before the `#`,
 * overrides it, to compare both.
 */
export const STACK_SCROLL_MOTION = true;

/**
 * Whether the stack uses the scroll-linked pilot on this visit. Browsers without scroll-driven
 * animations keep the one-time reveal. Reduced motion and print are handled in the CSS (the stack is
 * then shown as it is).
 */
export function stackScrollMotion(): boolean {
  if (typeof window === "undefined") return false;
  const override = new URLSearchParams(window.location.search).get("stackMotion");
  const enabled = override === "on" ? true : override === "off" ? false : STACK_SCROLL_MOTION;
  return (
    enabled && typeof CSS !== "undefined" && CSS.supports?.("animation-timeline: view()") === true
  );
}
