import type { MouseEvent } from "react";

export function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** A missing page has its own path, which the hash router cannot leave: load the home page. */
export function leaveMissingPage(event: MouseEvent) {
  if (["/", "/index.html"].includes(window.location.pathname) || !isPlainClick(event)) return false;
  event.preventDefault();
  window.location.assign("/");
  return true;
}
