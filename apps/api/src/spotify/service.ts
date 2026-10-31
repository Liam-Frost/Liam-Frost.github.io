import type { PublicSpotifyPlayer, SpotifySettings, SpotifySyncStatus } from "@liam-frost/shared";
import { z } from "zod";

import type { SettingsRepository } from "../settings/types";
import { PlaylistError, playlistIdFromUrl, playlistUrl, type FetchedPlaylist, type PlaylistFetcher } from "./playlist";

const SETTINGS_KEY = "spotify";
const STATE_KEY = "spotify.playlist";

/** Successful syncs are refreshed after this long. */
export const REFRESH_MS = 6 * 60 * 60 * 1000;
/** After a failed sync, visitors do not trigger another attempt for this long. */
export const RETRY_MS = 10 * 60 * 1000;

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
  error: string | null;
  playlist: FetchedPlaylist | null;
};

const EMPTY_STATE: SyncState = { syncedAt: null, attemptedAt: null, error: null, playlist: null };

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
    if (settings.playlistUrl !== previous.playlistUrl) await this.sync();
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
    const knownCovers = new Map((previous.playlist?.tracks ?? []).map((track) => [track.id, track.image] as const));

    let next: SyncState;
    try {
      const playlist = await this.fetchPlaylist(id, knownCovers);
      next = { syncedAt: attemptedAt, attemptedAt, error: null, playlist };
    } catch (error) {
      this.onSyncError(error);
      next = { ...previous, attemptedAt, error: error instanceof PlaylistError ? error.message : "同步失败" };
    }
    await this.repo.set(STATE_KEY, next);
    return next;
  }

  /** Sync details for the admin; a playlist cached for another URL does not count. */
  async status(): Promise<SpotifySyncStatus> {
    const [settings, state] = await Promise.all([this.settings(), this.state()]);
    const current = state.playlist?.id === playlistIdFromUrl(settings.playlistUrl) ? state.playlist : null;
    return {
      syncedAt: current ? state.syncedAt : null,
      attemptedAt: state.attemptedAt,
      error: state.error,
      playlist: current && { id: current.id, name: current.name, image: current.image, link: current.link },
      tracks: current?.tracks ?? []
    };
  }

  /**
   * The site's player. The first request for a playlist waits for its sync; later ones get the cached
   * playlist and refresh it in the background once it is old.
   */
  async player(): Promise<PublicSpotifyPlayer> {
    const settings = await this.settings();
    const { playlistUrl: _url, ...options } = settings;
    if (!settings.enabled) return { ...options, playlist: null, tracks: [] };

    let state = await this.state();
    const id = playlistIdFromUrl(settings.playlistUrl);
    const now = this.now();
    const mayRetry = !state.error || !state.attemptedAt || now - Date.parse(state.attemptedAt) > RETRY_MS;
    const current = state.playlist?.id === id;

    if (!current && mayRetry) {
      state = await this.sync();
    } else if (current && mayRetry && (!state.syncedAt || now - Date.parse(state.syncedAt) > REFRESH_MS)) {
      this.sync().catch(this.onSyncError);
    }

    const playlist = state.playlist?.id === id ? state.playlist : null;
    return {
      ...options,
      playlist: playlist && { id: playlist.id, name: playlist.name, image: playlist.image, link: playlist.link },
      tracks: playlist?.tracks ?? []
    };
  }
}
