import type { AdminMediaItem, PublicMedia, PublicMediaSummary } from "@liam-frost/shared";

import { toProjectImage } from "../projects/mapping";
import type { LocalImageStore } from "../storage/local";
import type { MediaRow } from "./types";

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
    featured: row.featured,
    hasReview: Object.values(row.review).some((text) => text?.trim()),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toPublicMedia(row: MediaRow, store: LocalImageStore): PublicMedia {
  return { ...toPublicMediaSummary(row, store), overview: row.overview, review: row.review, source: row.source, sourceUrl: row.sourceUrl };
}
