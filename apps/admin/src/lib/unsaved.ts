import { useEffect, useSyncExternalStore } from "react";

/**
 * What would be lost if the page went away. "session" work survives moving around the admin (drafts held
 * in memory) and is only lost by reloading or closing; "page" work lives in the page and is lost by
 * leaving it too.
 */
export type UnsavedScope = "session" | "page";

const sources = new Map<symbol, UnsavedScope>();
const listeners = new Set<() => void>();
let unloadAllowed = false;

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const hasUnsaved = () => sources.size > 0;
export const hasPageUnsaved = () => [...sources.values()].includes("page");
export const onUnsavedChange = subscribe;

let guardSkippedUntil = 0;
/** The page is leaving because its content is gone (deleted): there is nothing left to protect. */
export function skipNavigationGuard() {
  guardSkippedUntil = Date.now() + 1000;
}
export const navigationGuardSkipped = () => Date.now() < guardSkippedUntil;

/** The next page unload was already confirmed in the admin: the browser should not ask again. */
export function allowUnload() {
  unloadAllowed = true;
}

if (typeof window !== "undefined")
  window.addEventListener("beforeunload", (event) => {
    if (hasUnsaved() && !unloadAllowed) event.preventDefault();
  });

/** Reports this component's unsaved work while `dirty` is true. */
export function useUnsaved(dirty: boolean, scope: UnsavedScope) {
  useEffect(() => {
    if (!dirty) return;
    const source = Symbol("unsaved");
    sources.set(source, scope);
    emit();
    return () => {
      sources.delete(source);
      emit();
    };
  }, [dirty, scope]);
}

export const useHasPageUnsaved = () => useSyncExternalStore(subscribe, hasPageUnsaved);
