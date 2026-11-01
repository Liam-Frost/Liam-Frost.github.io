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

  it("leaves out Traditional genre names that TMDB only has in Simplified", async () => {
    const fetchImpl = fakeFetch((url) => {
      if (url.pathname.startsWith("/3/genre/")) {
        const lang = url.searchParams.get("language")!;
        return Response.json({ genres: [{ id: 35, name: lang.startsWith("zh") ? "喜剧" : "Comedy" }] });
      }
      return Response.json({ id: 1, name: "剧", genres: [{ id: 35, name: "喜剧" }] });
    });
    const result = await createMediaSources({ tmdbKey: "abc123", fetchImpl }).details("tmdb", "tv", "tv:1");
    expect(result.genres).toEqual([{ zh: "喜剧", en: "Comedy", fr: "Comedy", ja: "Comedy" }]);
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

  it("keeps Simplified and Traditional Chinese apart, and imports without genre lists", async () => {
    const fetchImpl = fakeFetch((url) => {
      if (url.pathname.startsWith("/3/genre/")) return new Response("", { status: 500 });
      return Response.json({
        id: 7,
        title: "简体名",
        release_date: "2020-01-01",
        genres: [{ id: 18, name: "剧情" }],
        translations: { translations: [{ iso_639_1: "zh", iso_3166_1: "CN", data: { title: "简体名", overview: "简体简介" } }] }
      });
    });
    const result = await createMediaSources({ tmdbKey: "abc123", fetchImpl }).details("tmdb", "movie", "movie:7");
    expect(result.title).toEqual({ zh: "简体名" });
    expect(result.overview).toEqual({ zh: "简体简介" });
    expect(result.genres).toEqual([{ zh: "剧情" }]);
  });

  it("uses the original title for the work's own language", async () => {
    const fetchImpl = fakeFetch((url) => {
      if (url.pathname.startsWith("/3/genre/")) return Response.json({ genres: [] });
      return Response.json({
        id: 1396,
        name: "绝命毒师",
        original_name: "Breaking Bad",
        original_language: "en",
        translations: {
          translations: [
            { iso_639_1: "zh", iso_3166_1: "CN", data: { name: "绝命毒师" } },
            { iso_639_1: "en", iso_3166_1: "US", data: { name: "", overview: "A chemistry teacher..." } }
          ]
        }
      });
    });
    const result = await createMediaSources({ tmdbKey: "abc123", fetchImpl }).details("tmdb", "tv", "tv:1396");
    expect(result.title).toEqual({ zh: "绝命毒师", en: "Breaking Bad" });
  });

  it("treats a response without results as no results", async () => {
    const sources = createMediaSources({ tmdbKey: "abc123", fetchImpl: fakeFetch(() => Response.json({ status_message: "busy" })) });
    expect(await sources.search("tmdb", "movie", "x")).toEqual([]);
  });

  it("explains a missing or rejected key", async () => {
    await expect(createMediaSources({}).search("tmdb", "movie", "x")).rejects.toThrow("未配置 TMDB_API_KEY");
    const rejected = createMediaSources({ tmdbKey: "bad", fetchImpl: fakeFetch(() => new Response("", { status: 401 })) });
    await expect(rejected.search("tmdb", "movie", "x")).rejects.toThrow(/API key/);
    expect(createMediaSources({}).available()).toEqual({ tmdb: false, bangumi: true, openlibrary: true, googlebooks: false, anilist: true });
  });
});

