import { DEFAULT_ABOUT, splitEmphasis, toPublicAbout, type AboutContent } from "@liam-frost/shared";
import { describe, expect, it } from "vitest";

import { AboutStore } from "../src/about/store";
import { MemorySettingsRepository } from "../src/settings/types";
import { buildTestServer, csrf, login } from "./helpers";

async function setup(withSettings = true) {
  const settings = withSettings ? new MemorySettingsRepository() : null;
  const app = await buildTestServer({}, { settings });
  const headers = { ...csrf, cookie: await login(app) };
  const read = async () =>
    (await app.inject({ method: "GET", url: "/api/admin/about", headers })).json();
  const save = (about: unknown, revision: string) =>
    app.inject({ method: "PUT", url: "/api/admin/about", headers, payload: { about, revision } });
  return { app, settings, read, save };
}

const content = (patch: Partial<AboutContent> = {}): AboutContent => ({
  manifestos: [
    { id: "a", text: { en: "First *one*" }, attribution: {}, visible: true },
    { id: "b", text: { zh: "第二条" }, attribution: { zh: "某人" }, visible: false }
  ],
  rotation: { mode: "daily", fixedId: null },
  gear: [
    {
      id: "cam",
      name: { en: "Camera" },
      visible: true,
      items: [
        { id: "c1", name: "Canon R5", visible: true },
        { id: "c2", name: "Old body", visible: false }
      ]
    },
    {
      id: "empty",
      name: { en: "Empty" },
      visible: true,
      items: [{ id: "e1", name: "x", visible: false }]
    },
    {
      id: "hidden",
      name: { en: "Hidden" },
      visible: false,
      items: [{ id: "h1", name: "y", visible: true }]
    }
  ],
  ...patch
});

describe("about content", () => {
  it("serves the defaults before the first save, and without a database", async () => {
    const { app, read } = await setup();
    const initial = await read();
    expect(initial).toMatchObject({ saved: false, revision: "default", about: DEFAULT_ABOUT });
    const pub = await app.inject({ method: "GET", url: "/api/about" });
    expect(pub.json()).toEqual(toPublicAbout(DEFAULT_ABOUT));

    const none = await setup(false);
    expect((await none.app.inject({ method: "GET", url: "/api/about" })).json()).toEqual(
      toPublicAbout(DEFAULT_ABOUT)
    );
    expect((await none.read()).error.code).toBe("DATABASE_NOT_CONFIGURED");
  });

  it("saves the whole content and shows only what is visible", async () => {
    const { app, read, save } = await setup();
    const response = await save(content(), "default");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ saved: true, about: content() });
    expect((await read()).revision).toBe(response.json().revision);

    const pub = (await app.inject({ method: "GET", url: "/api/about" })).json();
    expect(pub.manifestos.map((m: { id: string }) => m.id)).toEqual(["a"]);
    expect(pub.manifestos[0]).not.toHaveProperty("visible");
    expect(pub.gear).toEqual([
      { id: "cam", name: { en: "Camera" }, items: [{ id: "c1", name: "Canon R5" }] }
    ]);
    // Daily with no fixed manifesto: the first visible one stands in.
    expect(pub.rotation).toEqual({ mode: "daily", fixedId: "a" });
  });

  it("replaces a hidden fixed manifesto by the first visible one", () => {
    const pub = toPublicAbout(content({ rotation: { mode: "fixed", fixedId: "b" } }));
    expect(pub.rotation.fixedId).toBe("a");
  });

  it("refuses a save started from an older revision", async () => {
    const { save } = await setup();
    const first = (await save(content(), "default")).json();
    const stale = await save(content({ manifestos: [] }), "default");
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe("ABOUT_OUT_OF_DATE");
    expect((await save(content({ manifestos: [] }), first.revision)).statusCode).toBe(200);
  });

  it("validates ids, names and the fixed manifesto", async () => {
    const { save } = await setup();
    const cases: [Partial<AboutContent>, RegExp][] = [
      [{ rotation: { mode: "fixed", fixedId: "missing" } }, /fixed manifesto/],
      [
        { manifestos: [{ id: "a", text: { en: "  " }, attribution: {}, visible: true }] },
        /at least one language/
      ],
      [
        {
          gear: [
            {
              id: "a",
              name: { en: "Clash" },
              visible: true,
              items: []
            }
          ]
        },
        /Duplicate ids/
      ],
      [
        {
          gear: [
            {
              id: "g",
              name: { en: "Cam" },
              visible: true,
              items: [
                { id: "i1", name: "Canon R5", visible: true },
                { id: "i2", name: "canon r5", visible: true }
              ]
            }
          ]
        },
        /already in this category/
      ]
    ];
    for (const [patch, message] of cases) {
      const response = await save(content(patch), "default");
      expect(response.statusCode).toBe(400);
      expect(response.json().error.message).toMatch(message);
    }
    expect((await save({ ...content(), extra: 1 }, "default")).statusCode).toBe(400);
  });

  it("needs an admin session", async () => {
    const { app } = await setup();
    expect((await app.inject({ method: "GET", url: "/api/admin/about" })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "PUT", url: "/api/admin/about", headers: csrf, payload: {} }))
        .statusCode
    ).toBe(401);
  });

  it("reads unreadable stored content as the defaults", async () => {
    const settings = new MemorySettingsRepository();
    await settings.set("about", { manifestos: "broken" });
    expect(await new AboutStore(settings).get()).toMatchObject({
      saved: false,
      about: DEFAULT_ABOUT
    });
  });
});

describe("splitEmphasis", () => {
  it("marks *…* and leaves a lone star alone", () => {
    expect(splitEmphasis("To be *perfect*.")).toEqual([
      { text: "To be ", em: false },
      { text: "perfect", em: true },
      { text: ".", em: false }
    ]);
    expect(splitEmphasis("5 * 3")).toEqual([{ text: "5 * 3", em: false }]);
  });
});
