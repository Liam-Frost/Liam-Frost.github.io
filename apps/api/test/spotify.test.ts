import { describe, expect, it, vi } from "vitest";

import { MemorySettingsRepository } from "../src/settings/types";
import { createPlaylistFetcher, parseEmbedPage, playlistIdFromUrl, type FetchedPlaylist, type PlaylistFetcher } from "../src/spotify/playlist";
import { FIRST_SYNC_WAIT_MS, REFRESH_MS, RETRY_MS, SpotifyService } from "../src/spotify/service";
import { buildTestServer, csrf, login } from "./helpers";

const PLAYLIST_ID = "37i9dQZF1DX9AUX5YVf3hc";
const OTHER_ID = "0123456789abcdefghijkl";
const trackId = (n: number) => `track${String(n).padStart(17, "0")}`;

function embedPage(tracks: object[], name = "City Pop Best") {
  const data = {
    props: {
      pageProps: {
        state: { data: { entity: { name, coverArt: { sources: [{ url: "https://i.scdn.co/image/playlist" }] }, trackList: tracks } } }
      }
    }
  };
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;
}

const embedTrack = (n: number, extra: object = {}) => ({
  uri: `spotify:track:${trackId(n)}`,
  title: `Song ${n}`,
  subtitle: `Artist ${n}`,
  isPlayable: true,
  audioPreview: { url: `https://p.scdn.co/mp3-preview/${n}` },
  ...extra
});

function playlist(id: string, count = 2): FetchedPlaylist {
  return {
    id,
    name: `Playlist ${id}`,
    image: "https://i.scdn.co/image/playlist",
    link: `https://open.spotify.com/playlist/${id}`,
    tracks: Array.from({ length: count }, (_, i) => ({
      id: trackId(i),
      title: `Song ${i}`,
      artist: "Artist",
      image: `https://i.scdn.co/image/${i}`,
      link: `https://open.spotify.com/track/${trackId(i)}`,
      previewUrl: `https://p.scdn.co/mp3-preview/${i}`
    }))
  };
}

describe("playlist parsing", () => {
  it("reads playlist ids from links", () => {
    expect(playlistIdFromUrl(`https://open.spotify.com/playlist/${PLAYLIST_ID}?si=abc`)).toBe(PLAYLIST_ID);
    expect(playlistIdFromUrl(`https://open.spotify.com/intl-ja/playlist/${PLAYLIST_ID}`)).toBe(PLAYLIST_ID);
    expect(playlistIdFromUrl(`spotify:playlist:${PLAYLIST_ID}`)).toBe(PLAYLIST_ID);
    expect(playlistIdFromUrl(`https://open.spotify.com/album/${PLAYLIST_ID}`)).toBeNull();
    expect(playlistIdFromUrl(`https://evil.example/playlist/${PLAYLIST_ID}`)).toBeNull();
    expect(playlistIdFromUrl(`http://open.spotify.com/playlist/${PLAYLIST_ID}`)).toBeNull();
    expect(playlistIdFromUrl("https://open.spotify.com/playlist/short")).toBeNull();
  });

  it("keeps playable tracks with previews, once each", () => {
    const parsed = parseEmbedPage(
      embedPage([
        embedTrack(1),
        embedTrack(1),
        embedTrack(2, { isPlayable: false }),
        embedTrack(3, { audioPreview: null }),
        embedTrack(4, { uri: "spotify:episode:abc" }),
        embedTrack(5)
      ])
    );
    expect(parsed.name).toBe("City Pop Best");
    expect(parsed.tracks.map((t) => t.title)).toEqual(["Song 1", "Song 5"]);
    expect(parsed.tracks[0]).toEqual({
      id: trackId(1),
      title: "Song 1",
      artist: "Artist 1",
      link: `https://open.spotify.com/track/${trackId(1)}`,
      previewUrl: "https://p.scdn.co/mp3-preview/1"
    });
  });

  it("fails clearly when the page format changes", () => {
    expect(() => parseEmbedPage("<html>nothing here</html>")).toThrow(/无法解析/);
  });

  it("looks up covers only for new tracks", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/embed/playlist/")) return new Response(embedPage([embedTrack(1), embedTrack(2)]));
      if (url.includes(trackId(2))) return Response.json({ thumbnail_url: "https://image-cdn/2" });
      return new Response("nope", { status: 500 });
    });
    const fetcher = createPlaylistFetcher(fetchMock as unknown as typeof fetch);
    const result = await fetcher(PLAYLIST_ID, new Map([[trackId(1), "https://image-cdn/known"]]));
    expect(result.tracks.map((t) => t.image)).toEqual(["https://image-cdn/known", "https://image-cdn/2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the playlist cover and reports missing playlists", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) =>
      String(input).includes("/embed/") ? new Response(embedPage([embedTrack(1)])) : new Response("", { status: 404 })
    );
    const result = await createPlaylistFetcher(fetchMock as unknown as typeof fetch)(PLAYLIST_ID, new Map());
    expect(result.tracks[0].image).toBe("https://i.scdn.co/image/playlist");

    const missing = createPlaylistFetcher((async () => new Response("", { status: 404 })) as unknown as typeof fetch);
    await expect(missing(PLAYLIST_ID, new Map())).rejects.toThrow(/不存在/);
  });
});

