/// <reference lib="dom" />
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readReloadPosition,
  restoreReloadPosition,
  saveReloadPosition
} from "../../web/src/app/reloadPosition";
import { scrollToPosition } from "../../web/src/lib/smoothScroll";
import { isLayoutPending } from "../../web/src/app/layoutPending";

vi.mock("../../web/src/lib/smoothScroll", () => ({
  layoutTop: (el: HTMLElement) => el.offsetTop,
  scrollToPosition: vi.fn()
}));
vi.mock("../../web/src/app/layoutPending", () => ({ isLayoutPending: vi.fn(() => false) }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const saved = {
  url: "https://example.com/#/",
  key: "entry",
  y: 2400,
  section: "skills",
  offset: 100
};
function environment() {
  vi.useFakeTimers();
  vi.stubGlobal("performance", {
    now: () => Date.now(),
    getEntriesByType: () => [{ type: "reload" }]
  });
  const browser = Object.assign(new EventTarget(), {
    location: { href: saved.url },
    scrollY: 0,
    setTimeout
  });
  vi.stubGlobal("window", browser);
  const section = { offsetTop: 3000, offsetHeight: 800 };
  const root = { dataset: {} as Record<string, string> };
  vi.stubGlobal("document", { documentElement: root, getElementById: () => section });
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => setTimeout(fn, 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  let stored: string | null = null;
  vi.stubGlobal("sessionStorage", {
    getItem: () => stored,
    setItem: (_key: string, value: string) => {
      stored = value;
    }
  });
  vi.mocked(isLayoutPending).mockReturnValue(false);
  return { browser, section, root };
}

describe("reload section restoration", () => {
  it("uses section-relative position after content above has changed", () => {
    const { section, root } = environment();
    vi.mocked(isLayoutPending).mockReturnValue(true);
    restoreReloadPosition(saved);
    vi.advanceTimersByTime(1000);
    expect(root.dataset.scrollRestoring).toBe("true");
    section.offsetTop = 3500;
    vi.mocked(isLayoutPending).mockReturnValue(false);
    vi.advanceTimersByTime(400);
    expect(scrollToPosition).toHaveBeenLastCalledWith(3600);
    expect(root.dataset.scrollRestoring).toBeUndefined();
  });
  it("falls back to section start when the old offset no longer fits", () => {
    const { section } = environment();
    section.offsetHeight = 50;
    restoreReloadPosition(saved);
    vi.advanceTimersByTime(400);
    expect(scrollToPosition).toHaveBeenLastCalledWith(3000);
  });
  it("always reveals the page when an API stalls", () => {
    const { root } = environment();
    vi.mocked(isLayoutPending).mockReturnValue(true);
    restoreReloadPosition(saved);
    vi.advanceTimersByTime(5000);
    expect(root.dataset.scrollRestoring).toBeUndefined();
  });
  it.each(["wheel", "touchstart", "pointerdown", "keydown"])(
    "hands control back on %s",
    (event) => {
      const { root, browser } = environment();
      restoreReloadPosition(saved);
      browser.dispatchEvent(new Event(event));
      vi.mocked(scrollToPosition).mockClear();
      vi.advanceTimersByTime(6000);
      expect(scrollToPosition).not.toHaveBeenCalled();
      expect(root.dataset.scrollRestoring).toBeUndefined();
    }
  );
  it("only reads the saved location on reload of the same URL", () => {
    const { browser } = environment();
    saveReloadPosition(saved);
    expect(readReloadPosition()).toEqual(saved);
    browser.location.href = "https://example.com/#/projects";
    expect(readReloadPosition()).toBeNull();
    browser.location.href = saved.url;
    vi.stubGlobal("performance", { getEntriesByType: () => [{ type: "navigate" }] });
    expect(readReloadPosition()).toBeNull();
  });
  it("tolerates unavailable storage and malformed records", () => {
    environment();
    sessionStorage.setItem("", "{broken");
    expect(readReloadPosition()).toBeNull();
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      }
    });
    expect(() => saveReloadPosition(saved)).not.toThrow();
    expect(readReloadPosition()).toBeNull();
  });
});
