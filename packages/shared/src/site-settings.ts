import type { LocalizedText, PublicCollection } from "./api";

export type DictionaryEntry = { id: string; aliases: string[]; labels: LocalizedText };
export type SiteSettingsGroups = {
  identity: { name: LocalizedText; title: LocalizedText; avatarPhotoId: string | null };
  footer: { owner: LocalizedText; startYear: number | null; showRole: boolean };
  preferences: {
    theme: "system" | "light" | "dark";
    language: "auto" | "zh" | "zh-Hant" | "en" | "ja" | "fr";
  };
  privacy: { title: LocalizedText; body: LocalizedText; effectiveDate: string | null };
  dictionary: { entries: DictionaryEntry[] };
  favicon: { photoId: string | null };
};
export const DEFAULT_SITE_SETTINGS: SiteSettingsGroups = {
  identity: { name: {}, title: {}, avatarPhotoId: null },
  footer: { owner: {}, startYear: null, showRole: true },
  preferences: { theme: "system", language: "auto" },
  privacy: { title: {}, body: {}, effectiveDate: null },
  dictionary: { entries: [] },
  favicon: { photoId: null }
};
export type SiteSettingsGroup = keyof SiteSettingsGroups;
export type SiteSettingsDocument<K extends SiteSettingsGroup = SiteSettingsGroup> = {
  value: SiteSettingsGroups[K];
  revision: string;
  saved: boolean;
};
export type PublicSiteSettings = Omit<SiteSettingsGroups, "favicon"> & {
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
