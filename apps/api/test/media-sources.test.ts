import { describe, expect, it, vi } from "vitest";

import { createMediaSources } from "../src/media/sources";

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

function fakeFetch(handler: Handler) {
  return vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => handler(new URL(String(input)), init)) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const GENRES: Record<string, string> = { "zh-CN": "动画", "zh-TW": "動畫", "en-US": "Animation", "fr-FR": "Animation", "ja-JP": "アニメーション" };

const tmdbHandler: Handler = (url) => {
  if (url.pathname.startsWith("/3/genre/")) return Response.json({ genres: [{ id: 16, name: GENRES[url.searchParams.get("language")!] }] });
  if (url.pathname === "/3/movie/129") {
    return Response.json({
      id: 129,
      title: "千与千寻",
      original_title: "千と千尋の神隠し",
      release_date: "2001-07-20",
      poster_path: "/p.jpg",
      overview: "中文简介",
      genres: [{ id: 16, name: "动画" }],
      credits: { crew: [{ job: "Director", name: "宫崎骏" }, { job: "Producer", name: "铃木敏夫" }] },
      translations: {
        translations: [
          { iso_639_1: "zh", iso_3166_1: "CN", data: { title: "千与千寻", overview: "中文简介" } },
          { iso_639_1: "zh", iso_3166_1: "HK", data: { title: "千與千尋", overview: "港版" } },
          { iso_639_1: "zh", iso_3166_1: "TW", data: { title: "神隱少女", overview: "台版簡介" } },
          { iso_639_1: "en", iso_3166_1: "US", data: { title: "Spirited Away", overview: "English overview" } },
          { iso_639_1: "fr", iso_3166_1: "FR", data: { title: "Le Voyage de Chihiro", overview: "" } },
          { iso_639_1: "ja", iso_3166_1: "JP", data: { title: "", overview: "日本語" } }
        ]
      }
    });
  }
  if (url.pathname === "/3/search/multi") {
    return Response.json({
      results: [
        { id: 1, media_type: "tv", name: "进击的巨人", original_name: "進撃の巨人", first_air_date: "2013-04-07", poster_path: "/a.jpg" },
        { id: 2, media_type: "person", name: "Someone" },
        { id: 3, media_type: "movie", title: "你的名字。", release_date: "2016-08-26" }
      ]
    });
  }
  return new Response("", { status: 404 });
};

describe("TMDB", () => {
  it("maps details to every site language, genres and directors", async () => {
    const fetchImpl = fakeFetch(tmdbHandler);
    const sources = createMediaSources({ tmdbKey: "abc123", fetchImpl });
    const result = await sources.details("tmdb", "movie", "movie:129");

    expect(result).toMatchObject({
      sourceUrl: "https://www.themoviedb.org/movie/129",
      title: { zh: "千与千寻", "zh-Hant": "神隱少女", en: "Spirited Away", fr: "Le Voyage de Chihiro" },
      originalTitle: "千と千尋の神隠し",
      year: 2001,
      genres: [{ zh: "动画", "zh-Hant": "動畫", en: "Animation", fr: "Animation", ja: "アニメーション" }],
      credits: ["宫崎骏"],
      overview: { zh: "中文简介", "zh-Hant": "台版簡介", en: "English overview", ja: "日本語" },
      posterUrl: "https://image.tmdb.org/t/p/w780/p.jpg",
      episodes: null
    });
    // Empty translations are left out so the site falls back.
    expect(result.title).not.toHaveProperty("ja");
    expect(result.overview).not.toHaveProperty("fr");
    // A v3 key goes in the query string.
    expect(new URL(String(fetchImpl.mock.calls[0][0])).searchParams.get("api_key")).toBe("abc123");
  });

  it("sends a v4 token as a bearer header and loads genre lists once", async () => {
    const fetchImpl = fakeFetch(tmdbHandler);
    const sources = createMediaSources({ tmdbKey: "eyJhbGciOi.token", fetchImpl });
    await sources.details("tmdb", "movie", "movie:129");
    await sources.details("tmdb", "movie", "movie:129");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(String(url)).searchParams.has("api_key")).toBe(false);
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer eyJhbGciOi.token" });
    expect(fetchImpl.mock.calls.filter(([u]) => String(u).includes("/genre/")).length).toBe(5);
  });

  it("searches films and series for anime, skipping people", async () => {
    const sources = createMediaSources({ tmdbKey: "abc123", fetchImpl: fakeFetch(tmdbHandler) });
    const hits = await sources.search("tmdb", "anime", "x");
    expect(hits.map((hit) => [hit.sourceId, hit.mediaType, hit.year])).toEqual([
      ["tv:1", "tv", 2013],
      ["movie:3", "movie", 2016]
    ]);
    expect(hits[0].posterUrl).toBe("https://image.tmdb.org/t/p/w185/a.jpg");
  });

  it("explains a missing or rejected key", async () => {
    await expect(createMediaSources({}).search("tmdb", "movie", "x")).rejects.toThrow("未配置 TMDB_API_KEY");
    const rejected = createMediaSources({ tmdbKey: "bad", fetchImpl: fakeFetch(() => new Response("", { status: 401 })) });
    await expect(rejected.search("tmdb", "movie", "x")).rejects.toThrow(/API key/);
    expect(createMediaSources({}).available()).toEqual({ tmdb: false, bangumi: true });
  });
});

