import type { MediaKind, PublicCollection } from "@liam-frost/shared";
import { afterEach, describe, expect, it } from "vitest";

import { excerpt, pickHomeFeatured } from "../src/media/home";
import type { MediaRow } from "../src/media/types";
import { MemorySettingsRepository } from "../src/settings/types";
import { buildTestServer, csrf, login } from "./helpers";
import { MemoryMediaRepository } from "./memory-media-repository";

let counter = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

function row(kind: MediaKind, fields: Partial<MediaRow> = {}): MediaRow {
  const id = uuid();
  return {
    id,
    kind,
    source: "manual",
    sourceId: null,
    sourceUrl: null,
    title: { en: id },
    originalTitle: null,
    year: null,
    genres: [],
    credits: [],
    overview: {},
    poster: null,
    status: "done",
    rating: null,
    review: {},
    watchedOn: null,
    rewatchCount: 0,
    progress: null,
    extra: {},
    inPlayer: false,
    featured: true,
    featuredOrder: null,
    visibility: "public",
    createdAt: new Date(Date.UTC(2026, 0, counter)),
    updatedAt: new Date(Date.UTC(2026, 0, counter)),
    ...fields
  };
}

describe("home featured picks", () => {
  it("rotates daily, the same all day, and spreads kinds", () => {
    const rows = [
      row("movie"),
      row("movie"),
      row("movie"),
      row("book"),
      row("game"),
      row("anime"),
      row("movie")
    ];
    const ids = (day: string) => pickHomeFeatured(rows, "rotate", day).map((r) => r.id);
    expect(ids("2026-11-04")).toEqual(ids("2026-11-04"));
    expect(ids("2026-11-04")).not.toEqual(ids("2026-11-05"));
    for (const day of ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]) {
      const picked = pickHomeFeatured(rows, "rotate", day);
      expect(picked).toHaveLength(3);
      // Four kinds exist, so three picks never repeat one.
      expect(new Set(picked.map((r) => r.kind)).size).toBe(3);
    }
    // Over a week every featured entry comes up.
    const seen = new Set<string>();
    for (let d = 1; d <= 7; d++) ids(`2026-11-0${d}`).forEach((id) => seen.add(id));
    expect(seen.size).toBe(rows.length);
  });

  it("gives every featured entry a turn within as many days as there are entries", () => {
    const days = (n: number) =>
      Array.from({ length: n }, (_, d) =>
        new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10)
      );
    const check = (rows: MediaRow[]) => {
      const seen = new Set<string>();
      for (const day of days(rows.length))
        pickHomeFeatured(rows, "rotate", day).forEach((r) => seen.add(r.id));
      expect(seen.size, rows.map((r) => r.kind).join(",")).toBe(rows.length);
    };
    // Codex's case: six entries, so a window moving by three only ever started at two places, and the
    // kind spreading skipped the middle movies for good.
    check([row("movie"), row("movie"), row("movie"), row("movie"), row("book"), row("game")]);
    // Every size from 4 to 15 with lopsided kinds.
    const kinds: MediaKind[] = ["movie", "movie", "movie", "book", "movie", "game", "anime"];
    for (let n = 4; n <= 15; n++) check(Array.from({ length: n }, (_, i) => row(kinds[i % 7]!)));
  });

  it("fills with repeated kinds only when needed, and ignores entries not featured", () => {
    const rows = [
      row("movie"),
      row("movie"),
      row("movie"),
      row("movie"),
      row("tv", { featured: false })
    ];
    const picked = pickHomeFeatured(rows, "rotate", "2026-11-04");
    expect(picked).toHaveLength(3);
    expect(picked.every((r) => r.kind === "movie")).toBe(true);
    expect(pickHomeFeatured(rows.slice(0, 2), "rotate", "2026-11-04")).toHaveLength(2);
  });

  it("keeps the fixed order, with entries never ordered last and newest first", () => {
    const a = row("movie", { featuredOrder: 1 });
    const b = row("book", { featuredOrder: 0 });
    const older = row("game", { updatedAt: new Date("2026-02-01") });
    const newer = row("anime", { updatedAt: new Date("2026-03-01") });
    expect(pickHomeFeatured([a, older, b, newer], "manual", "2026-11-04").map((r) => r.id)).toEqual(
      [b.id, a.id, newer.id]
    );
  });
});

