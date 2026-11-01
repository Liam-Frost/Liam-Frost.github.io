import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { MediaSources } from "../src/media/sources";
import { MemorySettingsRepository } from "../src/settings/types";
import { SpotifyAccount, type ApiTrack } from "../src/spotify/account";
import { spotifyLink } from "../src/spotify/playlist";
import { buildTestServer, csrf, login, offlineMediaSources, SESSION_SECRET } from "./helpers";
import { MemoryMediaRepository } from "./memory-media-repository";

const APP = { clientId: "client", clientSecret: "secret", redirectUri: "http://127.0.0.1:8787/api/admin/spotify/callback" };

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;
const fakeFetch = (handler: Handler) =>
  vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => handler(new URL(String(input)), init)) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

const apiTrack = (n: number) => ({
  id: `track${String(n).padStart(17, "0")}`,
  type: "track",
  name: `Song ${n}`,
  artists: [{ name: "Miki Matsubara" }, { name: "Guest" }],
  album: { name: "Pocket Park", release_date: "1980-01-21", images: [{ url: "https://i.scdn.co/image/small", width: 64 }, { url: `https://i.scdn.co/image/${n % 2}`, width: 640 }] },
  duration_ms: 300000,
  external_urls: { spotify: `https://open.spotify.com/track/${n}` }
});

/** Spotify: token endpoint, /me, Liked Songs in pages of two, one playlist. */
function spotifyApi(options: { refreshFails?: boolean } = {}) {
  return fakeFetch((url, init) => {
    if (url.hostname === "accounts.spotify.com") {
      const body = new URLSearchParams(String(init.body));
      if (body.get("grant_type") === "refresh_token" && options.refreshFails) return Response.json({ error: "invalid_grant" }, { status: 400 });
      return Response.json({ access_token: `access-${body.get("grant_type")}`, refresh_token: "refresh-1", expires_in: 3600 });
    }
    if (url.pathname === "/v1/me") return Response.json({ id: "liam", display_name: "Liam" });
    if (url.pathname === "/v1/me/tracks") {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const items = [apiTrack(offset), apiTrack(offset + 1)].map((track) => ({ track }));
      return Response.json({ items, next: offset === 0 ? "https://api.spotify.com/v1/me/tracks?offset=2&limit=50" : null });
    }
    if (url.pathname === "/v1/me/playlists") {
      return Response.json({ items: [{ id: "37i9dQZF1DX9AUX5YVf3hc", name: "Mine", tracks: { total: 3 }, images: [{ url: "https://i.scdn.co/p" }], owner: { display_name: "Liam" } }, null], next: null });
    }
    return new Response("", { status: 404 });
  });
}

