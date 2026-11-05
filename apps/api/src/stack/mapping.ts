import type {
  AdminStackCategory,
  AdminStackTechnology,
  PublicStackCategory,
  PublicStackTechnology
} from "@liam-frost/shared";

import { variantFileName } from "../photos/mapping";
import type { LocalImageStore } from "../storage/local";
import { iconUrl } from "./catalog";
import type { StackCategoryRow, StackTechnologyRow } from "./types";

function technologyIcon(row: StackTechnologyRow, store: LocalImageStore) {
  if (row.iconProvider === "custom" && row.customIcon) {
    const largest = row.customIcon.variants[row.customIcon.variants.length - 1];
    return largest ? store.publicUrl(row.customIcon.key, variantFileName(largest.width)) : null;
  }
  if ((row.iconProvider === "devicon" || row.iconProvider === "simpleicons") && row.iconKey)
    return iconUrl(row.iconProvider, row.iconKey);
  return null;
}

function toPublicTechnology(
  row: StackTechnologyRow,
  store: LocalImageStore
): PublicStackTechnology {
  return {
    id: row.id,
    name: row.name,
    iconUrl: technologyIcon(row, store),
    websiteUrl: row.websiteUrl,
    prominence: row.prominence
  };
}

/** Visible categories with their visible technologies; categories left empty are not shown. */
export function toPublicStack(
  rows: StackCategoryRow[],
  store: LocalImageStore
): PublicStackCategory[] {
  return rows
    .filter((category) => category.visible)
    .map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      technologies: category.technologies
        .filter((technology) => technology.visible)
        .map((technology) => toPublicTechnology(technology, store))
    }))
    .filter((category) => category.technologies.length > 0);
}

function toAdminTechnology(row: StackTechnologyRow, store: LocalImageStore): AdminStackTechnology {
  return {
    ...toPublicTechnology(row, store),
    categoryId: row.categoryId,
    iconProvider: row.iconProvider,
    iconKey: row.iconKey,
    visible: row.visible,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toAdminStack(
  rows: StackCategoryRow[],
  store: LocalImageStore
): AdminStackCategory[] {
  return rows.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    visible: category.visible,
    sortOrder: category.sortOrder,
    technologies: category.technologies.map((technology) => toAdminTechnology(technology, store)),
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString()
  }));
}
