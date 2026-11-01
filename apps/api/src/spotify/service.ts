import type { PublicSpotifyPlayer, SpotifySettings, SpotifyTrack } from "@liam-frost/shared";
import { z } from "zod";

import type { CollectionSettingsStore } from "../media/collection-settings";
import { DEFAULT_COLLECTION_SETTINGS } from "../media/collection-settings";
import { musicOf } from "../media/mapping";
import { isMediaPublic, type MediaRepository, type MediaRow } from "../media/types";
import type { PlaylistRepository } from "../playlists/types";
import type { SettingsRepository } from "../settings/types";
import type { LocalImageStore } from "../storage/local";
import { variantFileName } from "../photos/mapping";
import { spotifyLink } from "./playlist";

const SETTINGS_KEY = "spotify";

export const DEFAULT_SPOTIFY_SETTINGS: SpotifySettings = {
  enabled: true,
  mode: "custom",
  embedUrl: "https://open.spotify.com/playlist/37i9dQZF1DX9AUX5YVf3hc",
  shuffle: true,
  volume: 30,
  autoCollapseSeconds: 3,
  playlistId: null
};

const settingsShape = {
  enabled: z.boolean(),
  mode: z.enum(["custom", "embed"]),
  embedUrl: z.string().trim().max(500),
  shuffle: z.boolean(),
  volume: z.number().int().min(0).max(100),
  autoCollapseSeconds: z.number().int().min(0).max(120),
  playlistId: z.string().regex(/^[0-9a-f-]{36}$/, "Invalid playlist").nullable().default(null)
};

/** Input from the admin: every field, nothing else. The embed link is normalized (and required for "embed"). */
export const spotifySettingsSchema = z
  .object(settingsShape)
  .strict()
  .transform((value, ctx) => {
    const link = value.embedUrl ? spotifyLink(value.embedUrl) : null;
    if ((value.embedUrl && !link) || (value.mode === "embed" && !link)) {
      ctx.addIssue({ code: "custom", message: "请填写 Spotify 歌单、专辑、歌曲或艺人的链接" });
      return z.NEVER;
    }
    return { ...value, embedUrl: link ?? "" };
  });
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
    private readonly store: LocalImageStore,
    private readonly playlists: PlaylistRepository | null = null
  ) {}

  async settings(): Promise<SpotifySettings> {
    const stored = await this.repo.get(SETTINGS_KEY);
    const parsed = storedSettingsSchema.safeParse({ ...DEFAULT_SPOTIFY_SETTINGS, ...(stored && typeof stored === "object" ? stored : {}) });
    return parsed.success ? parsed.data : DEFAULT_SPOTIFY_SETTINGS;
  }

  async saveSettings(settings: SpotifySettings) {
    await this.repo.set(SETTINGS_KEY, settings);
  }

  /**
   * Songs the player plays: the chosen playlist's songs in playlist order, or (without one, or when it is
   * gone or hidden) every song marked "in player" in the order they were added. Only public songs with
   * a preview play.
   */
  async tracks(playlistId: string | null = null): Promise<SpotifyTrack[]> {
    if (!this.media) return [];
    const [rows, settings, playlist] = await Promise.all([
      this.media.list({ kind: "track" }),
      this.collection?.get() ?? DEFAULT_COLLECTION_SETTINGS,
      playlistId && this.playlists ? this.playlists.get(playlistId) : null
    ]);
    const shown = rows.filter((row) => isMediaPublic(row, settings));
    let picked: MediaRow[];
    if (playlist && playlist.visibility === "public") {
      const byId = new Map(shown.map((row) => [row.id, row]));
      picked = playlist.trackIds.map((id) => byId.get(id)).filter((row): row is MediaRow => row !== undefined);
    } else {
      picked = shown.filter((row) => row.inPlayer).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    return picked.map((row) => this.toTrack(row)).filter((track): track is SpotifyTrack => track !== null);
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
    // The embedded player plays Spotify's own list; the site's card plays the collection's songs.
    if (!settings.enabled || settings.mode === "embed") return { ...settings, tracks: [] };
    return { ...settings, tracks: await this.tracks(settings.playlistId) };
  }
}