describe("AniList romaji", () => {
  const anilist = (media: object | null) => fakeFetch(() => Response.json({ data: { Media: media } }));

  it("returns the romaji title of the same work", async () => {
    const sources = createMediaSources({ fetchImpl: anilist({ title: { romaji: "Bocchi the Rock!", native: "ぼっち・ざ・ろっく！" }, startDate: { year: 2022 } }) });
    expect(await sources.romaji("ぼっち・ざ・ろっく!", null)).toBe("Bocchi the Rock!");
  });

  it("accepts a different spelling of the same year, and rejects other works", async () => {
    const match = createMediaSources({ fetchImpl: anilist({ title: { romaji: "Sousou no Frieren", native: "葬送のフリーレン" }, startDate: { year: 2023 } }) });
    expect(await match.romaji("葬送的芙莉莲", 2023)).toBe("Sousou no Frieren");
    expect(await match.romaji("別の作品", 2010)).toBeNull();
  });

  it("reads relations with their direction and the other work's kind", async () => {
    const fetchImpl = fakeFetch((_url, init) => {
      expect(String(init.body)).toContain("relationType(version: 2)");
      return Response.json({
        data: {
          Media: {
            title: { romaji: "Bocchi the Rock!", native: "ぼっち・ざ・ろっく！" },
            startDate: { year: 2022 },
            relations: {
              edges: [
                { relationType: "SOURCE", node: { type: "MANGA", format: "MANGA", title: { native: "ぼっち・ざ・ろっく！" } } },
                { relationType: "ADAPTATION", node: { type: "MANGA", format: "NOVEL", title: { romaji: "Some Novel" } } },
                { relationType: "SEQUEL", node: { type: "ANIME", format: "TV", title: { native: "続編" } } }
              ]
            }
          }
        }
      });
    });
    expect(await createMediaSources({ fetchImpl }).relations("anime", "ぼっち・ざ・ろっく！", 2022)).toEqual([
      { relationType: "SOURCE", kind: "comic", titles: ["ぼっち・ざ・ろっく！"] },
      { relationType: "ADAPTATION", kind: "book", titles: ["Some Novel"] },
      { relationType: "SEQUEL", kind: "anime", titles: ["続編"] }
    ]);
  });

  it("gives up quietly when AniList fails", async () => {
    expect(await createMediaSources({ fetchImpl: fakeFetch(() => new Response("", { status: 500 })) }).romaji("x", 2020)).toBeNull();
    expect(await createMediaSources({ fetchImpl: anilist(null) }).romaji("x", 2020)).toBeNull();
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
          { name: "Cloverworks", count: 750 },
          { name: "芳文社", count: 720 },
          { name: "日常", count: 700 }
        ],
        eps: 12,
        total_episodes: 16,
        infobox: [
          { key: "导演", value: "斎藤圭一郎" },
          { key: "动画制作", value: [{ v: "CloverWorks" }] },
          { key: "原作", value: "はまじあき（芳文社「まんがタイムきららMAX」連載中）" }
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
      credits: ["斎藤圭一郎", "CloverWorks", "はまじあき"],
      posterUrl: "https://lain.bgm.tv/l.jpg",
      episodes: 12
    });
  });

  it("rejects malformed ids and non-https poster URLs", async () => {
    const sources = createMediaSources({ fetchImpl: fakeFetch(() => Response.json({})) });
    await expect(sources.details("bangumi", "anime", "../1")).rejects.toThrow("无效");
    await expect(sources.download("http://image.tmdb.org/t/p/w780/p.jpg")).rejects.toThrow("海报地址无效");
    await expect(sources.download("https://internal.example/p.jpg")).rejects.toThrow("海报地址无效");
    expect(await sources.search("bangumi", "anime", "x")).toEqual([]);
  });
});

