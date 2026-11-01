import type {
  LocalizedText,
  MediaGame,
  MediaKind,
  MediaPublication,
  MediaSearchResult,
  MediaSearchSource,
  PersonRole,
  PersonSearchResult
} from "@liam-frost/shared";

/** Errors worth showing in the admin as they are. */
export class SourceError extends Error {}

export type SearchSource = MediaSearchSource;
export type SourceHit = Omit<MediaSearchResult, "existingId">;

/** Normalized details of one source entry, ready to become a collection entry. */
export type SourceDetails = {
  sourceId: string;
  sourceUrl: string;
  title: LocalizedText;
  originalTitle: string | null;
  year: number | null;
  genres: LocalizedText[];
  credits: string[];
  overview: LocalizedText;
  posterUrl: string | null;
  /** Episodes of a series, or volumes of a comic: the progress total. */
  episodes: number | null;
  /** Books and comics. */
  publication: MediaPublication | null;
  /** Games. */
  game?: Partial<MediaGame> | null;
};

export type PersonHit = Omit<PersonSearchResult, "existingId">;

/** Normalized details of one TMDB person, ready to become a person in the collection. */
export type PersonDetails = {
  sourceId: string;
  sourceUrl: string;
  name: LocalizedText;
  originalName: string | null;
  bio: LocalizedText;
  links: string[];
  photoUrl: string | null;
};

/** A cast or crew member of a TMDB film or series. */
export type CreditHit = {
  sourceId: string;
  name: string;
  role: PersonRole;
  character: string | null;
  photoUrl: string | null;
};

/** An AniList relation: how the other work relates to this one, which kind it is, and its titles. */
export type AniListRelation = {
  relationType: string;
  kind: "anime" | "comic" | "book";
  titles: string[];
};

export interface MediaSources {
  available(): Record<SearchSource, boolean>;
  search(source: SearchSource, kind: MediaKind, query: string): Promise<SourceHit[]>;
  details(source: SearchSource, kind: MediaKind, sourceId: string): Promise<SourceDetails>;
  /** Downloads a poster for the image pipeline. */
  download(url: string): Promise<Buffer>;
  /** Romaji title of an anime or comic from AniList, matched by its Japanese title; null when not found or unreachable. */
  romaji(
    nativeTitle: string,
    year: number | null,
    kind?: "anime" | "comic"
  ): Promise<string | null>;
  /** TMDB people search. */
  searchPeople(query: string): Promise<PersonHit[]>;
  /** One TMDB person. */
  person(sourceId: string): Promise<PersonDetails>;
  /** Directors / creators, writers and the main cast of a TMDB film or series ("movie:123"). */
  credits(sourceId: string, kind: MediaKind): Promise<CreditHit[]>;
  /** IGDB games for Steam app ids (Steam's id as text → IGDB's id); missing ones are not on IGDB. */
  steamGames(appIds: string[]): Promise<Map<string, string>>;
  /** AniList relations of an anime, comic or (light) novel matched by its Japanese title; empty when not found or unreachable. */
  relations(
    kind: "anime" | "comic" | "book",
    nativeTitle: string,
    year: number | null
  ): Promise<AniListRelation[]>;
}

const TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const USER_AGENT = "liam-frost-site/0.1 (https://github.com/Liam-Frost/Liam-Frost.github.io)";

const TMDB_API = "https://api.themoviedb.org/3";
const ANILIST_API = "https://graphql.anilist.co";
const ANILIST_QUERY =
  "query ($search: String, $type: MediaType) { Media(search: $search, type: $type) { title { romaji native } startDate { year } } }";
// relationType version 2 tells a work's source (SOURCE) from its adaptations (ADAPTATION); version 1 calls both ADAPTATION.
const ANILIST_RELATIONS_QUERY =
  "query ($search: String, $type: MediaType) { Media(search: $search, type: $type) { title { romaji native } startDate { year } relations { edges { relationType(version: 2) node { type format title { romaji native english } } } } } }";
const ANILIST_MANGA_FIELDS =
  "id siteUrl format status volumes genres title { romaji native english } startDate { year } coverImage { extraLarge large } description(asHtml: false) staff(perPage: 8) { edges { role node { name { full native } } } }";
const ANILIST_MANGA_SEARCH = `query ($search: String) { Page(perPage: 20) { media(search: $search, type: MANGA, format_not: NOVEL) { ${ANILIST_MANGA_FIELDS} } } }`;
const ANILIST_MANGA = `query ($id: Int) { Media(id: $id, type: MANGA) { ${ANILIST_MANGA_FIELDS} } }`;
/** AniList's fixed genre list in the site's other languages (English is AniList's own). */
const ANILIST_GENRES: Record<string, Omit<LocalizedText, "en">> = {
  Action: { zh: "动作", "zh-Hant": "動作", ja: "アクション", fr: "Action" },
  Adventure: { zh: "冒险", "zh-Hant": "冒險", ja: "冒険", fr: "Aventure" },
  Comedy: { zh: "喜剧", "zh-Hant": "喜劇", ja: "コメディ", fr: "Comédie" },
  Drama: { zh: "剧情", "zh-Hant": "劇情", ja: "ドラマ", fr: "Drame" },
  Ecchi: { zh: "卖肉", "zh-Hant": "賣肉", ja: "エッチ", fr: "Ecchi" },
  Fantasy: { zh: "奇幻", "zh-Hant": "奇幻", ja: "ファンタジー", fr: "Fantasy" },
  Horror: { zh: "恐怖", "zh-Hant": "恐怖", ja: "ホラー", fr: "Horreur" },
  "Mahou Shoujo": { zh: "魔法少女", "zh-Hant": "魔法少女", ja: "魔法少女", fr: "Magical girl" },
  Mecha: { zh: "机甲", "zh-Hant": "機甲", ja: "メカ", fr: "Mecha" },
  Music: { zh: "音乐", "zh-Hant": "音樂", ja: "音楽", fr: "Musique" },
  Mystery: { zh: "悬疑", "zh-Hant": "懸疑", ja: "ミステリー", fr: "Mystère" },
  Psychological: { zh: "心理", "zh-Hant": "心理", ja: "サイコ", fr: "Psychologique" },
  Romance: { zh: "爱情", "zh-Hant": "愛情", ja: "恋愛", fr: "Romance" },
  "Sci-Fi": { zh: "科幻", "zh-Hant": "科幻", ja: "SF", fr: "Science-fiction" },
  "Slice of Life": { zh: "日常", "zh-Hant": "日常", ja: "日常", fr: "Tranche de vie" },
  Sports: { zh: "运动", "zh-Hant": "運動", ja: "スポーツ", fr: "Sport" },
  Supernatural: { zh: "超自然", "zh-Hant": "超自然", ja: "超常", fr: "Surnaturel" },
  Thriller: { zh: "惊悚", "zh-Hant": "驚悚", ja: "スリラー", fr: "Thriller" }
};
/** AniList staff roles that make someone an author of a comic. */
const ANILIST_AUTHOR_ROLES = /^(Story & Art|Story|Art|Original Creator|Original Story)\b/;
const OPENLIBRARY = "https://openlibrary.org";
const GOOGLE_BOOKS = "https://www.googleapis.com/books/v1";
const IGDB = "https://api.igdb.com/v4";
const TWITCH_TOKEN = "https://id.twitch.tv/oauth2/token";
const IGDB_IMAGE = "https://images.igdb.com/igdb/image/upload";
/** IGDB game types left out of searches: bundles, mods, forks, packs and updates (fans' mods often rank first). */
const IGDB_SKIPPED_TYPES = "3,5,12,13,14";
const IGDB_FIELDS =
  "name,summary,url,first_release_date,cover.image_id,genres.name,platforms.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,alternative_names.name,alternative_names.comment,game_localizations.name,game_localizations.region.identifier";
