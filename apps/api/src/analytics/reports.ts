import {
  VITAL_THRESHOLDS,
  type AnalyticsContentItem,
  type AnalyticsContentType,
  type AnalyticsCount,
  type AnalyticsReferrer,
  type AnalyticsRouteHealth,
  type AnalyticsSourceStatus,
  type AnalyticsVital,
  type AnalyticsVitalSummary
} from "@liam-frost/shared";

import { percentile, totals } from "./metrics";
import type { ContentName, DailyRow, RequestStats, SystemEvent } from "./types";

type Totals = ReturnType<typeof totals>;

/** Counts of one metric, largest first. */
export function countsOf(sum: Totals, metric: string, limit = 50): AnalyticsCount[] {
  return [...sum.keys(metric)]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, limit);
}

/**
 * Groups below `min` are folded into one "other" entry (key ""), so a single visitor from a rare
 * country or a private link cannot be picked out. Unknown values (key "") join it too.
 */
export function fold(counts: AnalyticsCount[], min: number): AnalyticsCount[] {
  const shown = counts.filter((count) => count.key && count.value >= min);
  const rest = counts.filter((count) => !shown.includes(count)).reduce((s, c) => s + c.value, 0);
  return rest ? [...shown, { key: "", value: rest }] : shown;
}

const SEARCH =
  /(^|\.)(google|bing|baidu|duckduckgo|yandex|sogou|so|yahoo|ecosia|naver|startpage|brave)\.[a-z.]+$/;
const SOCIAL =
  /(^|\.)(t\.co|x\.com|twitter\.com|weibo\.(com|cn)|reddit\.com|facebook\.com|instagram\.com|linkedin\.com|lnkd\.in|bilibili\.com|zhihu\.com|xiaohongshu\.com|douban\.com|mastodon\.[a-z.]+|threads\.net|youtube\.com|discord\.com|telegram\.org|v2ex\.com)$/;
const CODE =
  /(^|\.)(github\.com|gitlab\.com|gitee\.com|stackoverflow\.com|news\.ycombinator\.com)$/;

export function referrerGroup(host: string): AnalyticsReferrer["group"] {
  if (!host) return "direct";
  if (SEARCH.test(host)) return "search";
  if (SOCIAL.test(host)) return "social";
  if (CODE.test(host)) return "code";
  return "other";
}

/** Views, visitors and plays of each piece of content, named from the catalog or the last name seen. */
export function contentItems(
  sum: Totals,
  catalog: Map<string, ContentName>,
  names: Map<string, ContentName>
): AnalyticsContentItem[] {
  const keys = new Set([
    ...sum.keys("content").keys(),
    ...[...sum.keys("play").keys()].map((id) => `media:${id}`)
  ]);
  return [...keys]
    .map((key) => {
      const split = key.indexOf(":");
      const type = key.slice(0, split) as AnalyticsContentType;
      const id = key.slice(split + 1);
      const known = catalog.get(key) ?? names.get(key);
      return {
        type,
        id,
        name: known?.name ?? null,
        kind: known?.kind ?? null,
        removed: !catalog.has(key),
        views: sum.value("content", key),
        visitors: sum.value("contentVisitors", key),
        plays: type === "media" ? sum.value("play", id) : 0
      };
    })
    .sort((a, b) => b.views + b.plays - (a.views + a.plays) || a.id.localeCompare(b.id));
}

/**
 * Page views by weekday and hour over the range. Cells with fewer distinct visitors (each hour's
 * visitors added up) than `min` show no number.
 */
export function heatmap(rows: DailyRow[], min: number) {
  const views = new Map<string, number>();
  const visitors = new Map<string, number>();
  for (const row of rows) {
    if (row.metric !== "hour" && row.metric !== "hourVisitors") continue;
    const weekday = new Date(`${row.day}T00:00:00Z`).getUTCDay();
    const key = `${weekday}|${row.key}`;
    const target = row.metric === "hour" ? views : visitors;
    target.set(key, (target.get(key) ?? 0) + row.value);
  }
  const cells: { weekday: number; hour: number; views: number | null }[] = [];
  for (let weekday = 0; weekday < 7; weekday++)
    for (let hour = 0; hour < 24; hour++) {
      const key = `${weekday}|${hour}`;
      const seen = visitors.get(key) ?? 0;
      cells.push({ weekday, hour, views: seen >= min ? (views.get(key) ?? 0) : seen ? null : 0 });
    }
  return cells;
}

