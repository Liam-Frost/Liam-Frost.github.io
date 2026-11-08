import { describe, expect, it } from "vitest";
import { DEFAULT_PRESENTATION, DEFAULT_SITE_SETTINGS } from "@liam-frost/shared";
import type { PhotoRow } from "../src/photos/types";
import { MemorySettingsRepository } from "../src/settings/types";
import { MemoryPhotoRepository } from "./memory-photo-repository";
import { buildTestServer, csrf, login } from "./helpers";

const photo = (id: string, visibility: "public" | "private"): PhotoRow => ({
  id,
  slug: id,
  title: { en: id },
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
  src: `https://example.com/${id}.jpg`,
  storage: "remote-url",
  storageKey: null,
  variants: null,
  source: null,
  visibility,
  featured: false,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date()
});

async function setup() {
  const settings = new MemorySettingsRepository(),
    photos = new MemoryPhotoRepository();
  const app = await buildTestServer({}, { settings, photos }),
    cookie = await login(app),
    headers = { ...csrf, cookie };
  const patch = (
    url: string,
    changes: unknown,
    base: unknown,
    withHeaders: Record<string, string> = headers
  ) => app.inject({ method: "PATCH", url, headers: withHeaders, payload: { changes, base } });
  const get = async (url: string) => (await app.inject({ url, headers })).json();
  return { app, settings, photos, headers, cookie, patch, get };
}

const IDENTITY = "/api/admin/site-settings/identity";
const PRESENTATION = "/api/admin/presentation";

