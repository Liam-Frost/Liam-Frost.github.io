import type {
  AdminStackCategory,
  AdminStackTechnology,
  PublicStackCategory,
  PublicStackProject,
  PublicStackTechnology
} from "@liam-frost/shared";

import { variantFileName } from "../photos/mapping";
import { toProjectImage } from "../projects/mapping";
import type { ProjectRow } from "../projects/types";
import type { LocalImageStore } from "../storage/local";
import { iconUrl } from "./catalog";
import { NEUTRAL_OPTICS, type IconOptics } from "./optics";
import type { StackCategoryRow, StackTechnologyRow } from "./types";

/** Logo optics by technology id (missing ones are neutral). */
export type OpticsById = ReadonlyMap<string, IconOptics>;

/** Width of the cover size shown next to a project in a technology's details. */
const THUMBNAIL_WIDTH = 320;

export function toPublicStackProject(row: ProjectRow, store: LocalImageStore): PublicStackProject {
  const cover = row.cover ? toProjectImage(row.cover, store) : null;
  const variant = cover
    ? (cover.variants.find((v) => v.width >= THUMBNAIL_WIDTH) ?? cover.variants.at(-1))
    : undefined;
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status,
    thumbnail: variant ? { url: variant.url, width: variant.width, height: variant.height } : null
  };
}

function technologyIcon(row: StackTechnologyRow, store: LocalImageStore) {
  if (row.iconProvider === "custom" && row.customIcon) {
    const largest = row.customIcon.variants[row.customIcon.variants.length - 1];
    return largest ? store.publicUrl(row.customIcon.key, variantFileName(largest.width)) : null;
  }
  if ((row.iconProvider === "devicon" || row.iconProvider === "simpleicons") && row.iconKey)
    return iconUrl(row.iconProvider, row.iconKey);
  return null;
}

function technologyFields(row: StackTechnologyRow, store: LocalImageStore, optics: OpticsById) {
  const { scale, tone } = optics.get(row.id) ?? NEUTRAL_OPTICS;
  return {
    id: row.id,
    name: row.name,
    iconUrl: technologyIcon(row, store),
    iconScale: scale,
    iconTone: tone,
    websiteUrl: row.websiteUrl,
    prominence: row.prominence
  };
}

/**
 * Visible categories with their visible technologies; categories left empty are not shown. Each
 * technology lists its projects among `publicProjects` (the public ones, in their order): hidden
 * projects are never listed, and linking a hidden technology to a public project does not show it.
 */
export function toPublicStack(
  rows: StackCategoryRow[],
  store: LocalImageStore,
  optics: OpticsById,
  publicProjects: ProjectRow[]
): PublicStackCategory[] {
  const projects = publicProjects
    .filter((project) => project.visibility === "public")
    .map((project) => ({ id: project.id, item: toPublicStackProject(project, store) }));
  const toPublicTechnology = (row: StackTechnologyRow): PublicStackTechnology => {
    const linked = new Set(row.projectIds);
    return {
      ...technologyFields(row, store, optics),
      projects: projects.filter((p) => linked.has(p.id)).map((p) => p.item)
    };
  };
  return rows
    .filter((category) => category.visible)
    .map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      technologies: category.technologies
        .filter((technology) => technology.visible)
        .map(toPublicTechnology)
    }))
    .filter((category) => category.technologies.length > 0);
}

function toAdminTechnology(
  row: StackTechnologyRow,
  store: LocalImageStore,
  optics: OpticsById
): AdminStackTechnology {
  return {
    ...technologyFields(row, store, optics),
    categoryId: row.categoryId,
    projectIds: row.projectIds,
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
  store: LocalImageStore,
  optics: OpticsById
): AdminStackCategory[] {
  return rows.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    visible: category.visible,
    sortOrder: category.sortOrder,
    technologies: category.technologies.map((technology) =>
      toAdminTechnology(technology, store, optics)
    ),
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString()
  }));
}
