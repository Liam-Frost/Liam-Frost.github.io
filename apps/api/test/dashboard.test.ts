import type { AdminDashboard } from "@liam-frost/shared";
import { afterEach, describe, expect, it } from "vitest";

import { MemorySettingsRepository } from "../src/settings/types";
import { buildTestServer, login, offlineMediaSources } from "./helpers";
import { MemoryAnalyticsStore } from "./memory-analytics-store";
import { MemoryMediaRepository } from "./memory-media-repository";
import { MemoryPersonRepository } from "./memory-people-repository";
import { MemoryPhotoRepository, remotePhoto } from "./memory-photo-repository";
import { MemoryPlaylistRepository } from "./memory-playlist-repository";
import { MemoryProjectRepository } from "./memory-project-repository";

const NOW = new Date("2026-11-02T04:00:00Z");

describe("admin dashboard", () => {
  const apps: Awaited<ReturnType<typeof buildTestServer>>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function setup({ analytics = true } = {}) {
    const photos = new MemoryPhotoRepository();
    const projects = new MemoryProjectRepository();
    const media = new MemoryMediaRepository();
    const people = new MemoryPersonRepository();
    const playlists = new MemoryPlaylistRepository(media);
    const settings = new MemorySettingsRepository();
    const store = new MemoryAnalyticsStore();
    await store.setFlag("collection-enabled", String(analytics));

    await photos.create(remotePhoto({ id: "ref", title: { zh: "外链" } }));
    await photos.create(
      remotePhoto({ id: "own", storage: "local", visibility: "private", featured: true })
    );
    const project = await projects.create({ id: "p1", slug: "site", title: { zh: "主页" } });
    await projects.update(project.id, { visibility: "public" });
    await projects.create({ id: "p2", slug: "draft", title: { zh: "草稿", en: "Draft" } });
    await media.create({
      id: "m1",
      kind: "movie",
      source: "manual",
      title: { zh: "千与千寻" },
      status: "done"
    });
    await media.create({
      id: "m2",
      kind: "tv",
      source: "manual",
      title: { zh: "在看" },
      status: "watching"
    });
    await media.create({
      id: "s1",
      kind: "track",
      source: "manual",
      title: { en: "Song" },
      status: "done"
    });
    await settings.set("steam.account", {
      steamId: "76561197960287930",
      name: "Liam",
      avatar: null,
      profileUrl: "https://steamcommunity.com/id/liam",
      connectedAt: "2026-08-01T00:00:00Z",
      lastSyncedAt: "2026-09-01T00:00:00Z"
    });
    await store.addSystemEvent({
      at: new Date("2026-11-01T00:00:00Z"),
      kind: "source",
      name: "tmdb",
      ok: true,
      message: null
    });
    await store.addSystemEvent({
      at: new Date("2026-11-01T02:00:00Z"),
      kind: "source",
      name: "tmdb",
      ok: false,
      message: "TMDB rejected the API key"
    });
    await store.addSystemEvent({
      at: new Date("2026-11-01T03:00:00Z"),
      kind: "job",
      name: "steam-sync",
      ok: true,
      message: "3 款：新增 1，更新 2，失败 0"
    });

    const app = await buildTestServer(
      {
        STEAM_WEB_API_KEY: "steam-test-key",
        TMDB_API_KEY: "tmdb-test-key"
      },
      {
        photos,
        projects,
        media,
        people,
        playlists,
        settings,
        analyticsStore: store,
        mediaSources: {
          ...offlineMediaSources,
          available: () => ({ ...offlineMediaSources.available(), tmdb: true, bangumi: true })
        },
        now: () => NOW
      }
    );
    apps.push(app);
    const cookie = await login(app);
    const get = async () => {
      const response = await app.inject({ url: "/api/admin/dashboard", headers: { cookie } });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      return { body: response.body, data: response.json<AdminDashboard>() };
    };
    return { app, photos, get };
  }

  it("needs a signed-in admin", async () => {
    const { app } = await setup();
    expect((await app.inject("/api/admin/dashboard")).statusCode).toBe(401);
  });

  it("counts content and lists tasks, connections and recent activity", async () => {
    const { get } = await setup();
    const { data, body } = await get();

    expect(data.content).toEqual({
      ok: true,
      data: {
        photos: { total: 2, hidden: 1, featured: 1, referenced: 1 },
        projects: { total: 2, hidden: 1, featured: 0 },
        media: {
          total: 3,
          hidden: 0,
          watching: 1,
          byKind: [
            { kind: "movie", count: 1 },
            { kind: "tv", count: 1 },
            { kind: "track", count: 1 }
          ]
        },
        people: { total: 0, hidden: 0 },
        playlists: { total: 0, hidden: 0 }
      }
    });

    if (!data.tasks.ok) throw new Error(data.tasks.error);
    const tasks = Object.fromEntries(
      data.tasks.data.map((task) => [task.subject ?? task.id, task])
    );
    // Warnings first.
    expect(data.tasks.data.map((task) => task.severity)).toEqual([
      "warning",
      "warning",
      "warning",
      "warning",
      "info",
      "info",
      "info"
    ]);
    expect(tasks["photos-referenced"]).toMatchObject({
      count: 1,
      examples: [{ id: "ref", name: "外链", to: null }]
    });
    // The hidden photo is not counted as missing English.
    expect(tasks["photos-missing-en"]).toMatchObject({ count: 1 });
    expect(tasks["projects-missing-en"]).toMatchObject({
      count: 1,
      examples: [{ id: "p1", name: "主页", to: "/projects/p1" }]
    });
    expect(tasks["projects-no-cover"]).toMatchObject({ count: 1 });
    // Songs are not rated.
    expect(tasks["media-unrated"]).toMatchObject({
      count: 1,
      examples: [{ id: "m1", to: "/collection/m1" }]
    });
    expect(tasks["steam-stale"]).toBeDefined();
    expect(tasks.tmdb).toMatchObject({ id: "source-failing", severity: "warning" });

    if (!data.connections.ok) throw new Error(data.connections.error);
    expect(data.connections.data.steam).toEqual({
      configured: true,
      account: { name: "Liam", lastSyncedAt: "2026-09-01T00:00:00Z", stale: true }
    });
    expect(data.connections.data.spotify).toEqual({ configured: false, account: null });
    expect(data.connections.data.sources.find((s) => s.name === "tmdb")).toEqual({
      name: "tmdb",
      needsKey: true,
      configured: true,
      lastOk: "2026-11-01T00:00:00.000Z",
      lastError: "2026-11-01T02:00:00.000Z",
      lastErrorMessage: "TMDB rejected the API key"
    });
    expect(data.connections.data.sources.find((s) => s.name === "bangumi")).toMatchObject({
      needsKey: false,
      configured: true
    });
    // Whether a key is set, never the key.
    expect(body).not.toContain("tmdb-test-key");
    expect(body).not.toContain("steam-test-key");

    if (!data.activity.ok) throw new Error(data.activity.error);
    expect(data.activity.data.jobs).toEqual([
      {
        at: "2026-11-01T03:00:00.000Z",
        kind: "job",
        name: "steam-sync",
        ok: true,
        message: "3 款：新增 1，更新 2，失败 0"
      }
    ]);
    expect(data.activity.data.edited).toHaveLength(6);

    if (!data.traffic?.ok) throw new Error("no traffic");
    expect(data.traffic.data.online).toBe(0);
    expect(data.traffic.data.week).toHaveLength(7);
  });

  it("reports a failing part and still returns the others", async () => {
    const { photos, get } = await setup();
    photos.failing = true;
    const { data } = await get();
    // A short reason, not the error's own text.
    expect(data.content).toEqual({ ok: false, error: "读取失败，详情见服务器日志" });
    expect(data.tasks.ok).toBe(false);
    expect(data.activity.ok).toBe(false);
    expect(data.connections.ok).toBe(true);
    expect(data.traffic?.ok).toBe(true);
  });

  it("leaves traffic out when analytics is off", async () => {
    const { get } = await setup({ analytics: false });
    const { data } = await get();
    expect(data.traffic).toBeNull();
    expect(data.content.ok).toBe(true);
  });
});
