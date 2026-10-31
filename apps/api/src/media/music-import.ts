import type { MediaMusic, MusicImportJob } from "@liam-frost/shared";
import { randomBytes, randomUUID } from "node:crypto";

import { InvalidImageError, processImage, type ProcessedImage } from "../photos/images";
import type { StoredImage } from "../projects/types";
import { PlaylistError, playlistIdFromUrl, type PlaylistFetcher } from "../spotify/playlist";
import type { LocalImageStore } from "../storage/local";
import { storePoster } from "./import";
import type { MusicSource } from "./itunes";
import { SourceError, type MediaSources } from "./sources";
import { DuplicateMediaError, type MediaRepository, type MediaRow } from "./types";

type Deps = { media: MediaRepository; sources: MediaSources; store: LocalImageStore };

/** Artists as separate credits: "A, B" and "A & B" become ["A", "B"]. */
const splitArtists = (artist: string) =>
  artist
    .split(/\s*(?:,|、|&|＆)\s*/)
    .map((name) => name.trim())
    .filter(Boolean);

const musicExtra = (music: MediaMusic) => ({ music });

/** Downloads and processes a cover; failures leave the song without one. */
async function cover(deps: Deps, url: string | null): Promise<ProcessedImage | null> {
  if (!url) return null;
  try {
    return await processImage(await deps.sources.download(url));
  } catch (error) {
    if (error instanceof SourceError || error instanceof InvalidImageError) return null;
    throw error;
  }
}

/** Adds an iTunes song. Throws DuplicateMediaError when it is already in the collection. */
export async function importItunesSong(deps: Deps & { music: MusicSource }, itunesId: string, country: string): Promise<MediaRow> {
  if ((await deps.media.findBySource("itunes", [itunesId])).size) throw new DuplicateMediaError();
  const song = await deps.music.lookup(itunesId, country);
  if (!song) throw new SourceError("iTunes 上找不到这首歌");

  const id = randomUUID();
  const image = await cover(deps, song.artworkLarge);
  const poster = image ? await storePoster(deps.store, id, image) : null;
  try {
    return await deps.media.create({
      id,
      kind: "track",
      source: "itunes",
      sourceId: song.itunesId,
      sourceUrl: song.appleUrl,
      title: { en: song.title },
      year: song.year,
      genres: song.genre ? [{ en: song.genre }] : [],
      credits: splitArtists(song.artist),
      poster,
      extra: musicExtra({ album: song.album, durationMs: song.durationMs, previewUrl: song.previewUrl, spotifyUrl: null, appleUrl: song.appleUrl }),
      inPlayer: Boolean(song.previewUrl)
    });
  } catch (error) {
    if (poster) await deps.store.remove(`media/${id}`).catch(() => undefined);
    throw error;
  }
}

const MAX_JOBS = 10;

/**
 * Imports the songs of a public Spotify playlist (from its embed page, with 30-second previews) as a
 * background job; the admin polls its progress. Songs already in the collection are skipped, so a
 * playlist can be imported again to pick up new songs.
 */
export class PlaylistImports {
  private readonly jobs = new Map<string, MusicImportJob>();
  private running: string | null = null;

  constructor(
    private readonly deps: Deps,
    private readonly fetchPlaylist: PlaylistFetcher,
    private readonly onError: (error: unknown) => void = () => {}
  ) {}

  get(id: string) {
    return this.jobs.get(id) ?? null;
  }

  /** Starts an import, or returns the one already running. Throws PlaylistError for a bad link. */
  start(playlistLink: string): MusicImportJob {
    if (this.running) return this.jobs.get(this.running)!;
    const playlistId = playlistIdFromUrl(playlistLink);
    if (!playlistId) throw new PlaylistError("请填写 Spotify 歌单链接，例如 https://open.spotify.com/playlist/…");

    const job: MusicImportJob = { id: randomBytes(8).toString("hex"), state: "running", playlistName: null, total: 0, processed: 0, added: 0, skipped: 0, noPreview: 0, error: null };
    this.jobs.set(job.id, job);
    while (this.jobs.size > MAX_JOBS) this.jobs.delete(this.jobs.keys().next().value!);
    this.running = job.id;
    void this.run(job, playlistId).finally(() => {
      this.running = null;
    });
    return job;
  }

  private async run(job: MusicImportJob, playlistId: string) {
    try {
      // A background job can wait for every cover.
      const playlist = await this.fetchPlaylist(playlistId, new Map(), { coverBudgetMs: Number.POSITIVE_INFINITY });
      job.playlistName = playlist.name;
      job.total = playlist.tracks.length;
      const existing = await this.deps.media.findBySource("spotify", playlist.tracks.map((track) => track.id));
      // Songs of one album share a cover; download and process it once.
      const covers = new Map<string, Promise<ProcessedImage | null>>();

      for (const track of playlist.tracks) {
        if (existing.has(track.id)) {
          job.skipped += 1;
        } else {
          const id = randomUUID();
          // The playlist's own cover stands in for songs whose cover was not found; leave those without one.
          const coverUrl = track.image && track.image !== playlist.image ? track.image : null;
          let poster: StoredImage | null = null;
          try {
            if (coverUrl && !covers.has(coverUrl)) covers.set(coverUrl, cover(this.deps, coverUrl));
            const image = coverUrl ? await covers.get(coverUrl)! : null;
            poster = image ? await storePoster(this.deps.store, id, image) : null;
            await this.deps.media.create({
              id,
              kind: "track",
              source: "spotify",
              sourceId: track.id,
              sourceUrl: track.link,
              title: { en: track.title },
              credits: splitArtists(track.artist),
              poster,
              extra: musicExtra({ album: null, durationMs: null, previewUrl: track.previewUrl || null, spotifyUrl: track.link, appleUrl: null }),
              inPlayer: Boolean(track.previewUrl)
            });
            job.added += 1;
            if (!track.previewUrl) job.noPreview += 1;
          } catch (error) {
            if (poster) await this.deps.store.remove(`media/${id}`).catch(() => undefined);
            if (!(error instanceof DuplicateMediaError)) throw error;
            job.skipped += 1;
          }
        }
        job.processed += 1;
      }
      job.state = "done";
    } catch (error) {
      this.onError(error);
      job.state = "failed";
      job.error = error instanceof PlaylistError || error instanceof SourceError ? error.message : "导入失败";
    }
  }
}
