import type { MediaKind } from "@liam-frost/shared";
import { randomBytes, randomUUID } from "node:crypto";

import { InvalidImageError, processImage, saveImage, type ProcessedImage } from "../photos/images";
import type { StoredImage } from "../projects/types";
import type { LocalImageStore } from "../storage/local";
import { SourceError, type MediaSources, type SearchSource } from "./sources";
import { DuplicateMediaError, type MediaRepository, type MediaRow } from "./types";

/** Saves a processed poster under the entry's folder; the caller attaches it to the entry. */
export async function storePoster(store: LocalImageStore, entryId: string, image: ProcessedImage): Promise<StoredImage> {
  const imageId = randomBytes(6).toString("hex");
  const key = `media/${entryId}/${imageId}`;
  await saveImage(store, key, image);
  return { id: imageId, key, width: image.width, height: image.height, variants: image.variants.map(({ width, height }) => ({ width, height })) };
}

/**
 * Creates an entry from a source entry: details and poster are fetched by the server. A missing or broken
 * poster does not block the import (one can be uploaded afterwards). Throws DuplicateMediaError when the
 * entry is already in the collection, SourceError when the source fails.
 */
export async function importMedia(
  deps: { media: MediaRepository; sources: MediaSources; store: LocalImageStore; onPosterError?: (error: unknown) => void },
  kind: MediaKind,
  source: SearchSource,
  sourceId: string
): Promise<MediaRow> {
  const { media, sources, store } = deps;
  if ((await media.findBySource(source, [sourceId])).has(sourceId)) throw new DuplicateMediaError();

  const details = await sources.details(source, kind, sourceId);
  const id = randomUUID();

  // Anime keeps its romaji name in English and French rather than falling back to Chinese.
  if (kind === "anime" && details.originalTitle) {
    const romaji = await sources.romaji(details.originalTitle, details.year);
    if (romaji) details.title = { ...details.title, en: romaji, fr: romaji };
  }

  let poster: StoredImage | null = null;
  if (details.posterUrl) {
    try {
      poster = await storePoster(store, id, await processImage(await sources.download(details.posterUrl)));
    } catch (error) {
      if (!(error instanceof SourceError || error instanceof InvalidImageError)) throw error;
      deps.onPosterError?.(error);
    }
  }

  try {
    return await media.create({
      id,
      kind,
      source,
      sourceId: details.sourceId,
      sourceUrl: details.sourceUrl,
      title: details.title,
      originalTitle: details.originalTitle,
      year: details.year,
      genres: details.genres,
      credits: details.credits,
      overview: details.overview,
      poster,
      status: "done",
      progress: kind !== "movie" && details.episodes ? { watched: 0, total: details.episodes } : null
    });
  } catch (error) {
    if (poster) await store.remove(`media/${id}`).catch(() => undefined);
    throw error;
  }
}
