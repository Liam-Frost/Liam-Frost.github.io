import type { AnalyticsClearScope } from "@liam-frost/shared";

import type {
  AnalyticsStore,
  ContentName,
  DailyRow,
  RequestStats,
  StoredEvent,
  StoredSession,
  SystemEvent
} from "../src/analytics/types";

export class MemoryAnalyticsStore implements AnalyticsStore {
  readonly events = new Map<string, StoredEvent>();
  readonly sessions = new Map<string, StoredSession>();
  readonly rows: DailyRow[] = [];
  readonly rolled = new Map<string, Date>();
  readonly salts = new Map<string, string>();
  readonly names = new Map<string, ContentName>();
  readonly requests = new Map<string, RequestStats>();
  readonly system: SystemEvent[] = [];
  readonly flags = new Map<string, string>();

  async insertEvents(events: StoredEvent[]) {
    for (const event of events) if (!this.events.has(event.id)) this.events.set(event.id, event);
  }

  async getSession(id: string) {
    return this.sessions.get(id) ?? null;
  }

  async createSession(session: StoredSession) {
    if (!this.sessions.has(session.id)) this.sessions.set(session.id, session);
  }

  async touchSession(id: string, lastSeenAt: Date, lang: string | null) {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, lastSeenAt, lang });
  }

  async eventsOn(day: string) {
    return [...this.events.values()].filter((event) => event.day === day);
  }

  async sessionsOn(day: string) {
    return [...this.sessions.values()].filter((session) => session.day === day);
  }

  async countActiveSessions(since: Date) {
    return [...this.sessions.values()].filter((session) => session.lastSeenAt >= since).length;
  }

  async writeDaily(day: string, rows: DailyRow[], computedAt: Date) {
    this.rows.splice(0, this.rows.length, ...this.rows.filter((row) => row.day !== day), ...rows);
    this.rolled.set(day, computedAt);
  }

  async daily(days: string[]) {
    return this.rows.filter((row) => days.includes(row.day));
  }

  async rolledUpDays() {
    return new Set(this.rolled.keys());
  }

  async oldestRawDay() {
    const days = [
      ...[...this.events.values()].map((event) => event.day),
      ...[...this.sessions.values()].map((session) => session.day)
    ].sort();
    return days[0] ?? null;
  }

  async firstDay() {
    const days = [await this.oldestRawDay(), ...this.rolled.keys()]
      .filter((day): day is string => Boolean(day))
      .sort();
    return days[0] ?? null;
  }

  async deleteRawBefore(day: string) {
    for (const [id, event] of this.events) if (event.day < day) this.events.delete(id);
    for (const [id, session] of this.sessions) if (session.day < day) this.sessions.delete(id);
  }

  async saltFor(day: string, create: () => string) {
    for (const key of this.salts.keys()) if (key !== day) this.salts.delete(key);
    if (!this.salts.has(day)) this.salts.set(day, create());
    return this.salts.get(day)!;
  }

  async getSessions(ids: string[]) {
    return ids.map((id) => this.sessions.get(id)).filter((s): s is StoredSession => Boolean(s));
  }

  async contentNames() {
    return [...this.names.values()];
  }

  async writeContentNames(names: ContentName[]) {
    for (const name of names) this.names.set(name.key, name);
  }

  async addRequestStats(stats: RequestStats) {
    const key = `${stats.day}|${stats.route}`;
    const row = this.requests.get(key) ?? {
      ...stats,
      requests: 0,
      serverErrors: 0,
      clientErrors: 0,
      totalMs: 0,
      histogram: {}
    };
    row.requests += stats.requests;
    row.serverErrors += stats.serverErrors;
    row.clientErrors += stats.clientErrors;
    row.totalMs += stats.totalMs;
    for (const [bound, count] of Object.entries(stats.histogram))
      row.histogram[bound] = (row.histogram[bound] ?? 0) + count;
    this.requests.set(key, row);
  }

  async requestStats(days: string[]) {
    return [...this.requests.values()].filter((row) => days.includes(row.day));
  }

  async addSystemEvent(event: SystemEvent) {
    this.system.push(event);
  }

  async systemEvents({
    since,
    kind,
    limit
  }: {
    since: Date;
    kind?: SystemEvent["kind"];
    limit: number;
  }) {
    return this.system
      .filter((event) => event.at >= since && (!kind || event.kind === kind))
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);
  }

  async deleteSystemEventsBefore(at: Date) {
    this.system.splice(0, this.system.length, ...this.system.filter((event) => event.at >= at));
  }

  async flag(key: string) {
    return this.flags.get(key) ?? null;
  }

  async clear(scope: AnalyticsClearScope) {
    if (scope !== "health") {
      this.events.clear();
      this.sessions.clear();
      this.rows.splice(0);
      this.rolled.clear();
      this.names.clear();
    }
    if (scope !== "events") {
      this.requests.clear();
      this.system.splice(0);
    }
    if (scope === "all") this.flags.clear();
  }
}
