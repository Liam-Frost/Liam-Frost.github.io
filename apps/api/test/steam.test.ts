import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { MediaSources, SourceDetails } from "../src/media/sources";
import { MemorySettingsRepository } from "../src/settings/types";
import { buildTestServer, csrf, login, offlineMediaSources } from "./helpers";
import { MemoryMediaRepository } from "./memory-media-repository";

let jpg: Buffer;
beforeAll(async () => {
  jpg = await sharp({ create: { width: 300, height: 450, channels: 3, background: "#123" } })
    .jpeg()
    .toBuffer();
});

const STEAM_ID = "76561198000000001";
const KEY = "steam-test-key";

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;
const fakeFetch = (handler: Handler) =>
  vi.fn(async (input: string | URL | Request, init: RequestInit = {}) =>
    handler(new URL(String(input)), init)
  ) as unknown as typeof fetch;

/** Steam's OpenID check, Web API and store, with a library of three games. */
function steam(options: { valid?: boolean; library?: object[] | null } = {}): Handler {
  return (url, init) => {
    if (url.hostname === "steamcommunity.com") {
      expect(new URLSearchParams(String(init.body)).get("openid.mode")).toBe(
        "check_authentication"
      );
      return new Response(
        `ns:http://specs.openid.net/auth/2.0\nis_valid:${options.valid === false ? "false" : "true"}\n`
      );
    }
    if (url.pathname === "/ISteamUser/GetPlayerSummaries/v2/") {
      expect(url.searchParams.get("key")).toBe(KEY);
      return Response.json({
        response: {
          players: [
            {
              personaname: "Liam",
              avatarfull: "https://avatars.steamstatic.com/a.jpg",
              profileurl: "https://steamcommunity.com/id/liam/"
            }
          ]
        }
      });
    }
    if (url.pathname === "/IPlayerService/GetOwnedGames/v1/") {
      expect(url.searchParams.get("steamid")).toBe(STEAM_ID);
      if (options.library === null) return Response.json({ response: {} });
      return Response.json({
        response: {
          game_count: 3,
          games: options.library ?? [
            {
              appid: 1245620,
              name: "ELDEN RING",
              playtime_forever: 7920,
              playtime_2weeks: 0,
              rtime_last_played: 1735689600
            },
            {
              appid: 367520,
              name: "Hollow Knight",
              playtime_forever: 2400,
              playtime_2weeks: 90,
              rtime_last_played: 1793000000
            },
            { appid: 999999, name: "Tiny Indie", playtime_forever: 0 }
          ]
        }
      });
    }
    if (url.hostname === "store.steampowered.com") {
      return Response.json({
        "999999": {
          success: true,
          data: {
            name: "小小独立游戏",
            short_description: "Hello <<script>script>alert(1)<</script>/script> world",
            developers: ["Solo Dev"],
            publishers: ["Solo Dev"],
            genres: [{ description: "独立" }],
            release_date: { date: "2024 年 5 月 1 日" },
            platforms: { windows: true, mac: true }
          }
        }
      });
    }
    return new Response("", { status: 404 });
  };
}

const igdbDetails = (id: string): SourceDetails => ({
  sourceId: id,
  sourceUrl: `https://www.igdb.com/games/${id}`,
  title: { en: "Elden Ring", zh: "艾尔登法环" },
  originalTitle: "Elden Ring",
  year: 2022,
  genres: [],
  credits: ["FromSoftware"],
  overview: {},
  posterUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/x.jpg",
  episodes: null,
  publication: null,
  game: {
    platforms: ["PC (Microsoft Windows)"],
    publishers: ["Bandai Namco Entertainment"],
    playtimeHours: null
  }
});

async function setup(handler: Handler = steam()) {
  const media = new MemoryMediaRepository();
  const settings = new MemorySettingsRepository();
  const sources: MediaSources = {
    ...offlineMediaSources,
    available: () => ({
      tmdb: false,
      bangumi: true,
      openlibrary: true,
      googlebooks: false,
      anilist: true,
      igdb: true
    }),
    steamGames: async (ids) => {
      const known: Record<string, string> = { "1245620": "119133", "367520": "14593" };
      return new Map(ids.filter((id) => known[id]).map((id) => [id, known[id]]));
    },
    details: async (_source, _kind, id) => igdbDetails(id),
    download: async () => jpg
  };
  const app = await buildTestServer(
    { STEAM_WEB_API_KEY: KEY },
    { media, settings, mediaSources: sources, steamFetch: fakeFetch(handler) }
  );
  const cookie = await login(app);
  const headers = { ...csrf, cookie };
  return { app, media, settings, headers, cookie };
}

/** Signs in: the admin asks for Steam's URL, and Steam sends the browser to the callback. */
async function signIn(
  app: Awaited<ReturnType<typeof setup>>["app"],
  headers: Record<string, string>,
  tamper?: (params: URLSearchParams) => void
) {
  const { url } = (
    await app.inject({
      method: "POST",
      url: "/api/admin/steam/connect",
      headers,
      payload: { returnTo: "http://localhost:5174/admin/collection?kind=game" }
    })
  ).json();
  const steamPage = new URL(url);
  expect(steamPage.origin + steamPage.pathname).toBe("https://steamcommunity.com/openid/login");
  const returnTo = steamPage.searchParams.get("openid.return_to")!;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": "https://steamcommunity.com/openid/login",
    "openid.claimed_id": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    "openid.identity": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    "openid.return_to": returnTo,
    "openid.response_nonce": "2026-11-05T00:00:00Zabc",
    "openid.assoc_handle": "1234567890",
    "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
    "openid.sig": "c2ln"
  });
  tamper?.(params);
  const callback = new URL(returnTo);
  for (const [key, value] of params) callback.searchParams.set(key, value);
  return app.inject({ url: callback.pathname + callback.search });
}

