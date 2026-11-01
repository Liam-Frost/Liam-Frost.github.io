import type { AnalyticsClearScope, AnalyticsEventType } from "@liam-frost/shared";

export type StoredEvent = {
  id: string;
  type: AnalyticsEventType;
  at: Date;
  day: string;
  hour: number;
  sessionId: string;
  visitor: string;
  path: string;
  contentType: string | null;
  contentId: string | null;
  target: string | null;
  detail: string | null;
  value: number | null;
};

export type StoredSession = {
  id: string;
  visitor: string;
  startedAt: Date;
  lastSeenAt: Date;
  day: string;
  hour: number;
  entryPath: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  country: string | null;
  lang: string | null;
  device: string;
  browser: string;
};

/** One daily total: `metric` names the count, `key` what it counts ("" for plain totals). */
export type DailyRow = { day: string; metric: string; key: string; value: number };

/** The name of a piece of content when last seen; `key` is "type:id". */
export type ContentName = {
  key: string;
  type: string;
  contentId: string;
  name: string;
  kind: string | null;
};

/** Requests to one public API route on one day; `histogram` maps an upper bound in ms to a count. */
export type RequestStats = {
  day: string;
  route: string;
  requests: number;
  serverErrors: number;
  clientErrors: number;
  totalMs: number;
  histogram: Record<string, number>;
};

export type SystemEvent = {
  at: Date;
  kind: "job" | "source";
  name: string;
  ok: boolean;
  message: string | null;
};

export interface AnalyticsStore {
  /** Stores new events; ids already stored are ignored. */
  insertEvents(events: StoredEvent[]): Promise<void>;
  getSession(id: string): Promise<StoredSession | null>;
  createSession(session: StoredSession): Promise<void>;
  /** Marks a session active now, with the language of its latest page. */
  touchSession(id: string, lastSeenAt: Date, lang: string | null): Promise<void>;
  eventsOn(day: string): Promise<StoredEvent[]>;
  sessionsOn(day: string): Promise<StoredSession[]>;
  countActiveSessions(since: Date): Promise<number>;
  /** Replaces a day's totals and marks it rolled up. */
  writeDaily(day: string, rows: DailyRow[], computedAt: Date): Promise<void>;
  daily(days: string[]): Promise<DailyRow[]>;
  rolledUpDays(): Promise<Set<string>>;
  /** The oldest day with raw events or sessions. */
  oldestRawDay(): Promise<string | null>;
  /** The oldest day with any data. */
  firstDay(): Promise<string | null>;
  /** Deletes raw events and sessions of days before `day`. */
  deleteRawBefore(day: string): Promise<void>;
  /** The salt for a day, created on first use; every other day's salt is deleted. */
  saltFor(day: string, create: () => string): Promise<string>;
  getSessions(ids: string[]): Promise<StoredSession[]>;
  contentNames(): Promise<ContentName[]>;
  /** Adds or replaces names. */
  writeContentNames(names: ContentName[], at: Date): Promise<void>;
  /** Adds requests to a day's counts for a route. */
  addRequestStats(stats: RequestStats): Promise<void>;
  requestStats(days: string[]): Promise<RequestStats[]>;
  addSystemEvent(event: SystemEvent): Promise<void>;
  /** Newest first. */
  systemEvents(options: {
    since: Date;
    kind?: SystemEvent["kind"];
    limit: number;
  }): Promise<SystemEvent[]>;
  deleteSystemEventsBefore(at: Date): Promise<void>;
  flag(key: string): Promise<string | null>;
  clear(scope: AnalyticsClearScope): Promise<void>;
}