describe("Spotify service", () => {
  it("syncs on first use, then serves the cache and refreshes it in the background", async () => {
    let now = Date.parse("2026-10-31T00:00:00Z");
    const fetchPlaylist = vi.fn<PlaylistFetcher>(async (id) => playlist(id));
    const service = new SpotifyService(new MemorySettingsRepository(), fetchPlaylist, undefined, () => now);

    const first = await service.player();
    expect(first.tracks).toHaveLength(2);
    expect(first.shuffle).toBe(true);
    expect(fetchPlaylist).toHaveBeenCalledTimes(1);

    await service.player();
    expect(fetchPlaylist).toHaveBeenCalledTimes(1);

    now += REFRESH_MS + 1;
    await service.player();
    await service.sync();
    expect(fetchPlaylist).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good playlist after a failure and waits before retrying", async () => {
    let now = Date.parse("2026-10-31T00:00:00Z");
    let fail = false;
    const fetchPlaylist = vi.fn<PlaylistFetcher>(async (id) => {
      if (fail) throw new Error("boom");
      return playlist(id);
    });
    const service = new SpotifyService(new MemorySettingsRepository(), fetchPlaylist, undefined, () => now);
    await service.sync();

    fail = true;
    now += REFRESH_MS + 1;
    await service.sync();
    expect((await service.status()).error).toBe("同步失败");
    expect((await service.player()).tracks).toHaveLength(2);
    expect(fetchPlaylist).toHaveBeenCalledTimes(2);

    // The background retry is in flight; sync() joins it instead of fetching again.
    now += RETRY_MS + 1;
    await service.player();
    await service.sync();
    expect(fetchPlaylist).toHaveBeenCalledTimes(3);
  });

  it("shares one fetch between concurrent syncs", async () => {
    const fetchPlaylist = vi.fn<PlaylistFetcher>(async (id) => playlist(id));
    const service = new SpotifyService(new MemorySettingsRepository(), fetchPlaylist);
    await Promise.all([service.player(), service.player(), service.sync()]);
    expect(fetchPlaylist).toHaveBeenCalledTimes(1);
  });

  it("syncs a new playlist even when a sync of the old one is running", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchPlaylist = vi.fn<PlaylistFetcher>(async (id) => {
      if (id === PLAYLIST_ID) await gate;
      return playlist(id);
    });
    const service = new SpotifyService(new MemorySettingsRepository(), fetchPlaylist);
    const running = service.sync();
    const saving = service.saveSettings({ ...(await service.settings()), playlistUrl: `https://open.spotify.com/playlist/${OTHER_ID}` });
    release();
    await Promise.all([running, saving]);
    expect(fetchPlaylist.mock.calls.map(([id]) => id)).toEqual([PLAYLIST_ID, OTHER_ID]);
    expect((await service.status()).playlist?.id).toBe(OTHER_ID);
  });

  it("does not let another playlist's failure delay a sync", async () => {
    const repo = new MemorySettingsRepository();
    const fetchPlaylist = vi.fn<PlaylistFetcher>(async (id) => {
      if (id === PLAYLIST_ID) throw new Error("boom");
      return playlist(id);
    });
    const service = new SpotifyService(repo, fetchPlaylist);
    await service.sync();
    // Changed without saveSettings (e.g. by another process).
    await repo.set("spotify", { ...(await service.settings()), playlistUrl: `https://open.spotify.com/playlist/${OTHER_ID}` });
    expect((await service.player()).tracks).toHaveLength(2);
  });

  it("answers without tracks when the first sync is slow, and finishes it in the background", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const service = new SpotifyService(new MemorySettingsRepository(), async (id) => {
        await gate;
        return playlist(id);
      });
      const pending = service.player();
      await vi.advanceTimersByTimeAsync(FIRST_SYNC_WAIT_MS);
      expect((await pending).tracks).toEqual([]);
      release();
      await service.sync();
      expect((await service.player()).tracks).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("looks up covers again for tracks that fell back to the playlist cover", async () => {
    const fetchPlaylist = vi.fn<PlaylistFetcher>(async (id) => {
      const result = playlist(id);
      result.tracks[1].image = result.image;
      return result;
    });
    const service = new SpotifyService(new MemorySettingsRepository(), fetchPlaylist);
    await service.sync();
    await service.sync();
    expect([...fetchPlaylist.mock.calls[1][1].keys()]).toEqual([trackId(0)]);
  });

  it("returns no tracks when the player is disabled", async () => {
    const repo = new MemorySettingsRepository();
    const fetchPlaylist = vi.fn<PlaylistFetcher>(async (id) => playlist(id));
    const service = new SpotifyService(repo, fetchPlaylist);
    await service.saveSettings({ ...(await service.settings()), enabled: false });
    expect((await service.player()).tracks).toEqual([]);
    expect(fetchPlaylist).not.toHaveBeenCalled();
  });
});

