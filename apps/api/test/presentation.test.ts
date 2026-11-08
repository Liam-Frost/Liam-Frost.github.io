import { describe, expect, it } from "vitest";
import { DEFAULT_PRESENTATION, genreLabel } from "@liam-frost/shared";
import { MemorySettingsRepository } from "../src/settings/types";
import { MemoryPhotoRepository } from "./memory-photo-repository";
import type { PhotoRow } from "../src/photos/types";
import { buildTestServer, csrf, login } from "./helpers";

describe("presentation settings", () => {
  it("guards writes, rejects stale saves and exposes only currently public image references", async () => {
    const photos = new MemoryPhotoRepository();
    const photo: PhotoRow = {
      id: "public-photo",
      slug: "public-photo",
      title: { en: "Landscape" },
      date: "2026-01-01",
      category: {},
      location: null,
      camera: null,
      lens: null,
      settings: null,
      description: null,
      tags: [],
      alt: {},
      width: 1600,
      height: 1000,
      src: "https://example.com/public.jpg",
      storage: "remote-url",
      storageKey: null,
      variants: null,
      source: null,
      visibility: "public",
      featured: false,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    photos.rows.set(photo.id, photo);
    const settings = new MemorySettingsRepository();
    const app = await buildTestServer({}, { settings, photos });
    const cookie = await login(app),
      headers = { ...csrf, cookie };
    const initial = (await app.inject({ url: "/api/admin/presentation", headers })).json();
    const value = structuredClone(DEFAULT_PRESENTATION);
    value.sections.skills = false;
    value.publicLogo.text = "LF";
    value.loginBackground = { mode: "rotate", photoIds: [photo.id], intervalSeconds: 20 };
    const payload = { revision: initial.revision, settings: value };
    expect(
      (await app.inject({ method: "PUT", url: "/api/admin/presentation", headers: csrf, payload }))
        .statusCode
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/presentation",
          headers: { cookie },
          payload
        })
      ).statusCode
    ).toBe(403);
    const attempts = await Promise.all(
      [1, 2].map(() =>
        app.inject({ method: "PUT", url: "/api/admin/presentation", headers, payload })
      )
    );
    expect(attempts.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const published = await app.inject("/api/presentation");
    expect(published.headers["cache-control"]).toBe("no-store");
    expect(published.json().sections.skills).toBe(false);
    expect(published.json().images[photo.id]).toBe(photo.src);
    photos.rows.set(photo.id, { ...photo, visibility: "private" });
    const hidden = await app.inject("/api/presentation");
    expect(hidden.json().images).toEqual({});
    expect(hidden.json().logoUrls).toEqual({ publicLogo: null, adminLogo: null });
    const current = (await app.inject({ url: "/api/admin/presentation", headers })).json();
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/presentation",
          headers,
          payload: { ...current, settings: value }
        })
      ).statusCode
    ).toBe(400);
    await app.close();
  });
  it("uses defaults without a database and refuses unauthenticated settings reads", async () => {
    const app = await buildTestServer();
    expect((await app.inject("/api/presentation")).json().sections).toEqual(
      DEFAULT_PRESENTATION.sections
    );
    expect((await app.inject("/api/admin/presentation")).statusCode).toBe(401);
    await app.close();
  });
});

describe("genre label fallback", () => {
  it("fills known taxonomy gaps while preserving explicit translations and unknown custom tags", () => {
    expect(genreLabel({ zh: "科幻" }, "en")).toBe("Science Fiction");
    expect(genreLabel({ zh: "战斗" }, "en")).toBe("Battle");
    expect(genreLabel({ zh: "漫改" }, "en")).toBe("Manga adaptation");
    expect(genreLabel({ zh: "实用工具" }, "fr")).toBe("Utilitaires");
    expect(genreLabel({ en: "Sci-Fi" }, "ja")).toBe("SF");
    expect(genreLabel({ zh: "漫画改" }, "fr")).toBe("Adaptation de manga");
    expect(genreLabel({ zh: "日常", en: "My custom label" }, "en")).toBe("My custom label");
    expect(genreLabel({ zh: "私人标签" }, "fr")).toBe("私人标签");
  });
});
