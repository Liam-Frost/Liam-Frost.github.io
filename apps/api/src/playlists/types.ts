import type { LocalizedText, PhotoVisibility } from "@liam-frost/shared";

export type PlaylistRow = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  source: "manual" | "spotify";
  sourceId: string | null;
  sourceUrl: string | null;
  visibility: PhotoVisibility;
  /** Song ids in playlist order. */
  trackIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type NewPlaylist = Pick<PlaylistRow, "id" | "name" | "source"> &
  Partial<Pick<PlaylistRow, "description" | "sourceId" | "sourceUrl" | "visibility">>;
export type PlaylistPatch = Partial<Pick<PlaylistRow, "name" | "description" | "visibility">>;

export interface PlaylistRepository {
  /** Newest first. */
  list(options?: { includePrivate?: boolean }): Promise<PlaylistRow[]>;
  get(id: string): Promise<PlaylistRow | null>;
  findBySource(source: PlaylistRow["source"], sourceId: string): Promise<PlaylistRow | null>;
  create(playlist: NewPlaylist): Promise<PlaylistRow>;
  update(id: string, patch: PlaylistPatch): Promise<PlaylistRow | null>;
  delete(id: string): Promise<PlaylistRow | null>;
  /** Appends songs that are not in the playlist yet, in the given order; returns the playlist. */
  addTracks(id: string, mediaIds: string[]): Promise<PlaylistRow | null>;
  removeTracks(id: string, mediaIds: string[]): Promise<PlaylistRow | null>;
  /** Puts the playlist's songs in this order; `mediaIds` must be exactly its songs. */
  reorder(id: string, mediaIds: string[]): Promise<PlaylistRow | null>;
}