describe("Spotify account", () => {
  it("builds the consent link and accepts each state once, before it expires", () => {
    let now = 1_000_000;
    const account = new SpotifyAccount(APP, new MemorySettingsRepository(), SESSION_SECRET, spotifyApi(), () => now);
    const url = new URL(account.authorizeUrl("http://localhost:5174/admin/collection?kind=track"));
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ response_type: "code", client_id: "client", redirect_uri: APP.redirectUri, scope: expect.stringContaining("user-library-read") });
    const state = url.searchParams.get("state")!;
    expect(account.takeState(state)).toBe("http://localhost:5174/admin/collection?kind=track");
    expect(account.takeState(state)).toBeNull();

    const late = new URL(account.authorizeUrl("http://x/")).searchParams.get("state")!;
    now += 11 * 60 * 1000;
    expect(account.takeState(late)).toBeNull();
  });

  it("stores the refresh token encrypted and reads Liked Songs across pages", async () => {
    const repo = new MemorySettingsRepository();
    const fetchImpl = spotifyApi();
    const account = new SpotifyAccount(APP, repo, SESSION_SECRET, fetchImpl);
    await account.complete("code-1");

    const stored = (await repo.get("spotify.account")) as { refreshToken: string };
    expect(JSON.stringify(stored)).not.toContain("refresh-1");
    expect((await account.status()).account).toMatchObject({ id: "liam", displayName: "Liam" });

    const liked = await account.likedTracks();
    expect(liked.map((track) => track.title)).toEqual(["Song 0", "Song 1", "Song 2", "Song 3"]);
    expect(liked[0]).toEqual<ApiTrack>({
      id: "track00000000000000000",
      title: "Song 0",
      artists: ["Miki Matsubara", "Guest"],
      album: "Pocket Park",
      year: 1980,
      durationMs: 300000,
      coverUrl: "https://i.scdn.co/image/0",
      spotifyUrl: "https://open.spotify.com/track/0"
    });
    expect(await account.playlists()).toEqual([{ id: "37i9dQZF1DX9AUX5YVf3hc", name: "Mine", tracks: 3, image: "https://i.scdn.co/p", owner: "Liam" }]);
  });

  it("refreshes the access token from the stored token, and disconnects when Spotify revokes it", async () => {
    const repo = new MemorySettingsRepository();
    await new SpotifyAccount(APP, repo, SESSION_SECRET, spotifyApi()).complete("code-1");

    const fresh = spotifyApi();
    await new SpotifyAccount(APP, repo, SESSION_SECRET, fresh).likedTracks();
    const refresh = fresh.mock.calls.find(([, init]) => String((init as RequestInit).body).includes("refresh_token"));
    expect(String((refresh![1] as RequestInit).body)).toContain("refresh_token=refresh-1");

    const revoked = new SpotifyAccount(APP, repo, SESSION_SECRET, spotifyApi({ refreshFails: true }));
    await expect(revoked.likedTracks()).rejects.toThrow("Spotify 授权已失效");
    expect((await revoked.status()).account).toBeNull();
  });

  it("waits and retries when rate limited", async () => {
    let calls = 0;
    const base = spotifyApi();
    const fetchImpl = fakeFetch((url, init) => {
      if (url.pathname === "/v1/me/playlists" && calls++ === 0) return new Response("", { status: 429, headers: { "retry-after": "0" } });
      return base(url, init);
    });
    const repo = new MemorySettingsRepository();
    await new SpotifyAccount(APP, repo, SESSION_SECRET, spotifyApi()).complete("c");
    expect(await new SpotifyAccount(APP, repo, SESSION_SECRET, fetchImpl).playlists()).toHaveLength(1);
  });

  it("explains a missing app or account", async () => {
    expect(() => new SpotifyAccount(null, new MemorySettingsRepository(), SESSION_SECRET).authorizeUrl("http://x/")).toThrow("SPOTIFY_CLIENT_ID");
    await expect(new SpotifyAccount(APP, new MemorySettingsRepository(), SESSION_SECRET, spotifyApi()).likedTracks()).rejects.toThrow("还没有连接");
  });

  it("normalizes links for the embedded player", () => {
    expect(spotifyLink("https://open.spotify.com/intl-ja/album/0123456789abcdefghijkl?si=1")).toBe("https://open.spotify.com/album/0123456789abcdefghijkl");
    expect(spotifyLink("spotify:artist:0123456789abcdefghijkl")).toBe("https://open.spotify.com/artist/0123456789abcdefghijkl");
    expect(spotifyLink("https://open.spotify.com/show/0123456789abcdefghijkl")).toBeNull();
    expect(spotifyLink("https://evil.example/playlist/0123456789abcdefghijkl")).toBeNull();
  });
});

