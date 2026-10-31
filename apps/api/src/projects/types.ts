import type { LocalizedText, PhotoVisibility, ProjectLinks, ProjectStatus } from "@liam-frost/shared";

import type { StoredVariant } from "../photos/types";

/** An uploaded project image as stored; URLs are derived from `key` at read time. */
export type StoredImage = {
  id: string;
  /** "projects/<projectId>/<imageId>" */
  key: string;
  width: number;
  height: number;
  variants: StoredVariant[];
};

export type ProjectRow = {
  id: string;
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  body: LocalizedText;
  cover: StoredImage | null;
  gallery: StoredImage[];
  techStack: string[];
  links: ProjectLinks;
  status: ProjectStatus;
  startedAt: string | null;
  endedAt: string | null;
  featured: boolean;
  visibility: PhotoVisibility;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NewProject = Pick<ProjectRow, "id" | "slug" | "title">;

export type ProjectPatch = Partial<Omit<ProjectRow, "id" | "sortOrder" | "createdAt" | "updatedAt">>;

export class SlugTakenError extends Error {}

/** What /uploads needs to decide whether to serve a project image. */
export type ProjectImageAccess = Pick<ProjectRow, "visibility" | "cover" | "gallery">;

export interface ProjectRepository {
  /** Ordered by sortOrder, then newest first. */
  list(options?: { includePrivate?: boolean }): Promise<ProjectRow[]>;
  get(id: string): Promise<ProjectRow | null>;
  getBySlug(slug: string): Promise<ProjectRow | null>;
  /** Visibility and images only (no texts), for image requests. */
  imageAccess(id: string): Promise<ProjectImageAccess | null>;
  /** New projects are hidden and go first. Throws SlugTakenError. */
  create(project: NewProject): Promise<ProjectRow>;
  /** Throws SlugTakenError. */
  update(id: string, patch: ProjectPatch): Promise<ProjectRow | null>;
  delete(id: string): Promise<ProjectRow | null>;
  reorder(ids: string[]): Promise<void>;
}
