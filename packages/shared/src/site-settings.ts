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
    /** The public site's colour scheme; chosen in the admin only, visitors cannot change it. */
    palette: SitePalette;
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
  /** Image file management; read by the admin and the API only. */
  images: {
    /** Days a deleted image stays in the trash before it is removed for good. */
    trashRetentionDays: number;
    /** The most versions one photo may have. */
    maxPhotoVersions: number;
  };
};
/**
 * The public site's colour schemes. Each has a light and a dark form, built from four colours: ink
 * (the dark base, and the text on light), paper (the light base, and the text on dark) and two
 * accents; ink2 and paper2 are each mode's second background. The web's stylesheets hold the same
 * values (globals.css for the first, themes.css for the rest); a test keeps them in step.
 */
export const SITE_PALETTES = ["mist", "pine", "mono", "midnight", "graphite"] as const;
export type SitePalette = (typeof SITE_PALETTES)[number];
export type SitePaletteColors = {
  ink: string;
  accent: string;
  soft: string;
  paper: string;
  ink2: string;
  paper2: string;
};
export const SITE_PALETTE_COLORS: Record<SitePalette, SitePaletteColors> = {
  mist: {
    ink: "#213448",
    accent: "#547792",
    soft: "#94b4c1",
    paper: "#eae0cf",
    ink2: "#1b2a3e",
    paper2: "#e0d5c4"
  },
  pine: {
    ink: "#1c342c",
    accent: "#3f7a62",
    soft: "#9cc4ad",
    paper: "#efe9d9",
    ink2: "#162a23",
    paper2: "#e3dcc8"
  },
  mono: {
    ink: "#131416",
    accent: "#3d5afe",
    soft: "#9aa9ff",
    paper: "#f3f3f0",
    ink2: "#0b0b0c",
    paper2: "#e6e6e2"
  },
  midnight: {
    ink: "#0e1622",
    accent: "#3f7fc4",
    soft: "#9ec5ea",
    paper: "#e9edf1",
    ink2: "#090f18",
    paper2: "#dbe1e7"
  },
  graphite: {
    ink: "#18191c",
    accent: "#7d838d",
    soft: "#c5c9d0",
    paper: "#eeeeeb",
    ink2: "#101113",
    paper2: "#e1e1dd"
  }
};
export function isSitePalette(value: unknown): value is SitePalette {
  return SITE_PALETTES.includes(value as SitePalette);
}
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
  preferences: { palette: "mist", theme: "system", language: "auto" },
  navigation: {
    tabBarMode: "hover",
    glass: "clear",
    selectedButton: "lens",
    refraction: 1.4,
    showLabels: true,
    bottomOffset: 16
  },
  privacy: { title: {}, body: {}, effectiveDate: null },
  dictionary: { entries: [] },
  images: { trashRetentionDays: 30, maxPhotoVersions: 10 }
};
export type SiteSettingsGroup = keyof SiteSettingsGroups;
export type SiteSettingsDocument<K extends SiteSettingsGroup = SiteSettingsGroup> = {
  value: SiteSettingsGroups[K];
  revision: string;
  saved: boolean;
};
export type PublicSiteSettings = Omit<SiteSettingsGroups, "images"> & {
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
