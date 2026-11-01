import type { AnalyticsEventInput, AnalyticsOverview } from "@liam-frost/shared";
import { afterEach, describe, expect, it } from "vitest";

import { browserOf, deviceOf, isBot } from "../src/analytics/ingest";
import { AnalyticsClock } from "../src/analytics/time";
import { buildTestServer, login } from "./helpers";
import { MemoryAnalyticsStore } from "./memory-analytics-store";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

let counter = 0;
const id = (prefix = "e") => `${prefix}${String(++counter).padStart(10, "0")}`;

function event(sessionId: string, fields: Partial<AnalyticsEventInput> = {}): AnalyticsEventInput {
  return { id: id(), type: "page_view", sessionId, path: "/", lang: "zh", ...fields };
}

describe("analytics", () => {
  let clock = new Date("2026-11-02T04:00:00Z"); // 12:00 in Shanghai
  const apps: Awaited<ReturnType<typeof buildTestServer>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    clock = new Date("2026-11-02T04:00:00Z");
  });

  async function setup(env: Record<string, string> = {}) {
    const store = new MemoryAnalyticsStore();
    const app = await buildTestServer(
      { ANALYTICS_COUNTRY_HEADER: "cf-ipcountry", ...env },
      { analyticsStore: store, now: () => clock }
    );
    apps.push(app);
    const send = (
      events: AnalyticsEventInput[],
      headers: Record<string, string> = {},
      remoteAddress = "203.0.113.7"
    ) =>
      app.inject({
        method: "POST",
        url: "/api/analytics/events",
        headers: { "user-agent": CHROME, "content-type": "text/plain", ...headers },
        payload: JSON.stringify({ events }),
        remoteAddress
      });
    const overview = async (query = "range=today") => {
      const cookie = await login(app);
      const response = await app.inject({
        url: `/api/admin/analytics/overview?${query}`,
        headers: { cookie }
      });
      expect(response.statusCode).toBe(200);
      return response.json<AnalyticsOverview>();
    };
    return { app, store, send, overview };
  }

  it("stores events with a daily visitor hash and session details, never the IP", async () => {
    const { store, send } = await setup();
    const session = id("s");
    const response = await send(
      [
        event(session, {
          referrer: "https://www.google.com/search?q=liam",
          utm: { source: " Newsletter ", campaign: "Launch" }
        }),
        event(session, {
          type: "content_view",
          contentType: "photo",
          contentId: "glico-night-icon"
        })
      ],
      { "cf-ipcountry": "jp" }
    );
    expect(response.statusCode).toBe(204);

    const stored = [...store.events.values()];
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ day: "2026-11-02", hour: 12, path: "/" });
    expect(stored[0]!.visitor).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(store.sessions.get(session)).toMatchObject({
      entryPath: "/",
      referrer: "google.com",
      utmSource: "newsletter",
      utmCampaign: "launch",
      country: "JP",
      lang: "zh",
      device: "desktop",
      browser: "chrome"
    });
    expect(JSON.stringify([...store.events.values(), ...store.sessions.values()])).not.toContain(
      "203.0.113.7"
    );

    // The next day's salt gives the same person another hash, and yesterday's salt is gone.
    const firstHash = stored[0]!.visitor;
    clock = new Date("2026-11-03T04:00:00Z");
    await send([event(id("s"))]);
    const next = [...store.events.values()].find((e) => e.day === "2026-11-03")!;
    expect(next.visitor).not.toBe(firstHash);
    expect([...store.salts.keys()]).toEqual(["2026-11-03"]);
  });

  it("skips bots, the signed-in admin, excluded IPs and malformed events", async () => {
    const { app, store, send } = await setup({ ANALYTICS_EXCLUDE_IPS: "198.51.100.0/24" });
    await send([event(id("s"))], { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" });
    await send([event(id("s"))], { "user-agent": "" });
    await send([event(id("s"))], {}, "198.51.100.20");
    const cookie = await login(app);
    expect((await send([event(id("s"))], { cookie })).statusCode).toBe(204);
    expect(store.events.size).toBe(0);

    const session = id("s");
    await send([
      event(session),
      // Unknown path, missing content, a bad player, no visible time.
      { ...event(session), path: "/admin" as never },
      event(session, { type: "content_view", contentType: "project" }),
      event(session, { type: "music_play", contentId: "t1", target: "radio", detail: "button" }),
      event(session, { type: "engagement", value: 0 })
    ]);
    expect([...store.events.values()].map((e) => e.type)).toEqual(["page_view"]);

    // Not JSON, or too many events: still 204, nothing stored.
    const bad = await app.inject({
      method: "POST",
      url: "/api/analytics/events",
      headers: { "user-agent": CHROME, "content-type": "text/plain" },
      payload: "{not json"
    });
    expect(bad.statusCode).toBe(204);
    const many = Array.from({ length: 51 }, () => event(id("s")));
    await send(many);
    expect(store.events.size).toBe(1);
  });

  it("drops the same event sent twice and a repeated click within a second", async () => {
    const { store, send } = await setup();
    const session = id("s");
    const view = event(session);
    await send([view]);
    await send([view]);
    const click = { type: "outbound_click" as const, target: "github.com", detail: "header" };
    await send([event(session, click), event(session, click)]);
    clock = new Date(clock.getTime() + 1500);
    await send([event(session, click)]);
    expect([...store.events.values()].map((e) => e.type)).toEqual([
      "page_view",
      "outbound_click",
      "outbound_click"
    ]);
  });

  it("reads devices and browsers from the User-Agent", () => {
    expect(deviceOf(IPHONE)).toBe("mobile");
    expect(browserOf(IPHONE)).toBe("safari");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)")).toBe("tablet");
    expect(browserOf(`${CHROME} Edg/140.0`)).toBe("edge");
    expect(isBot(CHROME)).toBe(false);
    expect(isBot("Mozilla/5.0 HeadlessChrome/140.0")).toBe(true);
  });

  it("totals today, compares with yesterday until the same time, and rolls days up", async () => {
    const { store, send, overview } = await setup();

    // Yesterday: one visitor, one session reading two pages (morning), one bounce in the evening.
    clock = new Date("2026-11-01T01:00:00Z"); // 09:00
    const reader = id("s");
    await send([event(reader), event(reader, { path: "/projects" })]);
    await send([event(reader, { type: "engagement", path: "/projects", value: 40 })]);
    clock = new Date("2026-11-01T12:00:00Z"); // 20:00, after the comparison cut
    await send([event(id("s"))], {}, "203.0.113.8");

    // Today: two visitors by 12:00.
    clock = new Date("2026-11-02T02:00:00Z"); // 10:00
    const a = id("s");
    await send([event(a), event(a, { type: "engagement", value: 5 })]);
    clock = new Date("2026-11-02T03:58:00Z"); // 11:58
    const b = id("s");
    await send([event(b, { path: "/collection" }), event(b)], {}, "203.0.113.9");
    clock = new Date("2026-11-02T04:00:00Z");

    const today = await overview();
    expect(today.range).toMatchObject({ from: "2026-11-02", to: "2026-11-02" });
    expect(today.current).toEqual({
      views: 3,
      visitors: 2,
      sessions: 2,
      avgEngagedSeconds: 3,
      bounceRate: 0.5
    });
    // Yesterday until 12:00: the reader only.
    expect(today.previous).toMatchObject({ views: 2, visitors: 1, sessions: 1, bounceRate: 0 });
    expect(today.trend.bucket).toBe("hour");
    expect(today.trend.points).toHaveLength(13);
    expect(today.trend.points[10]).toEqual({ key: "10", views: 1, visitors: 1, sessions: 1 });
    expect(today.topPages[0]).toEqual({ path: "/", views: 2, avgEngagedSeconds: 3 });
    expect(today.online).toBe(1);

    // Rolling up stores yesterday's totals; raw data past retention goes away.
    const service = await serviceOf(store);
    await service.maintain();
    expect(store.rolled.has("2026-11-01")).toBe(true);
    expect(store.rows.find((r) => r.day === "2026-11-01" && r.metric === "views")?.value).toBe(3);

    const week = await overview("range=7d");
    expect(week.trend.bucket).toBe("day");
    expect(week.trend.points.map((p) => p.views)).toEqual([0, 0, 0, 0, 0, 3, 3]);
    expect(week.current).toMatchObject({ views: 6, visitors: 4, sessions: 4 });

    clock = new Date("2027-03-01T04:00:00Z");
    await service.maintain();
    expect(store.events.size).toBe(0);
    expect(store.sessions.size).toBe(0);
    expect(store.rows.some((r) => r.day === "2026-11-01")).toBe(true);

    function serviceOf(memory: MemoryAnalyticsStore) {
      return import("../src/analytics/service").then(
        ({ AnalyticsService }) =>
          new AnalyticsService(
            memory,
            {
              enabled: true,
              timezone: "Asia/Shanghai",
              retentionDays: 90,
              minGroupSize: 3,
              rateLimitPerMinute: 60,
              excludeIps: { has: () => false } as never,
              countryHeader: null,
              geoipDb: null
            },
            { source: "none", country: async () => null },
            () => clock
          )
      );
    }
  });

  it("checks ranges and needs the admin", async () => {
    const { app, overview } = await setup();
    expect((await app.inject("/api/admin/analytics/overview")).statusCode).toBe(401);
    const cookie = await login(app);
    const future = await app.inject({
      url: "/api/admin/analytics/overview?range=custom&from=2026-11-01&to=2026-12-01",
      headers: { cookie }
    });
    expect(future.statusCode).toBe(400);
    const custom = await overview("range=custom&from=2026-10-01&to=2026-10-31");
    expect(custom.range).toMatchObject({ previousFrom: "2026-08-31", previousTo: "2026-09-30" });
    expect(custom.trend.points).toHaveLength(31);
    const meta = await app.inject({ url: "/api/admin/analytics/meta", headers: { cookie } });
    expect(meta.json()).toMatchObject({
      enabled: true,
      countrySource: "header",
      retentionDays: 90
    });
  });

  it("finds local days and hours in the time zone", () => {
    const clock = new AnalyticsClock("America/New_York");
    expect(clock.local(new Date("2026-03-09T03:59:00Z"))).toEqual({ day: "2026-03-08", hour: 23 });
  });

  it("accepts events without a database and drops them", async () => {
    const app = await buildTestServer({}, {});
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/analytics/events",
      headers: { "user-agent": CHROME },
      payload: { events: [event(id("s"))] }
    });
    expect(response.statusCode).toBe(204);
    const cookie = await login(app);
    expect(
      (await app.inject({ url: "/api/admin/analytics/meta", headers: { cookie } })).statusCode
    ).toBe(503);
  });
});
