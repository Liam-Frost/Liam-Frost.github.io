import type { LocalizedText, MediaKind, MediaSearchResult, PersonRole, PersonSearchResult } from "@liam-frost/shared";

/** Errors worth showing in the admin as they are. */
export class SourceError extends Error {}

export type SearchSource = "tmdb" | "bangumi";
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
  episodes: number | null;
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
export type CreditHit = { sourceId: string; name: string; role: PersonRole; character: string | null; photoUrl: string | null };

/** An AniList relation of an anime: how the other work relates to it, what it is, and its titles. */
export type AniListRelation = { relationType: string; mediaType: "ANIME" | "MANGA"; titles: string[] };

export interface MediaSources {
  available(): { tmdb: boolean; bangumi: boolean };
  search(source: SearchSource, kind: MediaKind, query: string): Promise<SourceHit[]>;
  details(source: SearchSource, kind: MediaKind, sourceId: string): Promise<SourceDetails>;
  /** Downloads a poster for the image pipeline. */
  download(url: string): Promise<Buffer>;
  /** Romaji title of an anime from AniList, matched by its Japanese title; null when not found or unreachable. */
  romaji(nativeTitle: string, year: number | null): Promise<string | null>;
  /** TMDB people search. */
  searchPeople(query: string): Promise<PersonHit[]>;
  /** One TMDB person. */
  person(sourceId: string): Promise<PersonDetails>;
  /** Directors / creators, writers and the main cast of a TMDB film or series ("movie:123"). */
  credits(sourceId: string, kind: MediaKind): Promise<CreditHit[]>;
  /** AniList relations of an anime matched by its Japanese title; empty when not found or unreachable. */
  animeRelations(nativeTitle: string, year: number | null): Promise<AniListRelation[]>;
}

const TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const USER_AGENT = "liam-frost-site/0.1 (https://github.com/Liam-Frost/Liam-Frost.github.io)";

const TMDB_API = "https://api.themoviedb.org/3";
const ANILIST_API = "https://graphql.anilist.co";
const ANILIST_QUERY = "query ($search: String) { Media(search: $search, type: ANIME) { title { romaji native } startDate { year } } }";
const ANILIST_RELATIONS_QUERY =
  "query ($search: String) { Media(search: $search, type: ANIME) { title { romaji native } startDate { year } relations { edges { relationType node { type title { romaji native english } } } } } }";
/** Main cast members suggested for a film or series. */
const CAST_LIMIT = 8;

/** Compares titles ignoring width, spacing and punctuation ("ぼっち・ざ・ろっく！" = "ぼっちざろっく!"). */
export const titleKey = (title: string) => title.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
/** Image hosts of TMDB, Bangumi, iTunes and Spotify; posters and covers are only downloaded from these. */
const POSTER_HOSTS = [/^image\.tmdb\.org$/, /^lain\.bgm\.tv$/, /^is\d-ssl\.mzstatic\.com$/, /^i\.scdn\.co$/, /^mosaic\.scdn\.co$/, /^image-cdn-[a-z]+\.spotifycdn\.com$/];
export const isPosterHost = (hostname: string) => POSTER_HOSTS.some((host) => host.test(hostname));
const TMDB_IMAGE = "https://image.tmdb.org/t/p";
/** Site languages and the TMDB locale for each. */
const TMDB_LANGS = { zh: "zh-CN", "zh-Hant": "zh-TW", en: "en-US", fr: "fr-FR", ja: "ja-JP" } as const;
type SiteLang = keyof typeof TMDB_LANGS;

const yearOf = (date: string | null | undefined) => {
  const year = Number(date?.slice(0, 4));
  return Number.isInteger(year) && year > 1800 ? year : null;
};
const clean = (value: string | null | undefined) => value?.trim() || "";
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

type TmdbTranslation = { iso_639_1: string; iso_3166_1: string; data: { title?: string; name?: string; overview?: string } };

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
  translations?: { translations: { iso_639_1: string; iso_3166_1: string; data: { biography?: string; name?: string } }[] };
};

type TmdbCredits = {
  cast?: { id: number; name: string; character?: string; profile_path?: string | null; order?: number }[];
  crew?: { id: number; name: string; job: string; profile_path?: string | null }[];
};

