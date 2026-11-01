import type {
  AnalyticsAudience,
  AnalyticsContentCounts,
  AnalyticsContentDetail,
  AnalyticsContentReport,
  AnalyticsEventInput,
  AnalyticsHealth
} from "@liam-frost/shared";
import { afterEach, describe, expect, it } from "vitest";

import { fold, referrerGroup, toCsv } from "../src/analytics/reports";
import { SystemLog, withSourceLog } from "../src/analytics/system";
import { SourceError } from "../src/media/sources";
import { buildTestServer, csrf, login, offlineMediaSources } from "./helpers";
import { MemoryAnalyticsStore } from "./memory-analytics-store";
import { MemoryMediaRepository } from "./memory-media-repository";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

let counter = 0;
const id = (prefix = "e") => `${prefix}${String(++counter).padStart(10, "0")}`;
const event = (
  sessionId: string,
  fields: Partial<AnalyticsEventInput> = {}
): AnalyticsEventInput => ({
  id: id(),
  type: "page_view",
  sessionId,
  path: "/collection",
  ...fields
});

describe("analytics reports", () => {
  let clock = new Date("2026-11-02T04:00:00Z");
  const apps: Awaited<ReturnType<typeof buildTestServer>>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    clock = new Date("2026-11-02T04:00:00Z");
  });

  async function setup(env: Record<string, string> = {}) {
    const store = new MemoryAnalyticsStore();
    const media = new MemoryMediaRepository();
    const movie = await media.create({
      id: "movie-1",
      kind: "movie",
      source: "manual",
      title: { zh: "千与千寻", en: "Spirited Away" }
    });
    const song = await media.create({
      id: "song-1",
      kind: "track",
      source: "manual",
      title: { en: "=SUM(1)" }
    });
    await media.create({
      id: "hidden-1",
      kind: "movie",
      source: "manual",
      title: { zh: "隐藏" },
      visibility: "private"
    });
    const app = await buildTestServer(
      { ANALYTICS_COUNTRY_HEADER: "cf-ipcountry", ...env },
      { analyticsStore: store, media, now: () => clock }
    );
    apps.push(app);
    const send = (
      events: AnalyticsEventInput[],
      ip = "203.0.113.7",
      headers: Record<string, string> = {}
    ) =>
      app.inject({
        method: "POST",
        url: "/api/analytics/events",
        headers: { "user-agent": CHROME, "content-type": "text/plain", ...headers },
        payload: JSON.stringify({ events }),
        remoteAddress: ip
      });
    const cookie = await login(app);
    const get = async <T>(url: string) => {
      const response = await app.inject({ url, headers: { cookie } });
      expect(response.statusCode, response.body).toBe(200);
      return response.json<T>();
    };
    return { app, store, media, movie, song, send, get, cookie };
  }

  it("counts views and plays of public content only, and keeps names after deletion", async () => {
    const { app, store, media, send, get } = await setup();
    const a = id("s");
    await send([
      event(a, { referrer: "https://www.google.com/" }),
      event(a, { type: "content_view", contentType: "media", contentId: "movie-1" }),
      event(a, { type: "music_play", contentId: "song-1", target: "site", detail: "button" }),
      // Hidden, unknown and the player's sample songs are not counted.
      event(a, { type: "content_view", contentType: "media", contentId: "hidden-1" }),
      event(a, { type: "music_play", contentId: "sample-track", target: "site", detail: "dock" }),
      event(a, { type: "outbound_click", target: "themoviedb.org", detail: "media_source" }),
      event(a, { type: "collection_filter", target: "track", detail: "albums" })
    ]);
    const b = id("s");
    await send(
      [event(b), event(b, { type: "content_view", contentType: "media", contentId: "movie-1" })],
      "203.0.113.8"
    );

    const report = await get<AnalyticsContentReport>("/api/admin/analytics/content?range=today");
    expect(report.items).toEqual([
      {
        type: "media",
        id: "movie-1",
        name: "千与千寻",
        kind: "movie",
        removed: false,
        views: 2,
        visitors: 2,
        plays: 0
      },
      {
        type: "media",
        id: "song-1",
        name: "=SUM(1)",
        kind: "track",
        removed: false,
        views: 0,
        visitors: 0,
        plays: 1
      }
    ]);
    expect(report.players).toEqual([{ key: "site", value: 1 }]);
    expect(report.playSources).toEqual([{ key: "button", value: 1 }]);
    expect(report.outbound).toEqual([{ key: "themoviedb.org", value: 1 }]);
    expect(report.filters).toEqual([{ key: "track:albums", value: 1 }]);

    expect(await get<AnalyticsContentCounts>("/api/admin/analytics/counts?type=media")).toEqual({
      "movie-1": { views: 2, plays: 0 },
      "song-1": { views: 0, plays: 1 }
    });

    const detail = await get<AnalyticsContentDetail>(
      "/api/admin/analytics/content/media/movie-1?range=today"
    );
    expect(detail.item.views).toBe(2);
    expect(detail.referrers).toEqual([
      { key: "google.com", value: 1 },
      { key: "", value: 1 }
    ]);

    // Maintenance keeps the name; once deleted (and the catalog reloaded) it is shown as removed.
    clock = new Date("2026-11-02T05:00:00Z");
    // The server's own service is not exposed; a second one on the same store runs maintenance.
    await (await serviceFor(store, media)).maintain();
    expect(store.names.get("media:movie-1")?.name).toBe("千与千寻");
    await media.delete("movie-1");
    clock = new Date("2026-11-02T05:10:00Z");
    const after = await get<AnalyticsContentReport>("/api/admin/analytics/content?range=today");
    expect(after.items[0]).toMatchObject({
      id: "movie-1",
      name: "千与千寻",
      removed: true,
      views: 2
    });
    expect(
      (
        await app.inject({
          url: "/api/admin/analytics/content/media/nothing",
          headers: { cookie: await login(app) }
        })
      ).statusCode
    ).toBe(404);
  });

  async function serviceFor(store: MemoryAnalyticsStore, media: MemoryMediaRepository) {
    const { AnalyticsService } = await import("../src/analytics/service");
    const { ContentCatalog } = await import("../src/analytics/catalog");
    const { loadConfig } = await import("../src/config/env");
    const config = loadConfig({});
    return new AnalyticsService(
      store,
      config.analytics,
      { source: "none", country: async () => null },
      () => clock,
      new ContentCatalog(
        { projects: null, photos: null, media, people: null, playlists: null },
        () => clock.getTime()
      )
    );
  }

  it("groups sources and audience, folding small groups and quiet heatmap cells", async () => {
    const { send, get } = await setup();
    // Three visitors from Japan via GitHub, one from Iceland via a private link.
    for (const ip of ["203.0.113.1", "203.0.113.2", "203.0.113.3"])
      await send(
        [
          event(id("s"), {
            referrer: "https://github.com/liam",
            lang: "ja",
            utm: { source: "readme" }
          })
        ],
        ip,
        { "cf-ipcountry": "JP" }
      );
    await send([event(id("s"), { referrer: "https://secret.example.org/x" })], "203.0.113.4", {
      "cf-ipcountry": "IS"
    });

    const audience = await get<AnalyticsAudience>("/api/admin/analytics/audience?range=today");
    expect(audience.sessions).toBe(4);
    expect(audience.countries).toEqual([
      { key: "JP", value: 3 },
      { key: "", value: 1 }
    ]);
    expect(audience.referrers).toEqual([
      { key: "github.com", value: 3, group: "code" },
      { key: "", value: 1, group: "other" }
    ]);
    expect(audience.referrerGroups).toEqual([
      { key: "code", value: 3 },
      { key: "other", value: 1 }
    ]);
    expect(audience.utmSources).toEqual([
      { key: "readme", value: 3 },
      { key: "", value: 1 }
    ]);
    expect(audience.devices).toEqual([{ key: "desktop", value: 4 }]);
    // Monday 12:00: four visitors, shown; no other cell has visitors.
    const noon = audience.heatmap.find((cell) => cell.weekday === 1 && cell.hour === 12);
    expect(noon?.views).toBe(4);
  });

  it("hides heatmap cells with fewer visitors than the threshold", async () => {
    const { send, get } = await setup();
    await send([event(id("s"))]);
    const audience = await get<AnalyticsAudience>("/api/admin/analytics/audience?range=today");
    expect(
      audience.heatmap.find((cell) => cell.weekday === 1 && cell.hour === 12)?.views
    ).toBeNull();
    expect(audience.heatmap.find((cell) => cell.weekday === 1 && cell.hour === 11)?.views).toBe(0);
  });

  it("rates Web Vitals, times public API routes and lists jobs and sources", async () => {
    const { app, store, send, get } = await setup();
    const s = id("s");
    await send([
      event(s, { type: "web_vital", target: "lcp", value: 1800 }),
      event(s, { type: "web_vital", target: "lcp", value: 2100 }),
      event(s, { type: "web_vital", target: "lcp", value: 2400 }),
      event(s, { type: "web_vital", target: "lcp", value: 5200 }),
      event(s, { type: "web_vital", target: "cls", value: 30 }),
      event(s, { type: "web_vital", target: "fid", value: 30 })
    ]);
    await store.addSystemEvent({
      at: clock,
      kind: "job",
      name: "steam-sync",
      ok: false,
      message: "读取不到游戏库"
    });
    await store.addSystemEvent({
      at: new Date(clock.getTime() - 1000),
      kind: "source",
      name: "tmdb",
      ok: true,
      message: null
    });
    await store.addSystemEvent({
      at: clock,
      kind: "source",
      name: "tmdb",
      ok: false,
      message: "TMDB 返回错误（HTTP 401）"
    });

    const health = await get<AnalyticsHealth>("/api/admin/analytics/health?range=today");
    expect(health.vitals).toEqual([
      { path: "/collection", metric: "cls", samples: 1, p75: 50, rating: "good" },
      { path: "/collection", metric: "lcp", samples: 4, p75: 2500, rating: "good" }
    ]);
    expect(health.jobs).toEqual([
      {
        at: clock.toISOString(),
        kind: "job",
        name: "steam-sync",
        ok: false,
        message: "读取不到游戏库"
      }
    ]);
    expect(health.sources).toEqual([
      {
        name: "tmdb",
        lastOk: new Date(clock.getTime() - 1000).toISOString(),
        lastError: clock.toISOString(),
        lastErrorMessage: "TMDB 返回错误（HTTP 401）"
      }
    ]);

    // Public routes are timed; admin routes and events are not. Written on close (and once a minute).
    await app.inject("/api/collection");
    await app.inject("/api/photos");
    await app.close();
    apps.splice(apps.indexOf(app), 1);
    expect([...store.requests.values()].map((row) => [row.route, row.requests]).sort()).toEqual([
      ["/api/collection", 1],
      ["/api/photos", 1]
    ]);
  });

  it("logs source failures and keeps quiet about repeated successes", async () => {
    const store = new MemoryAnalyticsStore();
    let now = new Date("2026-11-02T04:00:00Z");
    const log = new SystemLog(store, () => now);
    const sources = withSourceLog(
      {
        ...offlineMediaSources,
        search: async (source) => {
          if (source === "igdb") throw new SourceError("IGDB 返回错误（HTTP 429）");
          return [];
        }
      },
      log
    );
    await sources.search("tmdb", "movie", "a");
    await sources.search("tmdb", "movie", "b");
    now = new Date(now.getTime() + 11 * 60 * 1000);
    await sources.search("tmdb", "movie", "c");
    await expect(sources.search("igdb", "game", "x")).rejects.toThrow("429");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.system.map((e) => [e.name, e.ok])).toEqual([
      ["tmdb", true],
      ["tmdb", true],
      ["igdb", false]
    ]);
  });

  it("exports Excel-safe CSV and JSON, and clears data by scope", async () => {
    const { app, store, send, cookie } = await setup();
    const s = id("s");
    await send([
      event(s),
      event(s, { type: "music_play", contentId: "song-1", target: "site", detail: "button" })
    ]);
    await store.addSystemEvent({
      at: clock,
      kind: "job",
      name: "steam-sync",
      ok: true,
      message: null
    });

    const csv = await app.inject({
      url: "/api/admin/analytics/export?dataset=content&range=today",
      headers: { cookie }
    });
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.headers["content-disposition"]).toBe(
      'attachment; filename="analytics-content-2026-11-02_2026-11-02.csv"'
    );
    expect(csv.body.startsWith("\uFEFFtype,id,name")).toBe(true);
    expect(csv.body).toContain("media,song-1,'=SUM(1),track,no,0,0,1");

    const json = await app.inject({
      url: "/api/admin/analytics/export?dataset=pages&format=json&range=today",
      headers: { cookie }
    });
    expect(json.json()).toMatchObject({
      dataset: "pages",
      rows: [{ path: "/collection", views: 1 }]
    });

    // Deleting needs the admin's CSRF header.
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: "/api/admin/analytics/data?scope=events",
          headers: { cookie }
        })
      ).statusCode
    ).toBe(403);
    const cleared = await app.inject({
      method: "DELETE",
      url: "/api/admin/analytics/data?scope=events",
      headers: { cookie, ...csrf }
    });
    expect(cleared.statusCode).toBe(204);
    expect(store.events.size).toBe(0);
    expect(store.system).toHaveLength(1);
    await app.inject({
      method: "DELETE",
      url: "/api/admin/analytics/data?scope=all",
      headers: { cookie, ...csrf }
    });
    expect(store.system).toHaveLength(0);
  });

  it("marks demo data", async () => {
    const { store, get } = await setup();
    expect((await get<{ demo: boolean }>("/api/admin/analytics/meta")).demo).toBe(false);
    store.flags.set("demo", "2026-11-02");
    expect((await get<{ demo: boolean }>("/api/admin/analytics/meta")).demo).toBe(true);
  });

  it("folds, groups referrers and escapes CSV", () => {
    expect(
      fold(
        [
          { key: "a", value: 5 },
          { key: "b", value: 1 },
          { key: "", value: 2 }
        ],
        3
      )
    ).toEqual([
      { key: "a", value: 5 },
      { key: "", value: 3 }
    ]);
    expect(referrerGroup("google.co.jp")).toBe("search");
    expect(referrerGroup("t.co")).toBe("social");
    expect(referrerGroup("github.com")).toBe("code");
    expect(referrerGroup("")).toBe("direct");
    expect(toCsv(["a"], [["-1+2"], ['x,"y"'], [3], [null]])).toBe(
      '\uFEFFa\r\n\'-1+2\r\n"x,""y"""\r\n3\r\n\r\n'
    );
  });
});
