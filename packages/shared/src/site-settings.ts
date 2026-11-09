import type { LocalizedText, PublicCollection } from "./api";

/** A link in the footer: an https address, a mail address, or a page of the site ("/privacy"). */
export type FooterLink = { label: LocalizedText; url: string };
/** The pages with their own copyright line: the four in the site's tab bar. */
export const FOOTER_PAGES = ["home", "projects", "collection", "portfolio"] as const;
export type FooterPage = (typeof FOOTER_PAGES)[number];
export type FooterCopyright = { owner: LocalizedText; startYear: number | null; showRole: boolean };
export type DictionaryEntry = { id: string; aliases: string[]; labels: LocalizedText };
export type SiteSettingsGroups = {
  identity: {
    name: LocalizedText;
    /** The browser tab title of the public site. */
    title: LocalizedText;
    /** The browser tab title and name of the admin. */
    adminTitle: LocalizedText;
  };
  footer: {
    copyright: Record<FooterPage, FooterCopyright>;
    links: FooterLink[];
  };
  preferences: {
    theme: "system" | "light" | "dark";
    language: "auto" | "zh" | "zh-Hant" | "en" | "ja" | "fr";
  };
  /** The public site's floating tab bar and glass buttons. */
  navigation: {
    tabBarMode: "always" | "adaptive" | "hover";
    glass: "regular" | "clear" | "opaque";
    selectedButton: "lens" | "ring" | "text";
    /** Multiplier of the edge refraction; 1 is the glass component's own strength. */
    refraction: number;
    showLabels: boolean;
    /** Distance from the bottom of the window in px (phones use half of it). */
    bottomOffset: number;
  };
  privacy: { title: LocalizedText; body: LocalizedText; effectiveDate: string | null };
  dictionary: { entries: DictionaryEntry[] };
};
const DEFAULT_COPYRIGHT: FooterCopyright = { owner: {}, startYear: null, showRole: true };
export const DEFAULT_SITE_SETTINGS: SiteSettingsGroups = {
  identity: { name: {}, title: {}, adminTitle: {} },
  footer: {
    copyright: {
      home: DEFAULT_COPYRIGHT,
      projects: DEFAULT_COPYRIGHT,
      collection: DEFAULT_COPYRIGHT,
      portfolio: DEFAULT_COPYRIGHT
    },
    links: []
  },
  preferences: { theme: "system", language: "auto" },
  navigation: {
    tabBarMode: "hover",
    glass: "clear",
    selectedButton: "lens",
    refraction: 1.4,
    showLabels: true,
    bottomOffset: 16
  },
  privacy: { title: {}, body: {}, effectiveDate: null },
  dictionary: { entries: [] }
};
export type SiteSettingsGroup = keyof SiteSettingsGroups;
export type SiteSettingsDocument<K extends SiteSettingsGroup = SiteSettingsGroup> = {
  value: SiteSettingsGroups[K];
  revision: string;
  saved: boolean;
};
export type PublicSiteSettings = SiteSettingsGroups & {
  avatarUrl: string | null;
  faviconUrl: string | null;
};

/** The same content-presence rule serves the homepage and the admin visibility explanation. */
export function homeCollectionContentIds(collection: PublicCollection): string[] {
  const byId = new Map(collection.items.map((item) => [item.id, item]));
  const picked = (collection.home.wall?.items ?? collection.home.featured)
    .map((p) => p.id)
    .filter((id) => byId.has(id));
  const recent = collection.items
    .filter((item) => item.status === "done" && item.kind !== "track")
    .map((item) => item.id);
  return [...new Set([...picked, ...recent])];
}

/**
 * A save of some top-level fields of a settings document: the new values, and the values they were
 * edited from. Fields nobody else touched are merged; a field that changed underneath is a conflict.
 */
export type SettingsFieldPatch = {
  changes: Record<string, unknown>;
  base: Record<string, unknown>;
};
export type SettingsConflictDetails<Document = unknown> = {
  fields: string[];
  current: Document;
};

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, sortedKeys(item)])
    );
  return value;
}

/** Equality of settings values, regardless of the order their keys were written in. */
export const sameSettingsValue = (a: unknown, b: unknown) =>
  JSON.stringify(sortedKeys(a ?? null)) === JSON.stringify(sortedKeys(b ?? null));

/** The fields of a patch that someone else has changed to something different since it was started. */
export function conflictingFields(current: object, { changes, base }: SettingsFieldPatch) {
  const stored = current as Record<string, unknown>;
  return Object.keys(changes).filter(
    (field) =>
      !sameSettingsValue(stored[field], base[field]) &&
      !sameSettingsValue(stored[field], changes[field])
  );
}
