import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { SourceError, type MediaSources, type SourceDetails } from "../src/media/sources";
import { isMediaPublic } from "../src/media/types";
import { MemorySettingsRepository } from "../src/settings/types";
import { buildTestServer, csrf, login, multipartFile, offlineMediaSources } from "./helpers";
import { MemoryMediaRepository } from "./memory-media-repository";

let png: Buffer;

beforeAll(async () => {
  png = await sharp({ create: { width: 600, height: 900, channels: 3, background: "#246" } }).png().toBuffer();
});

const details = (overrides: Partial<SourceDetails> = {}): SourceDetails => ({
  sourceId: "movie:129",
  sourceUrl: "https://www.themoviedb.org/movie/129",
  title: { zh: "千与千寻", en: "Spirited Away", ja: "千と千尋の神隠し" },
  originalTitle: "千と千尋の神隠し",
  year: 2001,
  genres: [{ zh: "动画", en: "Animation" }],
  credits: ["宫崎骏"],
  overview: { zh: "简介", en: "Overview" },
  posterUrl: "https://image.tmdb.org/t/p/w780/poster.jpg",
  episodes: null,
  publication: null,
  ...overrides
});

function fakeSources(overrides: Partial<MediaSources> = {}): MediaSources {
  return {
    ...offlineMediaSources,
    available: () => ({ tmdb: true, bangumi: true, openlibrary: true, googlebooks: true, anilist: true }),
    search: async (source) => [
      { source, sourceId: "movie:129", mediaType: "movie", creators: [], title: "千与千寻", originalTitle: null, year: 2001, posterUrl: null, overview: "" },
      { source, sourceId: "movie:4935", mediaType: "movie", creators: [], title: "哈尔的移动城堡", originalTitle: null, year: 2004, posterUrl: null, overview: "" }
    ],
    details: async (_source, _kind, sourceId) => details({ sourceId }),
    download: async () => png,
    romaji: async () => null,
    ...overrides
  };
}

async function setup(sources: MediaSources = fakeSources()) {
  const uploadDir = mkdtempSync(join(tmpdir(), "lf-media-"));
  const media = new MemoryMediaRepository();
  const settings = new MemorySettingsRepository();
  const app = await buildTestServer({ UPLOAD_DIR: uploadDir }, { media, settings, mediaSources: sources });
  const cookie = await login(app);
  const headers = { ...csrf, cookie };
  const importEntry = (sourceId = "movie:129", kind = "movie") =>
    app.inject({ method: "POST", url: "/api/admin/media/import", headers, payload: { kind, source: "tmdb", sourceId } });
  const patch = (id: string, payload: object) => app.inject({ method: "PATCH", url: `/api/admin/media/${id}`, headers, payload });
  return { app, media, settings, cookie, headers, uploadDir, importEntry, patch };
}

describe("collection visibility rules", () => {
  const settings = { show: { movie: true, tv: false, anime: true, book: true, comic: false, music: true, people: true }, showWant: false };
  it("combines the entry, its kind and the want switch", () => {
    expect(isMediaPublic({ kind: "movie", status: "done", visibility: "public" }, settings)).toBe(true);
    expect(isMediaPublic({ kind: "movie", status: "done", visibility: "private" }, settings)).toBe(false);
    expect(isMediaPublic({ kind: "tv", status: "done", visibility: "public" }, settings)).toBe(false);
    expect(isMediaPublic({ kind: "movie", status: "want", visibility: "public" }, settings)).toBe(false);
    expect(isMediaPublic({ kind: "movie", status: "want", visibility: "public" }, { ...settings, showWant: true })).toBe(true);
    expect(isMediaPublic({ kind: "track", status: null, visibility: "public" }, settings)).toBe(true);
  });
});