async function waitFor(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string, id: string) {
  for (let i = 0; i < 100; i++) {
    const { job } = (
      await app.inject({ url: `/api/admin/steam/jobs/${id}`, headers: { cookie } })
    ).json();
    if (job.state !== "running") return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("sync did not finish");
}

describe("Steam account", () => {
  it("signs in through Steam, checked with Steam, and stores no secret", async () => {
    const { app, headers, cookie, settings } = await setup();
    const back = await signIn(app, headers);
    expect(back.statusCode).toBe(302);
    expect(back.headers.location).toBe(
      "http://localhost:5174/admin/collection?kind=game&steam=connected"
    );
    const status = (
      await app.inject({ url: "/api/admin/steam/account", headers: { cookie } })
    ).json();
    expect(status).toMatchObject({
      configured: true,
      account: {
        steamId: STEAM_ID,
        name: "Liam",
        profileUrl: "https://steamcommunity.com/id/liam/",
        lastSyncedAt: null
      }
    });
    expect(JSON.stringify(await settings.get("steam.account"))).not.toContain(KEY);

    expect(
      (await app.inject({ method: "DELETE", url: "/api/admin/steam/account", headers })).statusCode
    ).toBe(204);
    expect(
      (await app.inject({ url: "/api/admin/steam/account", headers: { cookie } })).json().account
    ).toBeNull();
  });

  it("refuses forged, replayed and unconfirmed sign-ins", async () => {
    const { app, headers, cookie } = await setup(steam({ valid: false }));
    const unconfirmed = await signIn(app, headers);
    expect(unconfirmed.headers.location).toContain("steam=error");
    const forged = await signIn(app, headers, (params) =>
      params.set("openid.return_to", "https://evil.example/cb")
    );
    expect(forged.headers.location).toContain("steam=error");
    expect(
      (
        await app.inject({
          url: "/api/admin/steam/callback?state=00000000000000000000000000000000"
        })
      ).statusCode
    ).toBe(400);
    expect(
      (await app.inject({ url: "/api/admin/steam/account", headers: { cookie } })).json().account
    ).toBeNull();
  });
});

describe("Steam library sync", () => {
  it("updates collected games and adds the rest hidden, from IGDB or the store", async () => {
    const { app, headers, cookie, media } = await setup();
    await signIn(app, headers);
    // Hollow Knight is already in the collection (from IGDB), with the admin's own record.
    await media.create({
      id: "11111111-1111-4111-8111-111111111111",
      kind: "game",
      source: "igdb",
      sourceId: "14593",
      title: { en: "Hollow Knight" },
      status: "done",
      rating: 5
    });

    const start = await app.inject({ method: "POST", url: "/api/admin/steam/sync", headers });
    expect(start.statusCode).toBe(202);
    const job = await waitFor(app, cookie, start.json().job.id);
    expect(job).toMatchObject({
      state: "done",
      total: 3,
      processed: 3,
      added: 2,
      fromStore: 1,
      updated: 1,
      failed: 0
    });

    const games = await media.list({ kind: "game", includePrivate: true });
    const hollow = games.find((g) => g.sourceId === "14593")!;
    expect(hollow).toMatchObject({ status: "done", rating: 5, visibility: "public" });
    expect(hollow.extra.game).toMatchObject({
      steamAppId: 367520,
      playtimeHours: 40,
      lastPlayedOn: "2026-10-26"
    });

    const elden = games.find((g) => g.sourceId === "119133")!;
    expect(elden).toMatchObject({
      source: "igdb",
      status: "done",
      visibility: "private",
      title: { zh: "艾尔登法环" }
    });
    expect(elden.extra.game).toMatchObject({
      steamAppId: 1245620,
      playtimeHours: 132,
      lastPlayedOn: "2025-01-01",
      platforms: ["PC (Microsoft Windows)"]
    });

    const indie = games.find((g) => g.source === "steam")!;
    expect(indie.overview.zh).toContain("Hello");
    expect(indie.overview.zh).not.toMatch(/[<>]/);
    expect(indie).toMatchObject({
      sourceId: "999999",
      status: "want",
      visibility: "private",
      title: { en: "Tiny Indie", zh: "小小独立游戏" },
      year: 2024,
      credits: ["Solo Dev"]
    });
    expect(indie.extra.game).toMatchObject({
      steamAppId: 999999,
      playtimeHours: 0,
      platforms: ["PC (Microsoft Windows)", "Mac"],
      publishers: ["Solo Dev"]
    });
    expect(indie.poster).not.toBeNull();

    // A second sync finds every game by its Steam id and adds nothing.
    const again = await waitFor(
      app,
      cookie,
      (await app.inject({ method: "POST", url: "/api/admin/steam/sync", headers })).json().job.id
    );
    expect(again).toMatchObject({ added: 0, updated: 3 });
    expect(await media.list({ kind: "game", includePrivate: true })).toHaveLength(3);
    expect(
      (await app.inject({ url: "/api/admin/steam/account", headers: { cookie } })).json().account
        .lastSyncedAt
    ).not.toBeNull();
  });

  it("explains a private library and a missing account", async () => {
    const { app, headers, cookie } = await setup(steam({ library: null }));
    const noAccount = await waitFor(
      app,
      cookie,
      (await app.inject({ method: "POST", url: "/api/admin/steam/sync", headers })).json().job.id
    );
    expect(noAccount).toMatchObject({ state: "failed", error: "还没有连接 Steam 账号" });
    await signIn(app, headers);
    const hidden = await waitFor(
      app,
      cookie,
      (await app.inject({ method: "POST", url: "/api/admin/steam/sync", headers })).json().job.id
    );
    expect(hidden.error).toContain("游戏详情");
  });
});
