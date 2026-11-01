import type { AdminMediaItem, MediaGame, MediaMusic, MediaPublication, PublicMedia, PublicMediaSummary } from "@liam-frost/shared";

import { toProjectImage } from "../projects/mapping";
import type { LocalImageStore } from "../storage/local";
import type { MediaRow } from "./types";

const text = (value: unknown) => (typeof value === "string" && value ? value : null);

/** Song details stored in `extra.music`; null for other kinds. */
export function musicOf(row: Pick<MediaRow, "kind" | "extra">): MediaMusic | null {
  if (row.kind !== "track") return null;
  const music = (row.extra.music ?? {}) as Record<string, unknown>;
  return {
    album: text(music.album),
    durationMs: typeof music.durationMs === "number" ? music.durationMs : null,
    previewUrl: text(music.previewUrl),
    spotifyUrl: text(music.spotifyUrl),
    appleUrl: text(music.appleUrl)
  };
}

const count = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null);

/** Book and comic details stored in `extra.publication`; null for other kinds. */
export function publicationOf(row: Pick<MediaRow, "kind" | "extra">): MediaPublication | null {
  if (row.kind !== "book" && row.kind !== "comic") return null;
  const publication = (row.extra.publication ?? {}) as Record<string, unknown>;
  return {
    publisher: text(publication.publisher),
    pages: count(publication.pages),
    volumes: count(publication.volumes),
    ongoing: typeof publication.ongoing === "boolean" ? publication.ongoing : null
  };
}

const names = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []);

/** Game details stored in `extra.game`; null for other kinds. */
export function gameOf(row: Pick<MediaRow, "kind" | "extra">): MediaGame | null {
  if (row.kind !== "game") return null;
  const game = (row.extra.game ?? {}) as Record<string, unknown>;
  return {
    platforms: names(game.platforms),
    publishers: names(game.publishers),
    playtimeHours: typeof game.playtimeHours === "number" && Number.isInteger(game.playtimeHours) && game.playtimeHours >= 0 ? game.playtimeHours : null
  };
}

export function toAdminMedia(row: MediaRow, store: LocalImageStore): AdminMediaItem {
  return {
    id: row.id,
    kind: row.kind,
    source: row.source,
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    title: row.title,
    originalTitle: row.originalTitle,
    year: row.year,
    genres: row.genres,
    credits: row.credits,
    overview: row.overview,
    poster: row.poster ? toProjectImage(row.poster, store) : null,
    status: row.status,
    rating: row.rating,
    review: row.review,
    watchedOn: row.watchedOn,
    rewatchCount: row.rewatchCount,
    progress: row.progress,
    music: musicOf(row),
    publication: publicationOf(row),
    game: gameOf(row),
    inPlayer: row.inPlayer,
    featured: row.featured,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toPublicMediaSummary(row: MediaRow, store: LocalImageStore): PublicMediaSummary {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    originalTitle: row.originalTitle,
    year: row.year,
    genres: row.genres,
    credits: row.credits,
    poster: row.poster ? toProjectImage(row.poster, store) : null,
    status: row.status,
    rating: row.rating,
    watchedOn: row.watchedOn,
    rewatchCount: row.rewatchCount,
    progress: row.progress,
    music: musicOf(row),
    publication: publicationOf(row),
    game: gameOf(row),
    featured: row.featured,
    hasReview: Object.values(row.review).some((text) => text?.trim()),
    updatedAt: row.updatedAt.toISOString()
  };
}

/** An entry's details; the collection route adds its links. */
export function toPublicMedia(row: MediaRow, store: LocalImageStore): Omit<PublicMedia, "links"> {
  return { ...toPublicMediaSummary(row, store), overview: row.overview, review: row.review, source: row.source, sourceUrl: row.sourceUrl };
}