/** IGDB's genre list in the site's other languages (English is IGDB's own). */
const IGDB_GENRES: Record<string, Omit<LocalizedText, "en">> = {
  Adventure: { zh: "冒险", "zh-Hant": "冒險", ja: "アドベンチャー", fr: "Aventure" },
  Arcade: { zh: "街机", "zh-Hant": "街機", ja: "アーケード", fr: "Arcade" },
  "Card & Board Game": {
    zh: "卡牌桌游",
    "zh-Hant": "卡牌桌遊",
    ja: "カード・ボード",
    fr: "Cartes et plateau"
  },
  Fighting: { zh: "格斗", "zh-Hant": "格鬥", ja: "格闘", fr: "Combat" },
  "Hack and slash/Beat 'em up": {
    zh: "动作砍杀",
    "zh-Hant": "動作砍殺",
    ja: "ハクスラ",
    fr: "Beat 'em up"
  },
  Indie: { zh: "独立", "zh-Hant": "獨立", ja: "インディー", fr: "Indépendant" },
  MOBA: { zh: "MOBA", "zh-Hant": "MOBA", ja: "MOBA", fr: "MOBA" },
  Music: { zh: "音乐", "zh-Hant": "音樂", ja: "音楽", fr: "Musique" },
  Pinball: { zh: "弹珠台", "zh-Hant": "彈珠台", ja: "ピンボール", fr: "Flipper" },
  Platform: { zh: "平台跳跃", "zh-Hant": "平台跳躍", ja: "アクション", fr: "Plateforme" },
  "Point-and-click": {
    zh: "点击解谜",
    "zh-Hant": "點擊解謎",
    ja: "ポイントアンドクリック",
    fr: "Point'n click"
  },
  Puzzle: { zh: "解谜", "zh-Hant": "解謎", ja: "パズル", fr: "Réflexion" },
  "Quiz/Trivia": { zh: "问答", "zh-Hant": "問答", ja: "クイズ", fr: "Quiz" },
  Racing: { zh: "竞速", "zh-Hant": "競速", ja: "レース", fr: "Course" },
  "Real Time Strategy (RTS)": {
    zh: "即时战略",
    "zh-Hant": "即時戰略",
    ja: "RTS",
    fr: "Stratégie en temps réel"
  },
  "Role-playing (RPG)": { zh: "角色扮演", "zh-Hant": "角色扮演", ja: "RPG", fr: "Jeu de rôle" },
  Shooter: { zh: "射击", "zh-Hant": "射擊", ja: "シューティング", fr: "Tir" },
  Simulator: { zh: "模拟", "zh-Hant": "模擬", ja: "シミュレーション", fr: "Simulation" },
  Sport: { zh: "体育", "zh-Hant": "體育", ja: "スポーツ", fr: "Sport" },
  Strategy: { zh: "策略", "zh-Hant": "策略", ja: "ストラテジー", fr: "Stratégie" },
  Tactical: { zh: "战术", "zh-Hant": "戰術", ja: "タクティクス", fr: "Tactique" },
  "Turn-based strategy (TBS)": {
    zh: "回合制策略",
    "zh-Hant": "回合制策略",
    ja: "ターン制ストラテジー",
    fr: "Stratégie au tour par tour"
  },
  "Visual Novel": {
    zh: "视觉小说",
    "zh-Hant": "視覺小說",
    ja: "ビジュアルノベル",
    fr: "Visual novel"
  }
};
/** Google Books languages ("zh-CN", "ja", ...) as site languages. */
const GOOGLE_LANGS: Record<string, SiteLang> = {
  zh: "zh",
  "zh-CN": "zh",
  "zh-TW": "zh-Hant",
  "zh-HK": "zh-Hant",
  ja: "ja",
  en: "en",
  fr: "fr"
};
/**
 * Open Library subjects mix genres with places, people, awards and other languages' headings; only these
 * genres are kept, by their lowercase subject name.
 */
const OPENLIBRARY_GENRES: Record<string, LocalizedText> = {
  fiction: { zh: "小说", "zh-Hant": "小說", en: "Fiction", fr: "Fiction", ja: "小説" },
  "science fiction": {
    zh: "科幻",
    "zh-Hant": "科幻",
    en: "Science fiction",
    fr: "Science-fiction",
    ja: "SF"
  },
  fantasy: { zh: "奇幻", "zh-Hant": "奇幻", en: "Fantasy", fr: "Fantasy", ja: "ファンタジー" },
  "fantasy fiction": {
    zh: "奇幻",
    "zh-Hant": "奇幻",
    en: "Fantasy",
    fr: "Fantasy",
    ja: "ファンタジー"
  },
  mystery: { zh: "推理", "zh-Hant": "推理", en: "Mystery", fr: "Policier", ja: "ミステリー" },
  "detective and mystery stories": {
    zh: "推理",
    "zh-Hant": "推理",
    en: "Mystery",
    fr: "Policier",
    ja: "ミステリー"
  },
  thriller: { zh: "惊悚", "zh-Hant": "驚悚", en: "Thriller", fr: "Thriller", ja: "スリラー" },
  horror: { zh: "恐怖", "zh-Hant": "恐怖", en: "Horror", fr: "Horreur", ja: "ホラー" },
  "horror tales": { zh: "恐怖", "zh-Hant": "恐怖", en: "Horror", fr: "Horreur", ja: "ホラー" },
  romance: { zh: "爱情", "zh-Hant": "愛情", en: "Romance", fr: "Romance", ja: "恋愛" },
  "love stories": { zh: "爱情", "zh-Hant": "愛情", en: "Romance", fr: "Romance", ja: "恋愛" },
  "historical fiction": {
    zh: "历史小说",
    "zh-Hant": "歷史小說",
    en: "Historical fiction",
    fr: "Roman historique",
    ja: "歴史小説"
  },
  history: { zh: "历史", "zh-Hant": "歷史", en: "History", fr: "Histoire", ja: "歴史" },
  biography: { zh: "传记", "zh-Hant": "傳記", en: "Biography", fr: "Biographie", ja: "伝記" },
  autobiography: {
    zh: "自传",
    "zh-Hant": "自傳",
    en: "Autobiography",
    fr: "Autobiographie",
    ja: "自伝"
  },
  poetry: { zh: "诗歌", "zh-Hant": "詩歌", en: "Poetry", fr: "Poésie", ja: "詩" },
  philosophy: { zh: "哲学", "zh-Hant": "哲學", en: "Philosophy", fr: "Philosophie", ja: "哲学" },
  psychology: {
    zh: "心理学",
    "zh-Hant": "心理學",
    en: "Psychology",
    fr: "Psychologie",
    ja: "心理学"
  },
  essays: { zh: "随笔", "zh-Hant": "隨筆", en: "Essays", fr: "Essais", ja: "エッセイ" },
  "short stories": {
    zh: "短篇",
    "zh-Hant": "短篇",
    en: "Short stories",
    fr: "Nouvelles",
    ja: "短編"
  },
  "young adult fiction": {
    zh: "青少年",
    "zh-Hant": "青少年",
    en: "Young adult",
    fr: "Jeunesse",
    ja: "ヤングアダルト"
  },
  "children's fiction": {
    zh: "儿童",
    "zh-Hant": "兒童",
    en: "Children's",
    fr: "Jeunesse",
    ja: "児童書"
  },
  "comic books, strips": {
    zh: "漫画",
    "zh-Hant": "漫畫",
    en: "Comics",
    fr: "Bande dessinée",
    ja: "コミック"
  },
  science: { zh: "科学", "zh-Hant": "科學", en: "Science", fr: "Sciences", ja: "科学" },
  economics: { zh: "经济", "zh-Hant": "經濟", en: "Economics", fr: "Économie", ja: "経済" },
  "computer science": {
    zh: "计算机",
    "zh-Hant": "電腦",
    en: "Computer science",
    fr: "Informatique",
    ja: "コンピュータ"
  },
  travel: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
  humor: { zh: "幽默", "zh-Hant": "幽默", en: "Humor", fr: "Humour", ja: "ユーモア" }
};
const OPENLIBRARY_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject,publisher";
/** Redirect hops a poster download may follow (Open Library covers go through archive.org). */
const MAX_REDIRECTS = 3;
/** Main cast members suggested for a film or series. */
const CAST_LIMIT = 8;

