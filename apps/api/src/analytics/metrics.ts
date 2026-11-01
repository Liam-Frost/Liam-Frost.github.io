import type { DailyRow, StoredEvent, StoredSession } from "./types";

/** A session that saw one page for under this many visible seconds bounced. */
export const BOUNCE_SECONDS = 10;

class Counter {
  readonly rows = new Map<string, DailyRow>();

  constructor(private readonly day: string) {}

  add(metric: string, key: string | null | undefined, value = 1) {
    const id = `${metric}\u0000${key ?? ""}`;
    const row = this.rows.get(id) ?? { day: this.day, metric, key: key ?? "", value: 0 };
    row.value += value;
    this.rows.set(id, row);
  }
}

/**
 * A day's totals from its raw events and the sessions that started on it. Totals for a whole day are
 * stored once the day is over; today's (or part of a day, for comparisons) are computed when asked.
 *
 * Metrics: views, visitors, sessions, bounces, engaged (seconds); per key: page, pageEngaged,
 * hour, hourVisitors, sessionHour, entry, referrer, utmSource, utmMedium, utmCampaign, country,
 * device, browser, lang, content, contentVisitors, play, player, playSource, outbound,
 * outboundPosition, filter.
 */
export function computeDay(
  day: string,
  events: StoredEvent[],
  sessions: StoredSession[]
): DailyRow[] {
  const counter = new Counter(day);
  const visitors = new Set<string>();
  const hourVisitors = new Map<number, Set<string>>();
  const contentVisitors = new Map<string, Set<string>>();
  const perSession = new Map<string, { pages: number; seconds: number }>();

  for (const event of events) {
    visitors.add(event.visitor);
    const session = perSession.get(event.sessionId) ?? { pages: 0, seconds: 0 };
    perSession.set(event.sessionId, session);
    switch (event.type) {
      case "page_view": {
        session.pages += 1;
        counter.add("views", "");
        counter.add("page", event.path);
        counter.add("hour", String(event.hour));
        const inHour = hourVisitors.get(event.hour) ?? new Set();
        inHour.add(event.visitor);
        hourVisitors.set(event.hour, inHour);
        break;
      }
      case "engagement":
        session.seconds += event.value ?? 0;
        counter.add("pageEngaged", event.path, event.value ?? 0);
        break;
      case "content_view": {
        const key = `${event.contentType}:${event.contentId}`;
        counter.add("content", key);
        const seen = contentVisitors.get(key) ?? new Set();
        seen.add(event.visitor);
        contentVisitors.set(key, seen);
        break;
      }
      case "music_play":
        counter.add("play", event.contentId);
        counter.add("player", event.target);
        counter.add("playSource", event.detail);
        break;
      case "outbound_click":
        counter.add("outbound", event.target);
        counter.add("outboundPosition", event.detail);
        break;
      case "collection_filter":
        counter.add("filter", event.detail ? `${event.target}:${event.detail}` : event.target);
        break;
    }
  }

  counter.add("visitors", "", visitors.size);
  for (const [hour, seen] of hourVisitors) counter.add("hourVisitors", String(hour), seen.size);
  for (const [key, seen] of contentVisitors) counter.add("contentVisitors", key, seen.size);

  for (const session of sessions) {
    const activity = perSession.get(session.id) ?? { pages: 0, seconds: 0 };
    counter.add("sessions", "");
    counter.add("engaged", "", activity.seconds);
    if (activity.pages <= 1 && activity.seconds < BOUNCE_SECONDS) counter.add("bounces", "");
    counter.add("sessionHour", String(session.hour));
    counter.add("entry", session.entryPath);
    counter.add("referrer", session.referrer);
    counter.add("utmSource", session.utmSource);
    counter.add("utmMedium", session.utmMedium);
    counter.add("utmCampaign", session.utmCampaign);
    counter.add("country", session.country);
    counter.add("device", session.device);
    counter.add("browser", session.browser);
    counter.add("lang", session.lang);
  }

  return [...counter.rows.values()].filter((row) => row.value !== 0);
}

/** Sums rows by metric and key. */
export function totals(rows: DailyRow[]) {
  const sums = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const byKey = sums.get(row.metric) ?? new Map<string, number>();
    byKey.set(row.key, (byKey.get(row.key) ?? 0) + row.value);
    sums.set(row.metric, byKey);
  }
  return {
    value: (metric: string, key = "") => sums.get(metric)?.get(key) ?? 0,
    keys: (metric: string) => sums.get(metric) ?? new Map<string, number>()
  };
}
