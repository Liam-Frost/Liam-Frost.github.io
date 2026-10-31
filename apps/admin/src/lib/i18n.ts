import { LANGS, type Lang, type LocalizedText } from "@liam-frost/shared";

export { LANGS, type Lang };

export const LANG_LABELS: Record<Lang, string> = {
  zh: "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
  fr: "Français",
  ja: "日本語"
};

/** First non-empty text, preferring Simplified Chinese then English, like the public site's fallback. */
export function pickText(value: LocalizedText | null | undefined, fallback = "") {
  if (!value) return fallback;
  return value.zh || value.en || LANGS.map((lang) => value[lang]).find(Boolean) || fallback;
}

export const STATUS_LABELS = {
  "in-progress": "进行中",
  completed: "已完成",
  archived: "已归档"
} as const;

/** Kinds managed in the collection so far (music comes later). */
export const WATCH_KINDS = ["movie", "tv", "anime"] as const;
export type WatchKind = (typeof WATCH_KINDS)[number];

export const KIND_LABELS: Record<WatchKind, string> = { movie: "电影", tv: "剧集", anime: "动漫" };

export const MEDIA_STATUS_LABELS = {
  want: "想看",
  watching: "在看",
  done: "看过",
  dropped: "弃了"
} as const;

export const SOURCE_LABELS = { tmdb: "TMDB", bangumi: "Bangumi", spotify: "Spotify", itunes: "Apple Music", manual: "手动添加" } as const;

/** URL-friendly slug suggestion from a title: ASCII letters and digits only. */
export function suggestSlug(text: string) {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}