/** Compares titles ignoring width, spacing and punctuation ("ぼっち・ざ・ろっく！" = "ぼっちざろっく!"). */
export const titleKey = (title: string) =>
  title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
/** Image hosts of TMDB, Bangumi, iTunes, Spotify, AniList and Open Library; posters and covers are only downloaded from these. */
const POSTER_HOSTS = [
  /^image\.tmdb\.org$/,
  /^lain\.bgm\.tv$/,
  /^is\d-ssl\.mzstatic\.com$/,
  /^i\.scdn\.co$/,
  /^mosaic\.scdn\.co$/,
  /^image-cdn-[a-z]+\.spotifycdn\.com$/,
  /^s\d+\.anilist\.co$/,
  /^covers\.openlibrary\.org$/,
  /^books\.google\.com$/,
  /^books\.googleusercontent\.com$/,
  /^images\.igdb\.com$/,
  /^cdn\.(cloudflare|akamai)\.steamstatic\.com$/,
  /^shared\.(cloudflare\.|akamai\.)?steamstatic\.com$/,
  /^archive\.org$/,
  /^ia\d+\.us\.archive\.org$/
];
export const isPosterHost = (hostname: string) => POSTER_HOSTS.some((host) => host.test(hostname));
const TMDB_IMAGE = "https://image.tmdb.org/t/p";
/** Site languages and the TMDB locale for each. */
const TMDB_LANGS = {
  zh: "zh-CN",
  "zh-Hant": "zh-TW",
  en: "en-US",
  fr: "fr-FR",
  ja: "ja-JP"
} as const;
type SiteLang = keyof typeof TMDB_LANGS;

const yearOf = (date: string | null | undefined) => {
  const year = Number(date?.slice(0, 4));
  return Number.isInteger(year) && year > 1800 ? year : null;
};
/** Trimmed text without invisible direction marks (Open Library publishers start with U+200E). */
const clean = (value: string | null | undefined) =>
  value?.replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim() || "";
/** AniList descriptions carry some HTML and a "(Source: ...)" credit line. */
const plainText = (value: string | null | undefined) =>
  clean(
    value
      ?.replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n*\(Source:[^)]*\)\s*$/i, "")
      .replace(/\n{3,}/g, "\n\n")
  );
/** The language a title is probably written in: kana → Japanese, other CJK → Chinese, otherwise English. */
const scriptLang = (text: string): SiteLang =>
  /[\u3040-\u30ff]/.test(text) ? "ja" : /[\u3400-\u9fff]/.test(text) ? "zh" : "en";
const compact = (text: Partial<Record<SiteLang, string>>): LocalizedText =>
  Object.fromEntries(Object.entries(text).filter(([, value]) => value?.trim())) as LocalizedText;

type TmdbType = "movie" | "tv";

type TmdbHit = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
};

type TmdbTranslation = {
  iso_639_1: string;
  iso_3166_1: string;
  data: { title?: string; name?: string; overview?: string };
};

type TmdbDetails = TmdbHit & {
  original_language?: string;
  genres?: { id: number; name: string }[];
  translations?: { translations: TmdbTranslation[] };
  credits?: { crew?: { job: string; name: string }[] };
  created_by?: { name: string }[];
  production_companies?: { name: string }[];
  number_of_episodes?: number;
};

type TmdbPersonHit = {
  id: number;
  name: string;
  known_for_department?: string;
  profile_path?: string | null;
  known_for?: { title?: string; name?: string }[];
};

type TmdbPerson = TmdbPersonHit & {
  biography?: string;
  homepage?: string | null;
  imdb_id?: string | null;
  translations?: {
    translations: {
      iso_639_1: string;
      iso_3166_1: string;
      data: { biography?: string; name?: string };
    }[];
  };
};

type TmdbCredits = {
  cast?: {
    id: number;
    name: string;
    character?: string;
    profile_path?: string | null;
    order?: number;
  }[];
  crew?: { id: number; name: string; job: string; profile_path?: string | null }[];
};

type AniListMedia = {
  title?: { romaji?: string; native?: string };
  startDate?: { year?: number };
  relations?: {
    edges?: {
      relationType?: string;
      node?: {
        type?: string;
        format?: string;
        title?: { romaji?: string; native?: string; english?: string };
      };
    }[];
  };
};

type AniListManga = {
  id: number;
  siteUrl?: string;
  format?: string;
  status?: string;
  volumes?: number | null;
  genres?: string[];
  title?: { romaji?: string; native?: string; english?: string };
  startDate?: { year?: number };
  coverImage?: { extraLarge?: string; large?: string };
  description?: string;
  staff?: { edges?: { role?: string; node?: { name?: { full?: string; native?: string } } }[] };
};

type IgdbGame = {
  id: number;
  name?: string;
  summary?: string;
  url?: string;
  first_release_date?: number;
  cover?: { image_id?: string };
  genres?: { name?: string }[];
  platforms?: { name?: string }[];
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: { name?: string } }[];
  alternative_names?: { name?: string; comment?: string }[];
  game_localizations?: { name?: string; region?: { identifier?: string } }[];
};

type GoogleVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    printedPageCount?: number;
    categories?: string[];
    language?: string;
    imageLinks?: Record<string, string>;
    canonicalVolumeLink?: string;
  };
};

type OpenLibraryDoc = {
  key: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  number_of_pages_median?: number;
  subject?: string[];
  publisher?: string[];
};

type BangumiSubject = {
  id: number;
  platform?: string;
  volumes?: number;
  name?: string;
  name_cn?: string;
  date?: string | null;
  summary?: string;
  images?: { large?: string; common?: string; medium?: string; small?: string } | null;
  tags?: { name: string; count: number }[];
  eps?: number;
  total_episodes?: number;
  infobox?: { key: string; value: string | { v: string }[] }[];
};