describe("Bangumi", () => {
  it("searches anime with a user agent and maps subject details", async () => {
    const fetchImpl = fakeFetch((url, init) => {
      if (url.pathname === "/v0/search/subjects") {
        expect(JSON.parse(String(init.body))).toEqual({ keyword: "孤独摇滚", filter: { type: [2] } });
        return Response.json({ data: [{ id: 328609, name: "ぼっち・ざ・ろっく！", name_cn: "孤独摇滚！", date: "2022-10-08", images: { common: "https://lain.bgm.tv/c.jpg" } }] });
      }
      return Response.json({
        id: 328609,
        name: "ぼっち・ざ・ろっく！",
        name_cn: "孤独摇滚！",
        date: "2022-10-08",
        summary: "简介",
        images: { large: "https://lain.bgm.tv/l.jpg" },
        tags: [
          { name: "2022年10月", count: 900 },
          { name: "音乐", count: 800 },
          { name: "日常", count: 700 }
        ],
        total_episodes: 12,
        infobox: [
          { key: "导演", value: "斎藤圭一郎" },
          { key: "动画制作", value: [{ v: "CloverWorks" }] }
        ]
      });
    });
    const sources = createMediaSources({ fetchImpl });

    const hits = await sources.search("bangumi", "anime", "孤独摇滚");
    expect(hits[0]).toMatchObject({ sourceId: "328609", title: "孤独摇滚！", originalTitle: "ぼっち・ざ・ろっく！", year: 2022 });
    expect((fetchImpl.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "user-agent": expect.stringContaining("liam-frost-site") });

    const result = await sources.details("bangumi", "anime", "328609");
    expect(result).toMatchObject({
      sourceUrl: "https://bgm.tv/subject/328609",
      title: { zh: "孤独摇滚！", ja: "ぼっち・ざ・ろっく！" },
      genres: [{ zh: "音乐" }, { zh: "日常" }],
      credits: ["斎藤圭一郎", "CloverWorks"],
      posterUrl: "https://lain.bgm.tv/l.jpg",
      episodes: 12
    });
  });

  it("rejects malformed ids and non-https poster URLs", async () => {
    const sources = createMediaSources({ fetchImpl: fakeFetch(() => Response.json({})) });
    await expect(sources.details("bangumi", "anime", "../1")).rejects.toThrow("无效");
    await expect(sources.download("http://example.com/p.jpg")).rejects.toThrow("海报地址无效");
  });
});
