import {
  LANGS,
  type Lang,
  type LocalizedText,
  type MediaSearchSource,
  type MediaSource,
  type MediaStatus,
  type PersonRole,
  type RelationType,
  type SoundtrackRole
} from "@liam-frost/shared";

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

/** Kinds added by searching a source (songs have their own tools). */
export const WATCH_KINDS = ["movie", "tv", "anime", "book", "comic"] as const;
export type WatchKind = (typeof WATCH_KINDS)[number];

export const KIND_LABELS: Record<WatchKind, string> = { movie: "电影", tv: "剧集", anime: "动漫", book: "图书", comic: "漫画" };

/** Sources each kind is searched on, the default first. */
export const KIND_SOURCES: Record<WatchKind, readonly MediaSearchSource[]> = {
  movie: ["tmdb"],
  tv: ["tmdb"],
  anime: ["bangumi", "tmdb"],
  book: ["openlibrary", "bangumi"],
  comic: ["anilist", "bangumi"]
};

/** Books and comics are read: 想读 / 在读 / 读过. */
export const isReadKind = (kind: string) => kind === "book" || kind === "comic";

/** Tabs of the collection page: films, series, anime and songs. */
export const COLLECTION_KINDS = [...WATCH_KINDS, "track"] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];
export const COLLECTION_KIND_LABELS: Record<CollectionKind, string> = { ...KIND_LABELS, track: "音乐" };

/** iTunes stores to search (songs are listed under that store's names). */
export const MUSIC_STORES = [
  ["US", "美国"],
  ["JP", "日本"],
  ["GB", "英国"],
  ["FR", "法国"],
  ["TW", "台湾"],
  ["HK", "香港"],
  ["CN", "中国大陆"]
] as const;

/** "4:54" */
export function formatDuration(ms: number | null) {
  if (!ms) return "";
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export const MEDIA_STATUS_LABELS = {
  want: "想看",
  watching: "在看",
  done: "看过",
  dropped: "弃了"
} as const;

export const READ_STATUS_LABELS: Record<MediaStatus, string> = {
  want: "想读",
  watching: "在读",
  done: "读过",
  dropped: "弃了"
};

/** Status names for a kind: watched for films, series and anime, read for books and comics. */
export const statusLabels = (kind: string): Record<MediaStatus, string> => (isReadKind(kind) ? READ_STATUS_LABELS : MEDIA_STATUS_LABELS);

export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  director: "导演",
  screenwriter: "编剧",
  creator: "主创",
  producer: "制作人",
  actor: "演员",
  voice: "配音",
  singer: "歌手",
  composer: "作曲",
  lyricist: "作词",
  author: "作者",
  illustrator: "画师",
  studio: "制作公司",
  other: "其他"
};

export const SOUNDTRACK_ROLE_LABELS: Record<SoundtrackRole, string> = {
  opening: "片头曲",
  ending: "片尾曲",
  insert: "插曲",
  theme: "主题曲",
  score: "配乐"
};

/** How a relation reads from the entry or person being edited ("from": it starts there). */
export const RELATION_LABELS: Record<RelationType, { from: string; to: string }> = {
  credit: { from: "参与作品", to: "参与者" },
  soundtrack: { from: "出自作品", to: "原声歌曲" },
  adaptation: { from: "改编自", to: "被改编为" },
  sequel: { from: "前作", to: "续作" },
  related: { from: "相关", to: "相关" }
};

/** The language a name is probably written in: kana → Japanese, other CJK → Chinese, otherwise English. */
export function guessLang(text: string): Lang {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\u3400-\u9fff]/.test(text)) return "zh";
  return "en";
}

export const SOURCE_LABELS: Record<MediaSource, string> = {
  tmdb: "TMDB",
  bangumi: "Bangumi",
  openlibrary: "Open Library",
  anilist: "AniList",
  spotify: "Spotify",
  itunes: "Apple Music",
  manual: "手动添加"
};

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
