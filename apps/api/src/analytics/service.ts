import type {
  AnalyticsKpis,
  AnalyticsMeta,
  AnalyticsOverview,
  AnalyticsRange
} from "@liam-frost/shared";
import { createHash, randomBytes } from "node:crypto";

import type { AnalyticsConfig } from "../config/env";
import type { CountryLookup } from "./geo";
import {
  batchSchema,
  browserOf,
  deviceOf,
  isBot,
  RepeatFilter,
  validateEvent,
  type ValidEvent
} from "./ingest";
import { computeDay, totals } from "./metrics";
import { addDays, AnalyticsClock, daysBetween } from "./time";
import type { AnalyticsStore, DailyRow, StoredEvent, StoredSession } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const ONLINE_MS = 5 * 60 * 1000;
/** Longest custom range. */
export const MAX_RANGE_DAYS = 366;
const RANGE_DAYS: Record<Exclude<AnalyticsRange, "custom">, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90
};

/** What the server knows about the request that sent events; nothing here is stored as is. */
export type IngestRequest = {
  ip: string;
  userAgent: string | undefined;
  host: string;
  country: () => Promise<string | null>;
  /** The signed-in admin's own visits are not counted. */
  isAdmin: boolean;
};

export class AnalyticsRangeError extends Error {}

/**
 * Collects visitor events and answers the admin's questions about them. Visitors are counted with a
 * hash of IP and User-Agent salted per day; the salt of past days is deleted, so neither the IP nor a
 * way to follow someone across days is kept.
 */
export class AnalyticsService {
  readonly clock: AnalyticsClock;
  private readonly repeats = new RepeatFilter();
  private salt: { day: string; value: string } | null = null;

  constructor(
    private readonly store: AnalyticsStore,
    private readonly config: AnalyticsConfig,
    private readonly geo: CountryLookup,
    private readonly now: () => Date = () => new Date()
  ) {
    this.clock = new AnalyticsClock(config.timezone);
  }

  get enabled() {
    return this.config.enabled;
  }

  async meta(): Promise<AnalyticsMeta> {
    return {
      enabled: this.config.enabled,
      timezone: this.config.timezone,
      retentionDays: this.config.retentionDays,
      minGroupSize: this.config.minGroupSize,
      countrySource: this.geo.source,
      firstDay: await this.store.firstDay()
    };
  }

  private async visitorHash(day: string, ip: string, userAgent: string) {
    if (this.salt?.day !== day) {
      const value = await this.store.saltFor(day, () => randomBytes(32).toString("hex"));
      this.salt = { day, value };
    }
    return createHash("sha256")
      .update(`${this.salt.value}|${ip}|${userAgent}`)
      .digest("base64url")
      .slice(0, 22);
  }

  /** Stores a batch from the site. Returns how many events were kept; skipped requests keep none. */
  async ingest(body: unknown, request: IngestRequest) {
    if (!this.config.enabled || request.isAdmin || isBot(request.userAgent)) return 0;
    if (this.config.excludeIps.has(request.ip)) return 0;
    const parsed = batchSchema.safeParse(typeof body === "string" ? safeJson(body) : body);
    if (!parsed.success) return 0;

    const now = this.now();
    const valid = parsed.data.events
      .map((raw) => validateEvent(raw, request.host))
      .filter((event): event is ValidEvent => event !== null)
      .filter((event) => !this.repeats.repeat(event, now.getTime()));
    if (!valid.length) return 0;

    const userAgent = request.userAgent!;
    const { day, hour } = this.clock.local(now);
    const visitor = await this.visitorHash(day, request.ip, userAgent);

    // Sessions: the first batch of a session sets where it came from; later ones only keep it alive.
    const bySession = new Map<string, ValidEvent[]>();
    for (const event of valid)
      bySession.set(event.sessionId, [...(bySession.get(event.sessionId) ?? []), event]);
    for (const [sessionId, events] of bySession) {
      const lang = [...events].reverse().find((event) => event.lang)?.lang ?? null;
      const existing = await this.store.getSession(sessionId);
      if (existing) {
        await this.store.touchSession(sessionId, now, lang ?? existing.lang);
        continue;
      }
      const entry = events.find((event) => event.type === "page_view");
      const session: StoredSession = {
        id: sessionId,
        visitor,
        startedAt: now,
        lastSeenAt: now,
        day,
        hour,
        entryPath: entry?.path ?? null,
        referrer: entry?.referrer ?? null,
        utmSource: entry?.utm.source ?? null,
        utmMedium: entry?.utm.medium ?? null,
        utmCampaign: entry?.utm.campaign ?? null,
        country: await request.country(),
        lang,
        device: deviceOf(userAgent),
        browser: browserOf(userAgent)
      };
      await this.store.createSession(session);
    }

    await this.store.insertEvents(
      valid.map((event): StoredEvent => ({
        id: event.id,
        type: event.type,
        at: now,
        day,
        hour,
        sessionId: event.sessionId,
        visitor,
        path: event.path,
        contentType: event.contentType,
        contentId: event.contentId,
        target: event.target,
        detail: event.detail,
        value: event.value
      }))
    );
    return valid.length;
  }

