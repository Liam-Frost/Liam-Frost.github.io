import type { CollectionSettings, LocalizedText, MediaKind, MediaProgress, MediaSource, MediaStatus, PhotoVisibility } from "@liam-frost/shared";

import type { StoredImage } from "../projects/types";

export type MediaRow = {
  id: string;
  kind: MediaKind;
  source: MediaSource;
  sourceId: string | null;
  sourceUrl: string | null;
  title: LocalizedText;
  originalTitle: string | null;
  year: number | null;
  genres: LocalizedText[];
  credits: string[];
  overview: LocalizedText;
  poster: StoredImage | null;
  status: MediaStatus | null;
  rating: number | null;
  review: LocalizedText;
  watchedOn: string | null;
  rewatchCount: number;
  progress: MediaProgress | null;
  extra: Record<string, unknown>;
  inPlayer: boolean;
  featured: boolean;
  visibility: PhotoVisibility;
  createdAt: Date;
  updatedAt: Date;
};

export type NewMedia = Pick<MediaRow, "id" | "kind" | "source" | "title"> & Partial<Omit<MediaRow, "id" | "kind" | "source" | "title" | "createdAt" | "updatedAt">>;

export type MediaPatch = Partial<Omit<MediaRow, "id" | "kind" | "source" | "sourceId" | "createdAt" | "updatedAt">>;

/** What /uploads needs to decide whether to serve a poster. */
export type MediaImageAccess = Pick<MediaRow, "kind" | "status" | "visibility" | "poster">;

/** The same source entry is already in the collection. */
export class DuplicateMediaError extends Error {}

export interface MediaRepository {
  /** Newest watched first (entries without a date by when they were added). */
  list(options?: { kind?: MediaKind; includePrivate?: boolean }): Promise<MediaRow[]>;
  get(id: string): Promise<MediaRow | null>;
  /** Ids of entries already imported from `source`, keyed by source id. */
  findBySource(source: MediaSource, sourceIds: string[]): Promise<Map<string, string>>;
  imageAccess(id: string): Promise<MediaImageAccess | null>;
  /** Throws DuplicateMediaError when the source entry exists. */
  create(item: NewMedia): Promise<MediaRow>;
  update(id: string, patch: MediaPatch): Promise<MediaRow | null>;
  delete(id: string): Promise<MediaRow | null>;
}

const MUSIC: MediaKind[] = ["track", "album"];

/** Whether the site may show an entry: its own visibility, its kind's switch, and the "want" switch. */
export function isMediaPublic(item: Pick<MediaRow, "kind" | "status" | "visibility">, settings: CollectionSettings) {
  if (item.visibility !== "public") return false;
  const kindShown = MUSIC.includes(item.kind) ? settings.show.music : settings.show[item.kind as Exclude<MediaKind, "track" | "album">];
  if (!kindShown) return false;
  return item.status !== "want" || settings.showWant;
}
