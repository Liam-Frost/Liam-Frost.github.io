import type { MediaMusic, MusicImportJob } from "@liam-frost/shared";
import { randomBytes, randomUUID } from "node:crypto";

import { InvalidImageError, processImage, type ProcessedImage } from "../photos/images";
import type { PlaylistRepository } from "../playlists/types";
import type { StoredImage } from "../projects/types";
import type { ApiTrack, SpotifyAccount } from "../spotify/account";
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
export async function importItunesSong(
  deps: Deps & { music: MusicSource },
  itunesId: string,
  country: string
): Promise<MediaRow> {
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
      extra: musicExtra({
        album: song.album,
        durationMs: song.durationMs,
        previewUrl: song.previewUrl,
        spotifyUrl: null,
        appleUrl: song.appleUrl
      }),
      inPlayer: Boolean(song.previewUrl)
    });
  } catch (error) {
    if (poster) await deps.store.remove(`media/${id}`).catch(() => undefined);
    throw error;
  }
}

/** One song to import, whatever the source. */
type ImportSong = {
  spotifyId: string;
  title: string;
  artists: string[];
  album: string | null;
  year: number | null;
  durationMs: number | null;
  coverUrl: string | null;
  spotifyUrl: string;
  /** Known preview, or a lookup for one (Web API songs have none). */
  preview: string | null | (() => Promise<{ previewUrl: string | null; appleUrl: string | null }>);
};

/** Another import is running. */
export class ImportBusyError extends Error {}

const MAX_JOBS = 10;
/** Web API songs need a preview lookup each; a few in parallel. */
const CONCURRENCY = 4;

/**
 * Imports songs from Spotify as background jobs the admin polls: a public playlist link (embed page, with
 * previews), or with a connected account the Liked Songs or one of the admin's playlists (Web API; each
 * song's preview comes from its embed page, else from iTunes). Songs already in the collection are skipped,
 * so imports can be repeated to pick up new songs. One import runs at a time.
 */
export class MusicImports {
  private readonly jobs = new Map<string, MusicImportJob>();
  private running: { jobId: string; key: string } | null = null;

  constructor(
    private readonly deps: Deps & {
      music: MusicSource;
      account: SpotifyAccount;
      fetchPlaylist: PlaylistFetcher;
      trackPreview: (trackId: string) => Promise<string | null>;
      playlists?: PlaylistRepository | null;
    },
    private readonly onError: (error: unknown) => void = () => {}
  ) {}

  get(id: string) {
    return this.jobs.get(id) ?? null;
  }

  /** Starts a public playlist import from its link. Throws PlaylistError for a bad link. */
  startPlaylistLink(link: string) {
    const playlistId = playlistIdFromUrl(link);
    if (!playlistId)
      throw new PlaylistError("请填写 Spotify 歌单链接，例如 https://open.spotify.com/playlist/…");
    return this.start(
      `link:${playlistId}`,
      "playlist-link",
      { sourceId: playlistId, sourceUrl: `https://open.spotify.com/playlist/${playlistId}` },
      async (job) => {
        // A background job can wait for every cover.
        const playlist = await this.deps.fetchPlaylist(playlistId, new Map(), {
          coverBudgetMs: Number.POSITIVE_INFINITY
        });
        job.playlistName = playlist.name;
        return playlist.tracks.map((track) => ({
          spotifyId: track.id,
          title: track.title,
          artists: splitArtists(track.artist),
          album: null,
          year: null,
          durationMs: null,
          // The playlist's own cover stands in for songs whose cover was not found; leave those without one.
          coverUrl: track.image && track.image !== playlist.image ? track.image : null,
          spotifyUrl: track.link,
          preview: track.previewUrl || null
        }));
      }
    );
  }

  /** Starts importing the connected account's Liked Songs, or one of its playlists. */
  startAccount(request: { source: "liked" } | { source: "playlist"; playlistId: string }) {
    const key = request.source === "liked" ? "liked" : `playlist:${request.playlistId}`;
    const playlist =
      request.source === "liked"
        ? { sourceId: "liked", sourceUrl: "https://open.spotify.com/collection/tracks" }
        : {
            sourceId: request.playlistId,
            sourceUrl: `https://open.spotify.com/playlist/${request.playlistId}`
          };
    return this.start(key, request.source, playlist, async (job) => {
      let tracks: ApiTrack[];
      if (request.source === "liked") {
        job.playlistName = "已点赞的歌曲";
        tracks = await this.deps.account.likedTracks();
      } else {
        const playlist = await this.deps.account.playlist(request.playlistId);
        job.playlistName = playlist.name;
        tracks = playlist.tracks;
      }
      return tracks.map((track) => ({
        ...track,
        spotifyId: track.id,
        preview: () => this.findPreview(track)
      }));
    });
  }

  /** Spotify's own preview first, else the same song on iTunes. */
  private async findPreview(track: ApiTrack) {
    const spotify = await this.deps.trackPreview(track.id);
    if (spotify) return { previewUrl: spotify, appleUrl: null };
    const song = await this.deps.music
      .findPreview(track.title, track.artists.join(", "), track.durationMs)
      .catch(() => null);
    return { previewUrl: song?.previewUrl ?? null, appleUrl: song?.appleUrl ?? null };
  }

