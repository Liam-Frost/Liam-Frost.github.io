import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createMusicSource, type ItunesSong, type MusicSource } from "../src/media/itunes";
import { SourceError, type MediaSources } from "../src/media/sources";
import { MemorySettingsRepository } from "../src/settings/types";
import type { FetchedPlaylist, PlaylistFetcher } from "../src/spotify/playlist";
import { buildTestServer, csrf, login, offlineMediaSources } from "./helpers";
import { MemoryMediaRepository } from "./memory-media-repository";

let jpg: Buffer;
beforeAll(async () => {
  jpg = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#a63" } }).jpeg().toBuffer();
});

const itunesResult = (n: number, overrides: object = {}) => ({
  wrapperType: "track",
  kind: "song",
  trackId: n,
  trackName: "Plastic Love",
  artistName: "Mariya Takeuchi",
  collectionName: "Variety",
  releaseDate: "1984-04-25T08:00:00Z",
  artworkUrl100: `https://is1-ssl.mzstatic.com/image/thumb/x/${n}/100x100bb.jpg`,
  previewUrl: `https://audio-ssl.itunes.apple.com/itunes-assets/${n}.m4a`,
  trackTimeMillis: 294000,
  trackViewUrl: `https://music.apple.com/us/album/variety/1?i=${n}&uo=4`,
  primaryGenreName: "J-Pop",
  ...overrides
});

const fakeFetch = (handler: (url: URL) => Response) =>
  vi.fn(async (input: string | URL | Request) => handler(new URL(String(input)))) as unknown as typeof fetch;

