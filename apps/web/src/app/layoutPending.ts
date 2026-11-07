import { useLayoutEffect } from "react";

const pending = new Set<object>();

/** Content requests that can change the home page's section positions. */
export function useLayoutPending(loading: boolean) {
  useLayoutEffect(() => {
    if (!loading) return;
    const token = {};
    pending.add(token);
    return () => {
      pending.delete(token);
    };
  }, [loading]);
}

export function isLayoutPending() {
  return pending.size > 0 || document.fonts?.status === "loading";
}