  private start(
    key: string,
    source: MusicImportJob["source"],
    playlist: { sourceId: string; sourceUrl: string },
    load: (job: MusicImportJob) => Promise<ImportSong[]>
  ): MusicImportJob {
    if (this.running) {
      if (this.running.key === key) return this.jobs.get(this.running.jobId)!;
      throw new ImportBusyError("另一个导入正在进行，请等它完成");
    }
    const job: MusicImportJob = {
      id: randomBytes(8).toString("hex"),
      source,
      state: "running",
      playlistName: null,
      total: 0,
      processed: 0,
      added: 0,
      skipped: 0,
      noPreview: 0,
      error: null
    };
    this.jobs.set(job.id, job);
    while (this.jobs.size > MAX_JOBS) this.jobs.delete(this.jobs.keys().next().value!);
    this.running = { jobId: job.id, key };
    void this.run(job, playlist, load).finally(() => {
      this.running = null;
    });
    return job;
  }

  private async run(
    job: MusicImportJob,
    playlist: { sourceId: string; sourceUrl: string },
    load: (job: MusicImportJob) => Promise<ImportSong[]>
  ) {
    try {
      const songs = await load(job);
      job.total = songs.length;
      const existing = await this.deps.media.findBySource(
        "spotify",
        songs.map((song) => song.spotifyId)
      );
      // Songs of one album share a cover; download and process it once.
      const covers = new Map<string, Promise<ProcessedImage | null>>();
      // Previews and covers are looked up a few at a time; songs are created one by one in list order,
      // which is the order the player plays them in.
      const limit = limiter(CONCURRENCY);
      const prepared = songs.map((song) =>
        existing.has(song.spotifyId)
          ? null
          : limit(() => this.prepare(song, covers)).then(
              (value) => ({ value }),
              (error: unknown) => ({ error })
            )
      );
      for (const [index, song] of songs.entries()) {
        const result = await prepared[index];
        if (!result) job.skipped += 1;
        else if ("error" in result) throw result.error;
        else await this.create(job, song, result.value);
        job.processed += 1;
      }
      await this.fillPlaylist(job, playlist, songs);
      job.state = "done";
    } catch (error) {
      this.onError(error);
      job.state = "failed";
      job.error =
        error instanceof PlaylistError || error instanceof SourceError ? error.message : "导入失败";
    }
  }

  /**
   * The import's songs (new and already collected) go into a playlist of the same name, created on the
   * first import and topped up later; songs already in it keep their place.
   */
  private async fillPlaylist(
    job: MusicImportJob,
    source: { sourceId: string; sourceUrl: string },
    songs: ImportSong[]
  ) {
    const playlists = this.deps.playlists;
    if (!playlists) return;
    const ids = await this.deps.media.findBySource(
      "spotify",
      songs.map((song) => song.spotifyId)
    );
    const ordered = songs
      .map((song) => ids.get(song.spotifyId))
      .filter((id): id is string => Boolean(id));
    const name = job.playlistName ?? "Spotify";
    const playlist =
      (await playlists.findBySource("spotify", source.sourceId)) ??
      (await playlists.create({
        id: randomUUID(),
        name:
          source.sourceId === "liked" ? { zh: "已点赞的歌曲", en: "Liked Songs" } : { en: name },
        source: "spotify",
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl
      }));
    await playlists.addTracks(playlist.id, ordered);
  }

  private async prepare(song: ImportSong, covers: Map<string, Promise<ProcessedImage | null>>) {
    const preview =
      typeof song.preview === "function"
        ? await song.preview()
        : { previewUrl: song.preview, appleUrl: null };
    if (song.coverUrl && !covers.has(song.coverUrl))
      covers.set(song.coverUrl, cover(this.deps, song.coverUrl));
    const image = song.coverUrl ? await covers.get(song.coverUrl)! : null;
    return { preview, image };
  }

  private async create(
    job: MusicImportJob,
    song: ImportSong,
    { preview, image }: Awaited<ReturnType<MusicImports["prepare"]>>
  ) {
    const id = randomUUID();
    let poster: StoredImage | null = null;
    try {
      poster = image ? await storePoster(this.deps.store, id, image) : null;
      await this.deps.media.create({
        id,
        kind: "track",
        source: "spotify",
        sourceId: song.spotifyId,
        sourceUrl: song.spotifyUrl,
        title: { en: song.title },
        year: song.year,
        credits: song.artists,
        poster,
        extra: musicExtra({
          album: song.album,
          durationMs: song.durationMs,
          previewUrl: preview.previewUrl,
          spotifyUrl: song.spotifyUrl,
          appleUrl: preview.appleUrl
        }),
        inPlayer: Boolean(preview.previewUrl)
      });
      job.added += 1;
      if (!preview.previewUrl) job.noPreview += 1;
    } catch (error) {
      if (poster) await this.deps.store.remove(`media/${id}`).catch(() => undefined);
      if (!(error instanceof DuplicateMediaError)) throw error;
      job.skipped += 1;
    }
  }
}

/** Runs at most `size` tasks at once. */
function limiter(size: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= size) await new Promise<void>((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}
