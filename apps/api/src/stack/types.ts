import type { LocalizedText, StackIconProvider, StackProminence } from "@liam-frost/shared";

import type { StoredImage } from "../projects/types";

export type StackTechnologyRow = {
  id: string;
  categoryId: string;
  name: string;
  iconProvider: StackIconProvider;
  iconKey: string | null;
  /** Uploaded logo; set exactly when iconProvider is "custom". Key: "stack/<technologyId>/<imageId>". */
  customIcon: StoredImage | null;
  websiteUrl: string | null;
  prominence: StackProminence;
  visible: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  /** Every project linked to it (hidden ones included), in no particular order. */
  projectIds: string[];
};

export type StackCategoryRow = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  visible: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  /** In order. */
  technologies: StackTechnologyRow[];
};

export type NewStackCategory = Pick<StackCategoryRow, "id" | "name" | "description" | "visible">;
export type StackCategoryPatch = Partial<
  Pick<StackCategoryRow, "name" | "description" | "visible">
>;

export type NewStackTechnology = Pick<
  StackTechnologyRow,
  | "id"
  | "categoryId"
  | "name"
  | "iconProvider"
  | "iconKey"
  | "websiteUrl"
  | "prominence"
  | "visible"
>;
/** `projectIds` replaces the links (existing projects only); new links go last in each project's list. */
export type StackTechnologyPatch = Partial<
  Omit<StackTechnologyRow, "id" | "sortOrder" | "createdAt" | "updatedAt">
>;

/** The whole layout, first to last. */
export type StackLayout = { id: string; technologies: string[] }[];

/**
 * The tech stack. Callers serialize writes (one lock for the whole stack) and validate names and
 * icons; the repository keeps the order: new categories and technologies go last, a technology
 * moved to another category goes to its end.
 */
export interface StackRepository {
  /** Every category with its technologies, in order. */
  list(): Promise<StackCategoryRow[]>;
  createCategory(category: NewStackCategory): Promise<void>;
  updateCategory(id: string, patch: StackCategoryPatch): Promise<boolean>;
  /** Fails (the database restricts it) while the category has technologies. */
  deleteCategory(id: string): Promise<boolean>;
  createTechnology(technology: NewStackTechnology): Promise<void>;
  updateTechnology(id: string, patch: StackTechnologyPatch): Promise<boolean>;
  deleteTechnology(id: string): Promise<boolean>;
  /** Moves every technology of one category to the end of another, keeping their order. */
  moveTechnologies(fromId: string, toId: string): Promise<void>;
  /** Applies a complete, already validated layout in one transaction. */
  reorder(layout: StackLayout): Promise<void>;
}
