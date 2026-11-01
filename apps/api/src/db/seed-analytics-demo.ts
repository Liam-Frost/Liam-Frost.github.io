// Development helper: fills a separate demo database with 60 days of made-up visitor statistics, so the
// admin's 统计 pages can be tried without real traffic. It refuses any database whose name or schema
// does not contain "demo", replaces the analytics tables there, and marks the data as demo data.
// Usage: DATABASE_URL=postgres://.../site_demo npm run db:seed:analytics-demo
import "dotenv/config";

import { ANALYTICS_PATHS, type AnalyticsPath } from "@liam-frost/shared";
import { randomUUID } from "node:crypto";

import { ContentCatalog } from "../analytics/catalog";
import { isDemoDatabase } from "../analytics/demo";
import { PrismaAnalyticsStore } from "../analytics/prisma-store";
import { AnalyticsService, DEMO_FLAG } from "../analytics/service";
import { addDays, AnalyticsClock } from "../analytics/time";
import type { StoredEvent, StoredSession } from "../analytics/types";
import { loadConfig } from "../config/env";
import { PrismaMediaRepository } from "../media/prisma-repository";
import { PrismaPersonRepository } from "../people/prisma-repository";
import { PrismaPhotoRepository } from "../photos/prisma-repository";
import { PrismaPlaylistRepository } from "../playlists/prisma-repository";
import { PrismaProjectRepository } from "../projects/prisma-repository";
import { createPrismaClient } from "./client";

const DAYS = 60;

