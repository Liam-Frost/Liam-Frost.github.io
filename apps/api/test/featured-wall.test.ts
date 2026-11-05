import { afterEach, describe, expect, it } from "vitest";
import {
  CollectionSettingsStore,
  DEFAULT_COLLECTION_SETTINGS
} from "../src/media/collection-settings";
import { pickHomeWall } from "../src/media/home";
import { MemorySettingsRepository } from "../src/settings/types";
import { MemoryMediaRepository } from "./memory-media-repository";
import { buildTestServer, csrf, login } from "./helpers";

describe("featured wall data and persisted controls", () => {
  const apps: Awaited<ReturnType<typeof buildTestServer>>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });
  async function setup() {
    const media = new MemoryMediaRepository(),
      settings = new MemorySettingsRepository();
    for (let i = 0; i < 24; i++)
      await media.create({
        id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        kind: i < 12 ? "track" : "movie",
        source: "manual",
        title: { en: `Item ${i}` },
        featured: i !== 23,
        featuredOrder: 23 - i,
        visibility: i === 22 ? "private" : "public"
      });
    const app = await buildTestServer({}, { media, settings });
    apps.push(app);
    const headers = { ...csrf, cookie: await login(app) };
    return { app, media, settings, headers };
  }
  it("exposes the complete eligible candidate set, keeps the legacy three picks and respects manual order", async () => {
    const { app, media, headers } = await setup();
    const saved = await app.inject({
      method: "PUT",
      url: "/api/admin/collection/settings",
      headers,
      payload: {
        ...DEFAULT_COLLECTION_SETTINGS,
        homeFeatured: "manual",
        featuredWall: { visibleRows: 5, targetRowHeight: 240 }
      }
    });
    expect(saved.statusCode).toBe(200);
    const data = (await app.inject("/api/collection")).json();
    expect(data.home.featured).toHaveLength(3);
    expect(data.home.wall.items).toHaveLength(22);
    // Ids only: the entries themselves are in `items`.
    expect(Object.keys(data.home.wall.items[0])).toEqual(["id"]);
    expect(data.home.wall.settings).toEqual({ visibleRows: 5, targetRowHeight: 240 });
    const expected = (await media.list())
      .filter((row) => row.featured)
      .sort((a, b) => a.featuredOrder! - b.featuredOrder!)
      .map((row) => row.id);
    expect(data.home.wall.items.map((pick: { id: string }) => pick.id)).toEqual(expected);
    const read = (await app.inject({ url: "/api/admin/collection/settings", headers })).json();
    expect(read.settings.featuredWall).toEqual({ visibleRows: 5, targetRowHeight: 240 });
  });
  it("validates writes at both boundaries and persists values beyond process cache", async () => {
    const { app, settings, headers } = await setup();
    for (const wall of [
      { visibleRows: 0, targetRowHeight: 180 },
      { visibleRows: 9, targetRowHeight: 180 },
      { visibleRows: 1.5, targetRowHeight: 180 },
      { visibleRows: 3, targetRowHeight: 99 },
      { visibleRows: 3, targetRowHeight: 361 }
    ]) {
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/api/admin/collection/settings",
            headers,
            payload: { ...DEFAULT_COLLECTION_SETTINGS, featuredWall: wall }
          })
        ).statusCode
      ).toBe(400);
    }
    for (const wall of [
      { visibleRows: 1, targetRowHeight: 100 },
      { visibleRows: 8, targetRowHeight: 360 }
    ]) {
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/api/admin/collection/settings",
            headers,
            payload: { ...DEFAULT_COLLECTION_SETTINGS, featuredWall: wall }
          })
        ).statusCode
      ).toBe(200);
      expect((await new CollectionSettingsStore(settings).get()).featuredWall).toEqual(wall);
    }
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/collection/settings",
          headers: csrf,
          payload: DEFAULT_COLLECTION_SETTINGS
        })
      ).statusCode
    ).toBe(401);
  });
  it("fills legacy/invalid wall defaults without enabling categories the admin hid", async () => {
    const repo = new MemorySettingsRepository();
    const legacy = {
      ...DEFAULT_COLLECTION_SETTINGS,
      show: { ...DEFAULT_COLLECTION_SETTINGS.show, music: false }
    };
    delete legacy.featuredWall;
    await repo.set("collection", legacy);
    expect((await new CollectionSettingsStore(repo).get()).featuredWall).toEqual({
      visibleRows: 3,
      targetRowHeight: 180
    });
    await repo.set("collection", {
      ...legacy,
      featuredWall: { visibleRows: 2, targetRowHeight: 0 }
    });
    const read = await new CollectionSettingsStore(repo).get();
    expect(read.featuredWall).toEqual({ visibleRows: 2, targetRowHeight: 180 });
    expect(read.show.music).toBe(false);
  });
  it("mixes automatic sequences stably while manual sequences remain exact", async () => {
    const { media } = await setup();
    const rows = (await media.list()).filter((row) => row.featured);
    const a = pickHomeWall(rows, "rotate", "2026-11-05");
    expect(a).toEqual(pickHomeWall(rows, "rotate", "2026-11-05"));
    expect(new Set(a.map((row) => row.id)).size).toBe(rows.length);
    expect(a.slice(0, 10).filter((row) => row.kind === "track").length).toBeGreaterThan(3);
    expect(a.slice(0, 10).filter((row) => row.kind === "movie").length).toBeGreaterThan(3);
    const starts = new Set(
      Array.from(
        { length: rows.length },
        (_, i) =>
          pickHomeWall(
            rows,
            "rotate",
            new Date(Date.UTC(2026, 10, i + 1)).toISOString().slice(0, 10)
          )[0]!.id
      )
    );
    expect(starts.size).toBe(rows.length);
  });
});
