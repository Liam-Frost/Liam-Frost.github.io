import { afterEach, describe, expect, it } from "vitest";
import { AnalyticsSettings, analyticsPreferencesSchema } from "../src/settings/analytics";
import { MemorySettingsRepository } from "../src/settings/types";
import { loadConfig } from "../src/config/env";
import { buildTestServer, csrf, login, multipartFile } from "./helpers";
import { MemoryAnalyticsStore } from "./memory-analytics-store";

describe("runtime analytics preferences", () => {
  const apps: Awaited<ReturnType<typeof buildTestServer>>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });
  async function setup() {
    const repo = new MemorySettingsRepository();
    const store = new MemoryAnalyticsStore();
    const app = await buildTestServer({}, { settings: repo, analyticsStore: store });
    apps.push(app);
    const cookie = await login(app);
    const headers = { ...csrf, cookie };
    const get = async () =>
      (await app.inject({ url: "/api/admin/analytics/preferences", headers })).json();
    return { app, repo, store, headers, get };
  }

  it("requires authentication and CSRF, applies settings without restarting, persists across instances", async () => {
    const { app, repo, headers, get } = await setup();
    const current = await get();
    const values = {
      ...current.values,
      retentionDays: 100,
      minGroupSize: 5,
      rateLimitPerMinute: 1,
      countryMode: "header",
      countryHeader: "CF-IPCountry",
      excludeIps: ["203.0.113.0/24", "2001:db8::/32"]
    };
    const payload = { values, revision: current.revision };
    expect(
      (await app.inject({ method: "PUT", url: "/api/admin/analytics/preferences", payload }))
        .statusCode
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/analytics/preferences",
          headers: csrf,
          payload
        })
      ).statusCode
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/analytics/preferences",
          headers,
          payload
        })
      ).statusCode
    ).toBe(200);
    const meta = (await app.inject({ url: "/api/admin/analytics/meta", headers })).json();
    expect(meta).toMatchObject({ retentionDays: 100, minGroupSize: 5, countrySource: "header" });
    const reloaded = new AnalyticsSettings(repo, loadConfig({}).analytics, "/unused");
    await reloaded.load();
    expect(reloaded.config.excludeIps.has("203.0.113.8")).toBe(true);
    expect(reloaded.config.excludeIps.has("2001:db8::1")).toBe(true);
    expect(reloaded.config.countryHeader).toBe("cf-ipcountry");
    // Per-route rate limit is read at request time, not frozen when routes are registered.
    const first = await app.inject({ method: "POST", url: "/api/analytics/events", payload: {} });
    const second = await app.inject({ method: "POST", url: "/api/analytics/events", payload: {} });
    expect([first.statusCode, second.statusCode]).toEqual([204, 429]);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/analytics/preferences",
          headers,
          payload
        })
      ).statusCode
    ).toBe(409);
  });

  it("requires explicit retention confirmation and never accepts server paths or time zone rewrites", async () => {
    const { app, headers, get } = await setup();
    const current = await get();
    const payload = { revision: current.revision, values: { ...current.values, retentionDays: 7 } };
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/analytics/preferences",
          headers,
          payload
        })
      ).statusCode
    ).toBe(400);
    expect((await get()).values.retentionDays).toBe(90);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/analytics/preferences",
          headers,
          payload: { ...payload, confirmRetention: true }
        })
      ).statusCode
    ).toBe(200);
    expect(
      analyticsPreferencesSchema.safeParse({ ...payload.values, geoipDb: "/etc/passwd" }).success
    ).toBe(false);
    expect(
      analyticsPreferencesSchema.safeParse({ ...payload.values, timezone: "UTC" }).success
    ).toBe(false);
    expect(
      analyticsPreferencesSchema.safeParse({ ...payload.values, excludeIps: ["bad-ip"] }).success
    ).toBe(false);
    expect(
      analyticsPreferencesSchema.safeParse({
        ...payload.values,
        countryMode: "database",
        databaseId: "../../etc/passwd"
      }).success
    ).toBe(false);
  });

  it("rejects fake MMDB uploads and never exposes the private storage directory", async () => {
    const { app, headers } = await setup();
    const file = multipartFile("test.mmdb", Buffer.from("not a database"));
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/admin/analytics/geoip",
          payload: file.payload,
          headers: { ...file.headers, ...headers }
        })
      ).statusCode
    ).toBe(400);
    expect(
      (await app.inject({ url: "/uploads/.analytics-geoip/example.mmdb", headers })).statusCode
    ).toBe(404);
  });

  it("uses edited country headers and exclusions for new visitor sessions", async () => {
    const { app, store, headers, get } = await setup();
    const current = await get();
    const result = await app.inject({
      method: "PUT",
      url: "/api/admin/analytics/preferences",
      headers,
      payload: {
        revision: current.revision,
        values: {
          ...current.values,
          countryMode: "header",
          countryHeader: "x-country",
          excludeIps: ["203.0.113.0/24"]
        }
      }
    });
    expect(result.statusCode).toBe(200);
    async function send(id: string, ip: string) {
      return app.inject({
        method: "POST",
        url: "/api/analytics/events",
        remoteAddress: ip,
        headers: { "user-agent": "Mozilla/5.0 Chrome/140.0", "x-country": "JP" },
        payload: {
          events: [{ id: `event-${id}`, sessionId: `session-${id}`, type: "page_view", path: "/" }]
        }
      });
    }
    await send("excluded", "203.0.113.8");
    expect(store.events.size).toBe(0);
    await send("included", "198.51.100.8");
    expect(store.events.size).toBe(1);
    expect([...store.sessions.values()][0]?.country).toBe("JP");
  });

  it("keeps the site reachable and collection paused when restored preferences reference a missing database", async () => {
    const repo = new MemorySettingsRepository();
    const defaults = new AnalyticsSettings(repo, loadConfig({}).analytics, "/unused").status();
    await repo.set("analytics.preferences.v1", {
      ...defaults.values,
      countryMode: "database",
      databaseId: "00000000-0000-4000-8000-000000000000"
    });
    const app = await buildTestServer(
      {},
      { settings: repo, analyticsStore: new MemoryAnalyticsStore() }
    );
    apps.push(app);
    const headers = { ...csrf, cookie: await login(app) };
    const current = (await app.inject({ url: "/api/admin/analytics/preferences", headers })).json();
    expect(current.error).toContain("采集已暂停");
    expect((await app.inject({ url: "/api/admin/analytics/meta", headers })).json().enabled).toBe(
      false
    );
    const saved = await app.inject({
      method: "PUT",
      url: "/api/admin/analytics/preferences",
      headers,
      payload: {
        revision: current.revision,
        values: { ...current.values, countryMode: "header", countryHeader: "cf-ipcountry" }
      }
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().error).toBeNull();
    expect((await app.inject({ url: "/api/admin/analytics/meta", headers })).json().enabled).toBe(
      true
    );
  });
});