describe("Spotify routes", () => {
  it("serves the player without a database", async () => {
    const app = await buildTestServer({}, { fetchPlaylist: async (id) => playlist(id, 3) });
    const response = await app.inject("/api/spotify/player");
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tracks).toHaveLength(3);
    expect(body.playlist.id).toBe(PLAYLIST_ID);
    expect(body).not.toHaveProperty("playlistUrl");
  });

  it("needs a database for admin settings", async () => {
    const app = await buildTestServer();
    const cookie = await login(app);
    expect((await app.inject({ url: "/api/admin/spotify", headers: { cookie } })).statusCode).toBe(503);
  });

  it("requires an admin session", async () => {
    const app = await buildTestServer({}, { settings: new MemorySettingsRepository() });
    expect((await app.inject("/api/admin/spotify")).statusCode).toBe(401);
  });

  it("saves settings and syncs a changed playlist", async () => {
    const fetchPlaylist = vi.fn<PlaylistFetcher>(async (id) => playlist(id, id === OTHER_ID ? 5 : 2));
    const app = await buildTestServer({}, { settings: new MemorySettingsRepository(), fetchPlaylist });
    const cookie = await login(app);
    const headers = { ...csrf, cookie };

    const initial = (await app.inject({ url: "/api/admin/spotify", headers: { cookie } })).json();
    expect(initial.settings.playlistUrl).toBe(`https://open.spotify.com/playlist/${PLAYLIST_ID}`);
    expect(initial.sync.syncedAt).toBeNull();

    const payload = {
      enabled: true,
      playlistUrl: `https://open.spotify.com/playlist/${OTHER_ID}?si=xyz`,
      shuffle: false,
      volume: 55,
      autoCollapseSeconds: 0
    };
    const saved = await app.inject({ method: "PUT", url: "/api/admin/spotify", headers, payload });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().settings).toEqual({ ...payload, playlistUrl: `https://open.spotify.com/playlist/${OTHER_ID}` });
    expect(saved.json().sync.tracks).toHaveLength(5);
    expect(fetchPlaylist).toHaveBeenLastCalledWith(OTHER_ID, expect.any(Map));

    const player = (await app.inject("/api/spotify/player")).json();
    expect(player).toMatchObject({ shuffle: false, volume: 55, autoCollapseSeconds: 0 });
    expect(player.tracks).toHaveLength(5);

    const synced = await app.inject({ method: "POST", url: "/api/admin/spotify/sync", headers });
    expect(synced.statusCode).toBe(200);
    expect(fetchPlaylist).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid settings", async () => {
    const app = await buildTestServer({}, { settings: new MemorySettingsRepository() });
    const cookie = await login(app);
    const headers = { ...csrf, cookie };
    const base = { enabled: true, playlistUrl: `https://open.spotify.com/playlist/${PLAYLIST_ID}`, shuffle: true, volume: 30, autoCollapseSeconds: 3 };

    const badUrl = await app.inject({ method: "PUT", url: "/api/admin/spotify", headers, payload: { ...base, playlistUrl: "https://evil.example/x" } });
    expect(badUrl.statusCode).toBe(400);
    expect(badUrl.json().error.message).toMatch(/歌单链接/);

    for (const payload of [{ ...base, volume: 101 }, { ...base, autoCollapseSeconds: -1 }, { ...base, extra: 1 }]) {
      expect((await app.inject({ method: "PUT", url: "/api/admin/spotify", headers, payload })).statusCode).toBe(400);
    }
  });
});