describe("Books and comics", () => {
  it("searches and imports Open Library works", async () => {
    const fetchImpl = fakeFetch((url) => {
      if (url.pathname === "/search.json" && url.searchParams.get("q") === "key:/works/OL17267881W") {
        return Response.json({
          docs: [
            {
              key: "/works/OL17267881W",
              title: "三体",
              author_name: ["刘慈欣", "Ken Liu"],
              first_publish_year: 2008,
              cover_i: 9157544,
              number_of_pages_median: 416,
              publisher: ["\u200e重庆出版社"],
              subject: ["Science fiction", "award:hugo_award=2015", "Fiction, science fiction, general", "Liebesbeziehung", "Fiction", "science fiction"]
            }
          ]
        });
      }
      if (url.pathname === "/search.json") return Response.json({ docs: [{ key: "/works/OL17267881W", title: "三体", author_name: ["刘慈欣"], cover_i: 1 }] });
      if (url.pathname === "/works/OL17267881W.json") return Response.json({ description: { value: "A novel.\n----------\nSee also: ..." } });
      return new Response("", { status: 404 });
    });
    const sources = createMediaSources({ fetchImpl });

    const [hit] = await sources.search("openlibrary", "book", "三体");
    expect(hit).toMatchObject({ source: "openlibrary", sourceId: "OL17267881W", creators: ["刘慈欣"], posterUrl: "https://covers.openlibrary.org/b/id/1-M.jpg" });

    const details = await sources.details("openlibrary", "book", "OL17267881W");
    expect(details).toMatchObject({
      sourceUrl: "https://openlibrary.org/works/OL17267881W",
      title: { zh: "三体" },
      year: 2008,
      genres: [
        { zh: "科幻", "zh-Hant": "科幻", en: "Science fiction", fr: "Science-fiction", ja: "SF" },
        { zh: "小说", "zh-Hant": "小說", en: "Fiction", fr: "Fiction", ja: "小説" }
      ],
      credits: ["刘慈欣"],
      overview: { en: "A novel." },
      posterUrl: "https://covers.openlibrary.org/b/id/9157544-L.jpg",
      publication: { publisher: "重庆出版社", pages: 416, volumes: null, ongoing: null }
    });
    await expect(sources.details("openlibrary", "book", "OL1A")).rejects.toThrow("无效");
  });

  it("imports AniList manga with authors, translated genres and status", async () => {
    const fetchImpl = fakeFetch(() =>
      Response.json({
        data: {
          Media: {
            id: 111258,
            siteUrl: "https://anilist.co/manga/111258",
            status: "RELEASING",
            volumes: null,
            genres: ["Comedy", "Music"],
            title: { romaji: "Bocchi the Rock!", native: "ぼっち・ざ・ろっく！", english: "Bocchi the Rock!" },
            startDate: { year: 2018 },
            coverImage: { extraLarge: "https://s4.anilist.co/x.jpg" },
            description: "Hitori wants friends.<br><br>\n(Source: Yen Press)",
            staff: { edges: [{ role: "Story & Art", node: { name: { full: "Aki Hamaji", native: "はまじあき" } } }, { role: "Translator", node: { name: { full: "Someone" } } }] }
          }
        }
      })
    );
    const details = await createMediaSources({ fetchImpl }).details("anilist", "comic", "111258");
    expect(details).toMatchObject({
      title: { ja: "ぼっち・ざ・ろっく！", en: "Bocchi the Rock!", fr: "Bocchi the Rock!" },
      originalTitle: "ぼっち・ざ・ろっく！",
      genres: [{ en: "Comedy", zh: "喜剧" }, { en: "Music", zh: "音乐" }],
      credits: ["はまじあき"],
      overview: { en: "Hitori wants friends." },
      publication: { volumes: null, ongoing: true }
    });
    const missing = createMediaSources({ fetchImpl: fakeFetch(() => Response.json({ data: { Media: null }, errors: [{ status: 404 }] })) });
    await expect(missing.details("anilist", "comic", "1")).rejects.toThrow("找不到");
  });

  it("splits Bangumi books into comics and the rest, and reads publication details", async () => {
    const fetchImpl = fakeFetch((url, init) => {
      if (url.pathname === "/v0/search/subjects") {
        expect(JSON.parse(String(init.body)).filter).toEqual({ type: [1] });
        return Response.json({
          data: [
            { id: 1, name: "ぼっち・ざ・ろっく！", platform: "漫画" },
            { id: 2, name: "三体", name_cn: "三体", platform: "小说" }
          ]
        });
      }
      return Response.json({
        id: 241088,
        name: "ぼっち・ざ・ろっく！",
        name_cn: "孤独摇滚！",
        platform: "漫画",
        volumes: 7,
        infobox: [
          { key: "作者", value: "はまじあき" },
          { key: "出版社", value: "芳文社、东立" },
          { key: "开始", value: "2018-03-19" }
        ]
      });
    });
    const sources = createMediaSources({ fetchImpl });
    expect((await sources.search("bangumi", "comic", "x")).map((hit) => hit.sourceId)).toEqual(["1"]);
    expect((await sources.search("bangumi", "book", "x")).map((hit) => hit.sourceId)).toEqual(["2"]);
    expect(await sources.details("bangumi", "comic", "241088")).toMatchObject({
      credits: ["はまじあき"],
      episodes: 7,
      publication: { publisher: "芳文社", pages: null, volumes: 7, ongoing: true }
    });
  });

  it("follows cover redirects only through image hosts", async () => {
    const jpg = Buffer.from("jpg");
    const fetchImpl = fakeFetch((url) => {
      if (url.hostname === "covers.openlibrary.org") return new Response(null, { status: 302, headers: { location: "https://archive.org/download/x.jpg" } });
      if (url.hostname === "archive.org") return new Response(null, { status: 302, headers: { location: "https://ia800507.us.archive.org/x.jpg" } });
      if (url.hostname === "ia800507.us.archive.org") return new Response(jpg);
      if (url.hostname === "image.tmdb.org") return new Response(null, { status: 302, headers: { location: "https://internal.example/x.jpg" } });
      return new Response("", { status: 404 });
    });
    const sources = createMediaSources({ fetchImpl });
    expect(await sources.download("https://covers.openlibrary.org/b/id/1-L.jpg")).toEqual(jpg);
    await expect(sources.download("https://image.tmdb.org/t/p/x.jpg")).rejects.toThrow("海报地址无效");
    expect(fetchImpl.mock.calls.every(([, init]) => (init as RequestInit).redirect === "manual")).toBe(true);
  });
});

