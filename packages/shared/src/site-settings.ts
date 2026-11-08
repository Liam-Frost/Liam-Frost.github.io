import type { LocalizedText, PublicCollection } from "./api";

/** A link in the footer: an https address, a mail address, or a page of the site ("/privacy"). */
export type FooterLink = { label: LocalizedText; url: string };
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
    owner: LocalizedText;
    startYear: number | null;
    showRole: boolean;
    links: FooterLink[];
  };
  preferences: {
    theme: "system" | "light" | "dark";
    language: "auto" | "zh" | "zh-Hant" | "en" | "ja" | "fr";
  };
  privacy: { title: LocalizedText; body: LocalizedText; effectiveDate: string | null };
  dictionary: { entries: DictionaryEntry[] };
};
export const DEFAULT_SITE_SETTINGS: SiteSettingsGroups = {
  identity: { name: {}, title: {}, adminTitle: {} },
  footer: { owner: {}, startYear: null, showRole: true, links: [] },
  preferences: { theme: "system", language: "auto" },
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
  const activity = collection.items
    .filter(
      (item) =>
        (item.status === "watching" && item.kind !== "track" && item.kind !== "album") ||
        (item.status === "done" && item.kind !== "track")
    )
    .map((item) => item.id);
  const songs = collection.playlists[0]
    ? collection.playlists[0].trackIds.filter((id) => byId.has(id))
    : collection.items.filter((item) => item.kind === "track").map((item) => item.id);
  return [...new Set([...picked, ...activity, ...songs])];
}
