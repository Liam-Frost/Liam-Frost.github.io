import type { SteamAccountStatus } from "@liam-frost/shared";
import { randomBytes } from "node:crypto";

import { SourceError } from "../media/sources";
import type { SettingsRepository } from "../settings/types";

const KEY = "steam.account";
const OPENID = "https://steamcommunity.com/openid/login";
const API = "https://api.steampowered.com";
const STATE_TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 20_000;

type StoredAccount = {
  steamId: string;
  name: string;
  avatar: string | null;
  profileUrl: string;
  connectedAt: string;
  lastSyncedAt: string | null;
};

/** A game in the Steam library. */
export type OwnedGame = {
  appId: number;
  name: string;
  minutes: number;
  minutesTwoWeeks: number;
  lastPlayed: number | null;
};

/**
 * The admin's Steam account. Steam has no OAuth for other sites, only "Sign in through Steam" (OpenID
 * 2.0), which proves the SteamID; the library is then read with the site's Web API key. Like Spotify's
 * callback, Steam's comes back without the admin cookie, so a one-time state authorizes it. Nothing
 * secret is stored: only the SteamID and the profile's name and avatar.
 */
export class SteamAccount {
  private readonly states = new Map<
    string,
    { returnTo: string; callbackUrl: string; expires: number }
  >();

  constructor(
    private readonly apiKey: string,
    private readonly repo: SettingsRepository | null,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now
  ) {}

  private async stored(): Promise<StoredAccount | null> {
    const value = (await this.repo?.get(KEY)) as StoredAccount | null | undefined;
    return value && typeof value.steamId === "string" ? value : null;
  }

  async status(): Promise<SteamAccountStatus> {
    return { configured: Boolean(this.apiKey), account: await this.stored() };
  }

  /** Steam's sign-in page; it returns to `callbackUrl` with a one-time state, then the admin goes to `returnTo`. */
  signInUrl(returnTo: string, callbackUrl: string) {
    if (!this.apiKey) throw new SourceError("未配置 STEAM_WEB_API_KEY");
    for (const [state, entry] of this.states)
      if (entry.expires < this.now()) this.states.delete(state);
    const state = randomBytes(16).toString("hex");
    const back = `${callbackUrl}?state=${state}`;
    this.states.set(state, { returnTo, callbackUrl: back, expires: this.now() + STATE_TTL_MS });
    const url = new URL(OPENID);
    url.search = new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": back,
      "openid.realm": new URL(callbackUrl).origin,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select"
    }).toString();
    return url.toString();
  }

  /** The state's return address and expected callback, once; null when unknown or expired. */
  takeState(state: string) {
    const entry = this.states.get(state);
    this.states.delete(state);
    return entry && entry.expires >= this.now() ? entry : null;
  }

  /**
   * Checks Steam's answer with Steam itself (check_authentication), so a forged callback cannot sign in
   * another account, then stores the SteamID with its public name and avatar.
   */
  async complete(params: Record<string, string>, expectedReturnTo: string) {
    if (params["openid.mode"] !== "id_res") throw new SourceError("已取消 Steam 登录");
    if (params["openid.op_endpoint"] !== OPENID || params["openid.return_to"] !== expectedReturnTo)
      throw new SourceError("Steam 登录信息不匹配");
    const steamId = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(
      params["openid.claimed_id"] ?? ""
    )?.[1];
    if (!steamId) throw new SourceError("Steam 没有返回账号");

    const check = new URLSearchParams(
      Object.entries(params).filter(([key]) => key.startsWith("openid."))
    );
    check.set("openid.mode", "check_authentication");
    const answer = await this.request(OPENID, { method: "POST", body: check }, "Steam");
    if (!/is_valid\s*:\s*true/.test(await answer.text()))
      throw new SourceError("Steam 没有确认这次登录");

    const summary = await this.api<{
      response?: { players?: { personaname?: string; avatarfull?: string; profileurl?: string }[] };
    }>("/ISteamUser/GetPlayerSummaries/v2/", { steamids: steamId });
    const player = summary.response?.players?.[0];
    const account: StoredAccount = {
      steamId,
      name: player?.personaname ?? steamId,
      avatar: player?.avatarfull ?? null,
      profileUrl: player?.profileurl ?? `https://steamcommunity.com/profiles/${steamId}`,
      connectedAt: new Date(this.now()).toISOString(),
      lastSyncedAt: null
    };
    await this.repo?.set(KEY, account);
    return account;
  }

  async disconnect() {
    await this.repo?.set(KEY, null);
  }

  async markSynced() {
    const account = await this.stored();
    if (account)
      await this.repo?.set(KEY, { ...account, lastSyncedAt: new Date(this.now()).toISOString() });
  }

  /** The library with playtimes. An empty answer means the profile's game details are not public. */
  async ownedGames(): Promise<OwnedGame[]> {
    const account = await this.stored();
    if (!account) throw new SourceError("还没有连接 Steam 账号");
    const data = await this.api<{
      response?: {
        game_count?: number;
        games?: {
          appid: number;
          name?: string;
          playtime_forever?: number;
          playtime_2weeks?: number;
          rtime_last_played?: number;
        }[];
      };
    }>("/IPlayerService/GetOwnedGames/v1/", {
      steamid: account.steamId,
      include_appinfo: "1",
      include_played_free_games: "1"
    });
    if (!data.response?.games)
      throw new SourceError("读取不到游戏库：请在 Steam 隐私设置里把“游戏详情”设为公开");
    return data.response.games.map((game) => ({
      appId: game.appid,
      name: game.name?.trim() || `App ${game.appid}`,
      minutes: game.playtime_forever ?? 0,
      minutesTwoWeeks: game.playtime_2weeks ?? 0,
      lastPlayed: game.rtime_last_played ? game.rtime_last_played * 1000 : null
    }));
  }

  private async api<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!this.apiKey) throw new SourceError("未配置 STEAM_WEB_API_KEY");
    const url = new URL(API + path);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("key", this.apiKey);
    try {
      return (await (await this.request(url.toString(), {}, "Steam")).json()) as T;
    } catch (error) {
      // Steam answers a bad key with 403; the key must never reach a message.
      if (error instanceof SourceError && /HTTP 40[13]/.test(error.message))
        throw new SourceError("Steam 拒绝了请求，请检查 STEAM_WEB_API_KEY");
      throw error;
    }
  }

  private async request(url: string, init: RequestInit, what: string) {
    let response: Response;
    try {
      response = await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new SourceError(
        `无法连接 ${what}。如果访问它需要代理，请在 apps/api/.env 中设置 HTTPS_PROXY 后重启 API`
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new SourceError(`${what} 返回错误（HTTP ${response.status}）`);
    }
    return response;
  }
}
