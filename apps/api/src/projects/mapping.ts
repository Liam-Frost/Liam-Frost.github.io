import type {
  AdminProject,
  ProjectImage,
  PublicProject,
  PublicProjectSummary
} from "@liam-frost/shared";

import { variantFileName } from "../photos/mapping";
import type { LocalImageStore } from "../storage/local";
import type { ProjectRow, StoredImage } from "./types";

export function toProjectImage(image: StoredImage, store: LocalImageStore): ProjectImage {
  const variants = image.variants.map((v) => ({
    ...v,
    url: store.publicUrl(image.key, variantFileName(v.width))
  }));
  return {
    id: image.id,
    width: image.width,
    height: image.height,
    src: variants[variants.length - 1].url,
    variants
  };
}

/**
 * The names shown on the site: linked technologies that are public, then the plain names (minus any
 * that repeat a linked one). Hidden technologies are left out, like everywhere else on the site.
 */
export function publicTechStack(row: Pick<ProjectRow, "technologies" | "techStack">) {
  const linked = row.technologies.map((t) => t.name.toLowerCase());
  return [
    ...row.technologies.filter((t) => t.public).map((t) => t.name),
    ...row.techStack.filter((name) => !linked.includes(name.toLowerCase()))
  ];
}

export function toPublicProjectSummary(
  row: ProjectRow,
  store: LocalImageStore
): PublicProjectSummary {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    cover: row.cover ? toProjectImage(row.cover, store) : null,
    techStack: publicTechStack(row),
    links: row.links,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    featured: row.featured
  };
}

export function toPublicProject(row: ProjectRow, store: LocalImageStore): PublicProject {
  return {
    ...toPublicProjectSummary(row, store),
    body: row.body,
    gallery: row.gallery.map((image) => toProjectImage(image, store))
  };
}

export function toAdminProject(row: ProjectRow, store: LocalImageStore): AdminProject {
  return {
    ...toPublicProject(row, store),
    id: row.id,
    technologyIds: row.technologies.map((t) => t.id),
    otherTechnologies: row.techStack,
    visibility: row.visibility,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