describe("admin collection", () => {
  it("needs a database", async () => {
    const app = await buildTestServer();
    const cookie = await login(app);
    expect((await app.inject({ url: "/api/admin/media", headers: { cookie } })).statusCode).toBe(503);
  });

  it("searches sources and marks entries already added", async () => {
    const { app, cookie, importEntry } = await setup();
    await importEntry("movie:129");
    const response = await app.inject({ url: "/api/admin/media/search?kind=movie&source=tmdb&q=%E5%8D%83", headers: { cookie } });
    expect(response.statusCode).toBe(200);
    const results = response.json().results;
    expect(results[0].existingId).toEqual(expect.any(String));
    expect(results[1].existingId).toBeNull();

    expect((await app.inject({ url: "/api/admin/media/search?kind=movie&source=tmdb&q=", headers: { cookie } })).statusCode).toBe(400);
  });

  it("reports source failures as 502 with their message", async () => {
    const { app, cookie } = await setup(
      fakeSources({
        search: async () => {
          throw new SourceError("TMDB 拒绝了请求，请检查 API key");
        }
      })
    );
    const response = await app.inject({ url: "/api/admin/media/search?kind=movie&source=tmdb&q=x", headers: { cookie } });
    expect(response.statusCode).toBe(502);
    expect(response.json().error).toEqual({ code: "SOURCE_ERROR", message: "TMDB 拒绝了请求，请检查 API key" });
  });

  it("imports details and a local poster, once per source entry", async () => {
    const { importEntry, uploadDir } = await setup();
    const response = await importEntry();
    expect(response.statusCode).toBe(201);
    const { item } = response.json();
    expect(item).toMatchObject({ kind: "movie", source: "tmdb", sourceId: "movie:129", year: 2001, status: "done", visibility: "public" });
    expect(item.title.en).toBe("Spirited Away");
    expect(item.poster.variants.map((v: { width: number }) => v.width)).toEqual([427, 600]);
    expect(existsSync(join(uploadDir, "media", item.id))).toBe(true);

    const again = await importEntry();
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe("MEDIA_EXISTS");
  });

  it("imports without a poster when the download fails, and sets series progress", async () => {
    const { importEntry } = await setup(
      fakeSources({
        details: async (_s, _k, sourceId) => details({ sourceId, episodes: 12 }),
        download: async () => {
          throw new SourceError("无法连接 海报服务器");
        }
      })
    );
    const response = await importEntry("tv:1", "tv");
    expect(response.statusCode).toBe(201);
    expect(response.json().item.poster).toBeNull();
    expect(response.json().item.progress).toEqual({ watched: 0, total: 12 });
  });

  it("puts the romaji name of anime in English and French", async () => {
    const { importEntry } = await setup(
      fakeSources({
        details: async (_s, _k, sourceId) => details({ sourceId, title: { zh: "孤独摇滚！", ja: "ぼっち・ざ・ろっく！" }, originalTitle: "ぼっち・ざ・ろっく！" }),
        romaji: async (native) => (native === "ぼっち・ざ・ろっく！" ? "Bocchi the Rock!" : null)
      })
    );
    const { item } = (await importEntry("tv:9", "anime")).json();
    expect(item.title).toEqual({ zh: "孤独摇滚！", ja: "ぼっち・ざ・ろっく！", en: "Bocchi the Rock!", fr: "Bocchi the Rock!" });
  });

  it("only imports from source entries the server looks up", async () => {
    const download = vi.fn(async () => png);
    const { app, headers } = await setup(fakeSources({ download }));
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/media/import",
      headers,
      payload: { kind: "movie", source: "tmdb", sourceId: "movie:1", posterUrl: "http://169.254.169.254/" }
    });
    expect(response.statusCode).toBe(400);
    expect(download).not.toHaveBeenCalled();
  });

  it("creates manual entries and validates edits", async () => {
    const { app, headers, patch } = await setup();
    const created = await app.inject({ method: "POST", url: "/api/admin/media", headers, payload: { kind: "anime", title: { zh: "自制条目" } } });
    expect(created.statusCode).toBe(201);
    const { id } = created.json().item;

    for (const payload of [
      { rating: 6 },
      { rating: 0 },
      { watchedOn: "2026-13-01" },
      { watchedOn: "2026-02-31" },
      { progress: { watched: 13, total: 12 } },
      { title: {} },
      { status: "maybe" },
      { genres: [{}] },
      { posterUrl: "x" }
    ]) {
      expect((await patch(id, payload)).statusCode, JSON.stringify(payload)).toBe(400);
    }

    const saved = await patch(id, {
      rating: 5,
      status: "watching",
      watchedOn: "2026-10-30",
      rewatchCount: 2,
      progress: { watched: 3, total: null },
      review: { zh: "好看", en: "Great", fr: "" },
      genres: [{ zh: "治愈" }],
      visibility: "private"
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().item).toMatchObject({
      rating: 5,
      status: "watching",
      watchedOn: "2026-10-30",
      rewatchCount: 2,
      progress: { watched: 3, total: null },
      review: { zh: "好看", en: "Great" },
      visibility: "private"
    });

    const cleared = await patch(id, { rating: null, watchedOn: "", progress: null });
    expect(cleared.json().item).toMatchObject({ rating: null, watchedOn: null, progress: null });
  });

  it("replaces the poster and deletes entries with their files", async () => {
    const { app, headers, importEntry, uploadDir } = await setup();
    const { item } = (await importEntry()).json();
    const body = multipartFile("poster.png", png, "image/png");
    const replaced = await app.inject({ method: "POST", url: `/api/admin/media/${item.id}/poster`, headers: { ...headers, ...body.headers }, payload: body.payload });
    expect(replaced.statusCode).toBe(201);
    const poster = replaced.json().item.poster;
    expect(poster.id).not.toBe(item.poster.id);
    expect(existsSync(join(uploadDir, "media", item.id, item.poster.id))).toBe(false);
    expect(existsSync(join(uploadDir, "media", item.id, poster.id))).toBe(true);

    expect((await app.inject({ method: "DELETE", url: `/api/admin/media/${item.id}`, headers })).statusCode).toBe(204);
    expect(existsSync(join(uploadDir, "media", item.id))).toBe(false);
  });

  it("saves collection settings and reports configured sources", async () => {
    const { app, cookie, headers } = await setup();
    const initial = (await app.inject({ url: "/api/admin/collection/settings", headers: { cookie } })).json();
    expect(initial).toEqual({ settings: { show: { movie: true, tv: true, anime: true, book: true, comic: true, music: true, people: true }, showWant: true }, sources: { tmdb: true, bangumi: true, openlibrary: true, googlebooks: true, anilist: true } });

    const next = { show: { movie: true, tv: false, anime: true, music: true, people: false }, showWant: false };
    const saved = await app.inject({ method: "PUT", url: "/api/admin/collection/settings", headers, payload: next });
    // Settings from before people, books and comics existed show them.
    // Settings from before people existed show people.
    const legacy = { show: { movie: true, tv: true, anime: true, music: true }, showWant: true };
    const upgraded = await app.inject({ method: "PUT", url: "/api/admin/collection/settings", headers, payload: legacy });
    expect(upgraded.json().settings.show.people).toBe(true);
    expect((await app.inject({ method: "PUT", url: "/api/admin/collection/settings", headers, payload: { showWant: false } })).statusCode).toBe(400);
  });

  it("serves posters only when the site may show the entry", async () => {
    const { app, cookie, headers, importEntry, patch } = await setup();
    const { item } = (await importEntry()).json();
    const url = item.poster.variants[0].url;

    expect((await app.inject(url)).statusCode).toBe(200);

    await patch(item.id, { status: "want" });
    await app.inject({ method: "PUT", url: "/api/admin/collection/settings", headers, payload: { show: { movie: true, tv: true, anime: true, music: true }, showWant: false } });
    expect((await app.inject(url)).statusCode).toBe(404);
    expect((await app.inject({ url, headers: { cookie } })).statusCode).toBe(200);

    await patch(item.id, { status: "done", visibility: "private" });
    expect((await app.inject(url)).statusCode).toBe(404);

    await patch(item.id, { visibility: "public" });
    await app.inject({ method: "PUT", url: "/api/admin/collection/settings", headers, payload: { show: { movie: false, tv: true, anime: true, music: true }, showWant: true } });
    expect((await app.inject(url)).statusCode).toBe(404);
  });
});

