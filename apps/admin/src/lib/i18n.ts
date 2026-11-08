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
import { tr } from "./messages";

export { LANGS, type Lang };

export const LANG_LABELS: Record<Lang, string> = {
  zh: "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
  fr: "Français",
  ja: tr("日本語")
};

/** First non-empty text, preferring Simplified Chinese then English, like the public site's fallback. */
export function pickText(value: LocalizedText | null | undefined, fallback = "") {
  if (!value) return fallback;
  return value.zh || value.en || LANGS.map((lang) => value[lang]).find(Boolean) || fallback;
}

export const STATUS_LABELS = {
  "in-progress": tr("进行中"),
  completed: tr("已完成"),
  archived: tr("已归档")
} as const;

/** Kinds added by searching a source (songs have their own tools). */
export const WATCH_KINDS = ["movie", "tv", "anime", "book", "comic", "game"] as const;
export type WatchKind = (typeof WATCH_KINDS)[number];

export const KIND_LABELS: Record<WatchKind, string> = {
  movie: tr("电影"),
  tv: tr("剧集"),
  anime: tr("动漫"),
  book: tr("图书"),
  comic: tr("漫画"),
  game: tr("游戏")
};

/** Sources each kind is searched on, the default first. */
export const KIND_SOURCES: Record<WatchKind, readonly MediaSearchSource[]> = {
  movie: ["tmdb"],
  tv: ["tmdb"],
  anime: ["bangumi", "tmdb"],
  book: ["openlibrary", "googlebooks", "bangumi"],
  comic: ["anilist", "bangumi"],
  game: ["igdb"]
};

/** Books and comics are read: 想读 / 在读 / 读过. */
export const isReadKind = (kind: string) => kind === "book" || kind === "comic";

/** Tabs of the collection page: films, series, anime and songs. */
export const COLLECTION_KINDS = [...WATCH_KINDS, "track"] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];
export const COLLECTION_KIND_LABELS: Record<CollectionKind, string> = {
  ...KIND_LABELS,
  track: tr("音乐")
};

/** iTunes stores to search (songs are listed under that store's names). */
export const MUSIC_STORES = [
  ["US", tr("美国")],
  ["JP", tr("日本")],
  ["GB", tr("英国")],
  ["FR", tr("法国")],
  ["TW", tr("台湾")],
  ["HK", tr("香港")],
  ["CN", tr("中国大陆")]
] as const;

/** "4:54" */
export function formatDuration(ms: number | null) {
  if (!ms) return "";
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export const MEDIA_STATUS_LABELS = {
  want: tr("想看"),
  watching: tr("在看"),
  done: tr("看过"),
  dropped: tr("弃了")
} as const;

export const READ_STATUS_LABELS: Record<MediaStatus, string> = {
  want: tr("想读"),
  watching: tr("在读"),
  done: tr("读过"),
  dropped: tr("弃了")
};

export const PLAY_STATUS_LABELS: Record<MediaStatus, string> = {
  want: tr("想玩"),
  watching: tr("在玩"),
  done: tr("玩过"),
  dropped: tr("弃了")
};

/** Status names for a kind: watched for films, series and anime, read for books and comics, played for games. */
export const statusLabels = (kind: string): Record<MediaStatus, string> =>
  kind === "game"
    ? PLAY_STATUS_LABELS
    : isReadKind(kind)
      ? READ_STATUS_LABELS
      : MEDIA_STATUS_LABELS;

export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  director: tr("导演"),
  screenwriter: tr("编剧"),
  creator: tr("主创"),
  producer: tr("制作人"),
  actor: tr("演员"),
  voice: tr("配音"),
  musician: tr("演奏"),
  singer: tr("演唱"),
  composer: tr("作曲"),
  lyricist: tr("作词"),
  author: tr("作者"),
  illustrator: tr("画师"),
  studio: tr("制作公司"),
  other: tr("其他")
};

export const SOUNDTRACK_ROLE_LABELS: Record<SoundtrackRole, string> = {
  opening: tr("片头曲"),
  ending: tr("片尾曲"),
  insert: tr("插曲"),
  theme: tr("主题曲"),
  score: tr("配乐")
};

/** How a relation reads from the entry or person being edited ("from": it starts there). */
export const RELATION_LABELS: Record<RelationType, { from: string; to: string }> = {
  credit: { from: tr("参与作品"), to: tr("参与者") },
  soundtrack: { from: tr("出自作品"), to: tr("原声歌曲") },
  adaptation: { from: tr("改编自"), to: tr("被改编为") },
  sequel: { from: tr("前作"), to: tr("续作") },
  related: { from: tr("相关"), to: tr("相关") }
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
  googlebooks: "Google Books",
  anilist: "AniList",
  igdb: "IGDB",
  steam: "Steam",
  spotify: "Spotify",
  itunes: "Apple Music",
  manual: tr("手动添加")
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