describe("Spotify routes", () => {
  let jpg: Buffer;
  beforeAll(async () => {
    jpg = await sharp({ create: { width: 640, height: 640, channels: 3, background: "#333" } }).jpeg().toBuffer();
  });

  async function setup() {
    const settings = new MemorySettingsRepository();
    const media = new MemoryMediaRepository();
    const account = new SpotifyAccount(APP, settings, SESSION_SECRET, spotifyApi());
    const mediaSources: MediaSources = {
      ...offlineMediaSources,
      available: () => ({ tmdb: false, bangumi: true, openlibrary: true, anilist: true }),
      search: async () => [],
      details: async () => {
        throw new Error("unused");
      },
      download: vi.fn(async () => jpg),
      romaji: async () => null
    };
    const trackPreview = vi.fn(async (id: string) => (id.endsWith("1") ? null : `https://p.scdn.co/mp3-preview/${id}`));
    const findPreview = vi.fn(async () => null);
    const app = await buildTestServer({}, { settings, media, mediaSources, spotifyAccount: account, trackPreview, musicSource: { search: async () => [], lookup: async () => null, findPreview } });
    const cookie = await login(app);
    return { app, media, account, mediaSources, trackPreview, findPreview, cookie, headers: { ...csrf, cookie } };
  }

  it("connects through Spotify's consent page and back to the admin", async () => {
    const { app, headers, cookie } = await setup();
    expect((await app.inject({ url: "/api/admin/spotify/account", headers: { cookie } })).json()).toEqual({ configured: true, redirectUri: APP.redirectUri, account: null });

    const { url } = (await app.inject({ method: "POST", url: "/api/admin/spotify/connect", headers, payload: { returnTo: "http://localhost:5174/admin/collection?kind=track" } })).json();
    const state = new URL(url).searchParams.get("state");
    // No admin cookie: Spotify redirects the browser here.
    const callback = await app.inject(`/api/admin/spotify/callback?code=abc&state=${state}`);
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe("http://localhost:5174/admin/collection?kind=track&spotify=connected");
    expect((await app.inject({ url: "/api/admin/spotify/account", headers: { cookie } })).json().account).toMatchObject({ displayName: "Liam" });

    expect((await app.inject(`/api/admin/spotify/callback?code=abc&state=${state}`)).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/admin/spotify/connect", headers: csrf, payload: { returnTo: "http://x/" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/admin/spotify/connect", headers, payload: { returnTo: "javascript:alert(1)" } })).statusCode).toBe(400);

    expect((await app.inject({ method: "DELETE", url: "/api/admin/spotify/account", headers })).statusCode).toBe(204);
    expect((await app.inject({ url: "/api/admin/spotify/account", headers: { cookie } })).json().account).toBeNull();
  });

  it("returns to the admin with the reason when the user declines", async () => {
    const { app, headers } = await setup();
    const { url } = (await app.inject({ method: "POST", url: "/api/admin/spotify/connect", headers, payload: { returnTo: "http://localhost:5174/admin" } })).json();
    const state = new URL(url).searchParams.get("state");
    const callback = await app.inject(`/api/admin/spotify/callback?error=access_denied&state=${state}`);
    const back = new URL(callback.headers.location as string);
    expect(back.searchParams.get("spotify")).toBe("error");
    expect(back.searchParams.get("reason")).toBe("已取消授权");
  });

  it("imports Liked Songs in order, with Spotify previews or none", async () => {
    const { app, account, headers, cookie, mediaSources, findPreview } = await setup();
    await account.complete("code");
    const start = await app.inject({ method: "POST", url: "/api/admin/music/spotify-import", headers, payload: { source: "liked" } });
    expect(start.statusCode).toBe(202);
    let job = start.json().job;
    for (let i = 0; i < 50 && job.state === "running"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      job = (await app.inject({ url: `/api/admin/music/jobs/${job.id}`, headers: { cookie } })).json().job;
    }
    expect(job).toMatchObject({ source: "liked", state: "done", playlistName: "已点赞的歌曲", total: 4, added: 4, noPreview: 1 });
    // Two album covers for four songs.
    expect(mediaSources.download).toHaveBeenCalledTimes(2);
    // Only the song without a Spotify preview is looked up on iTunes.
    expect(findPreview).toHaveBeenCalledTimes(1);

    const player = (await app.inject("/api/spotify/player")).json();
    expect(player.tracks.map((track: { title: string }) => track.title)).toEqual(["Song 0", "Song 2", "Song 3"]);
    const items = (await app.inject({ url: "/api/admin/media?kind=track", headers: { cookie } })).json().items;
    expect(items.find((item: { title: { en: string } }) => item.title.en === "Song 0")).toMatchObject({
      credits: ["Miki Matsubara", "Guest"],
      year: 1980,
      music: { album: "Pocket Park", durationMs: 300000, spotifyUrl: "https://open.spotify.com/track/0" }
    });
  });

  it("switches the site player to Spotify's embedded player", async () => {
    const { app, headers } = await setup();
    const base = { enabled: true, shuffle: true, volume: 30, autoCollapseSeconds: 3 };
    const saved = await app.inject({ method: "PUT", url: "/api/admin/spotify", headers, payload: { ...base, mode: "embed", embedUrl: "https://open.spotify.com/intl-ja/album/0123456789abcdefghijkl?si=x" } });
    expect(saved.json().settings).toMatchObject({ mode: "embed", embedUrl: "https://open.spotify.com/album/0123456789abcdefghijkl" });
    expect((await app.inject("/api/spotify/player")).json()).toMatchObject({ mode: "embed", embedUrl: "https://open.spotify.com/album/0123456789abcdefghijkl", tracks: [] });

    for (const payload of [{ ...base, mode: "embed", embedUrl: "" }, { ...base, mode: "custom", embedUrl: "https://example.com" }, { ...base, mode: "iframe", embedUrl: "" }]) {
      expect((await app.inject({ method: "PUT", url: "/api/admin/spotify", headers, payload })).statusCode, JSON.stringify(payload)).toBe(400);
    }
  });
});