describe("iTunes", () => {
  it("maps songs with a large cover and a clean Apple Music link", async () => {
    const music = createMusicSource(fakeFetch(() => Response.json({ results: [itunesResult(1), { kind: "music-video", trackId: 2 }] })));
    const [song, ...rest] = await music.search("plastic love", "US");
    expect(rest).toEqual([]);
    expect(song).toEqual({
      itunesId: "1",
      title: "Plastic Love",
      artist: "Mariya Takeuchi",
      album: "Variety",
      year: 1984,
      artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/x/1/100x100bb.jpg",
      artworkLarge: "https://is1-ssl.mzstatic.com/image/thumb/x/1/600x600bb.jpg",
      previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/1.m4a",
      durationMs: 294000,
      appleUrl: "https://music.apple.com/us/album/variety/1?i=1",
      genre: "J-Pop"
    });
  });

  it("finds a preview only for the same song: title, artist and length", async () => {
    const results = [
      itunesResult(1, { trackName: "Plastic Love", artistName: "Tanaka Yuri", trackTimeMillis: 305960 }),
      itunesResult(2, { trackName: "Plastic Love (2021 Remaster)", trackTimeMillis: 296000 })
    ];
    const music = createMusicSource(fakeFetch(() => Response.json({ results })));
    expect((await music.findPreview("Plastic Love", "Mariya Takeuchi", 294000))?.itunesId).toBe("2");
    expect(await music.findPreview("Plastic Love", "Mariya Takeuchi", 200000)).toBeNull();
    expect(await music.findPreview("Other Song", "Mariya Takeuchi", null)).toBeNull();
  });

  it("explains connection failures", async () => {
    const music = createMusicSource((async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch);
    await expect(music.search("x", "US")).rejects.toThrow(/HTTPS_PROXY/);
  });
});

function songOf(n: number, overrides: Partial<ItunesSong> = {}): ItunesSong {
  return {
    itunesId: String(n),
    title: `Song ${n}`,
    artist: "Artist A & Artist B",
    album: "Album",
    year: 2020,
    artworkUrl: null,
    artworkLarge: `https://is1-ssl.mzstatic.com/${n}/600x600bb.jpg`,
    previewUrl: `https://audio-ssl.itunes.apple.com/${n}.m4a`,
    durationMs: 200000,
    appleUrl: `https://music.apple.com/us/song/${n}`,
    genre: "Pop",
    ...overrides
  };
}

const playlist = (tracks: number): FetchedPlaylist => ({
  id: "37i9dQZF1DX9AUX5YVf3hc",
  name: "City Pop Best",
  image: "https://i.scdn.co/image/playlist",
  link: "https://open.spotify.com/playlist/37i9dQZF1DX9AUX5YVf3hc",
  tracks: Array.from({ length: tracks }, (_, i) => ({
    id: `track${String(i).padStart(17, "0")}`,
    title: `Track ${i}`,
    artist: "Miki Matsubara",
    // Two songs per album cover; the last one only has the playlist's cover.
    image: i === tracks - 1 ? "https://i.scdn.co/image/playlist" : `https://image-cdn-ak.spotifycdn.com/image/${Math.floor(i / 2)}`,
    link: `https://open.spotify.com/track/${i}`,
    previewUrl: i === 0 ? "" : `https://p.scdn.co/mp3-preview/${i}`
  }))
});

async function setup(options: { music?: Partial<MusicSource>; fetchPlaylist?: PlaylistFetcher; download?: MediaSources["download"] } = {}) {
  const media = new MemoryMediaRepository();
  const settings = new MemorySettingsRepository();
  const download = vi.fn(options.download ?? (async () => jpg));
  const mediaSources: MediaSources = {
    ...offlineMediaSources,
    available: () => ({ tmdb: false, bangumi: true, openlibrary: true, googlebooks: true, anilist: true, igdb: true }),
    search: async () => [],
    details: async () => {
      throw new SourceError("unused");
    },
    download,
    romaji: async () => null
  };
  const musicSource: MusicSource = {
    search: async () => [songOf(1), songOf(2)],
    lookup: async (id) => songOf(Number(id)),
    findPreview: async () => null,
    ...options.music
  };
  const app = await buildTestServer({}, { media, settings, mediaSources, musicSource, fetchPlaylist: options.fetchPlaylist });
  const cookie = await login(app);
  return { app, media, download, cookie, headers: { ...csrf, cookie } };
}

describe("admin music", () => {
  it("searches iTunes and marks songs already added", async () => {
    const { app, cookie, headers } = await setup();
    await app.inject({ method: "POST", url: "/api/admin/music/import", headers, payload: { itunesId: "1", country: "US" } });
    const results = (await app.inject({ url: "/api/admin/music/search?q=song&country=JP", headers: { cookie } })).json().results;
    expect(results.map((r: { existingId: string | null }) => Boolean(r.existingId))).toEqual([true, false]);
    expect(results[0]).not.toHaveProperty("artworkLarge");
    expect((await app.inject({ url: "/api/admin/music/search?q=x&country=XX", headers: { cookie } })).statusCode).toBe(400);
  });

  it("adds an iTunes song with its cover, artists and preview, in the player", async () => {
    const { app, headers, download } = await setup();
    const response = await app.inject({ method: "POST", url: "/api/admin/music/import", headers, payload: { itunesId: "7", country: "US" } });
    expect(response.statusCode).toBe(201);
    const { item } = response.json();
    expect(item).toMatchObject({
      kind: "track",
      source: "itunes",
      sourceId: "7",
      title: { en: "Song 7" },
      credits: ["Artist A", "Artist B"],
      genres: [{ en: "Pop" }],
      year: 2020,
      status: null,
      inPlayer: true,
      music: { album: "Album", durationMs: 200000, previewUrl: "https://audio-ssl.itunes.apple.com/7.m4a", spotifyUrl: null, appleUrl: "https://music.apple.com/us/song/7" }
    });
    expect(item.poster.variants).toHaveLength(1);
    expect(download).toHaveBeenCalledWith("https://is1-ssl.mzstatic.com/7/600x600bb.jpg");

    expect((await app.inject({ method: "POST", url: "/api/admin/music/import", headers, payload: { itunesId: "7", country: "US" } })).statusCode).toBe(409);
  });

  it("keeps songs without a preview out of the player", async () => {
    const { app, headers } = await setup({ music: { lookup: async (id) => songOf(Number(id), { previewUrl: null }) } });
    const { item } = (await app.inject({ method: "POST", url: "/api/admin/music/import", headers, payload: { itunesId: "3", country: "US" } })).json();
    expect(item.inPlayer).toBe(false);
  });

  it("imports a playlist in the background: once per song, one cover per album", async () => {
    const fetchPlaylist = vi.fn<PlaylistFetcher>(async () => playlist(5));
    const { app, headers, cookie, download } = await setup({ fetchPlaylist });
    const start = await app.inject({ method: "POST", url: "/api/admin/music/playlist-import", headers, payload: { playlistUrl: "https://open.spotify.com/playlist/37i9dQZF1DX9AUX5YVf3hc?si=1" } });
    expect(start.statusCode).toBe(202);
    const jobId = start.json().job.id;

    let job;
    for (let i = 0; i < 50; i++) {
      job = (await app.inject({ url: `/api/admin/music/jobs/${jobId}`, headers: { cookie } })).json().job;
      if (job.state !== "running") break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(job).toMatchObject({ state: "done", playlistName: "City Pop Best", total: 5, processed: 5, added: 5, skipped: 0, noPreview: 1 });
    expect(fetchPlaylist).toHaveBeenCalledWith("37i9dQZF1DX9AUX5YVf3hc", expect.any(Map), { coverBudgetMs: Number.POSITIVE_INFINITY });
    // Covers 0, 0, 1, 1 and the playlist cover (not downloaded): two downloads.
    expect(download).toHaveBeenCalledTimes(2);

    const items = (await app.inject({ url: "/api/admin/media?kind=track", headers: { cookie } })).json().items;
    expect(items).toHaveLength(5);
    const first = items.find((item: { sourceId: string }) => item.sourceId === "track00000000000000000");
    expect(first).toMatchObject({ source: "spotify", inPlayer: false, music: { previewUrl: null, spotifyUrl: "https://open.spotify.com/track/0" } });
    expect(items.find((item: { sourceId: string }) => item.sourceId === "track00000000000000004").poster).toBeNull();

    const again = (await app.inject({ method: "POST", url: "/api/admin/music/playlist-import", headers, payload: { playlistUrl: "https://open.spotify.com/playlist/37i9dQZF1DX9AUX5YVf3hc" } })).json().job;
    for (let i = 0; i < 50 && again.state === "running"; i++) {
      Object.assign(again, (await app.inject({ url: `/api/admin/music/jobs/${again.id}`, headers: { cookie } })).json().job);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(again).toMatchObject({ state: "done", added: 0, skipped: 5 });
  });

  it("refuses a second playlist while one is importing", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { app, headers } = await setup({
      fetchPlaylist: async () => {
        await gate;
        return playlist(1);
      }
    });
    const start = (playlistUrl: string) => app.inject({ method: "POST", url: "/api/admin/music/playlist-import", headers, payload: { playlistUrl } });
    const first = (await start("spotify:playlist:37i9dQZF1DX9AUX5YVf3hc")).json().job;
    expect((await start("https://open.spotify.com/playlist/37i9dQZF1DX9AUX5YVf3hc")).json().job.id).toBe(first.id);
    const other = await start("spotify:playlist:0123456789abcdefghijkl");
    expect(other.statusCode).toBe(409);
    expect(other.json().error.code).toBe("IMPORT_BUSY");
    release();
  });

  it("reports bad links and failed playlist reads", async () => {
    const { app, headers, cookie } = await setup({
      fetchPlaylist: async () => {
        throw new SourceError("无法连接 Spotify");
      }
    });
    expect((await app.inject({ method: "POST", url: "/api/admin/music/playlist-import", headers, payload: { playlistUrl: "https://example.com/x" } })).statusCode).toBe(400);
    const { job } = (await app.inject({ method: "POST", url: "/api/admin/music/playlist-import", headers, payload: { playlistUrl: "spotify:playlist:37i9dQZF1DX9AUX5YVf3hc" } })).json();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect((await app.inject({ url: `/api/admin/music/jobs/${job.id}`, headers: { cookie } })).json().job).toMatchObject({ state: "failed", error: "无法连接 Spotify" });
  });

  it("edits music fields of songs only, with previews from iTunes or Spotify", async () => {
    const { app, headers } = await setup();
    const { item } = (await app.inject({ method: "POST", url: "/api/admin/music/import", headers, payload: { itunesId: "4", country: "US" } })).json();
    const patch = (id: string, payload: object) => app.inject({ method: "PATCH", url: `/api/admin/media/${id}`, headers, payload });

    const saved = await patch(item.id, { inPlayer: false, rating: 4, music: { album: "Other", previewUrl: "https://p.scdn.co/mp3-preview/9" } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().item).toMatchObject({ inPlayer: false, rating: 4, music: { album: "Other", previewUrl: "https://p.scdn.co/mp3-preview/9", appleUrl: "https://music.apple.com/us/song/4" } });

    for (const payload of [{ music: { previewUrl: "https://evil.example/a.mp3" } }, { music: { appleUrl: "https://evil.example" } }, { status: "done" }, { progress: { watched: 1, total: 2 } }]) {
      expect((await patch(item.id, payload)).statusCode, JSON.stringify(payload)).toBe(400);
    }

    // The player only plays songs with a preview.
    expect((await patch(item.id, { music: { previewUrl: null } })).statusCode).toBe(200);
    expect((await patch(item.id, { inPlayer: true })).statusCode).toBe(400);
    expect((await patch(item.id, { inPlayer: true, music: { previewUrl: "https://audio-ssl.itunes.apple.com/x.m4a" } })).json().item.inPlayer).toBe(true);
    expect((await patch(item.id, { music: { previewUrl: null } })).statusCode).toBe(400);

    const film = (await app.inject({ method: "POST", url: "/api/admin/media", headers, payload: { kind: "movie", title: { zh: "电影" } } })).json().item;
    expect((await patch(film.id, { inPlayer: true })).statusCode).toBe(400);
    expect((await patch(film.id, { music: { album: "x" } })).statusCode).toBe(400);
  });

  it("lists public songs with their music details", async () => {
    const { app, headers } = await setup();
    await app.inject({ method: "POST", url: "/api/admin/music/import", headers, payload: { itunesId: "5", country: "US" } });
    const body = (await app.inject("/api/collection")).json();
    expect(body.kinds).toContain("track");
    expect(body.items[0]).toMatchObject({ kind: "track", music: { album: "Album", appleUrl: "https://music.apple.com/us/song/5" } });
  });
});
