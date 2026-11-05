import {
  SlugTakenError,
  type NewProject,
  type ProjectPatch,
  type ProjectRepository,
  type ProjectRow,
  type ProjectTechnologyRef
} from "../src/projects/types";
import type { MemoryLink, MemoryStackRepository } from "./memory-stack-repository";

type StoredRow = Omit<ProjectRow, "technologies">;

/**
 * In-memory ProjectRepository with the same rules as the Prisma one (unique slug, ordering,
 * cascading links). Pass a MemoryStackRepository to share its technology links.
 */
export class MemoryProjectRepository implements ProjectRepository {
  rows = new Map<string, StoredRow>();
  links: MemoryLink[];

  constructor(private readonly stack?: MemoryStackRepository) {
    this.links = stack?.links ?? [];
  }

  private setLinks(links: MemoryLink[]) {
    this.links.splice(0, this.links.length, ...links);
  }

  private full(row: StoredRow): ProjectRow {
    const technologies: ProjectTechnologyRef[] = this.links
      .filter((l) => l.projectId === row.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .flatMap((l) => {
        const technology = this.stack?.technologies.get(l.technologyId);
        const category = technology && this.stack?.categories.get(technology.categoryId);
        return technology && category
          ? [
              {
                id: technology.id,
                name: technology.name,
                public: technology.visible && category.visible
              }
            ]
          : [];
      });
    return { ...row, technologies };
  }

  private slugTaken(slug: string, exceptId?: string) {
    return [...this.rows.values()].some((row) => row.slug === slug && row.id !== exceptId);
  }

  async list({ includePrivate = false } = {}) {
    return [...this.rows.values()]
      .filter((row) => includePrivate || row.visibility === "public")
      .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.getTime() - a.createdAt.getTime())
      .map((row) => this.full(row));
  }

  async get(id: string) {
    const row = this.rows.get(id);
    return row ? this.full(row) : null;
  }

  async imageAccess(id: string) {
    const row = this.rows.get(id);
    return row ? { visibility: row.visibility, cover: row.cover, gallery: row.gallery } : null;
  }

  async getBySlug(slug: string) {
    const row = [...this.rows.values()].find((r) => r.slug === slug);
    return row ? this.full(row) : null;
  }

  async create(project: NewProject) {
    if (this.slugTaken(project.slug)) throw new SlugTakenError(project.slug);
    const min = Math.min(1, ...[...this.rows.values()].map((row) => row.sortOrder));
    const now = new Date();
    const row: StoredRow = {
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
    return this.full(row);
  }

  async update(id: string, { technologyIds, ...patch }: ProjectPatch) {
    const row = this.rows.get(id);
    if (!row) return null;
    if (patch.slug && this.slugTaken(patch.slug, id)) throw new SlugTakenError(patch.slug);
    if (technologyIds) {
      this.setLinks([
        ...this.links.filter((l) => l.projectId !== id),
        ...technologyIds.map((technologyId, sortOrder) => ({
          projectId: id,
          technologyId,
          sortOrder
        }))
      ]);
    }
    const next = { ...row, ...patch, updatedAt: new Date() };
    this.rows.set(id, next);
    return this.full(next);
  }

  async delete(id: string) {
    const row = this.rows.get(id);
    if (!row) return null;
    const removed = this.full(row);
    this.rows.delete(id);
    // Cascades to its technology links, like the foreign key.
    this.setLinks(this.links.filter((l) => l.projectId !== id));
    return removed;
  }

  async reorder(ids: string[]) {
    ids.forEach((id, index) => {
      const row = this.rows.get(id);
      if (row) this.rows.set(id, { ...row, sortOrder: index });
    });
  }
}
