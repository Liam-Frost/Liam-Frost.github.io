import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  const save = async (group: string, value: object, start?: object) => {
    const base = start ?? (await read(group)).value;
    return app.inject({
      method: "PATCH",
      url: `/api/admin/site-settings/${group}`,
      headers,
      payload: { changes: value, base }
    });
  };
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
            method: "PATCH",
            url: "/api/admin/site-settings/identity",
            headers: { cookie: headers.cookie },
            payload: { changes: value, base: initial.value }
          })
        ).statusCode
      ).toBe(403);
      const writes = await Promise.all([
        save("identity", value, initial.value),
        save("identity", { ...value, title: { en: "Other tab" } }, initial.value)
      ]);
      expect(writes.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      expect((await read("footer")).value).toEqual(DEFAULT_SITE_SETTINGS.footer);
      expect((await save("preferences", { theme: "injected", language: "en" })).statusCode).toBe(
        400
      );
      const security = await app.inject({
        url: "/api/admin/account",
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
      expect((await app.inject({ url: "/api/site-settings" })).json().navigation).toEqual(
        DEFAULT_SITE_SETTINGS.navigation
      );
      expect(
        (await save("navigation", { ...DEFAULT_SITE_SETTINGS.navigation, refraction: 4 }))
          .statusCode
      ).toBe(400);
      expect(
        (await save("navigation", { ...DEFAULT_SITE_SETTINGS.navigation, tabBarMode: "fixed" }))
          .statusCode
      ).toBe(400);
      expect(
        (await save("navigation", { ...DEFAULT_SITE_SETTINGS.navigation, refraction: 2.5 }))
          .statusCode
      ).toBe(200);
      expect((await app.inject({ url: "/api/site-settings" })).json().navigation.refraction).toBe(
        2.5
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
});