const rate = (metric: AnalyticsVital, p75: number): AnalyticsVitalSummary["rating"] =>
  p75 <= VITAL_THRESHOLDS[metric].good
    ? "good"
    : p75 > VITAL_THRESHOLDS[metric].poor
      ? "poor"
      : "needs-improvement";

/** The 75th percentile of each Web Vital per page, from "path|metric|bucket" counts. */
export function vitals(sum: Totals): AnalyticsVitalSummary[] {
  const groups = new Map<string, Map<number, number>>();
  for (const [key, count] of sum.keys("vital")) {
    const [path, metric, bound] = key.split("|");
    const id = `${path}|${metric}`;
    const histogram = groups.get(id) ?? new Map<number, number>();
    histogram.set(Number(bound), (histogram.get(Number(bound)) ?? 0) + count);
    groups.set(id, histogram);
  }
  return [...groups]
    .map(([id, histogram]) => {
      const [path, metric] = id.split("|") as [string, AnalyticsVital];
      const p75 = percentile(histogram, 0.75);
      const samples = [...histogram.values()].reduce((s, c) => s + c, 0);
      return { path, metric, samples, p75, rating: rate(metric, p75) };
    })
    .sort((a, b) => a.path.localeCompare(b.path) || a.metric.localeCompare(b.metric));
}

/** Requests per route over the range, busiest first. */
export function routeHealth(stats: RequestStats[]): AnalyticsRouteHealth[] {
  const byRoute = new Map<string, RequestStats>();
  for (const row of stats) {
    const sum = byRoute.get(row.route) ?? {
      ...row,
      requests: 0,
      serverErrors: 0,
      clientErrors: 0,
      totalMs: 0,
      histogram: {}
    };
    sum.requests += row.requests;
    sum.serverErrors += row.serverErrors;
    sum.clientErrors += row.clientErrors;
    sum.totalMs += row.totalMs;
    for (const [bound, count] of Object.entries(row.histogram))
      sum.histogram[bound] = (sum.histogram[bound] ?? 0) + count;
    byRoute.set(row.route, sum);
  }
  return [...byRoute.values()]
    .map((row) => ({
      route: row.route,
      requests: row.requests,
      serverErrors: row.serverErrors,
      clientErrors: row.clientErrors,
      avgMs: row.requests ? Math.round(row.totalMs / row.requests) : 0,
      p95Ms: percentile(row.histogram, 0.95)
    }))
    .sort((a, b) => b.requests - a.requests);
}

/** Last success and last failure of each external source, from newest-first events. */
export function sourceStatus(events: SystemEvent[]): AnalyticsSourceStatus[] {
  const byName = new Map<string, AnalyticsSourceStatus>();
  for (const event of events) {
    if (event.kind !== "source") continue;
    const status = byName.get(event.name) ?? {
      name: event.name,
      lastOk: null,
      lastError: null,
      lastErrorMessage: null
    };
    if (event.ok) status.lastOk ??= event.at.toISOString();
    else if (!status.lastError) {
      status.lastError = event.at.toISOString();
      status.lastErrorMessage = event.message;
    }
    byName.set(event.name, status);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * CSV for Excel: a byte-order mark so Chinese text opens correctly, and text starting with = + - @
 * (or a tab / carriage return) prefixed with ' so it is not run as a formula.
 */
export function toCsv(header: string[], rows: (string | number | null)[][]) {
  const cell = (value: string | number | null) => {
    if (value === null) return "";
    if (typeof value === "number") return String(value);
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return `\uFEFF${[header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
