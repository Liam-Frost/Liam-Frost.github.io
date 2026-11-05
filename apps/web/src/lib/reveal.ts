/**
 * One IntersectionObserver for every <Reveal>. An element is revealed once, when its top passes a
 * line 8% above the viewport's bottom (threshold 0, so an element of any height qualifies). The
 * observed area reaches far above the viewport, so an element already above it counts too: after an
 * anchor jump, a restored scroll, or a fast smooth scroll that carries it from below the viewport to
 * above it between two frames (it never "intersects" the viewport itself, so a viewport-sized area
 * would never report it). Scrolling back up never meets hidden content.
 *
 * Elements that asked to be staggered and are revealed together get their order on screen (top to
 * bottom, then left to right), which the CSS turns into a delay; see `--reveal-order`.
 *
 * Content is only hidden while `html.revealReady` is set. It is set here, before the first render,
 * when an observer can run, and removed again if creating it fails, so content never stays hidden.
 */
type Waiting = { onVisible: (order: number) => void; stagger: boolean };

const ROOT_MARGIN = "1000000px 0px -8% 0px";
const READY_CLASS = "revealReady";

const waiting = new WeakMap<Element, Waiting>();
let observer: IntersectionObserver | null = null;
let failed = false;

const supported = typeof window !== "undefined" && "IntersectionObserver" in window;
if (supported) document.documentElement.classList.add(READY_CLASS);

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function reveal(entries: IntersectionObserverEntry[]) {
  const due = entries.filter(
    (entry) => entry.isIntersecting || entry.boundingClientRect.bottom <= 0
  );
  const staggered = due
    .filter((entry) => waiting.get(entry.target)?.stagger)
    .sort(
      (a, b) =>
        a.boundingClientRect.top - b.boundingClientRect.top ||
        a.boundingClientRect.left - b.boundingClientRect.left
    );
  for (const entry of due) {
    const item = waiting.get(entry.target);
    if (!item) continue;
    waiting.delete(entry.target);
    observer?.unobserve(entry.target);
    item.onVisible(item.stagger ? staggered.indexOf(entry) : 0);
  }
}

function getObserver() {
  if (observer || failed || !supported) return observer;
  try {
    observer = new IntersectionObserver(reveal, { rootMargin: ROOT_MARGIN, threshold: 0 });
  } catch {
    failed = true;
    document.documentElement.classList.remove(READY_CLASS);
  }
  return observer;
}

export function observeReveal(
  element: Element,
  onVisible: (order: number) => void,
  { stagger = false }: { stagger?: boolean } = {}
) {
  const io = prefersReducedMotion() ? null : getObserver();
  if (!io) {
    onVisible(0);
    return () => {};
  }

  waiting.set(element, { onVisible, stagger });
  try {
    io.observe(element);
  } catch {
    waiting.delete(element);
    onVisible(0);
    return () => {};
  }

  return () => {
    waiting.delete(element);
    io.unobserve(element);
  };
}
