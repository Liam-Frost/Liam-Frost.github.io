import { describe, expect, it, vi } from "vitest";

import { MemorySettingsRepository } from "../src/settings/types";
import { createPlaylistFetcher, parseEmbedPage, playlistIdFromUrl } from "../src/spotify/playlist";
import { buildTestServer, csrf, login } from "./helpers";
import { MemoryMediaRepository } from "./memory-media-repository";

const PLAYLIST_ID = "37i9dQZF1DX9AUX5YVf3hc";
const trackId = (n: number) => `track${String(n).padStart(17, "0")}`;

function embedPage(tracks: object[], name = "City Pop Best") {
  const data = {
    props: {
      pageProps: {
        state: {
          data: {
            entity: {
              name,
              coverArt: { sources: [{ url: "https://i.scdn.co/image/playlist" }] },
              trackList: tracks
            }
          }
        }
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

describe("playlist parsing", () => {
  it("reads playlist ids from links", () => {
    expect(playlistIdFromUrl(`https://open.spotify.com/playlist/${PLAYLIST_ID}?si=abc`)).toBe(
      PLAYLIST_ID
    );
    expect(playlistIdFromUrl(`https://open.spotify.com/intl-ja/playlist/${PLAYLIST_ID}`)).toBe(
      PLAYLIST_ID
    );
    expect(playlistIdFromUrl(`spotify:playlist:${PLAYLIST_ID}`)).toBe(PLAYLIST_ID);
    expect(playlistIdFromUrl(`https://open.spotify.com/album/${PLAYLIST_ID}`)).toBeNull();
    expect(playlistIdFromUrl(`https://evil.example/playlist/${PLAYLIST_ID}`)).toBeNull();
    expect(playlistIdFromUrl(`http://open.spotify.com/playlist/${PLAYLIST_ID}`)).toBeNull();
    expect(playlistIdFromUrl("https://open.spotify.com/playlist/short")).toBeNull();
  });

  it("keeps playable tracks once each, with or without a preview", () => {
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
    expect(parsed.tracks.map((t) => [t.title, t.previewUrl])).toEqual([
      ["Song 1", "https://p.scdn.co/mp3-preview/1"],
      ["Song 3", ""],
      ["Song 5", "https://p.scdn.co/mp3-preview/5"]
    ]);
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
      if (url.includes("/embed/playlist/"))
        return new Response(embedPage([embedTrack(1), embedTrack(2)]));
      if (url.includes(trackId(2))) return Response.json({ thumbnail_url: "https://image-cdn/2" });
      return new Response("nope", { status: 500 });
    });
    const fetcher = createPlaylistFetcher(fetchMock as unknown as typeof fetch);
    const result = await fetcher(PLAYLIST_ID, new Map([[trackId(1), "https://image-cdn/known"]]));
    expect(result.tracks.map((t) => t.image)).toEqual([
      "https://image-cdn/known",
      "https://image-cdn/2"
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the playlist cover and reports missing playlists", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) =>
      String(input).includes("/embed/")
        ? new Response(embedPage([embedTrack(1)]))
        : new Response("", { status: 404 })
    );
    const result = await createPlaylistFetcher(fetchMock as unknown as typeof fetch)(
      PLAYLIST_ID,
      new Map()
    );
    expect(result.tracks[0].image).toBe("https://i.scdn.co/image/playlist");

    const missing = createPlaylistFetcher(
      (async () => new Response("", { status: 404 })) as unknown as typeof fetch
    );
    await expect(missing(PLAYLIST_ID, new Map())).rejects.toThrow(/不存在/);
  });
});

describe("music player", () => {
  async function setup() {
    const media = new MemoryMediaRepository();
    const settings = new MemorySettingsRepository();
    const app = await buildTestServer({}, { media, settings });
    const cookie = await login(app);
    const add = async (n: number, overrides: object = {}) => {
      // Distinct creation times: the player plays songs in the order they were added.
      await new Promise((resolve) => setTimeout(resolve, 2));
      return media.create({
        id: `00000000-0000-4000-8000-00000000000${n}`,
        kind: "track",
        source: "itunes",
        sourceId: String(n),
        title: { en: `Song ${n}` },
        credits: ["Artist A", "Artist B"],
        extra: {
          music: {
            previewUrl: `https://audio-ssl.itunes.apple.com/${n}.m4a`,
            appleUrl: `https://music.apple.com/song/${n}`,
            spotifyUrl: null
          }
        },
        inPlayer: true,
        ...overrides
      });
    };
    return { app, media, settings, cookie, headers: { ...csrf, cookie }, add };
  }

  it("plays public songs that are in the player and have a preview", async () => {
    const { app, add } = await setup();
    await add(1);
    await add(2, { inPlayer: false });
    await add(3, { visibility: "private" });
    await add(4, { extra: { music: { previewUrl: null } } });
    await add(5, {
      extra: {
        music: {
          previewUrl: "https://p.scdn.co/mp3-preview/5",
          spotifyUrl: "https://open.spotify.com/track/5"
        }
      }
    });
    const player = (await app.inject("/api/spotify/player")).json();
    expect(player).toMatchObject({
      enabled: true,
      shuffle: true,
      volume: 30,
      autoCollapseSeconds: 3
    });
    expect(player.tracks).toEqual(
      expect.arrayContaining([
        {
          id: expect.any(String),
          title: "Song 1",
          artist: "Artist A, Artist B",
          image: "",
          link: "https://music.apple.com/song/1",
          previewUrl: "https://audio-ssl.itunes.apple.com/1.m4a"
        },
        expect.objectContaining({ title: "Song 5", link: "https://open.spotify.com/track/5" })
      ])
    );
    expect(player.tracks.map((track: { title: string }) => track.title)).toEqual([
      "Song 1",
      "Song 5"
    ]);
  });

  it("hides songs when music is switched off on the site, and returns none when the player is off", async () => {
    const { app, headers, add } = await setup();
    await add(1);
    await app.inject({
      method: "PUT",
      url: "/api/admin/collection/settings",
      headers,
      payload: { show: { movie: true, tv: true, anime: true, music: false }, showWant: true }
    });
    expect((await app.inject("/api/spotify/player")).json().tracks).toEqual([]);

    await app.inject({
      method: "PUT",
      url: "/api/admin/collection/settings",
      headers,
      payload: { show: { movie: true, tv: true, anime: true, music: true }, showWant: true }
    });
    await app.inject({
      method: "PUT",
      url: "/api/admin/spotify",
      headers,
      payload: {
        enabled: false,
        mode: "custom",
        embedUrl: "",
        shuffle: true,
        volume: 30,
        autoCollapseSeconds: 3
      }
    });
    expect((await app.inject("/api/spotify/player")).json()).toMatchObject({
      enabled: false,
      tracks: []
    });
  });

  it("serves an empty player without a database", async () => {
    const app = await buildTestServer();
    expect((await app.inject("/api/spotify/player")).json()).toMatchObject({
      enabled: true,
      tracks: []
    });
  });

  it("saves settings, reports the song count, and ignores older stored fields", async () => {
    const { app, settings, headers, cookie, add } = await setup();
    await settings.set("spotify", {
      enabled: true,
      playlistUrl: "https://open.spotify.com/playlist/x",
      shuffle: false,
      volume: 40,
      autoCollapseSeconds: 5
    });
    await add(1);
    const current = (await app.inject({ url: "/api/admin/spotify", headers: { cookie } })).json();
    expect(current).toEqual({
      settings: {
        enabled: true,
        mode: "custom",
        embedUrl: "https://open.spotify.com/playlist/37i9dQZF1DX9AUX5YVf3hc",
        shuffle: false,
        volume: 40,
        autoCollapseSeconds: 5,
        playlistId: null
      },
      playerTracks: 1
    });

    const payload = {
      enabled: true,
      mode: "custom",
      embedUrl: "",
      shuffle: true,
      volume: 55,
      autoCollapseSeconds: 0
    };
    // Settings saved by an older admin have no playlist: the player plays every song marked "in player".
    expect(
      (await app.inject({ method: "PUT", url: "/api/admin/spotify", headers, payload })).json()
        .settings
    ).toEqual({ ...payload, playlistId: null });
    for (const bad of [
      { ...payload, volume: 101 },
      { ...payload, autoCollapseSeconds: -1 },
      { ...payload, playlistUrl: "x" }
    ]) {
      expect(
        (await app.inject({ method: "PUT", url: "/api/admin/spotify", headers, payload: bad }))
          .statusCode
      ).toBe(400);
    }
  });

  it("needs a database and an admin session for settings", async () => {
    const app = await buildTestServer();
    const cookie = await login(app);
    expect((await app.inject({ url: "/api/admin/spotify", headers: { cookie } })).statusCode).toBe(
      503
    );
    expect((await app.inject("/api/admin/spotify")).statusCode).toBe(401);
  });
});
