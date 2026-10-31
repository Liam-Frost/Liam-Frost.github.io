import type { PublicSpotifyPlayer, SpotifySettings, SpotifyTrack } from "@liam-frost/shared";
import { z } from "zod";

import type { CollectionSettingsStore } from "../media/collection-settings";
import { DEFAULT_COLLECTION_SETTINGS } from "../media/collection-settings";
import { musicOf } from "../media/mapping";
import { isMediaPublic, type MediaRepository, type MediaRow } from "../media/types";
import type { SettingsRepository } from "../settings/types";
import type { LocalImageStore } from "../storage/local";
import { variantFileName } from "../photos/mapping";

const SETTINGS_KEY = "spotify";

export const DEFAULT_SPOTIFY_SETTINGS: SpotifySettings = {
  enabled: true,
  shuffle: true,
  volume: 30,
  autoCollapseSeconds: 3
};

const settingsShape = {
  enabled: z.boolean(),
  shuffle: z.boolean(),
  volume: z.number().int().min(0).max(100),
  autoCollapseSeconds: z.number().int().min(0).max(120)
};

/** Input from the admin: every field, nothing else. */
export const spotifySettingsSchema = z.object(settingsShape).strict();
/** Stored settings may carry fields of older versions (e.g. playlistUrl); they are dropped. */
const storedSettingsSchema = z.object(settingsShape);

/**
 * The site's music player: its settings, and the collection's songs that are public, marked "in player"
 * and have a preview.
 */
export class SpotifyService {
  constructor(
    private readonly repo: SettingsRepository,
    private readonly media: MediaRepository | null,
    private readonly collection: CollectionSettingsStore | null,
    private readonly store: LocalImageStore
  ) {}

  async settings(): Promise<SpotifySettings> {
    const stored = await this.repo.get(SETTINGS_KEY);
    const parsed = storedSettingsSchema.safeParse({ ...DEFAULT_SPOTIFY_SETTINGS, ...(stored && typeof stored === "object" ? stored : {}) });
    return parsed.success ? parsed.data : DEFAULT_SPOTIFY_SETTINGS;
  }

  async saveSettings(settings: SpotifySettings) {
    await this.repo.set(SETTINGS_KEY, settings);
  }

  /** Songs the player plays, in collection order. */
  async tracks(): Promise<SpotifyTrack[]> {
    if (!this.media) return [];
    const [rows, settings] = await Promise.all([this.media.list({ kind: "track" }), this.collection?.get() ?? DEFAULT_COLLECTION_SETTINGS]);
    return rows
      .filter((row) => row.inPlayer && isMediaPublic(row, settings))
      .map((row) => this.toTrack(row))
      .filter((track): track is SpotifyTrack => track !== null);
  }

  private toTrack(row: MediaRow): SpotifyTrack | null {
    const music = musicOf(row);
    if (!music?.previewUrl) return null;
    const cover = row.poster?.variants.length ? this.store.publicUrl(row.poster.key, variantFileName(row.poster.variants[0].width)) : "";
    return {
      id: row.id,
      title: row.title.en || row.title.zh || row.originalTitle || Object.values(row.title).find(Boolean) || "",
      artist: row.credits.join(", "),
      image: cover,
      link: music.spotifyUrl ?? music.appleUrl ?? "",
      previewUrl: music.previewUrl
    };
  }

  async player(): Promise<PublicSpotifyPlayer> {
    const settings = await this.settings();
    if (!settings.enabled) return { ...settings, tracks: [] };
    return { ...settings, tracks: await this.tracks() };
  }
}