  /**
   * Writes the totals of finished days (the last two again every time, for sessions and late events
   * across midnight), then deletes raw data older than the retention period. Safe to run repeatedly.
   */
  async maintain() {
    const today = this.clock.local(this.now()).day;
    const yesterday = addDays(today, -1);
    const rolled = await this.store.rolledUpDays();
    const oldest = await this.store.oldestRawDay();
    if (oldest && oldest <= yesterday) {
      for (const day of daysBetween(oldest, yesterday)) {
        if (rolled.has(day) && day < addDays(today, -2)) continue;
        const rows = computeDay(
          day,
          await this.store.eventsOn(day),
          await this.store.sessionsOn(day)
        );
        await this.store.writeDaily(day, rows, this.now());
      }
    }
    await this.store.deleteRawBefore(addDays(today, -this.config.retentionDays));
  }

  /** The days of a range and of the period before it, with the instant the current one ends. */
  resolveRange(range: AnalyticsRange, from?: string, to?: string) {
    const now = this.now();
    const today = this.clock.local(now).day;
    let start: string;
    let end: string;
    if (range === "custom") {
      if (!from || !to || from > to) throw new AnalyticsRangeError("Choose a start and end day");
      if (to > today) throw new AnalyticsRangeError("The end day is in the future");
      if (daysBetween(from, to).length > MAX_RANGE_DAYS)
        throw new AnalyticsRangeError(`Ranges are at most ${MAX_RANGE_DAYS} days`);
      start = from;
      end = to;
    } else {
      end = today;
      start = addDays(today, 1 - RANGE_DAYS[range]);
    }
    const length = daysBetween(start, end).length;
    // A range ending today stops now; the period before it stops at the same time of day.
    const cutoff = end === today ? now : null;
    return {
      days: daysBetween(start, end),
      previousDays: daysBetween(addDays(start, -length), addDays(start, -1)),
      cutoff,
      previousCutoff: cutoff ? new Date(cutoff.getTime() - length * DAY_MS) : null
    };
  }

  /**
   * Totals for days: stored totals for finished days, computed from raw data for today, days not
   * rolled up yet, and a last day cut off at `cutoff`.
   */
  private async rows(days: string[], cutoff: Date | null) {
    const rolled = await this.store.rolledUpDays();
    const oldest = await this.store.oldestRawDay();
    const lastDay = days[days.length - 1];
    // Days before the oldest raw data that were never rolled up have no data at all.
    const live = days.filter(
      (day) => (day === lastDay && cutoff) || (!rolled.has(day) && oldest !== null && day >= oldest)
    );
    const stored = await this.store.daily(days.filter((day) => !live.includes(day)));
    const computed: DailyRow[] = [];
    for (const day of live) {
      const until = day === lastDay && cutoff ? cutoff.getTime() : Infinity;
      const events = (await this.store.eventsOn(day)).filter((e) => e.at.getTime() <= until);
      const sessions = (await this.store.sessionsOn(day)).filter(
        (s) => s.startedAt.getTime() <= until
      );
      computed.push(...computeDay(day, events, sessions));
    }
    return [...stored, ...computed];
  }

  async overview(range: AnalyticsRange, from?: string, to?: string): Promise<AnalyticsOverview> {
    const { days, previousDays, cutoff, previousCutoff } = this.resolveRange(range, from, to);
    const [current, previous] = await Promise.all([
      this.rows(days, cutoff),
      this.rows(previousDays, previousCutoff)
    ]);
    const sum = totals(current);

    const single = days.length === 1;
    const points = single
      ? Array.from({ length: cutoff ? this.clock.local(cutoff).hour + 1 : 24 }, (_, hour) => ({
          key: String(hour),
          views: sum.value("hour", String(hour)),
          visitors: sum.value("hourVisitors", String(hour)),
          sessions: sum.value("sessionHour", String(hour))
        }))
      : days.map((day) => {
          const ofDay = totals(current.filter((row) => row.day === day));
          return {
            key: day,
            views: ofDay.value("views"),
            visitors: ofDay.value("visitors"),
            sessions: ofDay.value("sessions")
          };
        });

    const engaged = sum.keys("pageEngaged");
    const topPages = [...sum.keys("page")]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, views]) => ({
        path,
        views,
        avgEngagedSeconds: views ? Math.round((engaged.get(path) ?? 0) / views) : 0
      }));

    const online = await this.store.countActiveSessions(new Date(this.now().getTime() - ONLINE_MS));

    return {
      range: {
        range,
        from: days[0]!,
        to: days[days.length - 1]!,
        previousFrom: previousDays[0]!,
        previousTo: previousDays[previousDays.length - 1]!,
        timezone: this.config.timezone
      },
      current: kpis(current),
      previous: kpis(previous),
      trend: { bucket: single ? "hour" : "day", points },
      topPages,
      online
    };
  }
}

function kpis(rows: DailyRow[]): AnalyticsKpis {
  const sum = totals(rows);
  const sessions = sum.value("sessions");
  return {
    views: sum.value("views"),
    visitors: sum.value("visitors"),
    sessions,
    avgEngagedSeconds: sessions ? Math.round(sum.value("engaged") / sessions) : 0,
    bounceRate: sessions ? sum.value("bounces") / sessions : 0
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
