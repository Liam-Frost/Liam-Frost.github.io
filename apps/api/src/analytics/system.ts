import { SourceError, type MediaSources } from "../media/sources";
import { bucketOf } from "./metrics";
import type { AnalyticsClock } from "./time";
import type { AnalyticsStore, RequestStats, SystemEvent } from "./types";

/** A source that keeps working is noted at most this often; failures are always noted. */
const OK_EVERY_MS = 10 * 60 * 1000;

/**
 * The job log and external-source status shown under 体验与运行: results of import and sync jobs, and
 * whether TMDB, IGDB, Spotify, ... answered. Writes never fail the work they describe.
 */
export class SystemLog {
  private readonly lastOk = new Map<string, number>();

  constructor(
    private readonly store: AnalyticsStore,
    private readonly now: () => Date = () => new Date(),
    private readonly onError: (error: unknown) => void = () => {}
  ) {}

  record(kind: SystemEvent["kind"], name: string, ok: boolean, message: string | null = null) {
    const at = this.now();
    if (ok && kind === "source") {
      const last = this.lastOk.get(name);
      if (last !== undefined && at.getTime() - last < OK_EVERY_MS) return;
      this.lastOk.set(name, at.getTime());
    }
    if (!ok && kind === "source") this.lastOk.delete(name);
    void this.store
      .addSystemEvent({ at, kind, name, ok, message: message?.slice(0, 500) ?? null })
      .catch(this.onError);
  }
}

/**
 * Media sources that report to the system log. Only SourceError counts as the source failing (bad key,
 * quota, unreachable); "not found" answers are SourceErrors too, so a failure names its message.
 */
export function withSourceLog(sources: MediaSources, log: SystemLog): MediaSources {
  const watch = <T>(name: string, call: () => Promise<T>) =>
    call().then(
      (value) => {
        log.record("source", name, true);
        return value;
      },
      (error: unknown) => {
        if (error instanceof SourceError) log.record("source", name, false, error.message);
        throw error;
      }
    );
  return {
    available: () => sources.available(),
    search: (source, kind, query) => watch(source, () => sources.search(source, kind, query)),
    details: (source, kind, id) => watch(source, () => sources.details(source, kind, id)),
    download: (url) => sources.download(url),
    romaji: (...args) => sources.romaji(...args),
    searchPeople: (query) => watch("tmdb", () => sources.searchPeople(query)),
    person: (id) => watch("tmdb", () => sources.person(id)),
    credits: (...args) => watch("tmdb", () => sources.credits(...args)),
    relations: (...args) => sources.relations(...args),
    steamGames: (ids) => watch("igdb", () => sources.steamGames(ids))
  };
}

/** Public API routes: request counts, errors and response times per day, written once a minute. */
export class RequestRecorder {
  private pending = new Map<string, RequestStats>();

  constructor(
    private readonly store: AnalyticsStore,
    private readonly clock: AnalyticsClock,
    private readonly now: () => Date = () => new Date()
  ) {}

  record(route: string, status: number, ms: number) {
    const day = this.clock.local(this.now()).day;
    const key = `${day}|${route}`;
    const row = this.pending.get(key) ?? {
      day,
      route,
      requests: 0,
      serverErrors: 0,
      clientErrors: 0,
      totalMs: 0,
      histogram: {}
    };
    row.requests += 1;
    if (status >= 500) row.serverErrors += 1;
    else if (status >= 400) row.clientErrors += 1;
    row.totalMs += ms;
    const bound = String(bucketOf(ms));
    row.histogram[bound] = (row.histogram[bound] ?? 0) + 1;
    this.pending.set(key, row);
  }

  async flush() {
    const rows = [...this.pending.values()];
    this.pending = new Map();
    for (const row of rows) await this.store.addRequestStats(row);
  }
}