describe("public collection", () => {
  it("is empty without a database", async () => {
    const app = await buildTestServer();
    expect((await app.inject("/api/collection")).json()).toEqual({ kinds: [], items: [], people: [] });
  });

  it("lists only what the site may show, without synopses or reviews", async () => {
    const { app, headers, importEntry, patch } = await setup();
    const shown = (await importEntry("movie:1")).json().item;
    const hidden = (await importEntry("movie:2")).json().item;
    const wanted = (await importEntry("movie:3")).json().item;
    const series = (await importEntry("tv:4", "tv")).json().item;
    await patch(shown.id, { review: { en: "Lovely" }, rating: 5 });
    await patch(hidden.id, { visibility: "private" });
    await patch(wanted.id, { status: "want" });
    await app.inject({ method: "PUT", url: "/api/admin/collection/settings", headers, payload: { show: { movie: true, tv: false, anime: true, music: true }, showWant: false } });

    const body = (await app.inject("/api/collection")).json();
    expect(body.kinds).toEqual(["movie", "anime", "book", "comic", "track"]);
    expect(body.items.map((item: { id: string }) => item.id)).toEqual([shown.id]);
    expect(body.items[0]).toMatchObject({ rating: 5, hasReview: true });
    expect(body.items[0]).not.toHaveProperty("review");
    expect(body.items[0]).not.toHaveProperty("overview");
    expect(body.items[0]).not.toHaveProperty("visibility");

    const detail = await app.inject(`/api/collection/${shown.id}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ review: { en: "Lovely" }, overview: { en: "Overview" }, sourceUrl: expect.stringContaining("themoviedb") });

    for (const id of [hidden.id, wanted.id, series.id, "00000000-0000-0000-0000-000000000000", "nope"]) {
      expect((await app.inject(`/api/collection/${id}`)).statusCode, id).toBe(404);
    }
  });

  it("answers an empty list when the database fails, and 503 for details", async () => {
    const { app, media, importEntry } = await setup();
    const { item } = (await importEntry()).json();
    const refused = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    media.list = async () => {
      throw refused;
    };
    media.get = async () => {
      throw refused;
    };
    expect((await app.inject("/api/collection")).json()).toEqual({ kinds: [], items: [], people: [] });
    expect((await app.inject(`/api/collection/${item.id}`)).statusCode).toBe(503);
  });
});

describe("books and comics", () => {
  it("imports a comic with its volumes and publication details, and edits them", async () => {
    const romaji = vi.fn(async () => "Bocchi the Rock!");
    const comic = details({
      sourceId: "241088",
      sourceUrl: "https://bgm.tv/subject/241088",
      title: { zh: "孤独摇滚！", ja: "ぼっち・ざ・ろっく！" },
      originalTitle: "ぼっち・ざ・ろっく！",
      year: 2019,
      credits: ["はまじあき"],
      episodes: 7,
      publication: { publisher: "芳文社", pages: null, volumes: 7, ongoing: true }
    });
    const { app, headers, patch } = await setup(fakeSources({ details: async () => comic, romaji }));
    const post = (payload: object) => app.inject({ method: "POST", url: "/api/admin/media/import", headers, payload });

    expect((await post({ kind: "comic", source: "tmdb", sourceId: "movie:1" })).statusCode).toBe(400);
    expect((await post({ kind: "book", source: "anilist", sourceId: "1" })).statusCode).toBe(400);
    expect((await post({ kind: "book", source: "openlibrary", sourceId: "OL1A" })).statusCode).toBe(400);
    const imported = await post({ kind: "comic", source: "bangumi", sourceId: "241088" });
    expect(imported.statusCode).toBe(201);
    const { item } = imported.json();
    expect(item).toMatchObject({
      kind: "comic",
      title: { zh: "孤独摇滚！", en: "Bocchi the Rock!", fr: "Bocchi the Rock!" },
      progress: { watched: 0, total: 7 },
      publication: { publisher: "芳文社", pages: null, volumes: 7, ongoing: true },
      music: null
    });
    expect(romaji).toHaveBeenCalledWith("ぼっち・ざ・ろっく！", 2019, "comic");

    const edited = await patch(item.id, { publication: { volumes: 8, ongoing: false }, status: "watching" });
    expect(edited.json().item.publication).toEqual({ publisher: "芳文社", pages: null, volumes: 8, ongoing: false });
    expect((await patch(item.id, { publication: { pages: 0 } })).statusCode).toBe(400);

    const film = (await app.inject({ method: "POST", url: "/api/admin/media/import", headers, payload: { kind: "movie", source: "tmdb", sourceId: "movie:129" } })).json().item;
    expect((await patch(film.id, { publication: { pages: 100 } })).statusCode).toBe(400);
    expect(film.publication).toBeNull();
  });

  it("searches only the sources a kind has", async () => {
    const { app, cookie } = await setup();
    const search = (query: string) => app.inject({ url: `/api/admin/media/search?${query}`, headers: { cookie } });
    expect((await search("kind=book&source=openlibrary&q=x")).statusCode).toBe(200);
    expect((await search("kind=book&source=tmdb&q=x")).statusCode).toBe(400);
    expect((await search("kind=comic&source=anilist&q=x")).statusCode).toBe(200);
    expect((await search("kind=movie&source=anilist&q=x")).statusCode).toBe(400);
  });
});