describe("review excerpts", () => {
  it("keeps short texts, ends at a sentence when it can, and cuts otherwise", () => {
    expect(excerpt("  好看。 ")).toBe("好看。");
    const sentences = `${"一".repeat(50)}。${"二".repeat(60)}。`;
    expect(excerpt(sentences)).toBe(`${"一".repeat(50)}。`);
    const long = "word ".repeat(40);
    const cut = excerpt(long);
    expect(cut.endsWith("…")).toBe(true);
    expect(Array.from(cut).length).toBeLessThanOrEqual(90);
    // Emoji count as one character and are never split.
    expect(Array.from(excerpt("😀".repeat(100))).length).toBe(90);
  });
});

describe("home collection API", () => {
  const apps: Awaited<ReturnType<typeof buildTestServer>>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function setup() {
    const media = new MemoryMediaRepository();
    const settings = new MemorySettingsRepository();
    const create = async (kind: MediaKind, fields: Partial<MediaRow>) => {
      const created = await media.create({
        id: uuid(),
        kind,
        source: "manual",
        title: { en: kind }
      });
      return (await media.update(created.id, fields))!;
    };
    const movie = await create("movie", {
      featured: true,
      status: "done",
      review: { zh: `${"好".repeat(100)}`, en: "Short." }
    });
    const book = await create("book", { featured: true, status: "done" });
    const game = await create("game", { featured: true, status: "watching" });
    const anime = await create("anime", { featured: true, status: "done" });
    const hidden = await create("tv", { featured: true, status: "done", visibility: "private" });
    const plain = await create("movie", { status: "done" });
    const app = await buildTestServer(
      { ANALYTICS_TIMEZONE: "Asia/Shanghai" },
      { media, settings, now: () => new Date("2026-11-04T03:00:00Z") }
    );
    apps.push(app);
    const headers = { ...csrf, cookie: await login(app) };
    const home = async () => (await app.inject("/api/collection")).json<PublicCollection>().home;
    return { app, headers, home, media, movie, book, game, anime, hidden, plain };
  }

  it("sends at most three featured picks with review excerpts", async () => {
    const { home, movie, hidden, plain } = await setup();
    const { featured } = await home();
    expect(featured).toHaveLength(3);
    const ids = featured.map((f) => f.id);
    expect(ids).not.toContain(hidden.id);
    expect(ids).not.toContain(plain.id);
    const pick = featured.find((f) => f.id === movie.id);
    if (pick) {
      expect(pick.excerpt.en).toBe("Short.");
      expect(pick.excerpt.zh!.endsWith("…")).toBe(true);
    }
  });

  it("orders featured entries in the admin and uses the order in manual mode", async () => {
    const { app, headers, home, movie, book, game, anime, hidden } = await setup();
    const order = (ids: string[]) =>
      app.inject({
        method: "PUT",
        url: "/api/admin/media/featured-order",
        headers,
        payload: { ids }
      });

    // Every featured entry (hidden ones too), each once.
    expect((await order([anime.id, game.id])).statusCode).toBe(400);
    expect((await order([anime.id, anime.id, game.id, book.id, movie.id])).statusCode).toBe(400);
    const saved = await order([anime.id, hidden.id, game.id, book.id, movie.id]);
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json().items.map((i: { featuredOrder: number }) => i.featuredOrder)).toEqual([
      0, 1, 2, 3, 4
    ]);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/media/featured-order",
          headers: csrf,
          payload: { ids: [] }
        })
      ).statusCode
    ).toBe(401);

    const put = await app.inject({
      method: "PUT",
      url: "/api/admin/collection/settings",
      headers,
      payload: {
        show: { movie: true, tv: true, anime: true, music: true },
        showWant: true,
        homeFeatured: "manual"
      }
    });
    expect(put.json().settings.homeFeatured).toBe("manual");
    // The hidden entry is skipped; the rest follow the order.
    expect((await home()).featured.map((f) => f.id)).toEqual([anime.id, game.id, book.id]);
  });

  it("keeps older settings without the choice, and rotates by default", async () => {
    const { app, headers } = await setup();
    const legacy = await app.inject({
      method: "PUT",
      url: "/api/admin/collection/settings",
      headers,
      payload: { show: { movie: true, tv: false, anime: true, music: true }, showWant: true }
    });
    expect(legacy.json().settings).toMatchObject({ homeFeatured: "rotate", show: { tv: false } });
  });
});
