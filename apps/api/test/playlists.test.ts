import { describe, expect, it } from "vitest";

import type { MediaRow } from "../src/media/types";
import { MemorySettingsRepository } from "../src/settings/types";
import { buildTestServer, csrf, login } from "./helpers";
import { MemoryMediaRepository } from "./memory-media-repository";
import { MemoryPlaylistRepository } from "./memory-playlist-repository";

const song = (n: number, extra: Partial<MediaRow> = {}): Parameters<MemoryMediaRepository["create"]>[0] => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  kind: "track",
  source: "manual",
  title: { en: `Song ${n}` },
  extra: { music: { previewUrl: `https://p.scdn.co/mp3-preview/${n}` } },
  ...extra
});
const ids = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
const film = "00000000-0000-4000-8000-000000000009";

async function setup() {
  const media = new MemoryMediaRepository();
  const playlists = new MemoryPlaylistRepository(media);
  const settings = new MemorySettingsRepository();
  await media.create(song(1, { inPlayer: true }));
  await media.create(song(2));
  await media.create(song(3, { visibility: "private" }));
  await media.create(song(4, { extra: {} }));
  await media.create({ id: film, kind: "movie", source: "manual", title: { en: "Film" }, status: "done" });
  const app = await buildTestServer({}, { media, playlists, settings });
  const cookie = await login(app);
  const headers = { ...csrf, cookie };
  const call = (method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", url: string, payload?: object) => app.inject({ method, url, headers, payload });
  const make = async (name = "Night drive") => (await call("POST", "/api/admin/playlists", { name: { en: name } })).json().playlist;
  return { app, media, playlists, call, make, headers };
}

describe("playlists", () => {
  it("creates, renames, fills, reorders and deletes a playlist", async () => {
    const { call, make } = await setup();
    const playlist = await make();
    expect(playlist).toMatchObject({ name: { en: "Night drive" }, source: "manual", visibility: "public", trackIds: [] });
    const url = `/api/admin/playlists/${playlist.id}`;

    expect((await call("POST", `${url}/tracks`, { action: "add", ids: [ids[1], ids[0], ids[1]] })).json().playlist.trackIds).toEqual([ids[1], ids[0]]);
    // Songs already in it keep their place; only songs go in playlists.
    expect((await call("POST", `${url}/tracks`, { action: "add", ids: [ids[0], ids[2]] })).json().playlist.trackIds).toEqual([ids[1], ids[0], ids[2]]);
    expect((await call("POST", `${url}/tracks`, { action: "add", ids: [film] })).statusCode).toBe(400);

    expect((await call("PUT", `${url}/order`, { ids: [ids[2], ids[1]] })).statusCode).toBe(400);
    expect((await call("PUT", `${url}/order`, { ids: [ids[2], ids[1], ids[0]] })).json().playlist.trackIds).toEqual([ids[2], ids[1], ids[0]]);
    expect((await call("POST", `${url}/tracks`, { action: "remove", ids: [ids[1]] })).json().playlist.trackIds).toEqual([ids[2], ids[0]]);

    const renamed = await call("PATCH", url, { name: { zh: "夜间驾驶", en: "Night drive" }, visibility: "private" });
    expect(renamed.json().playlist).toMatchObject({ name: { zh: "夜间驾驶" }, visibility: "private" });
    expect((await call("PATCH", url, { name: {} })).statusCode).toBe(400);

    expect((await call("GET", "/api/admin/playlists")).json().playlists).toHaveLength(1);
    expect((await call("DELETE", url)).statusCode).toBe(204);
    expect((await call("GET", url)).statusCode).toBe(404);
  });

  it("drops deleted songs from playlists", async () => {
    const { call, make } = await setup();
    const playlist = await make();
    await call("POST", `/api/admin/playlists/${playlist.id}/tracks`, { action: "add", ids: [ids[0], ids[1]] });
    await call("POST", "/api/admin/media/batch", { action: "delete", ids: [ids[0]] });
    expect((await call("GET", `/api/admin/playlists/${playlist.id}`)).json().playlist.trackIds).toEqual([ids[1]]);
  });

  it("lists public playlists with the songs the site shows", async () => {
    const { app, call, make } = await setup();
    const shown = await make("Shown");
    const hidden = await make("Hidden");
    const onlyPrivate = await make("Only private songs");
    await call("POST", `/api/admin/playlists/${shown.id}/tracks`, { action: "add", ids: [ids[2], ids[1], ids[0]] });
    await call("POST", `/api/admin/playlists/${hidden.id}/tracks`, { action: "add", ids: [ids[0]] });
    await call("PATCH", `/api/admin/playlists/${hidden.id}`, { visibility: "private" });
    await call("POST", `/api/admin/playlists/${onlyPrivate.id}/tracks`, { action: "add", ids: [ids[2]] });

    const { playlists } = (await app.inject("/api/collection")).json();
    expect(playlists).toEqual([{ id: shown.id, name: { en: "Shown" }, description: {}, trackIds: [ids[1], ids[0]], sourceUrl: null }]);
  });

  it("plays a chosen playlist in its order in the site's player", async () => {
    const { app, call, make } = await setup();
    const playlist = await make();
    await call("POST", `/api/admin/playlists/${playlist.id}/tracks`, { action: "add", ids: [ids[3], ids[1], ids[2], ids[0]] });
    const settings = { enabled: true, mode: "custom", embedUrl: "", shuffle: false, volume: 30, autoCollapseSeconds: 0 };

    // Without a playlist: songs marked "in player".
    expect((await app.inject("/api/spotify/player")).json().tracks.map((t: { id: string }) => t.id)).toEqual([ids[0]]);
    const saved = await call("PUT", "/api/admin/spotify", { ...settings, playlistId: playlist.id });
    // Its public songs with a preview, in playlist order (song 4 has no preview, song 3 is hidden).
    expect(saved.json().playerTracks).toBe(2);
    expect((await app.inject("/api/spotify/player")).json().tracks.map((t: { id: string }) => t.id)).toEqual([ids[1], ids[0]]);

    // A hidden or deleted playlist falls back to the songs marked "in player".
    await call("PATCH", `/api/admin/playlists/${playlist.id}`, { visibility: "private" });
    expect((await app.inject("/api/spotify/player")).json().tracks.map((t: { id: string }) => t.id)).toEqual([ids[0]]);
    expect((await call("PUT", "/api/admin/spotify", { ...settings, playlistId: "nope" })).statusCode).toBe(400);
  });
});
