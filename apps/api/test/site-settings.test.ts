import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_SETTINGS } from "@liam-frost/shared";
import { MemorySettingsRepository } from "../src/settings/types";
import { LocalImageStore } from "../src/storage/local";
import { MemoryMediaRepository } from "./memory-media-repository";
import { MemoryPhotoRepository } from "./memory-photo-repository";
import { buildTestServer, csrf, login } from "./helpers";

async function setup() {
  const settings = new MemorySettingsRepository(),
    media = new MemoryMediaRepository(),
    photos = new MemoryPhotoRepository();
  const upload = mkdtempSync(join(tmpdir(), "site-settings-")),
    store = new LocalImageStore(upload);
  const app = await buildTestServer({ UPLOAD_DIR: upload }, { settings, media, photos }),
    headers = { ...csrf, cookie: await login(app) };
  const read = async (group: string) =>
    (await app.inject({ url: `/api/admin/site-settings/${group}`, headers })).json();
  const save = async (group: string, value: unknown, revision?: string) =>
    app.inject({
      method: "PUT",
      url: `/api/admin/site-settings/${group}`,
      headers,
      payload: { value, revision: revision ?? (await read(group)).revision }
    });
  return { app, settings, media, photos, store, headers, read, save };
}
describe("grouped website settings", () => {
  it("requires admin and CSRF, isolates groups and rejects concurrent stale writes", async () => {
    const { app, headers, read, save } = await setup();
    try {
      const initial = await read("identity"),
        value = { name: { en: "New owner" }, title: { en: "New title" }, avatarPhotoId: null };
      expect((await app.inject({ url: "/api/admin/site-settings/identity" })).statusCode).toBe(401);
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/api/admin/site-settings/identity",
            headers: { cookie: headers.cookie },
            payload: { value, revision: initial.revision }
          })
        ).statusCode
      ).toBe(403);
      const writes = await Promise.all([
        save("identity", value, initial.revision),
        save("identity", { ...value, title: { en: "Other tab" } }, initial.revision)
      ]);
      expect(writes.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      expect((await read("footer")).value).toEqual(DEFAULT_SITE_SETTINGS.footer);
      expect((await save("preferences", { theme: "injected", language: "en" })).statusCode).toBe(
        400
      );
      const security = await app.inject({
        url: "/api/admin/site-settings/security/status",
        headers
      });
      expect(security.statusCode).toBe(200);
      expect(security.body).not.toMatch(/scrypt|sessionSecret|passwordHash|cookieName/);
      const pub = await app.inject({ url: "/api/site-settings" });
      expect(pub.statusCode).toBe(200);
      expect(pub.body).not.toMatch(
        /username|security|sessionSecret|passwordHash|site\.privacy\.history/
      );
    } finally {
      await app.close();
    }
  });
  it("retains privacy versions privately and never silently falls back over corrupt saved settings", async () => {
    const { app, settings, headers, save } = await setup();
    try {
      expect(
        (
          await save("privacy", {
            title: { en: "Privacy" },
            body: { en: "First" },
            effectiveDate: "2026-11-08"
          })
        ).statusCode
      ).toBe(200);
      expect(
        (
          await save("privacy", {
            title: { en: "Privacy" },
            body: { en: "Second" },
            effectiveDate: "2026-11-09"
          })
        ).statusCode
      ).toBe(200);
      const history = (
        await app.inject({ url: "/api/admin/site-settings/privacy/history", headers })
      ).json().history;
      expect(history).toHaveLength(1);
      expect(history[0].value.body.en).toBe("First");
      expect((await app.inject({ url: "/api/site-settings" })).json().privacy.body.en).toBe(
        "Second"
      );
      await settings.set("site.preferences", { theme: "broken" });
      expect((await app.inject({ url: "/api/site-settings" })).statusCode).toBe(503);
      expect(await settings.get("site.preferences")).toEqual({ theme: "broken" });
    } finally {
      await app.close();
    }
  });
  it("protects in-use dictionary IDs and aliases including private collection entries", async () => {
    const { app, media, save } = await setup();
    try {
      await media.create({
        id: "private-item",
        kind: "movie",
        source: "manual",
        title: { en: "Private" },
        visibility: "private",
        genres: [{ en: "Custom genre" }]
      });
      const entry = { id: "custom", aliases: ["Custom genre"], labels: { zh: "自定义分类" } };
      expect((await save("dictionary", { entries: [entry] })).statusCode).toBe(200);
      expect((await save("dictionary", { entries: [] })).statusCode).toBe(409);
      expect(
        (await save("dictionary", { entries: [{ ...entry, id: "different" }] })).statusCode
      ).toBe(409);
      expect(
        (
          await save("dictionary", {
            entries: [entry, { ...entry, id: "duplicate", aliases: ["CUSTOM GENRE"] }]
          })
        ).statusCode
      ).toBe(400);
      expect(
        (await save("dictionary", { entries: [{ ...entry, labels: { zh: "更新译名" } }] }))
          .statusCode
      ).toBe(200);
    } finally {
      await app.close();
    }
  });
  it("resolves only public avatars and generates versioned PNG/ICO from local public photos", async () => {
    const { app, photos, store, save } = await setup();
    try {
      const now = new Date();
      photos.rows.set("icon-photo", {
        id: "icon-photo",
        slug: "icon-photo",
        title: { en: "Icon" },
        date: "2026-11-08",
        category: {},
        location: null,
        camera: null,
        lens: null,
        settings: null,
        description: null,
        tags: [],
        alt: {},
        width: 640,
        height: 480,
        src: "",
        storage: "local",
        storageKey: "photos/icon-photo",
        variants: [{ width: 640, height: 480 }],
        source: null,
        visibility: "public",
        featured: false,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      });
      await store.write(
        "photos/icon-photo",
        "640.webp",
        await sharp({ create: { width: 640, height: 480, channels: 3, background: "#345" } })
          .webp()
          .toBuffer()
      );
      expect(
        (await save("identity", { ...DEFAULT_SITE_SETTINGS.identity, avatarPhotoId: "icon-photo" }))
          .statusCode
      ).toBe(200);
      expect((await save("favicon", { photoId: "icon-photo" })).statusCode).toBe(200);
      const pub = (await app.inject({ url: "/api/site-settings" })).json();
      expect(pub.avatarUrl).toMatch(/^\/uploads\//);
      expect(pub.faviconUrl).toMatch(/^\/api\/site-favicon\/[a-f0-9]{24}\/32\.png$/);
      const png = await app.inject({ url: pub.faviconUrl });
      expect(png.statusCode).toBe(200);
      expect(await sharp(png.rawPayload).metadata()).toMatchObject({
        format: "png",
        width: 32,
        height: 32
      });
      const ico = await app.inject({ url: pub.faviconUrl.replace("32.png", "favicon.ico") });
      expect(ico.rawPayload.readUInt16LE(2)).toBe(1);
      expect(ico.rawPayload.readUInt32LE(18)).toBe(22);
      await photos.update("icon-photo", { visibility: "private" });
      expect((await app.inject({ url: pub.faviconUrl })).statusCode).toBe(404);
      expect((await app.inject({ url: "/api/site-settings" })).json()).toMatchObject({
        avatarUrl: null,
        faviconUrl: null
      });
      expect((await save("favicon", { photoId: "icon-photo" })).statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
