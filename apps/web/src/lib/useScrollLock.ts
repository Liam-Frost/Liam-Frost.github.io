import { useEffect } from "react";

import { lockScroll } from "./smoothScroll";

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Smooth scrolling drives the page itself; stop it too.
    const unlock = lockScroll();

    return () => {
      document.body.style.overflow = previous;
      unlock();
    };
  }, [locked]);
}
