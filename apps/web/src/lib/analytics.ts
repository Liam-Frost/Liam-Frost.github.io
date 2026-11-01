import type { AnalyticsEventInput, AnalyticsPath } from "@liam-frost/shared";

import { apiFetchEnabled, apiUrl } from "./api";

/**
 * Visitor analytics. Nothing is stored in cookies or localStorage: the visit gets a random id in
 * sessionStorage (gone when the tab closes), and the server counts visitors with a hash that changes
 * every day. Off for browsers asking not to be tracked (GPC / Do Not Track), automated browsers, and
 * builds without the API (GitHub Pages).
 */

type Fields = Omit<AnalyticsEventInput, "id" | "type" | "sessionId" | "path"> & {
  path?: AnalyticsPath;
};

const ENDPOINT = apiUrl("/api/analytics/events");
const SESSION_KEY = "lf.analytics.session";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 3000;
const MAX_QUEUE = 20;

/** Whether this browser's visits are counted. */
export const analyticsEnabled = (() => {
  if (!apiFetchEnabled || typeof window === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return !nav.webdriver && !nav.globalPrivacyControl && nav.doNotTrack !== "1";
})();

const queue: AnalyticsEventInput[] = [];
let timer: number | undefined;
let currentPath: AnalyticsPath = "/";

/** 32 random hex characters; getRandomValues also works on plain-HTTP pages, unlike randomUUID. */
const randomId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

function readStoredSession(): { id: string; last: number } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as unknown;
    if (value && typeof value === "object") {
      const { id, last } = value as { id?: unknown; last?: unknown };
      if (typeof id === "string" && typeof last === "number") return { id, last };
    }
  } catch {
    // No storage, or a value from elsewhere.
  }
  return null;
}

/** The visit's id; a new visit starts after 30 minutes without activity. `isNew` for its first event. */
function session() {
  const now = Date.now();
  const stored = readStoredSession();
  const isNew = !stored || now - stored.last > SESSION_IDLE_MS;
  const id = stored && !isNew ? stored.id : randomId();
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
  } catch {
    // Private mode without storage: every page is its own visit.
  }
  return { id, isNew };
}

function flush(useBeacon = false) {
  window.clearTimeout(timer);
  timer = undefined;
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, 50) });
  // text/plain needs no CORS preflight, so it also works when the API is on another origin.
  if (useBeacon && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "text/plain" }))) {
    return;
  }
  void fetch(ENDPOINT, {
    method: "POST",
    body,
    headers: { "content-type": "text/plain" },
    keepalive: true,
    credentials: "same-origin"
  }).catch(() => undefined);
}

/** Queues an event; they are sent a few seconds later, together. */
export function track(type: AnalyticsEventInput["type"], fields: Fields = {}) {
  if (!analyticsEnabled) return;
  const visit = session();
  const event: AnalyticsEventInput = {
    ...fields,
    id: randomId(),
    type,
    sessionId: visit.id,
    path: fields.path ?? currentPath
  };
  // Where the visit came from is only sent with its first page.
  if (type === "page_view" && visit.isNew) {
    if (document.referrer) event.referrer = document.referrer;
    const utm = utmParameters();
    if (utm) event.utm = utm;
  }
  queue.push(event);
  if (queue.length >= MAX_QUEUE) flush();
  else timer ??= window.setTimeout(() => flush(), FLUSH_DELAY_MS);
}

/** UTM parameters from the address (before or after the #). */
function utmParameters() {
  const hashQuery = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
  const params = new URLSearchParams(`${window.location.search.slice(1)}&${hashQuery}`);
  const utm = {
    source: params.get("utm_source") ?? undefined,
    medium: params.get("utm_medium") ?? undefined,
    campaign: params.get("utm_campaign") ?? undefined
  };
  return utm.source || utm.medium || utm.campaign ? utm : null;
}

/** The route a path belongs to; pages are counted by route, not by address. */
export function routeOf(pathname: string): AnalyticsPath {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (/^\/projects\/[^/]+$/.test(path)) return "/projects/:slug";
  const known: AnalyticsPath[] = ["/", "/portfolio", "/projects", "/collection", "/privacy"];
  return known.find((route) => route === path) ?? "*";
}

// Visible time on the current page, reported when the page changes or the tab is hidden.
let visibleSince: number | null = null;
let visibleMs = 0;