describe("saving settings field by field", () => {
  it("lets two editors of different fields save from the same starting point", async () => {
    const { app, patch, get } = await setup();
    try {
      const start = DEFAULT_SITE_SETTINGS.identity;
      expect(
        (await patch(IDENTITY, { title: { en: "T" } }, { title: start.title })).statusCode
      ).toBe(200);
      expect((await patch(IDENTITY, { name: { en: "N" } }, { name: start.name })).statusCode).toBe(
        200
      );
      const saved = (await get(IDENTITY)).value;
      expect(saved.title).toEqual({ en: "T" });
      expect(saved.name).toEqual({ en: "N" });
    } finally {
      await app.close();
    }
  });

  it("refuses a change to a field someone else changed, and names it", async () => {
    const { app, patch, get } = await setup();
    try {
      const base = { title: DEFAULT_SITE_SETTINGS.identity.title };
      expect((await patch(IDENTITY, { title: { en: "First" } }, base)).statusCode).toBe(200);
      const late = await patch(IDENTITY, { title: { en: "Second" } }, base);
      expect(late.statusCode).toBe(409);
      expect(late.json().error.code).toBe("SETTINGS_CONFLICT");
      expect(late.json().error.details.fields).toEqual(["title"]);
      expect(late.json().error.details.current.value.title).toEqual({ en: "First" });
      expect((await get(IDENTITY)).value.title).toEqual({ en: "First" });
    } finally {
      await app.close();
    }
  });

  it("does not lose an update when two saves of one field race", async () => {
    const { app, patch } = await setup();
    try {
      const base = { title: DEFAULT_SITE_SETTINGS.identity.title };
      const results = await Promise.all([
        patch(IDENTITY, { title: { en: "A" } }, base),
        patch(IDENTITY, { title: { en: "B" } }, base)
      ]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    } finally {
      await app.close();
    }
  });

  it("treats saving the value already there as no conflict", async () => {
    const { app, patch } = await setup();
    try {
      const base = { title: DEFAULT_SITE_SETTINGS.identity.title };
      expect((await patch(IDENTITY, { title: { en: "Same" } }, base)).statusCode).toBe(200);
      expect((await patch(IDENTITY, { title: { en: "Same" } }, base)).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("still validates the result and guards the route", async () => {
    const { app, cookie, patch } = await setup();
    try {
      expect((await patch(IDENTITY, { unknown: 1 }, { unknown: null })).statusCode).toBe(400);
      expect((await patch(IDENTITY, { title: "not text" }, { title: {} })).statusCode).toBe(400);
      expect((await patch(IDENTITY, { title: { en: "x" } }, {}, { cookie })).statusCode).toBe(403);
      expect((await patch(IDENTITY, { title: { en: "x" } }, {}, csrf)).statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});

describe("presentation settings and hidden login photos", () => {
  const stored = (photoIds: string[]) => ({
    ...DEFAULT_PRESENTATION,
    loginBackground: { mode: "daily" as const, photoIds }
  });

  it("saves unrelated fields when a login photo has since been hidden", async () => {
    const { app, settings, photos, patch, get } = await setup();
    try {
      photos.rows.set("hidden", photo("hidden", "private"));
      await settings.set("presentation.v1", stored(["hidden"]));
      const logo = await patch(
        PRESENTATION,
        { publicLogo: { text: "LF" } },
        { publicLogo: DEFAULT_PRESENTATION.publicLogo }
      );
      expect(logo.statusCode).toBe(200);
      expect((await get(PRESENTATION)).settings.publicLogo.text).toBe("LF");
    } finally {
      await app.close();
    }
  });

  it("keeps an already chosen hidden photo but refuses to add a private one", async () => {
    const { app, settings, photos, patch } = await setup();
    try {
      photos.rows.set("hidden", photo("hidden", "private"));
      photos.rows.set("other-private", photo("other-private", "private"));
      photos.rows.set("open", photo("open", "public"));
      await settings.set("presentation.v1", stored(["hidden"]));
      const base = { loginBackground: stored(["hidden"]).loginBackground };
      const mode = await patch(
        PRESENTATION,
        { loginBackground: { ...base.loginBackground, mode: "visit" } },
        base
      );
      expect(mode.statusCode).toBe(200);
      const next = { ...base.loginBackground, mode: "visit" };
      const added = await patch(
        PRESENTATION,
        { loginBackground: { ...next, photoIds: ["hidden", "other-private"] } },
        { loginBackground: next }
      );
      expect(added.statusCode).toBe(400);
      const addedPublic = await patch(
        PRESENTATION,
        { loginBackground: { ...next, photoIds: ["hidden", "open"] } },
        { loginBackground: next }
      );
      expect(addedPublic.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("never exposes a hidden photo on the login page", async () => {
    const { app, settings, photos } = await setup();
    try {
      photos.rows.set("hidden", photo("hidden", "private"));
      photos.rows.set("open", photo("open", "public"));
      await settings.set("presentation.v1", stored(["hidden", "open"]));
      const shown = (await app.inject("/api/presentation")).json();
      expect(Object.keys(shown.images)).toEqual(["open"]);
    } finally {
      await app.close();
    }
  });

  it("detects field conflicts between pages sharing the document", async () => {
    const { app, patch } = await setup();
    try {
      const sections = { sections: DEFAULT_PRESENTATION.sections };
      const logos = { publicLogo: DEFAULT_PRESENTATION.publicLogo };
      expect(
        (
          await patch(
            PRESENTATION,
            { sections: { ...DEFAULT_PRESENTATION.sections, about: false } },
            sections
          )
        ).statusCode
      ).toBe(200);
      expect((await patch(PRESENTATION, { publicLogo: { text: "A" } }, logos)).statusCode).toBe(
        200
      );
      const late = await patch(PRESENTATION, { publicLogo: { text: "B" } }, logos);
      expect(late.statusCode).toBe(409);
      expect(late.json().error.details.fields).toEqual(["publicLogo"]);
    } finally {
      await app.close();
    }
  });

  it("saves any rotation mode, with no photos meaning a plain background", async () => {
    const { app, settings, photos, patch, get } = await setup();
    try {
      photos.rows.set("open", photo("open", "public"));
      await settings.set("presentation.v1", stored(["open"]));
      for (const [from, mode] of [
        ["daily", "session"],
        ["session", "fixed"]
      ] as const) {
        const response = await patch(
          PRESENTATION,
          { loginBackground: { mode, photoIds: ["open"] } },
          { loginBackground: { mode: from, photoIds: ["open"] } }
        );
        expect(response.statusCode).toBe(200);
      }
      const cleared = await patch(
        PRESENTATION,
        { loginBackground: { mode: "fixed", photoIds: [] } },
        { loginBackground: { mode: "fixed", photoIds: ["open"] } }
      );
      expect(cleared.statusCode).toBe(200);
      expect((await get(PRESENTATION)).settings.loginBackground.photoIds).toEqual([]);
      const unknown = await patch(
        PRESENTATION,
        { loginBackground: { mode: "weekly", photoIds: [] } },
        { loginBackground: { mode: "fixed", photoIds: [] } }
      );
      expect(unknown.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("reads backgrounds saved with the old modes", async () => {
    const { app, settings, get } = await setup();
    try {
      await settings.set("presentation.v1", {
        ...DEFAULT_PRESENTATION,
        loginBackground: { mode: "rotate", photoIds: ["a", "b"], intervalSeconds: 30 }
      });
      expect((await get(PRESENTATION)).settings.loginBackground).toEqual({
        mode: "visit",
        photoIds: ["a", "b"]
      });
      await settings.set("presentation.v1", {
        ...DEFAULT_PRESENTATION,
        loginBackground: { mode: "none", photoIds: ["a"], intervalSeconds: 30 }
      });
      expect((await get(PRESENTATION)).settings.loginBackground).toEqual({
        mode: "fixed",
        photoIds: []
      });
    } finally {
      await app.close();
    }
  });
});
