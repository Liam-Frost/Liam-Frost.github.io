/// <reference lib="dom" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { isQueryOnlyNavigation, restoreScroll } from "../../web/src/app/restoreScroll";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function environment() {
  vi.useFakeTimers();
  const root = new EventTarget();
  const html = { scrollHeight: 600 };
  const anchor = { scrollIntoView: vi.fn() };
  const browser = new EventTarget() as EventTarget & {
    innerHeight: number;
    scrollTo: ReturnType<typeof vi.fn>;
    setTimeout: typeof setTimeout;
  };
  browser.innerHeight = 600;
  Object.defineProperty(browser, "scrollY", { value: 0, writable: true });
  browser.scrollTo = vi.fn();
  browser.setTimeout = setTimeout;
  let resizeCallback = () => {};
  let mutationCallback = () => {};
  const disconnect = vi.fn();
  class FakeResizeObserver {
    constructor(callback: () => void) {
      resizeCallback = callback;
    }
    observe() {}
    disconnect() {
      disconnect();
    }
  }
  class FakeMutationObserver {
    constructor(callback: () => void) {
      mutationCallback = callback;
    }
    observe() {}
    disconnect() {
      disconnect();
    }
  }
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", {
    documentElement: html,
    body: root,
    getElementById: (id: string) =>
      id === "root" || id === "main" ? root : id === "target" ? anchor : null
  });
  vi.stubGlobal("MutationObserver", FakeMutationObserver);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => setTimeout(callback, 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  return {
    html,
    anchor,
    browser,
    resize: () => resizeCallback(),
    mutate: () => mutationCallback(),
    disconnect
  };
}

describe("scroll history and query navigation", () => {
  it("keeps the same document in place for query-only PUSH, REPLACE and POP keys", () => {
    const previous = { key: "a", pathname: "/collection", hash: "" };
    expect(isQueryOnlyNavigation(previous, { ...previous, key: "b" })).toBe(true);
    expect(isQueryOnlyNavigation(previous, { ...previous, key: "b", hash: "#section" })).toBe(
      false
    );
    expect(isQueryOnlyNavigation(previous, { ...previous, key: "b", pathname: "/portfolio" })).toBe(
      false
    );
    expect(isQueryOnlyNavigation(null, previous)).toBe(false);
    expect(isQueryOnlyNavigation(previous, previous)).toBe(false);
  });
  it("restores the saved position only after delayed content makes it reachable", () => {
    const env = environment();
    restoreScroll(900, undefined);
    vi.advanceTimersByTime(16);
    expect(env.browser.scrollTo).not.toHaveBeenCalled();
    env.html.scrollHeight = 1800;
    env.resize();
    env.mutate();
    vi.advanceTimersByTime(16);
    expect(env.browser.scrollTo).toHaveBeenCalledExactlyOnceWith({
      top: 900,
      left: 0,
      behavior: "instant"
    });
    vi.advanceTimersByTime(1000);
    expect(env.disconnect).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(9000);
    expect(env.browser.scrollTo).toHaveBeenCalledTimes(1);
  });
  it("cancels a pending restore when the visitor starts interacting", () => {
    const env = environment();
    restoreScroll(900, undefined);
    env.browser.dispatchEvent(new Event("wheel"));
    env.html.scrollHeight = 1800;
    env.resize();
    vi.advanceTimersByTime(9000);
    expect(env.browser.scrollTo).not.toHaveBeenCalled();
  });
  it("corrects a late layout shift and then stops observing", () => {
    const env = environment();
    env.html.scrollHeight = 1800;
    restoreScroll(900, "target");
    vi.advanceTimersByTime(16);
    Object.defineProperty(env.browser, "scrollY", { value: 600, writable: true });
    env.resize();
    vi.advanceTimersByTime(16);
    expect(env.browser.scrollTo).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(env.disconnect).toHaveBeenCalledTimes(2);
    expect(env.anchor.scrollIntoView).not.toHaveBeenCalled();
  });
  it("falls back to the anchor when saved offset cannot become reachable", () => {
    const env = environment();
    restoreScroll(900, "target");
    vi.advanceTimersByTime(8000);
    expect(env.anchor.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      behavior: "instant",
      block: "start"
    });
    expect(env.browser.scrollTo).not.toHaveBeenCalled();
  });
});
