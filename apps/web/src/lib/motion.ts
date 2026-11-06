/**
 * Stage 26: the tech stack's categories and technologies rise in one by one as the page scrolls, go
 * back one by one when scrolling up, and the section fades out as it leaves (components/
 * useStackScrub.ts: GSAP ScrollTrigger, ported from the reference site's code).
 *
 * Turn it off by setting this to false: the stack goes back to the one-time reveal used by the rest
 * of the site. For one visit, `?stackMotion=off` (or `=on`) in the address, before the `#`,
 * overrides it, to compare both.
 */
export const STACK_SCROLL_MOTION = true;

/** Whether the stack uses its scroll motion on this visit. Reduced motion and print are handled by
 * the motion itself (everything is then shown as it is). */
export function stackScrollMotion(): boolean {
  if (typeof window === "undefined") return false;
  const override = new URLSearchParams(window.location.search).get("stackMotion");
  return override === "on" ? true : override === "off" ? false : STACK_SCROLL_MOTION;
}