function reportEngagement() {
  if (visibleSince !== null) visibleMs += Date.now() - visibleSince;
  visibleSince = document.visibilityState === "visible" ? Date.now() : null;
  const seconds = Math.round(visibleMs / 1000);
  visibleMs = 0;
  if (seconds >= 1) track("engagement", { value: seconds });
}

/**
 * Core Web Vitals of the page the visit landed on, for half of the visits: the largest paint, the
 * slowest interaction (close to INP for the few interactions of a visit) and layout shift (the worst
 * burst of shifts, x 1000). Reported once, when the tab is first hidden or closed.
 */
const vitals: { path: AnalyticsPath | null; lcp: number | null; inp: number | null; cls: number } =
  {
    path: null,
    lcp: null,
    inp: null,
    cls: 0
  };
let vitalsSent = false;

function observeVitals() {
  if (typeof PerformanceObserver === "undefined") return;
  const supported = PerformanceObserver.supportedEntryTypes ?? [];
  const observe = (type: string, onEntries: (entries: PerformanceEntry[]) => void, extra = {}) => {
    if (!supported.includes(type)) return;
    try {
      new PerformanceObserver((list) => onEntries(list.getEntries())).observe({
        type,
        buffered: true,
        ...extra
      });
    } catch {
      // An older browser without this entry type.
    }
  };
  observe("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1];
    if (last) vitals.lcp = last.startTime;
  });
  observe(
    "event",
    (entries) => {
      // Only real interactions (clicks, taps, key presses) have an interactionId; hovers do not.
      for (const entry of entries as (PerformanceEntry & { interactionId?: number })[])
        if (entry.interactionId) vitals.inp = Math.max(vitals.inp ?? 0, entry.duration);
    },
    { durationThreshold: 40 }
  );
  // Layout shifts in bursts (under 1 s apart, at most 5 s long); the worst burst counts.
  let burst = 0;
  let first = 0;
  let previous = 0;
  observe("layout-shift", (entries) => {
    for (const entry of entries as (PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
    })[]) {
      if (entry.hadRecentInput) continue;
      if (burst && entry.startTime - previous < 1000 && entry.startTime - first < 5000) {
        burst += entry.value;
      } else {
        burst = entry.value;
        first = entry.startTime;
      }
      previous = entry.startTime;
      vitals.cls = Math.max(vitals.cls, burst);
    }
  });
}

function reportVitals() {
  if (vitalsSent || !vitals.path) return;
  vitalsSent = true;
  const path = vitals.path;
  if (vitals.lcp !== null) track("web_vital", { path, target: "lcp", value: vitals.lcp });
  if (vitals.inp !== null) track("web_vital", { path, target: "inp", value: vitals.inp });
  track("web_vital", { path, target: "cls", value: vitals.cls * 1000 });
}

/** Called on every route change: reports the time on the previous page, then counts the new one. */
export function trackPage(path: AnalyticsPath, lang: string) {
  if (!analyticsEnabled) return;
  reportEngagement();
  currentPath = path;
  track("page_view", { lang });
  // Vitals belong to the page the visit landed on; half of the page loads measure them.
  if (vitals.path === null && !vitalsSent) {
    if (crypto.getRandomValues(new Uint8Array(1))[0]! < 128) {
      vitals.path = path;
      observeVitals();
    } else {
      vitalsSent = true;
    }
  }
}

if (analyticsEnabled) {
  visibleSince = document.visibilityState === "visible" ? Date.now() : null;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      reportEngagement();
      reportVitals();
      flush(true);
    } else {
      visibleSince = Date.now();
    }
  });
  window.addEventListener("pagehide", () => {
    reportEngagement();
    reportVitals();
    flush(true);
  });

  // Links to other sites: left and middle clicks. "Open in new tab" from the context menu is not seen.
  const onLinkClick = (event: MouseEvent) => {
    if (event.button > 1) return;
    const link = (event.target as Element | null)?.closest?.("a[href]");
    if (!(link instanceof HTMLAnchorElement)) return;
    if (!/^https?:$/.test(link.protocol) || link.host === window.location.host) return;
    const position = link.closest("[data-analytics]")?.getAttribute("data-analytics") ?? undefined;
    track("outbound_click", { target: link.hostname.replace(/^www\./, ""), detail: position });
  };
  document.addEventListener("click", onLinkClick, true);
  document.addEventListener("auxclick", onLinkClick, true);
}
