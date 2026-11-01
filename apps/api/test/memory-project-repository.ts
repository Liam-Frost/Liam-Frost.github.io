import {
  SlugTakenError,
  type NewProject,
  type ProjectPatch,
  type ProjectRepository,
  type ProjectRow
} from "../src/projects/types";

/** In-memory ProjectRepository with the same rules as the Prisma one (unique slug, ordering). */
export class MemoryProjectRepository implements ProjectRepository {
  rows = new Map<string, ProjectRow>();

  private slugTaken(slug: string, exceptId?: string) {
    return [...this.rows.values()].some((row) => row.slug === slug && row.id !== exceptId);
  }

  async list({ includePrivate = false } = {}) {
    return [...this.rows.values()]
      .filter((row) => includePrivate || row.visibility === "public")
      .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.getTime() - a.createdAt.getTime());
  }

  async get(id: string) {
    return this.rows.get(id) ?? null;
  }

  async imageAccess(id: string) {
    const row = this.rows.get(id);
    return row ? { visibility: row.visibility, cover: row.cover, gallery: row.gallery } : null;
  }

  async getBySlug(slug: string) {
    return [...this.rows.values()].find((row) => row.slug === slug) ?? null;
  }

  async create(project: NewProject) {
    if (this.slugTaken(project.slug)) throw new SlugTakenError(project.slug);
    const min = Math.min(1, ...[...this.rows.values()].map((row) => row.sortOrder));
    const now = new Date();
    const row: ProjectRow = {
      ...project,
      summary: {},
      body: {},
      cover: null,
      gallery: [],
      techStack: [],
      links: {},
      status: "in-progress",
      startedAt: null,
      endedAt: null,
      featured: false,
      visibility: "private",
      sortOrder: min - 1,
      createdAt: now,
      updatedAt: now
    };
    this.rows.set(row.id, row);
    return row;
  }

  async update(id: string, patch: ProjectPatch) {
    const row = this.rows.get(id);
    if (!row) return null;
    if (patch.slug && this.slugTaken(patch.slug, id)) throw new SlugTakenError(patch.slug);
    const next = { ...row, ...patch, updatedAt: new Date() };
    this.rows.set(id, next);
    return next;
  }

  async delete(id: string) {
    const row = this.rows.get(id) ?? null;
    this.rows.delete(id);
    return row;
  }

  async reorder(ids: string[]) {
    ids.forEach((id, index) => {
      const row = this.rows.get(id);
      if (row) this.rows.set(id, { ...row, sortOrder: index });
    });
  }
}
