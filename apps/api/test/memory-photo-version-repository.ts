import { randomUUID } from "node:crypto";

import type { NewVersion, PhotoVersionRepository, VersionRow } from "../src/photos/versions";

/** In-memory PhotoVersionRepository with the same rules as the Prisma one. */
export class MemoryPhotoVersionRepository implements PhotoVersionRepository {
  rows = new Map<string, VersionRow>();
  private order = 0;
  private sequence = new Map<string, number>();

  async list(photoId: string, { includeTrashed = false } = {}) {
    return [...this.rows.values()]
      .filter((row) => row.photoId === photoId && (includeTrashed || !row.deletedAt))
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          this.sequence.get(a.id)! - this.sequence.get(b.id)!
      );
  }

  async get(id: string) {
    return this.rows.get(id) ?? null;
  }

  async findByStorageKey(key: string) {
    return [...this.rows.values()].find((row) => row.storageKey === key && !row.deletedAt) ?? null;
  }

  async trash(id: string, at: Date) {
    return this.mark(id, at);
  }

  async restore(id: string) {
    return this.mark(id, null);
  }

  private mark(id: string, deletedAt: Date | null) {
    const row = this.rows.get(id);
    if (!row) return null;
    const next = { ...row, deletedAt };
    this.rows.set(id, next);
    return next;
  }

  async listTrashed() {
    return [...this.rows.values()]
      .filter((row) => row.deletedAt)
      .sort((a, b) => b.deletedAt!.getTime() - a.deletedAt!.getTime());
  }

  async create(version: NewVersion) {
    const row: VersionRow = {
      ...version,
      id: randomUUID(),
      label: version.label ?? "",
      createdAt: version.createdAt ?? new Date(),
      deletedAt: null
    };
    this.rows.set(row.id, row);
    this.sequence.set(row.id, (this.order += 1));
    return row;
  }

  async setLabel(id: string, label: string) {
    const row = this.rows.get(id);
    if (!row) return null;
    const next = { ...row, label };
    this.rows.set(id, next);
    return next;
  }

  async delete(id: string) {
    const row = this.rows.get(id) ?? null;
    this.rows.delete(id);
    return row;
  }

  async removeAll(photoId: string) {
    for (const row of [...this.rows.values()])
      if (row.photoId === photoId) this.rows.delete(row.id);
  }
}
