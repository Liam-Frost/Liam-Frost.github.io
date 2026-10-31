import { DuplicateMediaError, type MediaPatch, type MediaRepository, type MediaRow, type NewMedia } from "../src/media/types";

/** In-memory MediaRepository with the same rules as the Prisma one (unique source entry, ordering). */
export class MemoryMediaRepository implements MediaRepository {
  rows = new Map<string, MediaRow>();

  async list({ kind, includePrivate = false }: { kind?: MediaRow["kind"]; includePrivate?: boolean } = {}) {
    return [...this.rows.values()]
      .filter((row) => (!kind || row.kind === kind) && (includePrivate || row.visibility === "public"))
      .sort((a, b) => {
        if (a.watchedOn !== b.watchedOn) return a.watchedOn === null ? 1 : b.watchedOn === null ? -1 : b.watchedOn.localeCompare(a.watchedOn);
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  async get(id: string) {
    return this.rows.get(id) ?? null;
  }

  async findBySource(source: MediaRow["source"], sourceIds: string[]) {
    return new Map([...this.rows.values()].filter((row) => row.source === source && row.sourceId && sourceIds.includes(row.sourceId)).map((row) => [row.sourceId!, row.id]));
  }

  async imageAccess(id: string) {
    const row = this.rows.get(id);
    return row ? { kind: row.kind, status: row.status, visibility: row.visibility, poster: row.poster } : null;
  }

  async create(item: NewMedia) {
    if (item.sourceId && (await this.findBySource(item.source, [item.sourceId])).size) throw new DuplicateMediaError();
    const now = new Date();
    const row: MediaRow = {
      sourceId: null,
      sourceUrl: null,
      originalTitle: null,
      year: null,
      genres: [],
      credits: [],
      overview: {},
      poster: null,
      status: null,
      rating: null,
      review: {},
      watchedOn: null,
      rewatchCount: 0,
      progress: null,
      extra: {},
      featured: false,
      visibility: "public",
      ...item,
      createdAt: now,
      updatedAt: now
    };
    this.rows.set(row.id, structuredClone(row));
    return structuredClone(row);
  }

  async update(id: string, patch: MediaPatch) {
    const row = this.rows.get(id);
    if (!row) return null;
    const next = { ...row, ...structuredClone(patch), updatedAt: new Date() };
    this.rows.set(id, next);
    return structuredClone(next);
  }

  async delete(id: string) {
    const row = this.rows.get(id);
    if (!row) return null;
    this.rows.delete(id);
    return row;
  }
}
