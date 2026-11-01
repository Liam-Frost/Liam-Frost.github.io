import type { SpotifyAccountStatus, SpotifyOwnPlaylist } from "@liam-frost/shared";
import { randomBytes } from "node:crypto";

import { SecretBox } from "../lib/secret-box";
import { SourceError } from "../media/sources";
import type { SettingsRepository } from "../settings/types";

const KEY = "spotify.account";
const SCOPES = "user-library-read playlist-read-private playlist-read-collaborative";
const STATE_TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 15_000;
const API = "https://api.spotify.com/v1";

type StoredAccount = { refreshToken: string; id: string; displayName: string; connectedAt: string };

/** A song read from the Spotify Web API (which no longer returns previews to new apps). */
export type ApiTrack = {
  id: string;
  title: string;
  artists: string[];
  album: string | null;
  year: number | null;
  durationMs: number | null;
  coverUrl: string | null;
  spotifyUrl: string;
};

type SpotifyApiTrack = {
  id?: string | null;
  type?: string;
  is_local?: boolean;
  name?: string;
  artists?: { name?: string }[];
  album?: {
    name?: string;
    release_date?: string;
    images?: { url?: string; width?: number | null }[];
  };
  duration_ms?: number;
  external_urls?: { spotify?: string };
};

function toApiTrack(track: SpotifyApiTrack | null | undefined): ApiTrack | null {
  if (!track?.id || track.is_local || (track.type && track.type !== "track") || !track.name)
    return null;
  const images = [...(track.album?.images ?? [])].filter((image) =>
    image.url?.startsWith("https://")
  );
  images.sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return {
    id: track.id,
    title: track.name,
    artists: (track.artists ?? []).map((artist) => artist.name?.trim() ?? "").filter(Boolean),
    album: track.album?.name ?? null,
    year: Number(track.album?.release_date?.slice(0, 4)) || null,
    durationMs: track.duration_ms ?? null,
    coverUrl: images[0]?.url ?? null,
    spotifyUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`
  };
}

export class SpotifyAuthError extends SourceError {}

/**
 * The admin's Spotify account (OAuth authorization code flow). The callback arrives from Spotify without
 * the admin cookie (SameSite=Strict; in development also on another origin), so it is authorized by a
 * one-time state created by a signed-in admin. The refresh token is stored encrypted.
 */
export class SpotifyAccount {
  private readonly states = new Map<string, { returnTo: string; expires: number }>();
  private access: { token: string; expires: number } | null = null;
  private readonly box: SecretBox;

  constructor(
    private readonly app: { clientId: string; clientSecret: string; redirectUri: string } | null,
    private readonly repo: SettingsRepository | null,
    sessionSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now
  ) {
    this.box = new SecretBox(sessionSecret, "spotify-account");
  }

  private async stored(): Promise<StoredAccount | null> {
    const value = (await this.repo?.get(KEY)) as StoredAccount | null | undefined;
    return value && typeof value.refreshToken === "string" ? value : null;
  }

  async status(): Promise<SpotifyAccountStatus> {
    const account = this.app ? await this.stored() : null;
    return {
      configured: Boolean(this.app && this.repo),
      redirectUri: this.app?.redirectUri ?? null,
      account: account && {
        id: account.id,
        displayName: account.displayName,
        connectedAt: account.connectedAt
      }
    };
  }

  /** The Spotify authorization page; the callback returns the browser to `returnTo`. */
  authorizeUrl(returnTo: string) {
    if (!this.app || !this.repo)
      throw new SourceError("未配置 SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET");
    const now = this.now();
    for (const [key, value] of this.states) if (value.expires < now) this.states.delete(key);
    const state = randomBytes(16).toString("hex");
    this.states.set(state, { returnTo, expires: now + STATE_TTL_MS });
    const url = new URL("https://accounts.spotify.com/authorize");
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: this.app.clientId,
      scope: SCOPES,
      redirect_uri: this.app.redirectUri,
      state,
      show_dialog: "true"
    }).toString();
    return url.toString();
  }

  /** Where to send the browser for a callback state; null for an unknown or expired one. Consumes it. */
  takeState(state: string): string | null {
    const entry = this.states.get(state);
    this.states.delete(state);
    return entry && entry.expires >= this.now() ? entry.returnTo : null;
  }

  private async token(body: Record<string, string>) {
    const basic = Buffer.from(`${this.app!.clientId}:${this.app!.clientSecret}`).toString("base64");
    let response: Response;
    try {
      response = await this.fetchImpl("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          authorization: `Basic ${basic}`,
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams(body),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch {
      throw new SourceError(
        "无法连接 Spotify。如果访问它需要代理，请在 apps/api/.env 中设置 HTTPS_PROXY 后重启 API"
      );
    }
    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!response.ok || !data.access_token) {
      if (data.error === "invalid_grant")
        throw new SpotifyAuthError("Spotify 授权已失效，请重新连接");
      throw new SourceError(`Spotify 授权失败（${data.error ?? `HTTP ${response.status}`}）`);
    }
    this.access = {
      token: data.access_token,
      expires: this.now() + ((data.expires_in ?? 3600) - 60) * 1000
    };
    return data;
  }

  /** Exchanges the callback code and stores the account. */
  async complete(code: string) {
    if (!this.app || !this.repo) throw new SourceError("未配置 Spotify 应用");
    const data = await this.token({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.app.redirectUri
    });
    if (!data.refresh_token) throw new SourceError("Spotify 没有返回刷新令牌");
    const me = await this.get<{ id?: string; display_name?: string | null }>("/me");
    await this.repo.set(KEY, {
      refreshToken: this.box.seal(data.refresh_token),
      id: me.id ?? "",
      displayName: me.display_name || me.id || "Spotify",
      connectedAt: new Date(this.now()).toISOString()
    } satisfies StoredAccount);
  }

  async disconnect() {
    this.access = null;
    await this.repo?.set(KEY, null);
  }

  private async accessToken() {
    if (this.access && this.access.expires > this.now()) return this.access.token;
    const account = await this.stored();
    const refreshToken = account && this.box.open(account.refreshToken);
    if (!account || !refreshToken) throw new SpotifyAuthError("还没有连接 Spotify 账号");
    try {
      const data = await this.token({ grant_type: "refresh_token", refresh_token: refreshToken });
      // Spotify may rotate the refresh token.
      if (data.refresh_token && data.refresh_token !== refreshToken)
        await this.repo!.set(KEY, { ...account, refreshToken: this.box.seal(data.refresh_token) });
    } catch (error) {
      if (error instanceof SpotifyAuthError) await this.disconnect();
      throw error;
    }
    return this.access!.token;
  }

  private async get<T>(pathOrUrl: string, attempt = 0): Promise<T> {
    const token = await this.accessToken();
    let response: Response;
    try {
      response = await this.fetchImpl(
        pathOrUrl.startsWith("https://") ? pathOrUrl : API + pathOrUrl,
        {
          headers: { authorization: `Bearer ${token}`, accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS)
        }
      );
    } catch {
      throw new SourceError(
        "无法连接 Spotify。如果访问它需要代理，请在 apps/api/.env 中设置 HTTPS_PROXY 后重启 API"
      );
    }
    // Rate limited: wait as asked (capped), a few times.
    if (response.status === 429 && attempt < 3) {
      await response.body?.cancel();
      const wait = Math.min(Number(response.headers.get("retry-after") ?? 2) || 0, 30) * 1000;
      await new Promise((resolve) => setTimeout(resolve, wait));
      return this.get<T>(pathOrUrl, attempt + 1);
    }
    if (response.status === 401) {
      await response.body?.cancel();
      this.access = null;
      if (attempt < 1) return this.get<T>(pathOrUrl, attempt + 1);
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 403)
        throw new SourceError(
          "Spotify 拒绝了请求（403）。开发模式的应用需要在 Spotify Developer 的 User Management 里加入你的账号"
        );
      throw new SourceError(`Spotify 返回错误（HTTP ${response.status}）`);
    }
    return (await response.json()) as T;
  }

  /** Follows `next` links of a paged Spotify endpoint. */
  private async paged<T>(first: string, limit = 10_000): Promise<T[]> {
    const items: T[] = [];
    let next: string | null = first;
    while (next && items.length < limit) {
      const page: { items?: T[]; next?: string | null } = await this.get(next);
      items.push(...(page.items ?? []));
      next = page.next ?? null;
    }
    return items;
  }

  async likedTracks(): Promise<ApiTrack[]> {
    const items = await this.paged<{ track?: SpotifyApiTrack }>("/me/tracks?limit=50");
    return items
      .map((item) => toApiTrack(item.track))
      .filter((track): track is ApiTrack => track !== null);
  }

  async playlists(): Promise<SpotifyOwnPlaylist[]> {
    type Item = {
      id?: string;
      name?: string;
      tracks?: { total?: number };
      images?: { url?: string }[] | null;
      owner?: { display_name?: string | null; id?: string };
    };
    const items = await this.paged<Item | null>("/me/playlists?limit=50");
    return items
      .filter((item): item is Item & { id: string } => Boolean(item?.id))
      .map((item) => ({
        id: item.id,
        name: item.name ?? "",
        tracks: item.tracks?.total ?? 0,
        image: item.images?.[0]?.url ?? null,
        owner: item.owner?.display_name || item.owner?.id || ""
      }));
  }

  async playlist(playlistId: string): Promise<{ name: string; tracks: ApiTrack[] }> {
    const meta = await this.get<{ name?: string }>(
      `/playlists/${encodeURIComponent(playlistId)}?fields=name`
    );
    const items = await this.paged<{ track?: SpotifyApiTrack }>(
      `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`
    );
    return {
      name: meta.name ?? "",
      tracks: items
        .map((item) => toApiTrack(item.track))
        .filter((track): track is ApiTrack => track !== null)
    };
  }
}
