import type { AnalyticsStore, DailyRow, StoredEvent, StoredSession } from "../src/analytics/types";

export class MemoryAnalyticsStore implements AnalyticsStore {
  readonly events = new Map<string, StoredEvent>();
  readonly sessions = new Map<string, StoredSession>();
  readonly rows: DailyRow[] = [];
  readonly rolled = new Map<string, Date>();
  readonly salts = new Map<string, string>();

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
}
