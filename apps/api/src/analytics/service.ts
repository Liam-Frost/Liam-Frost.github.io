import type {
  AnalyticsAudience,
  AnalyticsClearScope,
  AnalyticsContentCounts,
  AnalyticsContentDetail,
  AnalyticsContentReport,
  AnalyticsContentType,
  AnalyticsExport,
  AnalyticsHealth,
  AnalyticsKpis,
  AnalyticsMeta,
  AnalyticsOverview,
  AnalyticsRange,
  AnalyticsRangeInfo
} from "@liam-frost/shared";
import { createHash, randomBytes } from "node:crypto";

import type { AnalyticsConfig } from "../config/env";
import type { ContentCatalog } from "./catalog";
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
import {
  contentItems,
  countsOf,
  fold,
  heatmap,
  referrerGroup,
  routeHealth,
  sourceStatus,
  toCsv,
  vitals
} from "./reports";
import { addDays, AnalyticsClock, daysBetween } from "./time";
import type { AnalyticsStore, ContentName, DailyRow, StoredEvent, StoredSession } from "./types";

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

/** The flag the demo data script sets. */
export const DEMO_FLAG = "demo";

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
    private readonly now: () => Date = () => new Date(),
    /** Checks that viewed and played content exists and is public, and names it; null skips the check. */
    private readonly catalog: ContentCatalog | null = null
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
      demo: (await this.store.flag(DEMO_FLAG)) !== null,
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
    const checked = parsed.data.events
      .map((raw) => validateEvent(raw, request.host))
      .filter((event): event is ValidEvent => event !== null)
      .filter((event) => !this.repeats.repeat(event, now.getTime()));
    // Content must exist and be public: ids nobody published (or the player's sample songs) are dropped.
    const valid: ValidEvent[] = [];
    for (const event of checked) {
      if (
        event.contentType &&
        this.catalog &&
        !(await this.catalog.get(event.contentType, event.contentId!))
      )
        continue;
      valid.push(event);
    }
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
    await this.store.deleteSystemEventsBefore(
      new Date(this.now().getTime() - this.config.retentionDays * DAY_MS)
    );
    await this.snapshotNames();
  }

  /** Keeps the current name of every public piece of content, for when it is later hidden or deleted. */
  private async snapshotNames() {
    if (!this.catalog) return;
    const stored = new Map((await this.store.contentNames()).map((name) => [name.key, name]));
    const changed = [...(await this.catalog.all()).values()].filter((entry) => {
      const known = stored.get(entry.key);
      return !known || known.name !== entry.name || known.kind !== entry.kind;
    });
    if (changed.length) await this.store.writeContentNames(changed, this.now());
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

  /** A range's days and totals, and the period before it. */
  private async period(range: AnalyticsRange, from?: string, to?: string) {
    const resolved = this.resolveRange(range, from, to);
    const [current, previous] = await Promise.all([
      this.rows(resolved.days, resolved.cutoff),
      this.rows(resolved.previousDays, resolved.previousCutoff)
    ]);
    const { days, previousDays } = resolved;
    const info: AnalyticsRangeInfo = {
      range,
      from: days[0]!,
      to: days[days.length - 1]!,
      previousFrom: previousDays[0]!,
      previousTo: previousDays[previousDays.length - 1]!,
      timezone: this.config.timezone
    };
    return { ...resolved, info, current, previous };
  }

  async overview(range: AnalyticsRange, from?: string, to?: string): Promise<AnalyticsOverview> {
    const { days, cutoff, info, current, previous } = await this.period(range, from, to);
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
      range: info,
      current: kpis(current),
      previous: kpis(previous),
      trend: { bucket: single ? "hour" : "day", points },
      topPages,
      online
    };
  }

  /** Names for content: what is public now, and the last names seen of what is not. */
  private async names() {
    const [catalog, stored] = await Promise.all([
      this.catalog?.all() ?? new Map<string, ContentName>(),
      this.store.contentNames()
    ]);
    return { catalog, stored: new Map(stored.map((name) => [name.key, name])) };
  }

  async content(
    range: AnalyticsRange,
    from?: string,
    to?: string
  ): Promise<AnalyticsContentReport> {
    const { info, current } = await this.period(range, from, to);
    const sum = totals(current);
    const { catalog, stored } = await this.names();
    return {
      range: info,
      items: contentItems(sum, catalog, stored),
      players: countsOf(sum, "player"),
      playSources: countsOf(sum, "playSource"),
      outbound: countsOf(sum, "outbound"),
      outboundPositions: countsOf(sum, "outboundPosition"),
      filters: countsOf(sum, "filter")
    };
  }

  async contentDetail(
    type: AnalyticsContentType,
    id: string,
    range: AnalyticsRange,
    from?: string,
    to?: string
  ): Promise<AnalyticsContentDetail | null> {
    const { days, info, current, previous } = await this.period(range, from, to);
    const key = `${type}:${id}`;
    const { catalog, stored } = await this.names();
    const known = catalog.get(key) ?? stored.get(key);
    const sum = totals(current);
    const item = contentItems(sum, catalog, stored).find(
      (entry) => `${entry.type}:${entry.id}` === key
    );
    if (!item && !known) return null;
    const before = totals(previous);
    const of = (t: ReturnType<typeof totals>) => ({
      views: t.value("content", key),
      visitors: t.value("contentVisitors", key),
      plays: type === "media" ? t.value("play", id) : 0
    });

    // Where its visits came from: raw events still within the retention period.
    const sessionIds = await this.store.contentSessionIds(type, id, days);
    const referrers = new Map<string, number>();
    for (const session of await this.store.getSessions(sessionIds))
      referrers.set(session.referrer ?? "", (referrers.get(session.referrer ?? "") ?? 0) + 1);

    return {
      range: info,
      item: item ?? {
        type,
        id,
        name: known?.name ?? null,
        kind: known?.kind ?? null,
        removed: !catalog.has(key),
        views: 0,
        visitors: 0,
        plays: 0
      },
      previous: of(before),
      trend: days.map((day) => ({
        key: day,
        ...of(totals(current.filter((row) => row.day === day)))
      })),
      referrers: [...referrers]
        .map(([referrer, value]) => ({ key: referrer, value }))
        .sort((a, b) => b.value - a.value)
    };
  }

  /** Views and plays of every piece of one type over the last 30 days, for lists and editors. */
  async contentCounts(type: AnalyticsContentType): Promise<AnalyticsContentCounts> {
    const { current } = await this.period("30d");
    const sum = totals(current);
    const counts: AnalyticsContentCounts = {};
    for (const [key, views] of sum.keys("content")) {
      if (!key.startsWith(`${type}:`)) continue;
      counts[key.slice(type.length + 1)] = { views, plays: 0 };
    }
    if (type === "media")
      for (const [id, plays] of sum.keys("play"))
        counts[id] = { views: counts[id]?.views ?? 0, plays };
    return counts;
  }

  async audience(range: AnalyticsRange, from?: string, to?: string): Promise<AnalyticsAudience> {
    const { info, current } = await this.period(range, from, to);
    const sum = totals(current);
    const min = this.config.minGroupSize;
    const referrers = countsOf(sum, "referrer", 500);
    const groups = new Map<string, number>();
    for (const { key, value } of referrers) {
      const group = referrerGroup(key);
      groups.set(group, (groups.get(group) ?? 0) + value);
    }
    return {
      range: info,
      sessions: sum.value("sessions"),
      minGroupSize: min,
      referrers: fold(
        referrers.filter((r) => r.key),
        min
      ).map((r) => ({ ...r, group: r.key ? referrerGroup(r.key) : "other" })),
      referrerGroups: [...groups]
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value),
      utmSources: fold(countsOf(sum, "utmSource"), min),
      utmMediums: fold(countsOf(sum, "utmMedium"), min),
      utmCampaigns: fold(countsOf(sum, "utmCampaign"), min),
      countries: fold(countsOf(sum, "country", 300), min),
      langs: countsOf(sum, "lang"),
      devices: countsOf(sum, "device"),
      browsers: countsOf(sum, "browser"),
      entries: countsOf(sum, "entry"),
      heatmap: heatmap(current, min)
    };
  }

  async health(range: AnalyticsRange, from?: string, to?: string): Promise<AnalyticsHealth> {
    const { days, info, current } = await this.period(range, from, to);
    // Jobs from the day before the range starts (UTC midnight may fall inside the first local day).
    const start = new Date(Date.parse(`${days[0]}T00:00:00Z`) - DAY_MS);
    const [requests, jobs, sources] = await Promise.all([
      this.store.requestStats(days),
      this.store.systemEvents({ since: start, kind: "job", limit: 50 }),
      this.store.systemEvents({
        since: new Date(this.now().getTime() - this.config.retentionDays * DAY_MS),
        kind: "source",
        limit: 2000
      })
    ]);
    return {
      range: info,
      vitals: vitals(totals(current)),
      routes: routeHealth(requests),
      jobs: jobs.map((event) => ({ ...event, at: event.at.toISOString() })),
      sources: sourceStatus(sources)
    };
  }

  /** A report as CSV (Excel-safe) or JSON, for the same range the admin is looking at. */
  async export(
    dataset: AnalyticsExport,
    format: "csv" | "json",
    range: AnalyticsRange,
    from?: string,
    to?: string
  ) {
    const name = `analytics-${dataset}`;
    const table = await this.exportTable(dataset, range, from, to);
    const file = `${name}-${table.range.from}_${table.range.to}.${format}`;
    if (format === "json") {
      const rows = table.rows.map((row) =>
        Object.fromEntries(table.header.map((h, i) => [h, row[i]]))
      );
      return {
        file,
        type: "application/json; charset=utf-8",
        body: JSON.stringify(
          { dataset, range: table.range, generatedAt: this.now().toISOString(), rows },
          null,
          2
        )
      };
    }
    return { file, type: "text/csv; charset=utf-8", body: toCsv(table.header, table.rows) };
  }

  private async exportTable(
    dataset: AnalyticsExport,
    range: AnalyticsRange,
    from?: string,
    to?: string
  ) {
    switch (dataset) {
      case "pages": {
        const overview = await this.overview(range, from, to);
        const { current } = await this.period(range, from, to);
        const sum = totals(current);
        return {
          range: overview.range,
          header: ["path", "views", "avgEngagedSeconds"],
          rows: [...sum.keys("page")]
            .sort((a, b) => b[1] - a[1])
            .map(([path, views]) => [
              path,
              views,
              views ? Math.round(sum.value("pageEngaged", path) / views) : 0
            ])
        };
      }
      case "trend": {
        const overview = await this.overview(range, from, to);
        return {
          range: overview.range,
          header: [overview.trend.bucket, "views", "visitors", "sessions"],
          rows: overview.trend.points.map((p) => [p.key, p.views, p.visitors, p.sessions])
        };
      }
      case "content": {
        const report = await this.content(range, from, to);
        return {
          range: report.range,
          header: ["type", "id", "name", "kind", "removed", "views", "visitors", "plays"],
          rows: report.items.map((i) => [
            i.type,
            i.id,
            i.name,
            i.kind,
            i.removed ? "yes" : "no",
            i.views,
            i.visitors,
            i.plays
          ])
        };
      }
      case "referrers": {
        const audience = await this.audience(range, from, to);
        return {
          range: audience.range,
          header: ["referrer", "group", "sessions"],
          rows: audience.referrers.map((r) => [r.key || "other", r.group, r.value])
        };
      }
      case "countries": {
        const audience = await this.audience(range, from, to);
        return {
          range: audience.range,
          header: ["country", "sessions"],
          rows: audience.countries.map((c) => [c.key || "other", c.value])
        };
      }
      case "health": {
        const health = await this.health(range, from, to);
        return {
          range: health.range,
          header: ["route", "requests", "serverErrors", "clientErrors", "avgMs", "p95Ms"],
          rows: health.routes.map((r) => [
            r.route,
            r.requests,
            r.serverErrors,
            r.clientErrors,
            r.avgMs,
            r.p95Ms
          ])
        };
      }
    }
  }

  /** Deletes statistics: visitor data, the API health and job log, or both. Content is not touched. */
  async clear(scope: AnalyticsClearScope) {
    await this.store.clear(scope);
    this.salt = null;
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
