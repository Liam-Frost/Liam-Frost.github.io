import { afterEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "../src/config/env";
import { IntegrationSettings } from "../src/settings/integrations";
import { liveService } from "../src/settings/live-service";
import { MemorySettingsRepository } from "../src/settings/types";
import { buildTestServer, csrf, login, SESSION_SECRET } from "./helpers";
import { MemoryMediaRepository } from "./memory-media-repository";

const STORED_KEY = "integrations.credentials.v1";
const config = () => {
  const c = loadConfig({ TMDB_API_KEY: "environment-tmdb" });
  c.admin.configured = true;
  c.admin.sessionSecret = SESSION_SECRET;
  return c;
};

afterEach(() => vi.unstubAllGlobals());

describe("encrypted API settings", () => {
  it("keeps encrypted replacements across restart, preserves blank fields, explicitly disables and restores environment fallback", async () => {
    const repo = new MemorySettingsRepository();
    const s = new IntegrationSettings(repo, config());
    await s.refresh();
    expect(s.status().providers.tmdb.source).toBe("environment");
    await s.update("tmdb", { action: "save", values: { apiKey: "new-secret-tmdb" } });
    expect(await repo.get(STORED_KEY)).not.toContain("new-secret-tmdb");
    expect(JSON.stringify(s.status())).not.toContain("environment-tmdb");
    expect(JSON.stringify(s.status())).not.toContain("new-secret-tmdb");
    const restarted = new IntegrationSettings(repo, config());
    await restarted.refresh();
    expect(restarted.values("tmdb").apiKey).toBe("new-secret-tmdb");
    await restarted.update("tmdb", { action: "save", values: { apiKey: " " } });
    expect(restarted.values("tmdb").apiKey).toBe("new-secret-tmdb");
    await restarted.update("tmdb", { action: "disable" });
    expect(restarted.status().providers.tmdb).toMatchObject({ configured: false, source: "admin" });
    await s.refresh();
    expect(s.values("tmdb").apiKey).toBeUndefined();
    await s.update("tmdb", { action: "use-environment" });
    expect(s.values("tmdb").apiKey).toBe("environment-tmdb");
  });

  it("rejects incomplete apps and unsafe redirect URLs without changing saved data", async () => {
    const repo = new MemorySettingsRepository();
    const s = new IntegrationSettings(repo, config());
    for (const uri of [
      "http://example.com/api/admin/spotify/callback",
      "http://localhost/api/admin/spotify/callback",
      "https://example.com/elsewhere",
      "https://user:pass@example.com/api/admin/spotify/callback",
      "https://example.com/api/admin/spotify/callback#leak"
    ]) {
      await expect(
        s.update("spotify", {
          action: "save",
          values: { clientId: "id", clientSecret: "secret", redirectUri: uri }
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    }
    await expect(
      s.update("igdb", { action: "save", values: { clientId: "id" } })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await repo.get(STORED_KEY)).toBeNull();
    await s.update("spotify", {
      action: "save",
      values: {
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "http://127.0.0.1:3001/api/admin/spotify/callback"
      }
    });
    await repo.set("spotify.account", { refreshToken: "old-encrypted-token" });
    await s.update("tmdb", { action: "save", values: { apiKey: "different-provider" } });
    expect(await repo.get("spotify.account")).not.toBeNull();
    await s.update("spotify", { action: "save", values: { clientSecret: "rotated-secret" } });
    expect(s.spotify()?.clientId).toBe("id");
    expect(await repo.get("spotify.account")).toBeNull();
  });

  it("does not silently fall back after key loss, and serializes concurrent provider changes", async () => {
    const repo = new MemorySettingsRepository();
    const s = new IntegrationSettings(repo, config());
    await Promise.all([
      s.update("tmdb", { action: "save", values: { apiKey: "tmdb" } }),
      s.update("steam", { action: "save", values: { apiKey: "steam" } })
    ]);
    const restarted = new IntegrationSettings(repo, config());
    await restarted.refresh();
    expect(restarted.values("tmdb").apiKey).toBe("tmdb");
    expect(restarted.values("steam").apiKey).toBe("steam");
    const changed = config();
    changed.admin.sessionSecret = "other-server-secret".repeat(3);
    await expect(new IntegrationSettings(repo, changed).refresh()).rejects.toMatchObject({
      code: "INTEGRATIONS_UNREADABLE"
    });
  });

  it("replaces cached clients on credential change while keeping in-flight calls on their original snapshot", async () => {
    let credential = "old";
    let finish: (() => void) | undefined;
    const client = liveService(
      () => credential,
      (key) => ({
        key,
        async run() {
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
          return this.key;
        }
      })
    );
    const pending = client.run();
    credential = "new";
    expect(client.key).toBe("new");
    finish!();
    expect(await pending).toBe("old");
  });
});

describe("admin API configuration", () => {
  it("requires admin authentication, CSRF and allowed IPs, and never returns saved credential values", async () => {
    const repo = new MemorySettingsRepository();
    const app = await buildTestServer({}, { settings: repo });
    try {
      expect((await app.inject("/api/admin/integrations")).statusCode).toBe(401);
      const cookie = await login(app);
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/api/admin/integrations/tmdb",
            headers: { cookie },
            payload: { action: "disable" }
          })
        ).statusCode
      ).toBe(403);
      const saved = await app.inject({
        method: "PUT",
        url: "/api/admin/integrations/tmdb",
        headers: { cookie, ...csrf },
        payload: { action: "save", values: { apiKey: "private-api-token" } }
      });
      expect(saved.statusCode).toBe(200);
      expect(saved.headers["cache-control"]).toBe("no-store");
      expect(saved.body).not.toContain("private-api-token");
      expect(saved.json().providers.tmdb).toMatchObject({
        configured: true,
        source: "admin",
        fields: { apiKey: true }
      });
      const get = await app.inject({ url: "/api/admin/integrations", headers: { cookie } });
      expect(get.body).not.toContain("private-api-token");
      for (const [provider, values] of [
        ["DATABASE_URL", { apiKey: "x" }],
        ["steam", { clientSecret: "wrong-field" }],
        ["tmdb", { apiKey: "secret\nheader" }]
      ] as const) {
        expect(
          (
            await app.inject({
              method: "PUT",
              url: `/api/admin/integrations/${provider}`,
              headers: { cookie, ...csrf },
              payload: { action: "save", values }
            })
          ).statusCode
        ).toBe(400);
      }
    } finally {
      await app.close();
    }
    const restricted = await buildTestServer(
      { ADMIN_ALLOWED_IPS: "192.0.2.1" },
      { settings: repo }
    );
    try {
      expect((await restricted.inject("/api/admin/integrations")).statusCode).toBe(404);
    } finally {
      await restricted.close();
    }
  });

  it("disallows saving without persistence", async () => {
    const app = await buildTestServer();
    try {
      const cookie = await login(app);
      const response = await app.inject({
        method: "PUT",
        url: "/api/admin/integrations/tmdb",
        headers: { cookie, ...csrf },
        payload: { action: "save", values: { apiKey: "will-not-persist" } }
      });
      expect(response.statusCode).toBe(503);
      expect(response.body).not.toContain("will-not-persist");
    } finally {
      await app.close();
    }
  });

  it("uses a new TMDB credential immediately without restarting and resets Spotify pending consent when apps change", async () => {
    const used: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        used.push(url.searchParams.get("api_key") ?? "");
        return Response.json({ results: [] });
      })
    );
    const app = await buildTestServer(
      { TMDB_API_KEY: "old-env-key" },
      {
        settings: new MemorySettingsRepository(),
        media: new MemoryMediaRepository(),
        mediaSources: null
      }
    );
    try {
      const cookie = await login(app);
      const headers = { cookie, ...csrf };
      const search = () =>
        app.inject({ url: "/api/admin/media/search?source=tmdb&kind=movie&q=test", headers });
      expect((await search()).statusCode).toBe(200);
      expect(used.at(-1)).toBe("old-env-key");
      await app.inject({
        method: "PUT",
        url: "/api/admin/integrations/tmdb",
        headers,
        payload: { action: "save", values: { apiKey: "new-live-key" } }
      });
      expect((await search()).statusCode).toBe(200);
      expect(used.at(-1)).toBe("new-live-key");
      await app.inject({
        method: "PUT",
        url: "/api/admin/integrations/tmdb",
        headers,
        payload: { action: "disable" }
      });
      const calls = used.length;
      expect((await search()).statusCode).toBe(502);
      expect(used).toHaveLength(calls);
      const saveSpotify = (id: string) =>
        app.inject({
          method: "PUT",
          url: "/api/admin/integrations/spotify",
          headers,
          payload: {
            action: "save",
            values: {
              clientId: id,
              clientSecret: "secret",
              redirectUri: "https://example.com/api/admin/spotify/callback"
            }
          }
        });
      expect((await saveSpotify("first-client")).statusCode).toBe(200);
      const connect = await app.inject({
        method: "POST",
        url: "/api/admin/spotify/connect",
        headers,
        payload: { returnTo: "http://localhost:5174/admin/collection" }
      });
      expect(connect.statusCode).toBe(200);
      const oldState = new URL(connect.json().url).searchParams.get("state");
      await saveSpotify("second-client");
      expect(
        (await app.inject(`/api/admin/spotify/callback?state=${oldState}&code=unused`)).statusCode
      ).toBe(400);
      const next = await app.inject({
        method: "POST",
        url: "/api/admin/spotify/connect",
        headers,
        payload: { returnTo: "http://localhost:5174/admin/collection" }
      });
      expect(new URL(next.json().url).searchParams.get("client_id")).toBe("second-client");
    } finally {
      await app.close();
    }
  });
});