describe("Google Books", () => {
  const volume = {
    id: "27KePwAACAAJ",
    volumeInfo: {
      title: "ノルウェイの森",
      authors: ["村上春樹"],
      publisher: "講談社",
      publishedDate: "1987-09-04",
      description: "<p>僕は三十七歳で…</p>",
      pageCount: 268,
      categories: ["Fiction / Literary", "Romance"],
      language: "ja",
      imageLinks: { thumbnail: "http://books.google.com/books/content?id=27KePwAACAAJ&printsec=frontcover&img=1&zoom=1&edge=curl", large: "http://books.google.com/books/content?id=27KePwAACAAJ&zoom=3" },
      canonicalVolumeLink: "https://books.google.com/books/about/x.html?id=27KePwAACAAJ"
    }
  };

  it("searches and imports volumes with the key", async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url.searchParams.get("key")).toBe("gkey");
      if (url.pathname === "/books/v1/volumes") return Response.json({ items: [volume] });
      if (url.pathname === "/books/v1/volumes/27KePwAACAAJ") return Response.json(volume);
      return new Response("", { status: 404 });
    });
    const sources = createMediaSources({ googleBooksKey: "gkey", fetchImpl });
    expect(sources.available().googlebooks).toBe(true);

    const [hit] = await sources.search("googlebooks", "book", "ノルウェイの森");
    expect(hit).toMatchObject({
      source: "googlebooks",
      sourceId: "27KePwAACAAJ",
      creators: ["村上春樹"],
      year: 1987,
      posterUrl: "https://books.google.com/books/content?id=27KePwAACAAJ&printsec=frontcover&img=1&zoom=1"
    });

    expect(await sources.details("googlebooks", "book", "27KePwAACAAJ")).toMatchObject({
      title: { ja: "ノルウェイの森" },
      originalTitle: "ノルウェイの森",
      genres: [{ en: "Fiction" }, { en: "Romance" }],
      credits: ["村上春樹"],
      overview: { ja: "僕は三十七歳で…" },
      posterUrl: "https://books.google.com/books/content?id=27KePwAACAAJ&zoom=3&fife=w800",
      publication: { publisher: "講談社", pages: 268, volumes: null, ongoing: null }
    });
    await expect(sources.details("googlebooks", "book", "../x")).rejects.toThrow("无效");
  });

  it("is off without a key, and explains a rejected key without showing it", async () => {
    await expect(createMediaSources({}).search("googlebooks", "book", "x")).rejects.toThrow("未配置 GOOGLE_BOOKS_API_KEY");
    const rejected = createMediaSources({ googleBooksKey: "secret-key", fetchImpl: fakeFetch(() => new Response("", { status: 400 })) });
    const error = await rejected.search("googlebooks", "book", "x").catch((e: Error) => e);
    expect(String(error)).toContain("GOOGLE_BOOKS_API_KEY");
    expect(String(error)).not.toContain("secret-key");
  });
});
