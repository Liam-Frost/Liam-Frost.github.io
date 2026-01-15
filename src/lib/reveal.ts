type RevealCallback = () => void;

let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, RevealCallback>();

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function getObserver() {
  if (observer) return observer;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = callbacks.get(entry.target);
        if (cb) cb();
        callbacks.delete(entry.target);
        observer?.unobserve(entry.target);
      }
    },
    { threshold: 0.12 }
  );

  return observer;
}

export function observeReveal(element: Element, onVisible: RevealCallback) {
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    onVisible();
    return () => {};
  }

  const io = getObserver();
  callbacks.set(element, onVisible);
  io.observe(element);

  return () => {
    callbacks.delete(element);
    io.unobserve(element);
  };
}
