import type { LocalizedText, ProjectStatus } from "./api";

/** Icon libraries the admin can pick a logo from. Their icons are served by the API, never bundled. */
export const STACK_CATALOG_PROVIDERS = ["devicon", "simpleicons"] as const;
export type StackCatalogProvider = (typeof STACK_CATALOG_PROVIDERS)[number];
/** Where a technology's logo comes from: a library icon, an uploaded file, or none (initials). */
export type StackIconProvider = StackCatalogProvider | "custom" | "none";

/** Display order and a slight emphasis on the site; not a skill rating. */
export type StackProminence = "primary" | "standard";

/**
 * How a logo looks, measured from its pixels, so every logo can be shown without a tile:
 * - "dark" / "light": a single-colour mark too dark for the dark theme (or too light for the light
 *   one); the site recolours it in that theme only.
 * - "contrast": a multicolour logo with large near-black parts (a dark brand square); the site gives
 *   it a thin light outline in the dark theme.
 */
export type StackIconTone = "dark" | "light" | "contrast";

/** A public project using a technology, as shown in the technology's details. */
export type PublicStackProject = {
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  status: ProjectStatus;
  /** A small size of the cover (about 320 px wide), or null. */
  thumbnail: { url: string; width: number; height: number } | null;
};

export type PublicStackTechnology = {
  id: string;
  name: string;
  /** Logo URL (an image; library icons and uploads alike), or null for the initials fallback. */
  iconUrl: string | null;
  /**
   * Display scale of the logo in its square slot (about 0.8–1.1): removes the image's empty margins
   * and evens out how heavy logos look (a filled square shows smaller than a thin outline).
   */
  iconScale: number;
  iconTone: StackIconTone | null;
  websiteUrl: string | null;
  prominence: StackProminence;
  /** Public projects using it, in the projects' order. Hidden and draft projects are never listed. */
  projects: PublicStackProject[];
};

export type PublicStackCategory = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  technologies: PublicStackTechnology[];
};

/** GET /api/stack: visible categories with at least one visible technology, in the admin's order. */
export type PublicStackResponse = { categories: PublicStackCategory[] };

export type AdminStackTechnology = Omit<PublicStackTechnology, "projects"> & {
  categoryId: string;
  /** Every linked project, hidden ones included. */
  projectIds: string[];
  iconProvider: StackIconProvider;
  /** Library icon key (devicon: "react", simpleicons: "springboot"); null for custom and none. */
  iconKey: string | null;
  visible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminStackCategory = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  visible: boolean;
  sortOrder: number;
  technologies: AdminStackTechnology[];
  createdAt: string;
  updatedAt: string;
};

/** Every admin stack read and write answers with the whole stack, so the page never goes stale. */
export type AdminStackResponse = { categories: AdminStackCategory[] };

export type AdminStackCategoryCreate = {
  name: LocalizedText;
  description?: LocalizedText;
  visible?: boolean;
};

export type AdminStackCategoryUpdate = Partial<AdminStackCategoryCreate>;

/** A library icon, or none. Uploaded logos have their own route. */
export type AdminStackIconChoice =
  { provider: StackCatalogProvider; key: string } | { provider: "none" };

export type AdminStackTechnologyCreate = {
  categoryId: string;
  name: string;
  icon?: AdminStackIconChoice;
  websiteUrl?: string | null;
  prominence?: StackProminence;
  visible?: boolean;
  /** The projects using it: replaces its links (from the project side too). */
  projectIds?: string[];
};

/** Changing categoryId moves the technology to the end of that category. */
export type AdminStackTechnologyUpdate = Partial<AdminStackTechnologyCreate>;

/** The whole layout, first to last: every category once, every technology once, in its category. */
export type AdminStackOrder = { categories: { id: string; technologies: string[] }[] };

/** DELETE a category that still has technologies: move them to another category, or delete them too. */
export type AdminStackCategoryDelete =
  { technologies: "move"; to: string } | { technologies: "delete" };

export type StackCatalogIcon = {
  provider: StackCatalogProvider;
  key: string;
  title: string;
  /** The icon as an image, served by the API. */
  url: string;
};

export type AdminStackIconSearchResponse = { icons: StackCatalogIcon[] };

export const STACK_PROVIDER_LABELS: Record<StackIconProvider, string> = {
  devicon: "Devicon",
  simpleicons: "Simple Icons",
  custom: "自定义",
  none: "无图标"
};

/** One or two letters for a technology without a logo: "TypeScript" → "T", "After Effects" → "AE". */
export function stackInitials(name: string) {
  const words = name
    .trim()
    .split(/[\s._/-]+/)
    .filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  const word = words[0] ?? "?";
  return [...word][0]!.toUpperCase();
}
