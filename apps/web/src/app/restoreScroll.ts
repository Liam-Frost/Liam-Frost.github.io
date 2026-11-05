export function isQueryOnlyNavigation(
  previous: { key: string; pathname: string; hash: string } | null,
  next: { key: string; pathname: string; hash: string }
) {
  return Boolean(
    previous &&
    previous.key !== next.key &&
    previous.pathname === next.pathname &&
    previous.hash === next.hash
  );
}

/** Wait for asynchronous content before restoring a saved document offset. */
export function restoreScroll(
  target: number,
  hash: string | undefined,
  options: {
    scrollPosition?: (position: number) => void;
    scrollAnchor?: (element: HTMLElement) => void;
  } = {}
) {
  const scrollPosition =
    options.scrollPosition ??
    ((position: number) => window.scrollTo({ top: position, left: 0, behavior: "instant" }));
  const scrollAnchor =
    options.scrollAnchor ??
    ((element: HTMLElement) => element.scrollIntoView({ behavior: "instant", block: "start" }));
  const root = document.getElementById("root") ?? document.body;
  const content = document.getElementById("main") ?? root;
  let frame = 0;
  let timer = 0;
  let settleTimer = 0;
  let finished = false;
  let restored = false;
  let resize: ResizeObserver | null = null;
  let mutation: MutationObserver | null = null;
  const stop = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    clearTimeout(settleTimer);
    resize?.disconnect();
    mutation?.disconnect();
    root.removeEventListener("load", schedule, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
    window.removeEventListener("pointerdown", stop);
  };
  const scroll = () => {
    frame = 0;
    const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (maximum + 1 < target) return;
    if (Math.abs(window.scrollY - target) > 1) scrollPosition(target);
    restored = true;
    // Lazy images can resize the list again after it first becomes tall enough.
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(stop, 1000);
  };
  function schedule() {
    if (!finished && !frame) frame = requestAnimationFrame(scroll);
  }
  const fallback = () => {
    if (finished) return;
    if (restored) return stop();
    const anchor = hash ? document.getElementById(hash) : null;
    if (anchor) scrollAnchor(anchor);
    else scrollPosition(target);
    stop();
  };
  mutation = new MutationObserver(schedule);
  mutation.observe(content, { childList: true, subtree: true, attributes: true });
  if (typeof ResizeObserver !== "undefined") {
    resize = new ResizeObserver(schedule);
    resize.observe(root);
    resize.observe(document.documentElement);
  }
  root.addEventListener("load", schedule, true);
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);
  window.addEventListener("pointerdown", stop);
  timer = window.setTimeout(fallback, 8000);
  schedule();
  return stop;
}
