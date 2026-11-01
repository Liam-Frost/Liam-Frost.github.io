import type { NewPlaylist, PlaylistPatch, PlaylistRepository, PlaylistRow } from "../src/playlists/types";
import type { MemoryMediaRepository } from "./memory-media-repository";

/**
 * In-memory PlaylistRepository. Songs deleted from the collection drop out of playlists, like the
 * database's ON DELETE CASCADE.
 */
export class MemoryPlaylistRepository implements PlaylistRepository {
  rows = new Map<string, PlaylistRow>();

  constructor(private readonly media: MemoryMediaRepository) {}

  private live(row: PlaylistRow): PlaylistRow {
    return structuredClone({ ...row, trackIds: row.trackIds.filter((id) => this.media.rows.has(id)) });
  }

  async list({ includePrivate = false }: { includePrivate?: boolean } = {}) {
    return [...this.rows.values()]
      .filter((row) => includePrivate || row.visibility === "public")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((row) => this.live(row));
  }

  async get(id: string) {
    const row = this.rows.get(id);
    return row ? this.live(row) : null;
  }

  async findBySource(source: PlaylistRow["source"], sourceId: string) {
    const row = [...this.rows.values()].find((candidate) => candidate.source === source && candidate.sourceId === sourceId);
    return row ? this.live(row) : null;
  }

  async create(playlist: NewPlaylist) {
    const now = new Date();
    const row: PlaylistRow = { description: {}, sourceId: null, sourceUrl: null, visibility: "public", ...playlist, trackIds: [], createdAt: now, updatedAt: now };
    this.rows.set(row.id, row);
    return this.live(row);
  }

  async update(id: string, patch: PlaylistPatch) {
    const row = this.rows.get(id);
    if (!row) return null;
    Object.assign(row, structuredClone(patch), { updatedAt: new Date() });
    return this.live(row);
  }

  async delete(id: string) {
    const row = this.rows.get(id);
    if (!row) return null;
    this.rows.delete(id);
    return this.live(row);
  }

  async addTracks(id: string, mediaIds: string[]) {
    const row = this.rows.get(id);
    if (!row) return null;
    for (const mediaId of mediaIds) if (!row.trackIds.includes(mediaId)) row.trackIds.push(mediaId);
    return this.live(row);
  }

  async removeTracks(id: string, mediaIds: string[]) {
    const row = this.rows.get(id);
    if (!row) return null;
    row.trackIds = row.trackIds.filter((mediaId) => !mediaIds.includes(mediaId));
    return this.live(row);
  }

  async reorder(id: string, mediaIds: string[]) {
    const row = this.rows.get(id);
    if (!row) return null;
    row.trackIds = [...mediaIds];
    return this.live(row);
  }
}
