import type {
  NewStackCategory,
  NewStackTechnology,
  StackCategoryPatch,
  StackCategoryRow,
  StackLayout,
  StackRepository,
  StackTechnologyPatch,
  StackTechnologyRow
} from "../src/stack/types";

type Category = Omit<StackCategoryRow, "technologies">;

/** In-memory StackRepository with the Prisma one's rules (ordering, restrict on delete). */
export class MemoryStackRepository implements StackRepository {
  categories = new Map<string, Category>();
  technologies = new Map<string, StackTechnologyRow>();
  private clock = 0;
  private now() {
    // Strictly increasing, so ties in sortOrder still sort by creation like the database does.
    return new Date(Date.UTC(2026, 0, 1) + ++this.clock);
  }

  async list(): Promise<StackCategoryRow[]> {
    const order = <T extends { sortOrder: number; createdAt: Date }>(a: T, b: T) =>
      a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime();
    return [...this.categories.values()].sort(order).map((category) => ({
      ...category,
      technologies: [...this.technologies.values()]
        .filter((t) => t.categoryId === category.id)
        .sort(order)
    }));
  }

  private nextOrder(categoryId: string) {
    return (
      Math.max(
        -1,
        ...[...this.technologies.values()]
          .filter((t) => t.categoryId === categoryId)
          .map((t) => t.sortOrder)
      ) + 1
    );
  }

  async createCategory(category: NewStackCategory) {
    const now = this.now();
    const sortOrder = Math.max(-1, ...[...this.categories.values()].map((c) => c.sortOrder)) + 1;
    this.categories.set(category.id, { ...category, sortOrder, createdAt: now, updatedAt: now });
  }

  async updateCategory(id: string, patch: StackCategoryPatch) {
    const row = this.categories.get(id);
    if (!row) return false;
    this.categories.set(id, { ...row, ...patch, updatedAt: this.now() });
    return true;
  }

  async deleteCategory(id: string) {
    if (!this.categories.has(id)) return false;
    if ([...this.technologies.values()].some((t) => t.categoryId === id))
      throw new Error("Foreign key constraint violated (Restrict)");
    this.categories.delete(id);
    return true;
  }

  async createTechnology(technology: NewStackTechnology) {
    if (!this.categories.has(technology.categoryId)) throw new Error("Foreign key constraint");
    const now = this.now();
    this.technologies.set(technology.id, {
      ...technology,
      customIcon: null,
      sortOrder: this.nextOrder(technology.categoryId),
      createdAt: now,
      updatedAt: now
    });
  }

  async updateTechnology(id: string, patch: StackTechnologyPatch) {
    const row = this.technologies.get(id);
    if (!row) return false;
    const moved = patch.categoryId !== undefined && patch.categoryId !== row.categoryId;
    this.technologies.set(id, {
      ...row,
      ...patch,
      ...(moved ? { sortOrder: this.nextOrder(patch.categoryId!) } : {}),
      updatedAt: this.now()
    });
    return true;
  }

  async deleteTechnology(id: string) {
    return this.technologies.delete(id);
  }

  async moveTechnologies(fromId: string, toId: string) {
    const start = this.nextOrder(toId);
    const moving = (await this.list()).find((c) => c.id === fromId)?.technologies ?? [];
    moving.forEach((t, index) =>
      this.technologies.set(t.id, { ...t, categoryId: toId, sortOrder: start + index })
    );
  }

  async reorder(layout: StackLayout) {
    layout.forEach((category, index) => {
      const row = this.categories.get(category.id)!;
      this.categories.set(category.id, { ...row, sortOrder: index });
      category.technologies.forEach((id, position) => {
        const t = this.technologies.get(id)!;
        this.technologies.set(id, { ...t, categoryId: category.id, sortOrder: position });
      });
    });
  }
}
