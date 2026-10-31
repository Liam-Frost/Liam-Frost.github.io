import type { NewPhoto, PhotoPatch, PhotoRepository, PhotoRow } from "../src/photos/types";

/** In-memory PhotoRepository with the same ordering rules as the Prisma one. */
export class MemoryPhotoRepository implements PhotoRepository {
  rows = new Map<string, PhotoRow>();
  /** Set to make every call reject, simulating an unreachable database. */
  failing = false;

  private check() {
    if (this.failing) throw new Error("database unreachable");
  }

  async list({ includePrivate = false } = {}) {
    this.check();
    return [...this.rows.values()]
      .filter((row) => includePrivate || row.visibility === "public")
      .sort((a, b) => a.sortOrder - b.sortOrder || b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  }

  async get(id: string) {
    this.check();
    return this.rows.get(id) ?? null;
  }

  async create(photo: NewPhoto) {
    this.check();
    const min = Math.min(1, ...[...this.rows.values()].map((row) => row.sortOrder));
    const now = new Date();
    const row: PhotoRow = { ...photo, sortOrder: photo.sortOrder ?? min - 1, createdAt: now, updatedAt: now };
    this.rows.set(row.id, row);
    return row;
  }

  async update(id: string, patch: PhotoPatch) {
    this.check();
    const row = this.rows.get(id);
    if (!row) return null;
    const next = { ...row, ...patch, updatedAt: new Date() };
    this.rows.set(id, next);
    return next;
  }

  async delete(id: string) {
    this.check();
    const row = this.rows.get(id) ?? null;
    this.rows.delete(id);
    return row;
  }

  async reorder(ids: string[]) {
    this.check();
    ids.forEach((id, index) => {
      const row = this.rows.get(id);
      if (row) this.rows.set(id, { ...row, sortOrder: index });
    });
  }
}

export function remotePhoto(overrides: Partial<PhotoRow> = {}): PhotoRow {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: "remote-1",
    slug: "remote-1",
    title: { en: "Remote" },
    date: "2024-01-01",
    category: { en: "City" },
    location: null,
    camera: null,
    lens: null,
    settings: null,
    description: null,
    tags: [],
    alt: { en: "Remote photo" },
    width: 1600,
    height: 1200,
    src: "https://live.staticflickr.com/1/2_abc_b.jpg",
    storage: "remote-url",
    storageKey: null,
    variants: null,
    visibility: "public",
    featured: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}