/** A small seeded generator, so every run makes the same demo. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!isDemoDatabase(url)) {
    console.error(
      'Refusing to write demo data: DATABASE_URL must point to a database (or ?schema=) whose name contains "demo".'
    );
    process.exit(1);
  }
  const prisma = createPrismaClient(url);
  const config = loadConfig().analytics;
  const store = new PrismaAnalyticsStore(prisma);
  const catalog = new ContentCatalog({
    projects: new PrismaProjectRepository(prisma),
    photos: new PrismaPhotoRepository(prisma),
    media: new PrismaMediaRepository(prisma),
    people: new PrismaPersonRepository(prisma),
    playlists: new PrismaPlaylistRepository(prisma)
  });
  const clock = new AnalyticsClock(config.timezone);
  const rand = random(20261102);
  const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
  const weighted = <T>(items: [T, number][]) => {
    let roll = rand() * items.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [item, weight] of items) if ((roll -= weight) <= 0) return item;
    return items[0]![0];
  };

  const content = [...(await catalog.all()).values()];
  const songs = content.filter((entry) => entry.kind === "track");
  const opened = content.filter((entry) => entry.kind !== "track");

  await store.clear("all");
  const today = clock.local(new Date()).day;
  const events: StoredEvent[] = [];
  const sessions: StoredSession[] = [];

  for (let back = DAYS; back >= 1; back--) {
    const day = addDays(today, -back);
    const start = clock.start(day);
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    // Growing traffic, quieter on weekends, a launch spike three weeks ago.
    const visits = Math.round(
      (12 + (DAYS - back) * 0.4) *
        (weekday === 0 || weekday === 6 ? 0.7 : 1) *
        (back === 21 ? 3 : 1)
    );
    for (let v = 0; v < visits; v++) {
      const hour = weighted([
        [9, 2],
        [10, 3],
        [11, 3],
        [12, 2],
        [14, 3],
        [15, 3],
        [16, 2],
        [20, 4],
        [21, 4],
        [22, 3],
        [23, 1],
        [2, 0.5]
      ]);
      const at = new Date(start.getTime() + (hour * 60 + Math.floor(rand() * 60)) * 60_000);
      const id = randomUUID().replace(/-/g, "");
      const visitor = randomUUID().replace(/-/g, "").slice(0, 22);
      const referrer = weighted<string | null>([
        [null, 5],
        ["google.com", 4],
        ["github.com", 3],
        ["bing.com", 1],
        ["t.co", 1],
        ["weibo.com", 1],
        ["zhihu.com", 1],
        ["v2ex.com", 0.5]
      ]);
      const entry = weighted<AnalyticsPath>([
        ["/", 6],
        ["/projects/:slug", 2],
        ["/collection", 2],
        ["/portfolio", 1]
      ]);
      const session: StoredSession = {
        id,
        visitor,
        startedAt: at,
        lastSeenAt: at,
        day,
        hour,
        entryPath: entry,
        referrer: back === 21 && rand() < 0.6 ? "news.ycombinator.com" : referrer,
        utmSource: rand() < 0.08 ? "newsletter" : null,
        utmMedium: null,
        utmCampaign: null,
        country: weighted([
          ["CN", 8],
          ["US", 3],
          ["JP", 2],
          ["FR", 1],
          ["DE", 1],
          ["SG", 1],
          ["CA", 0.5]
        ]),
        lang: weighted([
          ["zh", 6],
          ["en", 4],
          ["ja", 1],
          ["fr", 0.5],
          ["zh-Hant", 0.5]
        ]),
        device: weighted([
          ["desktop", 6],
          ["mobile", 4],
          ["tablet", 0.5]
        ]),
        browser: weighted([
          ["chrome", 6],
          ["safari", 3],
          ["edge", 1],
          ["firefox", 1]
        ])
      };
      sessions.push(session);
      const add = (
        offset: number,
        fields: Partial<StoredEvent> & Pick<StoredEvent, "type" | "path">
      ) =>
        events.push({
          id: randomUUID().replace(/-/g, ""),
          at: new Date(at.getTime() + offset * 1000),
          day,
          hour,
          sessionId: id,
          visitor,
          contentType: null,
          contentId: null,
          target: null,
          detail: null,
          value: null,
          ...fields
        });

      const pages = 1 + Math.floor(rand() * rand() * 5);
      let path: AnalyticsPath = entry;
      for (let p = 0; p < pages; p++) {
        add(p * 40, { type: "page_view", path });
        const seconds = Math.round(5 + rand() * rand() * 240);
        if (pages > 1 || rand() < 0.6)
          add(p * 40 + 30, { type: "engagement", path, value: seconds });
        if (path === "/collection" && opened.length && rand() < 0.7) {
          const item = pick(opened);
          add(p * 40 + 5, {
            type: "content_view",
            path,
            contentType: item.type,
            contentId: item.contentId
          });
          if (rand() < 0.3)
            add(p * 40 + 8, {
              type: "collection_filter",
              path,
              target: pick(["movie", "anime", "track", "book"]),
              detail: rand() < 0.4 ? "list" : null
            });
        }
        if (songs.length && rand() < 0.25) {
          const song = pick(songs);
          add(p * 40 + 12, {
            type: "music_play",
            path,
            contentType: "media",
            contentId: song.contentId,
            target: rand() < 0.85 ? "site" : "spotify",
            detail: weighted([
              ["dock", 3],
              ["button", 2],
              ["all", 1]
            ])
          });
        }
        if (rand() < 0.12)
          add(p * 40 + 20, {
            type: "outbound_click",
            path,
            target: pick(["github.com", "themoviedb.org", "open.spotify.com", "linkedin.com"]),
            detail: pick(["contact", "project_links", "media_source", "listen"])
          });
        path = pick(ANALYTICS_PATHS.filter((route) => route !== "*" && route !== "/privacy"));
      }
      if (rand() < 0.5) {
        add(1, {
          type: "web_vital",
          path: entry,
          target: "lcp",
          value: Math.round(900 + rand() * rand() * 4200)
        });
        add(1, {
          type: "web_vital",
          path: entry,
          target: "cls",
          value: Math.round(rand() * rand() * 180)
        });
        if (rand() < 0.6)
          add(1, {
            type: "web_vital",
            path: entry,
            target: "inp",
            value: Math.round(40 + rand() * rand() * 450)
          });
      }
    }

    for (const route of [
      "/api/collection",
      "/api/photos",
      "/api/projects",
      "/api/spotify/player"
    ]) {
      const requests = Math.round(visits * (1 + rand()));
      await store.addRequestStats({
        day,
        route,
        requests,
        serverErrors: rand() < 0.1 ? 1 : 0,
        clientErrors: Math.floor(rand() * 3),
        totalMs: requests * (20 + rand() * 60),
        histogram: {
          "50": Math.round(requests * 0.6),
          "100": Math.round(requests * 0.3),
          "250": requests - Math.round(requests * 0.6) - Math.round(requests * 0.3)
        }
      });
    }
  }

  for (let i = 0; i < events.length; i += 5000) await store.insertEvents(events.slice(i, i + 5000));
  for (let i = 0; i < sessions.length; i += 2000)
    await prisma.analyticsSession.createMany({
      data: sessions.slice(i, i + 2000),
      skipDuplicates: true
    });
  await store.addSystemEvent({
    at: new Date(Date.now() - 3 * 86_400_000),
    kind: "job",
    name: "music-playlist-link",
    ok: true,
    message: "City Pop 100 首：新增 100，已有 0"
  });
  await store.addSystemEvent({
    at: new Date(Date.now() - 86_400_000),
    kind: "job",
    name: "steam-sync",
    ok: false,
    message: "读取不到游戏库：请在 Steam 隐私设置里把“游戏详情”设为公开"
  });
  await store.addSystemEvent({
    at: new Date(Date.now() - 7_200_000),
    kind: "source",
    name: "tmdb",
    ok: true,
    message: null
  });
  await store.addSystemEvent({
    at: new Date(Date.now() - 3_600_000),
    kind: "source",
    name: "igdb",
    ok: false,
    message: "IGDB 返回错误（HTTP 429）"
  });
  await prisma.analyticsFlag.upsert({
    where: { key: DEMO_FLAG },
    create: { key: DEMO_FLAG, value: today },
    update: { value: today }
  });

  // Roll the finished days up, as the API does every hour.
  const service = new AnalyticsService(
    store,
    config,
    { source: "none", country: async () => null },
    () => new Date(),
    catalog
  );
  await service.maintain();
  console.log(`Demo data: ${sessions.length} visits, ${events.length} events over ${DAYS} days.`);
  await prisma.$disconnect();
}

await main();