/** Credits worth showing from Bangumi's infobox, in this order: anime, then books and comics. */
const BANGUMI_CREDIT_KEYS = ["导演", "监督", "动画制作", "原作"];
const BANGUMI_BOOK_CREDIT_KEYS = ["作者", "原作", "作画", "插图"];

export function createMediaSources(options: {
  tmdbKey?: string;
  googleBooksKey?: string;
  twitch?: { clientId: string; clientSecret: string } | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): MediaSources {
  const fetchImpl = options.fetchImpl ?? fetch;
  const tmdbKey = options.tmdbKey?.trim() ?? "";
  const googleBooksKey = options.googleBooksKey?.trim() ?? "";
  const twitch = options.twitch ?? null;
  const now = options.now ?? Date.now;
  // A v4 read access token is a JWT; a v3 API key is a short hex string.
  const tmdbBearer = tmdbKey.startsWith("eyJ");

  const request = async (url: string, init: RequestInit = {}, what: string) => {
    let response: Response;
    try {
      response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new SourceError(
        `无法连接 ${what}。如果访问它需要代理，请在 apps/api/.env 中设置 HTTPS_PROXY 后重启 API`
      );
    }
    // With redirect: "manual" the caller follows 3xx responses itself.
    const redirect = init.redirect === "manual" && response.status >= 300 && response.status < 400;
    if (!response.ok && !redirect) {
      await response.body?.cancel();
      if (response.status === 401) throw new SourceError(`${what} 拒绝了请求，请检查 API key`);
      if (response.status === 404) throw new SourceError(`${what} 上找不到这个条目`);
      throw new SourceError(`${what} 返回错误（HTTP ${response.status}）`);
    }
    return response;
  };

  const tmdb = async <T>(path: string, params: Record<string, string> = {}): Promise<T> => {
    if (!tmdbKey) throw new SourceError("未配置 TMDB_API_KEY");
    const url = new URL(TMDB_API + path);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const headers: Record<string, string> = { accept: "application/json" };
    if (tmdbBearer) headers.authorization = `Bearer ${tmdbKey}`;
    else url.searchParams.set("api_key", tmdbKey);
    return (await request(url.toString(), { headers }, "TMDB")).json() as Promise<T>;
  };

  // Genre names per language rarely change; load each list once per process.
  const genreLists = new Map<TmdbType, Promise<Map<number, LocalizedText>>>();
  const tmdbGenres = (type: TmdbType) => {
    let list = genreLists.get(type);
    if (!list) {
      list = (async () => {
        const names = new Map<number, Partial<Record<SiteLang, string>>>();
        for (const [lang, locale] of Object.entries(TMDB_LANGS) as [SiteLang, string][]) {
          const { genres } = await tmdb<{ genres: { id: number; name: string }[] }>(
            `/genre/${type}/list`,
            { language: locale }
          );
          for (const genre of genres)
            names.set(genre.id, { ...names.get(genre.id), [lang]: genre.name });
        }
        // TMDB answers zh-TW genre lists with the Simplified names; keep only real Traditional ones.
        return new Map(
          [...names].map(([id, text]) => [
            id,
            compact(text["zh-Hant"] === text.zh ? { ...text, "zh-Hant": "" } : text)
          ])
        );
      })();
      list.catch(() => genreLists.delete(type));
      genreLists.set(type, list);
    }
    return list;
  };

  /** One AniList anime or manga matched by its Japanese title (same title, or a year within one); null otherwise. */
  const anilist = async (
    query: string,
    type: "ANIME" | "MANGA",
    nativeTitle: string,
    year: number | null
  ): Promise<AniListMedia | null> => {
    try {
      const response = await fetchImpl(ANILIST_API, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": USER_AGENT
        },
        body: JSON.stringify({ query, variables: { search: nativeTitle, type } }),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!response.ok) {
        await response.body?.cancel();
        return null;
      }
      const media = ((await response.json()) as { data?: { Media?: AniListMedia } }).data?.Media;
      if (!media) return null;
      // Search returns the closest match; accept it only when it is the same work.
      const sameTitle =
        media.title?.native && titleKey(media.title.native) === titleKey(nativeTitle);
      const sameYear =
        year !== null &&
        media.startDate?.year !== undefined &&
        Math.abs(media.startDate.year - year) <= 1;
      return sameTitle || sameYear ? media : null;
    } catch {
      return null;
    }
  };

  /** An AniList query whose errors are shown in the admin (searches and imports). */
  const anilistQuery = async <T>(query: string, variables: Record<string, unknown>): Promise<T> => {
    const response = await request(
      ANILIST_API,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "user-agent": USER_AGENT
        },
        body: JSON.stringify({ query, variables })
      },
      "AniList"
    );
    const body = (await response.json()) as {
      data?: T;
      errors?: { message?: string; status?: number }[];
    };
    if (!body.data)
      throw new SourceError(
        body.errors?.[0]?.status === 404 ? "AniList 上找不到这个条目" : "AniList 返回错误"
      );
    return body.data;
  };

  const googleBooks = async <T>(path: string, params: Record<string, string> = {}): Promise<T> => {
    if (!googleBooksKey) throw new SourceError("未配置 GOOGLE_BOOKS_API_KEY");
    const url = new URL(GOOGLE_BOOKS + path);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("key", googleBooksKey);
    try {
      return (
        await request(url.toString(), { headers: { accept: "application/json" } }, "Google Books")
      ).json() as Promise<T>;
    } catch (error) {
      // Google answers a bad key with 400 and an exhausted quota with 429; the key must never reach a message.
      if (error instanceof SourceError && /HTTP 4(00|03|29)/.test(error.message))
        throw new SourceError("Google Books 拒绝了请求，请检查 GOOGLE_BOOKS_API_KEY 或当日配额");
      throw error;
    }
  };

  // IGDB takes an app token from the Twitch app (valid for about two months); one is kept until shortly
  // before it expires, or until IGDB rejects it.
  let igdbToken: { value: string; expiresAt: number } | null = null;
  const igdbAccess = async () => {
    if (!twitch) throw new SourceError("未配置 TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET");
    if (igdbToken && igdbToken.expiresAt > now() + 60_000) return igdbToken.value;
    const body = new URLSearchParams({
      client_id: twitch.clientId,
      client_secret: twitch.clientSecret,
      grant_type: "client_credentials"
    });
    let token: { access_token?: string; expires_in?: number };
    try {
      token = (await (
        await request(TWITCH_TOKEN, { method: "POST", body }, "Twitch")
      ).json()) as typeof token;
    } catch (error) {
      if (error instanceof SourceError && /HTTP 40[03]|拒绝/.test(error.message))
        throw new SourceError(
          "Twitch 拒绝了应用凭证，请检查 TWITCH_CLIENT_ID 和 TWITCH_CLIENT_SECRET"
        );
      throw error;
    }
    if (!token.access_token) throw new SourceError("Twitch 没有返回令牌");
    igdbToken = { value: token.access_token, expiresAt: now() + (token.expires_in ?? 3600) * 1000 };
    return igdbToken.value;
  };
  const igdb = async <T>(endpoint: string, query: string, retry = true): Promise<T> => {
    const token = await igdbAccess();
    const response = await fetchImpl(`${IGDB}/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": twitch!.clientId,
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "content-type": "text/plain"
      },
      body: query,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    }).catch(() => {
      throw new SourceError(
        "无法连接 IGDB。如果访问它需要代理，请在 apps/api/.env 中设置 HTTPS_PROXY 后重启 API"
      );
    });
    if (response.status === 401 && retry) {
      // A revoked or expired token: get a new one once.
      await response.body?.cancel();
      igdbToken = null;
      return igdb<T>(endpoint, query, false);
    }
    if (response.status === 429 && retry) {
      // IGDB allows four requests a second; a Steam sync imports one game after another.
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, 1100));
      return igdb<T>(endpoint, query, false);
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new SourceError(`IGDB 返回错误（HTTP ${response.status}）`);
    }
    return response.json() as Promise<T>;
  };
  const igdbCover = (game: IgdbGame, size: string) =>
    game.cover?.image_id ? `${IGDB_IMAGE}/${size}/${game.cover.image_id}.jpg` : null;
  const igdbYear = (game: IgdbGame) =>
    game.first_release_date ? new Date(game.first_release_date * 1000).getUTCFullYear() : null;
  const igdbCompanies = (game: IgdbGame, role: "developer" | "publisher") => [
    ...new Set(
      (game.involved_companies ?? [])
        .filter((company) => company[role])
        .map((company) => clean(company.company?.name))
        .filter(Boolean)
    )
  ];

  const openLibrary = async <T>(path: string, params: Record<string, string> = {}): Promise<T> => {
    const url = new URL(OPENLIBRARY + path);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return (
      await request(
        url.toString(),
        { headers: { "user-agent": USER_AGENT, accept: "application/json" } },
        "Open Library"
      )
    ).json() as Promise<T>;
  };

  /**
   * A Google Books cover over https, without the page-curl effect. `fife=w800` asks for up to 800 px wide
   * (the API's own links are about 128 px); zoom=0 is not used, since it answers a placeholder for many books.
   */
  const googleCover = (
    links: Record<string, string> | undefined,
    sizes: string[],
    width?: number
  ) => {
    const link = sizes.map((size) => links?.[size]).find(Boolean);
    if (!link) return null;
    const url = new URL(link.replace(/^http:/, "https:"));
    url.searchParams.delete("edge");
    if (width) url.searchParams.set("fife", `w${width}`);
    return url.toString();
  };

  /** Open Library's genre list, matched against a subject or each part of "Fiction / Science Fiction / General". */
  const knownGenres = (subjects: string[]) => [
    ...new Map(
      subjects
        .flatMap((subject) => [subject, ...subject.split(/\s*\/\s*/)])
        .map((subject) => OPENLIBRARY_GENRES[subject.trim().toLowerCase()])
        .filter((genre): genre is LocalizedText => Boolean(genre))
        .map((genre) => [genre.en, genre])
    ).values()
  ];

  const anilistAuthors = (manga: AniListManga) =>
    [
      ...new Set(
        (manga.staff?.edges ?? [])
          .filter((edge) => ANILIST_AUTHOR_ROLES.test(edge.role ?? ""))
          .map((edge) => clean(edge.node?.name?.native) || clean(edge.node?.name?.full))
          .filter(Boolean)
      )
    ].slice(0, 4);

  const bangumi = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = {
      "user-agent": USER_AGENT,
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {})
    };
    return (
      await request(`https://api.bgm.tv${path}`, { ...init, headers }, "Bangumi")
    ).json() as Promise<T>;
  };

  const tmdbHit = (hit: TmdbHit, type: TmdbType): SourceHit => ({
    source: "tmdb",
    sourceId: `${type}:${hit.id}`,
    mediaType: type,
    creators: [],
    title: clean(hit.title ?? hit.name) || clean(hit.original_title ?? hit.original_name),
    originalTitle: clean(hit.original_title ?? hit.original_name) || null,
    year: yearOf(hit.release_date ?? hit.first_air_date),
    posterUrl: hit.poster_path ? `${TMDB_IMAGE}/w185${hit.poster_path}` : null,
    overview: clean(hit.overview)
  });

  const bangumiPoster = (subject: BangumiSubject) =>
    subject.images?.large || subject.images?.common || null;

  return {
    available: () => ({
      tmdb: Boolean(tmdbKey),
      bangumi: true,
      openlibrary: true,
      googlebooks: Boolean(googleBooksKey),
      anilist: true,
      igdb: Boolean(twitch)
    }),

    async search(source, kind, query) {
      if (source === "openlibrary") {
        const { docs } = await openLibrary<{ docs?: OpenLibraryDoc[] }>("/search.json", {
          q: query,
          limit: "20",
          fields: OPENLIBRARY_FIELDS
        });
        return (docs ?? []).map((doc) => ({
          source: "openlibrary" as const,
          sourceId: doc.key.replace(/^\/works\//, ""),
          mediaType: null,
          creators: (doc.author_name ?? []).slice(0, 2),
          title: clean(doc.title),
          originalTitle: null,
          year: doc.first_publish_year ?? null,
          posterUrl: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : null,
          overview: ""
        }));
      }

      if (source === "googlebooks") {
        const { items } = await googleBooks<{ items?: GoogleVolume[] }>("/volumes", {
          q: query,
          maxResults: "20",
          printType: "books"
        });
        return (items ?? []).map((volume) => {
          const info = volume.volumeInfo ?? {};
          return {
            source: "googlebooks" as const,
            sourceId: volume.id,
            mediaType: null,
            creators: (info.authors ?? []).slice(0, 2),
            title:
              [clean(info.title), clean(info.subtitle)].filter(Boolean).join("：") ||
              clean(info.title),
            originalTitle: null,
            year: yearOf(info.publishedDate),
            posterUrl: googleCover(info.imageLinks, ["thumbnail", "smallThumbnail"]),
            overview: plainText(info.description)
          };
        });
      }

      if (source === "igdb") {
        // Apicalypse strings are double-quoted; quotes and backslashes in the search would end them.
        const text = query.replace(/["\\]/g, " ").trim();
        const games = await igdb<IgdbGame[]>(
          "games",
          `search "${text}"; fields name,first_release_date,cover.image_id,involved_companies.developer,involved_companies.company.name,platforms.name; where version_parent = null & game_type != (${IGDB_SKIPPED_TYPES}); limit 20;`
        );
        return games.map((game) => ({
          source: "igdb" as const,
          sourceId: String(game.id),
          mediaType: null,
          creators: igdbCompanies(game, "developer").slice(0, 2),
          title: clean(game.name),
          originalTitle: null,
          year: igdbYear(game),
          posterUrl: igdbCover(game, "t_cover_small"),
          overview: (game.platforms ?? [])
            .map((platform) => clean(platform.name))
            .filter(Boolean)
            .join(" · ")
        }));
      }

      if (source === "anilist") {
        const { Page } = await anilistQuery<{ Page?: { media?: AniListManga[] } }>(
          ANILIST_MANGA_SEARCH,
          { search: query }
        );
        return (Page?.media ?? []).map((manga) => ({
          source: "anilist" as const,
          sourceId: String(manga.id),
          mediaType: null,
          creators: anilistAuthors(manga),
          title:
            clean(manga.title?.english) || clean(manga.title?.romaji) || clean(manga.title?.native),
          originalTitle: clean(manga.title?.native) || null,
          year: manga.startDate?.year ?? null,
          posterUrl: manga.coverImage?.large ?? null,
          overview: plainText(manga.description)
        }));
      }

      if (source === "tmdb") {
        const params = { query, language: "zh-CN", include_adult: "false" };
        if (kind === "movie" || kind === "tv") {
          const { results } = await tmdb<{ results?: TmdbHit[] }>(`/search/${kind}`, params);
          return (results ?? []).slice(0, 20).map((hit) => tmdbHit(hit, kind));
        }
        // Anime can be a film or a series.
        const { results } = await tmdb<{ results?: TmdbHit[] }>("/search/multi", params);
        return (results ?? [])
          .filter((hit) => hit.media_type === "movie" || hit.media_type === "tv")
          .slice(0, 20)
          .map((hit) => tmdbHit(hit, hit.media_type as TmdbType));
      }

      // Bangumi subject type 2 is anime; type 1 is books, split by platform into comics (漫画) and the rest.
      const isPrint = kind === "book" || kind === "comic";
      const { data } = await bangumi<{ data?: BangumiSubject[] }>("/v0/search/subjects?limit=20", {
        method: "POST",
        body: JSON.stringify({ keyword: query, filter: { type: [isPrint ? 1 : 2] } })
      });
      return (data ?? [])
        .filter((subject) => !isPrint || (kind === "comic") === (subject.platform === "漫画"))
        .map((subject) => ({
          source: "bangumi" as const,
          sourceId: String(subject.id),
          mediaType: isPrint ? null : ("tv" as const),
          creators: [],
          title: clean(subject.name_cn) || clean(subject.name),
          originalTitle: clean(subject.name) || null,
          year: yearOf(subject.date),
          posterUrl: subject.images?.common || subject.images?.medium || null,
          overview: clean(subject.summary)
        }));
    },

    async details(source, kind, sourceId) {
      if (source === "tmdb") {
        const match = /^(movie|tv):(\d+)$/.exec(sourceId);
        if (!match) throw new SourceError("无效的 TMDB 条目");
        const type = match[1] as TmdbType;
        const id = match[2];
        const details = await tmdb<TmdbDetails>(`/${type}/${id}`, {
          language: "zh-CN",
          append_to_response: "translations,credits"
        });
        const translations = details.translations?.translations ?? [];
        // Chinese is split by region (Simplified CN/SG, Traditional TW/HK), so it never falls back across
        // regions; other languages take any region when the preferred ones are missing.
        const translated = (lang: string, regions: string[], field: "title" | "overview") => {
          const candidates = translations.filter((t) => t.iso_639_1 === lang);
          const preferred = regions
            .map((region) => candidates.find((t) => t.iso_3166_1 === region))
            .find(Boolean);
          const pick = preferred ?? (lang === "zh" ? undefined : candidates[0]);
          return clean(
            field === "title" ? (pick?.data.title ?? pick?.data.name) : pick?.data.overview
          );
        };
        const original = clean(details.original_title ?? details.original_name) || null;
        // TMDB leaves the original language's translation empty (e.g. no English title for an English
        // series); the original title is that language's title.
        const inOriginal = (lang: string) =>
          details.original_language === lang ? (original ?? "") : "";
        // Localized genre names are optional; without them the details' Chinese names are used.
        const genreNames = await tmdbGenres(type).catch(() => new Map<number, LocalizedText>());
        const credits =
          type === "movie"
            ? (details.credits?.crew ?? [])
                .filter((member) => member.job === "Director")
                .map((member) => member.name)
            : (details.created_by ?? []).map((person) => person.name);
        const studios =
          type === "tv" || !credits.length
            ? (details.production_companies ?? []).slice(0, 2).map((company) => company.name)
            : [];

        return {
          sourceId,
          sourceUrl: `https://www.themoviedb.org/${type}/${id}`,
          title: compact({
            zh: translated("zh", ["CN", "SG"], "title") || clean(details.title ?? details.name),
            "zh-Hant": translated("zh", ["TW", "HK"], "title"),
            en: translated("en", ["US", "GB"], "title") || inOriginal("en"),
            fr: translated("fr", ["FR", "CA"], "title") || inOriginal("fr"),
            ja: translated("ja", ["JP"], "title") || inOriginal("ja")
          }),
          originalTitle: original,
          year: yearOf(details.release_date ?? details.first_air_date),
          genres: (details.genres ?? []).map(
            (genre) => genreNames.get(genre.id) ?? { zh: genre.name }
          ),
          credits: [...new Set([...credits, ...studios])].slice(0, 6),
          overview: compact({
            zh: translated("zh", ["CN", "SG"], "overview") || clean(details.overview),
            "zh-Hant": translated("zh", ["TW", "HK"], "overview"),
            en: translated("en", ["US", "GB"], "overview"),
            fr: translated("fr", ["FR", "CA"], "overview"),
            ja: translated("ja", ["JP"], "overview")
          }),
          posterUrl: details.poster_path ? `${TMDB_IMAGE}/w780${details.poster_path}` : null,
          episodes: type === "tv" ? (details.number_of_episodes ?? null) : null,
          publication: null
        };
      }

      if (source === "openlibrary") {
        if (!/^OL\d+W$/.test(sourceId)) throw new SourceError("无效的 Open Library 条目");
        const [{ docs }, work] = await Promise.all([
          openLibrary<{ docs?: OpenLibraryDoc[] }>("/search.json", {
            q: `key:/works/${sourceId}`,
            limit: "1",
            fields: OPENLIBRARY_FIELDS
          }),
          openLibrary<{ description?: string | { value?: string } }>(`/works/${sourceId}.json`)
        ]);
        const doc = docs?.[0];
        if (!doc) throw new SourceError("Open Library 上找不到这个条目");
        const title = clean(doc.title);
        const description =
          typeof work.description === "string" ? work.description : work.description?.value;
        return {
          sourceId,
          sourceUrl: `${OPENLIBRARY}/works/${sourceId}`,
          title: compact({ [scriptLang(title)]: title }),
          originalTitle: title || null,
          year: doc.first_publish_year ?? null,
          genres: knownGenres(doc.subject ?? []).slice(0, 5),
          // Later names are often translators and illustrators of editions.
          credits: (doc.author_name ?? []).slice(0, 1),
          // Descriptions often end with a "----------" block of links.
          overview: compact({ en: clean(description?.split(/\n-{5,}/)[0]) }),
          posterUrl: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
            : null,
          episodes: null,
          publication: {
            publisher: clean(doc.publisher?.[0]) || null,
            pages: doc.number_of_pages_median ?? null,
            volumes: null,
            ongoing: null
          }
        };
      }

      if (source === "googlebooks") {
        if (!/^[A-Za-z0-9_-]{12}$/.test(sourceId))
          throw new SourceError("无效的 Google Books 条目");
        const volume = await googleBooks<GoogleVolume>(`/volumes/${sourceId}`);
        const info = volume.volumeInfo ?? {};
        const title = clean(info.title);
        const lang = GOOGLE_LANGS[info.language ?? ""] ?? scriptLang(title);
        return {
          sourceId,
          sourceUrl: info.canonicalVolumeLink ?? `https://books.google.com/books?id=${sourceId}`,
          title: compact({ [lang]: title }),
          originalTitle: title || null,
          year: yearOf(info.publishedDate),
          genres: knownGenres(info.categories ?? []).slice(0, 5),
          credits: (info.authors ?? []).map(clean).filter(Boolean).slice(0, 3),
          overview: compact({ [lang]: plainText(info.description) }),
          posterUrl: googleCover(
            info.imageLinks,
            ["extraLarge", "large", "medium", "small", "thumbnail"],
            800
          ),
          episodes: null,
          publication: {
            publisher: clean(info.publisher) || null,
            pages: info.pageCount || info.printedPageCount || null,
            volumes: null,
            ongoing: null
          }
        };
      }

      if (source === "igdb") {
        if (!/^\d{1,12}$/.test(sourceId)) throw new SourceError("无效的 IGDB 条目");
        const [game] = await igdb<IgdbGame[]>(
          "games",
          `fields ${IGDB_FIELDS}; where id = ${sourceId};`
        );
        if (!game) throw new SourceError("IGDB 上找不到这个条目");
        const name = clean(game.name);
        // Local names: IGDB's localizations, then alternative names labelled with their language.
        const localized = (regions: string[], comment: RegExp) =>
          clean(
            game.game_localizations?.find((entry) =>
              regions.includes(entry.region?.identifier ?? "")
            )?.name
          ) ||
          clean(game.alternative_names?.find((entry) => comment.test(entry.comment ?? ""))?.name);
        return {
          sourceId,
          sourceUrl: game.url ?? `https://www.igdb.com/games/${sourceId}`,
          title: compact({
            zh: localized(["zh-CN"], /chinese.*simplified/i),
            "zh-Hant": localized(["zh-TW", "zh-HK"], /chinese.*traditional/i),
            en: name,
            ja: localized(["ja-JP"], /japanese/i)
          }),
          originalTitle: name || null,
          year: igdbYear(game),
          genres: (game.genres ?? [])
            .map((genre) => clean(genre.name))
            .filter(Boolean)
            .map((genre) => compact({ en: genre, ...IGDB_GENRES[genre] })),
          credits: igdbCompanies(game, "developer").slice(0, 3),
          overview: compact({ en: clean(game.summary) }),
          posterUrl: igdbCover(game, "t_cover_big_2x"),
          episodes: null,
          publication: null,
          game: {
            platforms: (game.platforms ?? [])
              .map((platform) => clean(platform.name))
              .filter(Boolean),
            publishers: igdbCompanies(game, "publisher").slice(0, 3),
            playtimeHours: null
          }
        };
      }

      if (source === "anilist") {
        if (!/^\d{1,9}$/.test(sourceId)) throw new SourceError("无效的 AniList 条目");
        const { Media: manga } = await anilistQuery<{ Media?: AniListManga }>(ANILIST_MANGA, {
          id: Number(sourceId)
        });
        if (!manga) throw new SourceError("AniList 上找不到这个条目");
        const romaji = clean(manga.title?.romaji);
        return {
          sourceId,
          sourceUrl: manga.siteUrl ?? `https://anilist.co/manga/${sourceId}`,
          // AniList has no Chinese titles; English and French get the English (or romaji) title.
          title: compact({
            ja: clean(manga.title?.native),
            en: clean(manga.title?.english) || romaji,
            fr: romaji
          }),
          originalTitle: clean(manga.title?.native) || null,
          year: manga.startDate?.year ?? null,
          genres: (manga.genres ?? [])
            .filter((genre) => genre !== "Hentai")
            .map((genre) => compact({ en: genre, ...ANILIST_GENRES[genre] })),
          credits: anilistAuthors(manga),
          overview: compact({ en: plainText(manga.description) }),
          posterUrl: manga.coverImage?.extraLarge ?? manga.coverImage?.large ?? null,
          episodes: manga.volumes ?? null,
          publication: {
            publisher: null,
            pages: null,
            volumes: manga.volumes ?? null,
            ongoing:
              manga.status === "RELEASING" || manga.status === "HIATUS"
                ? true
                : manga.status === "FINISHED"
                  ? false
                  : null
          }
        };
      }

      if (!/^\d+$/.test(sourceId)) throw new SourceError("无效的 Bangumi 条目");
      const subject = await bangumi<BangumiSubject>(`/v0/subjects/${sourceId}`);
      const infobox = subject.infobox ?? [];
      const infoboxText = (value: string | { v: string }[]) =>
        typeof value === "string" ? value : value.map((item) => item.v).join(" ");
      const isPrint = kind === "book" || kind === "comic";
      const field = (key: string) => {
        const value = infobox.find((entry) => entry.key === key)?.value;
        return value === undefined ? "" : clean(infoboxText(value));
      };
      const credits = (isPrint ? BANGUMI_BOOK_CREDIT_KEYS : BANGUMI_CREDIT_KEYS).flatMap((key) => {
        const value = infobox.find((entry) => entry.key === key)?.value;
        const names =
          typeof value === "string" ? value.split(/[、,，/]/) : (value ?? []).map((item) => item.v);
        // Drop notes such as "（芳文社「まんがタイムきららMAX」連載中）".
        return names.map((name) => name.replace(/[（(][^）)]*[）)]/g, "").trim()).filter(Boolean);
      });
      // User tags mix genres with studios, publishers and seasons; keep the ones the infobox does not name.
      const named = infobox
        .map((entry) => infoboxText(entry.value))
        .join(" ")
        .toLowerCase();
      const genres = (subject.tags ?? [])
        .filter(
          (tag) =>
            !/\d/.test(tag.name) &&
            tag.name.length <= 12 &&
            tag.name !== subject.platform &&
            !named.includes(tag.name.toLowerCase())
        )
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map((tag) => ({ zh: tag.name }));

      return {
        sourceId,
        sourceUrl: `https://bgm.tv/subject/${sourceId}`,
        title: compact({
          zh: clean(subject.name_cn) || clean(subject.name),
          ja: clean(subject.name)
        }),
        originalTitle: clean(subject.name) || null,
        year: yearOf(subject.date),
        genres,
        credits: [...new Set(credits)].slice(0, 6),
        overview: compact({ zh: clean(subject.summary) }),
        posterUrl: bangumiPoster(subject),
        // Anime: eps counts main episodes; total_episodes also counts specials, openings and endings.
        // Comics: volumes.
        episodes: isPrint ? subject.volumes || null : subject.eps || subject.total_episodes || null,
        publication: isPrint
          ? {
              publisher:
                field("出版社")
                  .split(/[、,，/]/)[0]
                  ?.trim() || null,
              pages: Number(field("页数")) || null,
              volumes: subject.volumes || null,
              // Serialized comics list a start and, once finished, an end.
              ongoing: field("结束") ? false : field("开始") ? true : null
            }
          : null
      };
    },

    async steamGames(appIds) {
      const found = new Map<string, string>();
      // External ids of source 1 are Steam's; up to 500 per query.
      for (let at = 0; at < appIds.length; at += 500) {
        const ids = appIds.slice(at, at + 500).filter((id) => /^\d{1,10}$/.test(id));
        if (!ids.length) continue;
        const rows = await igdb<{ game?: number; uid?: string }[]>(
          "external_games",
          `fields game,uid; where external_game_source = 1 & uid = (${ids.map((id) => `"${id}"`).join(",")}); limit 500;`
        );
        for (const row of rows)
          if (row.game && row.uid && !found.has(row.uid)) found.set(row.uid, String(row.game));
      }
      return found;
    },

    async romaji(nativeTitle, year, kind = "anime") {
      return (
        (
          await anilist(ANILIST_QUERY, kind === "comic" ? "MANGA" : "ANIME", nativeTitle, year)
        )?.title?.romaji?.trim() || null
      );
    },

    async relations(kind, nativeTitle, year) {
      const media = await anilist(
        ANILIST_RELATIONS_QUERY,
        kind === "anime" ? "ANIME" : "MANGA",
        nativeTitle,
        year
      );
      return (media?.relations?.edges ?? []).flatMap((edge): AniListRelation[] => {
        const titles = [
          edge.node?.title?.native,
          edge.node?.title?.romaji,
          edge.node?.title?.english
        ]
          .map(clean)
          .filter(Boolean);
        const type = edge.node?.type;
        if (!edge.relationType || !titles.length || (type !== "ANIME" && type !== "MANGA"))
          return [];
        const other = type === "ANIME" ? "anime" : edge.node?.format === "NOVEL" ? "book" : "comic";
        return [{ relationType: edge.relationType, kind: other, titles }];
      });
    },

    async searchPeople(query) {
      const data = await tmdb<{ results?: TmdbPersonHit[] }>("/search/person", {
        query,
        language: "zh-CN",
        include_adult: "false"
      });
      return (data.results ?? []).slice(0, 20).map((hit) => ({
        source: "tmdb" as const,
        sourceId: String(hit.id),
        name: clean(hit.name),
        department: hit.known_for_department ?? null,
        knownFor: (hit.known_for ?? [])
          .map((work) => clean(work.title ?? work.name))
          .filter(Boolean)
          .slice(0, 3),
        photoUrl: hit.profile_path ? `${TMDB_IMAGE}/w185${hit.profile_path}` : null
      }));
    },

    async person(sourceId) {
      if (!/^\d{1,12}$/.test(sourceId)) throw new SourceError("无效的 TMDB 人物");
      const details = await tmdb<TmdbPerson>(`/person/${sourceId}`, {
        append_to_response: "translations"
      });
      const translations = details.translations?.translations ?? [];
      const translated = (lang: string, regions: string[], field: "name" | "biography") => {
        const candidates = translations.filter((t) => t.iso_639_1 === lang);
        const preferred = regions
          .map((region) => candidates.find((t) => t.iso_3166_1 === region))
          .find(Boolean);
        return clean((preferred ?? (lang === "zh" ? undefined : candidates[0]))?.data[field]);
      };
      const name = clean(details.name);
      return {
        sourceId,
        sourceUrl: `https://www.themoviedb.org/person/${sourceId}`,
        // TMDB's main name is usually the romanized one; translations add local scripts when they exist.
        name: compact({
          zh: translated("zh", ["CN", "SG"], "name"),
          "zh-Hant": translated("zh", ["TW", "HK"], "name"),
          en: name,
          fr: translated("fr", ["FR", "CA"], "name"),
          ja: translated("ja", ["JP"], "name")
        }),
        originalName: null,
        bio: compact({
          zh: translated("zh", ["CN", "SG"], "biography"),
          "zh-Hant": translated("zh", ["TW", "HK"], "biography"),
          en: translated("en", ["US", "GB"], "biography") || clean(details.biography),
          fr: translated("fr", ["FR", "CA"], "biography"),
          ja: translated("ja", ["JP"], "biography")
        }),
        links: [
          details.homepage && /^https:\/\//.test(details.homepage) ? details.homepage : "",
          details.imdb_id && /^nm\d+$/.test(details.imdb_id)
            ? `https://www.imdb.com/name/${details.imdb_id}/`
            : ""
        ].filter(Boolean),
        photoUrl: details.profile_path ? `${TMDB_IMAGE}/w780${details.profile_path}` : null
      };
    },

    async credits(sourceId, kind) {
      const match = /^(movie|tv):(\d+)$/.exec(sourceId);
      if (!match) throw new SourceError("无效的 TMDB 条目");
      const type = match[1] as TmdbType;
      const details = await tmdb<{
        created_by?: { id: number; name: string; profile_path?: string | null }[];
        credits?: TmdbCredits;
      }>(`/${type}/${match[2]}`, {
        append_to_response: "credits"
      });
      const photo = (path: string | null | undefined) =>
        path ? `${TMDB_IMAGE}/w185${path}` : null;
      const crew = details.credits?.crew ?? [];
      const hits: CreditHit[] = [
        ...(type === "tv"
          ? (details.created_by ?? []).map((person) => ({
              id: person.id,
              name: person.name,
              role: "creator" as const,
              profile_path: person.profile_path
            }))
          : crew
              .filter((member) => member.job === "Director")
              .map((member) => ({ ...member, role: "director" as const }))),
        ...crew
          .filter((member) => member.job === "Screenplay" || member.job === "Writer")
          .map((member) => ({ ...member, role: "screenwriter" as const })),
        ...(details.credits?.cast ?? [])
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .slice(0, CAST_LIMIT)
          .map((member) => ({
            ...member,
            role: kind === "anime" ? ("voice" as const) : ("actor" as const)
          }))
      ].map((member) => {
        const character = "character" in member ? clean(member.character as string) : "";
        // Animated films list voice actors as cast with "(voice)" after the character.
        const voiced = /\s*\(voice\)$/i.test(character);
        return {
          sourceId: String(member.id),
          name: clean(member.name),
          role: voiced ? ("voice" as const) : member.role,
          character: character.replace(/\s*\(voice\)$/i, "") || null,
          photoUrl: photo(member.profile_path)
        };
      });
      // One suggestion per person and role (TMDB lists a writer once per writing credit).
      const seen = new Set<string>();
      return hits.filter((hit) => {
        const key = `${hit.sourceId}:${hit.role}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },

    async download(url) {
      // Poster URLs come from the sources' responses; only fetch from their image hosts. Redirects are
      // followed by hand so every hop is checked (Open Library covers go through archive.org).
      let next = url;
      let response: Response | null = null;
      for (let hop = 0; hop <= MAX_REDIRECTS && !response; hop++) {
        const parsed = new URL(next);
        if (parsed.protocol !== "https:" || !isPosterHost(parsed.hostname))
          throw new SourceError("海报地址无效");
        const answer = await request(
          next,
          { headers: { "user-agent": USER_AGENT }, redirect: "manual" },
          "海报服务器"
        );
        const location =
          answer.status >= 300 && answer.status < 400 ? answer.headers.get("location") : null;
        if (!location) {
          response = answer;
        } else {
          await answer.body?.cancel();
          next = new URL(location, next).toString();
        }
      }
      if (!response) throw new SourceError("海报地址跳转次数过多");
      const length = Number(response.headers.get("content-length"));
      if (length > MAX_IMAGE_BYTES) {
        await response.body?.cancel();
        throw new SourceError("海报文件过大");
      }
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length > MAX_IMAGE_BYTES) throw new SourceError("海报文件过大");
      return data;
    }
  };
}
