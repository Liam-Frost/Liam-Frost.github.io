import type { PublicSpotifyPlayer, SpotifySettings, SpotifySyncStatus } from "@liam-frost/shared";
import { z } from "zod";

import type { SettingsRepository } from "../settings/types";
import { PlaylistError, playlistIdFromUrl, playlistUrl, type FetchedPlaylist, type PlaylistFetcher } from "./playlist";

const SETTINGS_KEY = "spotify";
const STATE_KEY = "spotify.playlist";

/** Successful syncs are refreshed after this long. */
export const REFRESH_MS = 6 * 60 * 60 * 1000;
/** After a failed sync, visitors do not trigger another attempt for that playlist for this long. */
export const RETRY_MS = 10 * 60 * 1000;
/** A visitor waits at most this long for a playlist's first sync; it then finishes in the background. */
export const FIRST_SYNC_WAIT_MS = 8000;

export const DEFAULT_SPOTIFY_SETTINGS: SpotifySettings = {
  enabled: true,
  playlistUrl: playlistUrl("37i9dQZF1DX9AUX5YVf3hc"),
  shuffle: true,
  volume: 30,
  autoCollapseSeconds: 3
};

export const spotifySettingsSchema = z
  .object({
    enabled: z.boolean(),
    playlistUrl: z
      .string()
      .trim()
      .max(500)
      .refine((value) => playlistIdFromUrl(value) !== null, "请填写 Spotify 歌单链接，例如 https://open.spotify.com/playlist/…")
      .transform((value) => playlistUrl(playlistIdFromUrl(value)!)),
    shuffle: z.boolean(),
    volume: z.number().int().min(0).max(100),
    autoCollapseSeconds: z.number().int().min(0).max(120)
  })
  .strict();

type SyncState = {
  syncedAt: string | null;
  attemptedAt: string | null;
  /** The playlist the last attempt was for. */
  attemptedId: string | null;
  error: string | null;
  playlist: FetchedPlaylist | null;
};

const EMPTY_STATE: SyncState = { syncedAt: null, attemptedAt: null, attemptedId: null, error: null, playlist: null };

const playlistInfo = ({ id, name, image, link }: FetchedPlaylist) => ({ id, name, image, link });

/** Player settings plus the cached playlist, synced from Spotify on demand. */
export class SpotifyService {
  private inflight: Promise<SyncState> | null = null;

  constructor(
    private readonly repo: SettingsRepository,
    private readonly fetchPlaylist: PlaylistFetcher,
    private readonly onSyncError: (error: unknown) => void = () => {},
    private readonly now: () => number = Date.now
  ) {}

  async settings(): Promise<SpotifySettings> {
    // Stored settings were validated on save; anything unreadable falls back to the defaults.
    const stored = await this.repo.get(SETTINGS_KEY);
    const parsed = spotifySettingsSchema.safeParse({ ...DEFAULT_SPOTIFY_SETTINGS, ...(stored && typeof stored === "object" ? stored : {}) });
    return parsed.success ? parsed.data : DEFAULT_SPOTIFY_SETTINGS;
  }

  /** Saves validated settings; syncs right away when the playlist changed. */
  async saveSettings(settings: SpotifySettings) {
    const previous = await this.settings();
    await this.repo.set(SETTINGS_KEY, settings);
    if (settings.playlistUrl === previous.playlistUrl) return;
    // A sync already running read the old settings; let it finish, then sync the new playlist.
    await this.inflight?.catch(() => {});
    await this.sync();
  }

  private async state(): Promise<SyncState> {
    const stored = await this.repo.get(STATE_KEY);
    return stored && typeof stored === "object" ? { ...EMPTY_STATE, ...(stored as Partial<SyncState>) } : EMPTY_STATE;
  }

  /** Fetches the configured playlist. Concurrent calls share one fetch; failures keep the last good playlist. */
  sync(): Promise<SyncState> {
    this.inflight ??= this.runSync().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async runSync(): Promise<SyncState> {
    const [settings, previous] = await Promise.all([this.settings(), this.state()]);
    const id = playlistIdFromUrl(settings.playlistUrl)!;
    const attemptedAt = new Date(this.now()).toISOString();
    // Tracks showing the playlist cover had no cover of their own last time; look them up again.
    const knownCovers = new Map(
      (previous.playlist?.tracks ?? []).filter((track) => track.image !== previous.playlist?.image).map((track) => [track.id, track.image] as const)
    );

    let next: SyncState;
    try {
      const playlist = await this.fetchPlaylist(id, knownCovers);
      next = { syncedAt: attemptedAt, attemptedAt, attemptedId: id, error: null, playlist };
    } catch (error) {
      this.onSyncError(error);
      next = { ...previous, attemptedAt, attemptedId: id, error: error instanceof PlaylistError ? error.message : "同步失败" };
    }
    await this.repo.set(STATE_KEY, next);
    return next;
  }

  /** Sync details for the admin; a playlist cached for another URL does not count. */
  async status(settings?: SpotifySettings): Promise<SpotifySyncStatus> {
    const [current, state] = await Promise.all([settings ?? this.settings(), this.state()]);
    const id = playlistIdFromUrl(current.playlistUrl);
    const playlist = state.playlist?.id === id ? state.playlist : null;
    return {
      syncedAt: playlist ? state.syncedAt : null,
      attemptedAt: state.attemptedAt,
      error: state.attemptedId === id ? state.error : null,
      playlist: playlist && playlistInfo(playlist),
      tracks: playlist?.tracks ?? []
    };
  }

  /**
   * The site's player. The first request for a playlist waits (briefly) for its sync; later ones get
   * the cached playlist and refresh it in the background once it is old.
   */
  async player(): Promise<PublicSpotifyPlayer> {
    const settings = await this.settings();
    const { playlistUrl: _url, ...options } = settings;
    if (!settings.enabled) return { ...options, playlist: null, tracks: [] };

    let state = await this.state();
    const id = playlistIdFromUrl(settings.playlistUrl);
    const now = this.now();
    const failedRecently = state.error !== null && state.attemptedId === id && !!state.attemptedAt && now - Date.parse(state.attemptedAt) <= RETRY_MS;
    const current = state.playlist?.id === id;

    if (!current && !failedRecently) {
      const sync = this.sync();
      sync.catch(this.onSyncError);
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), FIRST_SYNC_WAIT_MS);
      });
      state = (await Promise.race([sync, timeout]).finally(() => clearTimeout(timer))) ?? state;
    } else if (current && !failedRecently && (!state.syncedAt || now - Date.parse(state.syncedAt) > REFRESH_MS)) {
      this.sync().catch(this.onSyncError);
    }

    const playlist = state.playlist?.id === id ? state.playlist : null;
    return { ...options, playlist: playlist && playlistInfo(playlist), tracks: playlist?.tracks ?? [] };
  }
}