type AniListMedia = {
  title?: { romaji?: string; native?: string };
  startDate?: { year?: number };
  relations?: { edges?: { relationType?: string; node?: { type?: string; title?: { romaji?: string; native?: string; english?: string } } }[] };
};

type BangumiSubject = {
  id: number;
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

/** Credits worth showing from Bangumi's infobox, in this order. */
const BANGUMI_CREDIT_KEYS = ["导演", "监督", "动画制作", "原作"];

export function createMediaSources(options: { tmdbKey?: string; fetchImpl?: typeof fetch }): MediaSources {
  const fetchImpl = options.fetchImpl ?? fetch;
  const tmdbKey = options.tmdbKey?.trim() ?? "";
  // A v4 read access token is a JWT; a v3 API key is a short hex string.
  const tmdbBearer = tmdbKey.startsWith("eyJ");

  const request = async (url: string, init: RequestInit = {}, what: string) => {
    let response: Response;
    try {
      response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new SourceError(`无法连接 ${what}。如果访问它需要代理，请在 apps/api/.env 中设置 HTTPS_PROXY 后重启 API`);
    }
    if (!response.ok) {
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
          const { genres } = await tmdb<{ genres: { id: number; name: string }[] }>(`/genre/${type}/list`, { language: locale });
          for (const genre of genres) names.set(genre.id, { ...names.get(genre.id), [lang]: genre.name });
        }
        // TMDB answers zh-TW genre lists with the Simplified names; keep only real Traditional ones.
        return new Map([...names].map(([id, text]) => [id, compact(text["zh-Hant"] === text.zh ? { ...text, "zh-Hant": "" } : text)]));
      })();
      list.catch(() => genreLists.delete(type));
      genreLists.set(type, list);
    }
    return list;
  };

  /** One AniList anime matched by its Japanese title (same title, or a year within one); null otherwise. */
  const anilist = async (query: string, nativeTitle: string, year: number | null): Promise<AniListMedia | null> => {
    try {
      const response = await fetchImpl(ANILIST_API, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", "user-agent": USER_AGENT },
        body: JSON.stringify({ query, variables: { search: nativeTitle } }),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!response.ok) {
        await response.body?.cancel();
        return null;
      }
      const media = ((await response.json()) as { data?: { Media?: AniListMedia } }).data?.Media;
      if (!media) return null;
      // Search returns the closest match; accept it only when it is the same work.
      const sameTitle = media.title?.native && titleKey(media.title.native) === titleKey(nativeTitle);
      const sameYear = year !== null && media.startDate?.year !== undefined && Math.abs(media.startDate.year - year) <= 1;
      return sameTitle || sameYear ? media : null;
    } catch {
      return null;
    }
  };

  const bangumi = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = { "user-agent": USER_AGENT, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) };
    return (await request(`https://api.bgm.tv${path}`, { ...init, headers }, "Bangumi")).json() as Promise<T>;
  };

  const tmdbHit = (hit: TmdbHit, type: TmdbType): SourceHit => ({
    source: "tmdb",
    sourceId: `${type}:${hit.id}`,
    mediaType: type,
    title: clean(hit.title ?? hit.name) || clean(hit.original_title ?? hit.original_name),
    originalTitle: clean(hit.original_title ?? hit.original_name) || null,
    year: yearOf(hit.release_date ?? hit.first_air_date),
    posterUrl: hit.poster_path ? `${TMDB_IMAGE}/w185${hit.poster_path}` : null,
    overview: clean(hit.overview)
  });

  const bangumiPoster = (subject: BangumiSubject) => subject.images?.large || subject.images?.common || null;

  return {
    available: () => ({ tmdb: Boolean(tmdbKey), bangumi: true }),

    async search(source, kind, query) {
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

      // Bangumi subject type 2 is anime.
      const { data } = await bangumi<{ data?: BangumiSubject[] }>("/v0/search/subjects?limit=20", {
        method: "POST",
        body: JSON.stringify({ keyword: query, filter: { type: [2] } })
      });
      return (data ?? []).map((subject) => ({
        source: "bangumi" as const,
        sourceId: String(subject.id),
        mediaType: "tv" as const,
        title: clean(subject.name_cn) || clean(subject.name),
        originalTitle: clean(subject.name) || null,
        year: yearOf(subject.date),
        posterUrl: subject.images?.common || subject.images?.medium || null,
        overview: clean(subject.summary)
      }));
    },

    async details(source, _kind, sourceId) {
      if (source === "tmdb") {
        const match = /^(movie|tv):(\d+)$/.exec(sourceId);
        if (!match) throw new SourceError("无效的 TMDB 条目");
        const type = match[1] as TmdbType;
        const id = match[2];
        const details = await tmdb<TmdbDetails>(`/${type}/${id}`, { language: "zh-CN", append_to_response: "translations,credits" });
        const translations = details.translations?.translations ?? [];
        // Chinese is split by region (Simplified CN/SG, Traditional TW/HK), so it never falls back across
        // regions; other languages take any region when the preferred ones are missing.
        const translated = (lang: string, regions: string[], field: "title" | "overview") => {
          const candidates = translations.filter((t) => t.iso_639_1 === lang);
          const preferred = regions.map((region) => candidates.find((t) => t.iso_3166_1 === region)).find(Boolean);
          const pick = preferred ?? (lang === "zh" ? undefined : candidates[0]);
          return clean(field === "title" ? (pick?.data.title ?? pick?.data.name) : pick?.data.overview);
        };
        const original = clean(details.original_title ?? details.original_name) || null;
        // TMDB leaves the original language's translation empty (e.g. no English title for an English
        // series); the original title is that language's title.
        const inOriginal = (lang: string) => (details.original_language === lang ? (original ?? "") : "");
        // Localized genre names are optional; without them the details' Chinese names are used.
        const genreNames = await tmdbGenres(type).catch(() => new Map<number, LocalizedText>());
        const credits =
          type === "movie"
            ? (details.credits?.crew ?? []).filter((member) => member.job === "Director").map((member) => member.name)
            : (details.created_by ?? []).map((person) => person.name);
        const studios = type === "tv" || !credits.length ? (details.production_companies ?? []).slice(0, 2).map((company) => company.name) : [];

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
          genres: (details.genres ?? []).map((genre) => genreNames.get(genre.id) ?? { zh: genre.name }),
          credits: [...new Set([...credits, ...studios])].slice(0, 6),
          overview: compact({
            zh: translated("zh", ["CN", "SG"], "overview") || clean(details.overview),
            "zh-Hant": translated("zh", ["TW", "HK"], "overview"),
            en: translated("en", ["US", "GB"], "overview"),
            fr: translated("fr", ["FR", "CA"], "overview"),
            ja: translated("ja", ["JP"], "overview")
          }),
          posterUrl: details.poster_path ? `${TMDB_IMAGE}/w780${details.poster_path}` : null,
          episodes: type === "tv" ? (details.number_of_episodes ?? null) : null
        };
      }

      if (!/^\d+$/.test(sourceId)) throw new SourceError("无效的 Bangumi 条目");
      const subject = await bangumi<BangumiSubject>(`/v0/subjects/${sourceId}`);
      const infobox = subject.infobox ?? [];
      const infoboxText = (value: string | { v: string }[]) => (typeof value === "string" ? value : value.map((item) => item.v).join(" "));
      const credits = BANGUMI_CREDIT_KEYS.flatMap((key) => {
        const value = infobox.find((entry) => entry.key === key)?.value;
        const names = typeof value === "string" ? value.split(/[、,，/]/) : (value ?? []).map((item) => item.v);
        // Drop notes such as "（芳文社「まんがタイムきららMAX」連載中）".
        return names.map((name) => name.replace(/[（(][^）)]*[）)]/g, "").trim()).filter(Boolean);
      });
      // User tags mix genres with studios, publishers and seasons; keep the ones the infobox does not name.
      const named = infobox.map((entry) => infoboxText(entry.value)).join(" ").toLowerCase();
      const genres = (subject.tags ?? [])
        .filter((tag) => !/\d/.test(tag.name) && tag.name.length <= 12 && !named.includes(tag.name.toLowerCase()))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map((tag) => ({ zh: tag.name }));

      return {
        sourceId,
        sourceUrl: `https://bgm.tv/subject/${sourceId}`,
        title: compact({ zh: clean(subject.name_cn) || clean(subject.name), ja: clean(subject.name) }),
        originalTitle: clean(subject.name) || null,
        year: yearOf(subject.date),
        genres,
        credits: [...new Set(credits)].slice(0, 6),
        overview: compact({ zh: clean(subject.summary) }),
        posterUrl: bangumiPoster(subject),
        // eps counts main episodes; total_episodes also counts specials, openings and endings.
        episodes: subject.eps || subject.total_episodes || null
      };
    },

    async romaji(nativeTitle, year) {
      return (await anilist(ANILIST_QUERY, nativeTitle, year))?.title?.romaji?.trim() || null;
    },

    async animeRelations(nativeTitle, year) {
      const media = await anilist(ANILIST_RELATIONS_QUERY, nativeTitle, year);
      return (media?.relations?.edges ?? []).flatMap((edge) => {
        const titles = [edge.node?.title?.native, edge.node?.title?.romaji, edge.node?.title?.english].map(clean).filter(Boolean);
        const mediaType = edge.node?.type;
        if (!edge.relationType || !titles.length || (mediaType !== "ANIME" && mediaType !== "MANGA")) return [];
        return [{ relationType: edge.relationType, mediaType, titles }];
      });
    },

    async searchPeople(query) {
      const data = await tmdb<{ results?: TmdbPersonHit[] }>("/search/person", { query, language: "zh-CN", include_adult: "false" });
      return (data.results ?? []).slice(0, 20).map((hit) => ({
        source: "tmdb" as const,
        sourceId: String(hit.id),
        name: clean(hit.name),
        department: hit.known_for_department ?? null,
        knownFor: (hit.known_for ?? []).map((work) => clean(work.title ?? work.name)).filter(Boolean).slice(0, 3),
        photoUrl: hit.profile_path ? `${TMDB_IMAGE}/w185${hit.profile_path}` : null
      }));
    },

    async person(sourceId) {
      if (!/^\d{1,12}$/.test(sourceId)) throw new SourceError("无效的 TMDB 人物");
      const details = await tmdb<TmdbPerson>(`/person/${sourceId}`, { append_to_response: "translations" });
      const translations = details.translations?.translations ?? [];
      const translated = (lang: string, regions: string[], field: "name" | "biography") => {
        const candidates = translations.filter((t) => t.iso_639_1 === lang);
        const preferred = regions.map((region) => candidates.find((t) => t.iso_3166_1 === region)).find(Boolean);
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
          details.imdb_id && /^nm\d+$/.test(details.imdb_id) ? `https://www.imdb.com/name/${details.imdb_id}/` : ""
        ].filter(Boolean),
        photoUrl: details.profile_path ? `${TMDB_IMAGE}/w780${details.profile_path}` : null
      };
    },

    async credits(sourceId, kind) {
      const match = /^(movie|tv):(\d+)$/.exec(sourceId);
      if (!match) throw new SourceError("无效的 TMDB 条目");
      const type = match[1] as TmdbType;
      const details = await tmdb<{ created_by?: { id: number; name: string; profile_path?: string | null }[]; credits?: TmdbCredits }>(`/${type}/${match[2]}`, {
        append_to_response: "credits"
      });
      const photo = (path: string | null | undefined) => (path ? `${TMDB_IMAGE}/w185${path}` : null);
      const crew = details.credits?.crew ?? [];
      const hits: CreditHit[] = [
        ...(type === "tv"
          ? (details.created_by ?? []).map((person) => ({ id: person.id, name: person.name, role: "creator" as const, profile_path: person.profile_path }))
          : crew.filter((member) => member.job === "Director").map((member) => ({ ...member, role: "director" as const }))),
        ...crew.filter((member) => member.job === "Screenplay" || member.job === "Writer").map((member) => ({ ...member, role: "screenwriter" as const })),
        ...(details.credits?.cast ?? [])
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .slice(0, CAST_LIMIT)
          .map((member) => ({ ...member, role: kind === "anime" ? ("voice" as const) : ("actor" as const) }))
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
      // Poster URLs come from the sources' responses; only fetch from their image hosts, without redirects.
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !isPosterHost(parsed.hostname)) throw new SourceError("海报地址无效");
      const response = await request(url, { headers: { "user-agent": USER_AGENT }, redirect: "error" }, "海报服务器");
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
