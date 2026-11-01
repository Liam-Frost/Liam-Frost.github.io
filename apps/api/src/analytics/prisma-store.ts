import type { AnalyticsEventType } from "@liam-frost/shared";

import type { AnalyticsEvent, PrismaClient } from "../generated/prisma/client";
import type { AnalyticsStore, DailyRow, StoredEvent, StoredSession } from "./types";

const toEvent = (record: AnalyticsEvent): StoredEvent => ({
  ...record,
  type: record.type as AnalyticsEventType
});

export class PrismaAnalyticsStore implements AnalyticsStore {
  constructor(private readonly prisma: PrismaClient) {}

  async insertEvents(events: StoredEvent[]) {
    await this.prisma.analyticsEvent.createMany({ data: events, skipDuplicates: true });
  }

  async getSession(id: string) {
    return this.prisma.analyticsSession.findUnique({ where: { id } });
  }

  async createSession(session: StoredSession) {
    // Two batches of a new session can arrive together; the second one only keeps it alive.
    await this.prisma.analyticsSession.createMany({ data: [session], skipDuplicates: true });
  }

  async touchSession(id: string, lastSeenAt: Date, lang: string | null) {
    await this.prisma.analyticsSession.updateMany({ where: { id }, data: { lastSeenAt, lang } });
  }

  async eventsOn(day: string) {
    return (await this.prisma.analyticsEvent.findMany({ where: { day } })).map(toEvent);
  }

  async sessionsOn(day: string) {
    return this.prisma.analyticsSession.findMany({ where: { day } });
  }

  async countActiveSessions(since: Date) {
    return this.prisma.analyticsSession.count({ where: { lastSeenAt: { gte: since } } });
  }

  async writeDaily(day: string, rows: DailyRow[], computedAt: Date) {
    await this.prisma.$transaction([
      this.prisma.analyticsDaily.deleteMany({ where: { day } }),
      this.prisma.analyticsDaily.createMany({ data: rows }),
      this.prisma.analyticsRollupDay.upsert({
        where: { day },
        create: { day, computedAt },
        update: { computedAt }
      })
    ]);
  }

  async daily(days: string[]) {
    if (!days.length) return [];
    return this.prisma.analyticsDaily.findMany({ where: { day: { in: days } } });
  }

  async rolledUpDays() {
    const records = await this.prisma.analyticsRollupDay.findMany({ select: { day: true } });
    return new Set(records.map((record) => record.day));
  }

  async oldestRawDay() {
    const [event, session] = await Promise.all([
      this.prisma.analyticsEvent.findFirst({ orderBy: { day: "asc" }, select: { day: true } }),
      this.prisma.analyticsSession.findFirst({ orderBy: { day: "asc" }, select: { day: true } })
    ]);
    const days = [event?.day, session?.day].filter((day): day is string => Boolean(day)).sort();
    return days[0] ?? null;
  }

  async firstDay() {
    const [raw, rolled] = await Promise.all([
      this.oldestRawDay(),
      this.prisma.analyticsRollupDay.findFirst({ orderBy: { day: "asc" }, select: { day: true } })
    ]);
    const days = [raw, rolled?.day].filter((day): day is string => Boolean(day)).sort();
    return days[0] ?? null;
  }

  async deleteRawBefore(day: string) {
    await this.prisma.$transaction([
      this.prisma.analyticsEvent.deleteMany({ where: { day: { lt: day } } }),
      this.prisma.analyticsSession.deleteMany({ where: { day: { lt: day } } })
    ]);
  }

  async saltFor(day: string, create: () => string) {
    await this.prisma.analyticsSalt.deleteMany({ where: { day: { not: day } } });
    await this.prisma.analyticsSalt.createMany({
      data: [{ day, salt: create() }],
      skipDuplicates: true
    });
    const record = await this.prisma.analyticsSalt.findUniqueOrThrow({ where: { day } });
    return record.salt;
  }
}
