// Development helper: fills the collection with samples of everything the site shows: films, series,
// anime, books, comics and games (TMDB, Bangumi, Open Library, AniList, IGDB) with ratings, reviews and
// statuses over two years (for the year in review); songs from iTunes (two from one album, for the album
// view) in a playlist; people (TMDB and by hand) with their credits; and links between entries
// (soundtracks, adaptations, related works). Game entries carry Steam-style playtime and dates.
// Anything already in the collection is kept, so it can be run again. Usage: npm run db:seed:collection
import "dotenv/config";

import * as http from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import type { LocalizedText, MediaKind, PersonRole, RelationType } from "@liam-frost/shared";

import { importMedia, storePoster } from "../media/import";
import { createMusicSource } from "../media/itunes";
import { importItunesSong } from "../media/music-import";
import { PrismaMediaRepository } from "../media/prisma-repository";
import { createMediaSources, SourceError, type SearchSource } from "../media/sources";
import { DuplicateMediaError, type MediaPatch } from "../media/types";
import { PrismaPersonRepository, PrismaRelationRepository } from "../people/prisma-repository";
import { DuplicateRelationError, relationKey, type PersonRow } from "../people/types";
import { InvalidImageError, processImage } from "../photos/images";
import { PrismaPlaylistRepository } from "../playlists/prisma-repository";
import type { StoredImage } from "../projects/types";
import { LocalImageStore } from "../storage/local";
import { createPrismaClient } from "./client";

type Sample = {
  /** Name used by the songs, people and links below. */
  key?: string;
  kind: MediaKind;
  source: SearchSource;
  sourceId?: string;
  query?: string;
  patch: MediaPatch;
};

/** Songs found on iTunes; `work` is the entry the song belongs to. */
type SongSample = {
  key: string;
  /** The title comes first; the result's title must contain it. */
  query: string;
  /** The result must be by this artist (and on this album, when given). */
  artist: string;
  album?: string;
  /** iTunes store; Japan unless the song is only in another. */
  country?: string;
  work?: { key: string; role: "opening" | "ending" | "insert" | "theme" };
};

const SONGS: SongSample[] = [
  // Both on the album 結束バンド, so the album view groups them.
  {
    key: "seishun",
    query: "青春コンプレックス 結束バンド",
    artist: "結束バンド",
    album: "結束バンド",
    work: { key: "bocchi", role: "opening" }
  },
  {
    key: "guitar",
    query: "ギターと孤独と蒼い惑星 結束バンド",
    artist: "結束バンド",
    album: "結束バンド",
    work: { key: "bocchi", role: "insert" }
  },
  {
    key: "yuusha",
    query: "勇者 YOASOBI",
    artist: "YOASOBI",
    work: { key: "frieren-anime", role: "opening" }
  },
  {
    key: "zenzenzense",
    // The Japanese store only has covers; the original is in the US store.
    query: "Zenzenzense RADWIMPS",
    artist: "RADWIMPS",
    country: "US",
    work: { key: "your-name", role: "theme" }
  },
  {
    key: "itsumo",
    query: "いつも何度でも 木村弓",
    artist: "木村",
    work: { key: "spirited-away", role: "ending" }
  },
  {
    key: "guren",
    query: "紅蓮の弓矢 Linked Horizon",
    artist: "Linked Horizon",
    work: { key: "aot", role: "opening" }
  }
];

/** People: TMDB ones are imported with their photo (when TMDB is configured); others are added by name. */
type PersonSample = {
  key: string;
  tmdbId?: string;
  name: LocalizedText;
  originalName?: string;
  featured?: boolean;
  credits: { work: string; role: PersonRole; note?: LocalizedText }[];
};

const PEOPLE: PersonSample[] = [
  {
    key: "miyazaki",
    tmdbId: "608",
    name: { zh: "宫崎骏", en: "Hayao Miyazaki", ja: "宮崎駿" },
    featured: true,
    credits: [
      { work: "spirited-away", role: "director" },
      { work: "howl", role: "director" }
    ]
  },
  {
    key: "bong",
    tmdbId: "21684",
    name: { zh: "奉俊昊", en: "Bong Joon-ho" },
    credits: [{ work: "parasite", role: "director" }]
  },
  {
    key: "shinkai",
    name: { zh: "新海诚", en: "Makoto Shinkai", ja: "新海誠" },
    originalName: "新海誠",
    credits: [{ work: "your-name", role: "director" }]
  },
  {
    key: "liu",
    name: { zh: "刘慈欣", en: "Liu Cixin" },
    originalName: "刘慈欣",
    credits: [{ work: "three-body", role: "author" }]
  },
  {
    key: "yamada",
    name: { zh: "山田钟人", en: "Kanehito Yamada", ja: "山田鐘人" },
    originalName: "山田鐘人",
    credits: [{ work: "frieren-comic", role: "author" }]
  },
  {
    key: "kessoku",
    name: { zh: "结束乐队", en: "Kessoku Band", ja: "結束バンド" },
    originalName: "結束バンド",
    credits: [
      { work: "seishun", role: "singer" },
      { work: "guitar", role: "singer" }
    ]
  },
  {
    key: "yoasobi",
    name: { en: "YOASOBI" },
    credits: [{ work: "yuusha", role: "singer" }]
  }
];

/** Links between entries: `from` is the song, the adaptation, or one of two related works. */
const LINKS: { from: string; to: string; type: RelationType; note?: LocalizedText }[] = [
  { from: "bocchi", to: "bocchi-comic", type: "adaptation" },
  { from: "frieren-anime", to: "frieren-comic", type: "adaptation" },
  {
    from: "howl",
    to: "spirited-away",
    type: "related",
    note: { zh: "同为吉卜力工作室作品", en: "Both Studio Ghibli films" }
  }
];

const SAMPLES: Sample[] = [
  {
    key: "spirited-away",
    kind: "movie",
    source: "tmdb",
    sourceId: "movie:129",
    patch: {
      rating: 5,
      watchedOn: "2026-10-20",
      rewatchCount: 3,
      featured: true,
      review: {
        zh: "每次重看都能发现新的细节。\n汤屋的夜景永远看不腻。",
        en: "Something new on every rewatch."
      }
    }
  },
  {
    key: "howl",
    kind: "movie",
    source: "tmdb",
    sourceId: "movie:4935",
    patch: { rating: 4, watchedOn: "2026-09-02" }
  },
  {
    key: "parasite",
    kind: "movie",
    source: "tmdb",
    sourceId: "movie:496243",
    patch: { rating: 5, watchedOn: "2026-08-15", review: { zh: "后半段一直坐立不安。" } }
  },
  {
    kind: "movie",
    source: "tmdb",
    sourceId: "movie:194",
    patch: {
      rating: 4,
      watchedOn: "2025-12-24",
      review: { fr: "Un conte de Paris plein de charme." }
    }
  },
  { kind: "movie", source: "tmdb", sourceId: "movie:27205", patch: { status: "want" } },
  // Hidden: must not appear on the site.
  {
    kind: "movie",
    source: "tmdb",
    sourceId: "movie:157336",
    patch: { rating: 5, watchedOn: "2026-04-11", visibility: "private" }
  },
  {
    kind: "tv",
    source: "tmdb",
    sourceId: "tv:64010",
    patch: { rating: 5, watchedOn: "2026-07-01", review: { zh: "看完像告别了一整条街坊。" } }
  },
  {
    kind: "tv",
    source: "tmdb",
    sourceId: "tv:1396",
    patch: { status: "watching", rating: 4, progress: { watched: 30, total: 62 } }
  },
  {
    kind: "tv",
    source: "tmdb",
    sourceId: "tv:42009",
    patch: { status: "dropped", rating: 3, progress: { watched: 7, total: null } }
  },
  {
    key: "bocchi",
    kind: "anime",
    source: "bangumi",
    sourceId: "328609",
    patch: {
      rating: 5,
      watchedOn: "2026-10-28",
      featured: true,
      review: { zh: "社恐吉他手，太真实了。", ja: "リアルすぎる。" }
    }
  },
  {
    key: "frieren-anime",
    kind: "anime",
    source: "bangumi",
    sourceId: "400602",
    patch: { status: "watching", rating: 4, progress: { watched: 10, total: 28 } }
  },
  {
    key: "your-name",
    kind: "anime",
    source: "tmdb",
    sourceId: "movie:372058",
    patch: { rating: 4, watchedOn: "2026-06-12" }
  },
  { key: "aot", kind: "anime", source: "bangumi", query: "进击的巨人", patch: { status: "want" } },
  {
    key: "three-body",
    kind: "book",
    source: "openlibrary",
    sourceId: "OL17267881W",
    patch: { rating: 5, watchedOn: "2025-08-14", review: { zh: "黑暗森林那一段读得背后发凉。" } }
  },
  {
    kind: "book",
    source: "bangumi",
    query: "涼宮ハルヒの憂鬱",
    patch: { status: "watching", progress: { watched: 120, total: null } }
  },
  {
    key: "bocchi-comic",
    kind: "comic",
    source: "anilist",
    sourceId: "111258",
    patch: { status: "watching", rating: 5, progress: { watched: 5, total: null } }
  },
  {
    key: "frieren-comic",
    kind: "comic",
    source: "bangumi",
    query: "葬送のフリーレン",
    patch: { rating: 4, watchedOn: "2026-09-30" }
  },
  {
    key: "elden",
    kind: "game",
    source: "igdb",
    sourceId: "119133",
    patch: {
      rating: 5,
      watchedOn: "2026-02-20",
      review: { zh: "第一次打过大树守卫的时候手都在抖。" },
      extra: {
        game: {
          playtimeHours: 132,
          steamAppId: 1245620,
          lastPlayedOn: "2026-10-05",
          purchasedOn: "2022-02-25"
        }
      }
    }
  },
  {
    key: "hollow",
    kind: "game",
    source: "igdb",
    query: "Hollow Knight",
    patch: {
      status: "watching",
      rating: 4,
      extra: {
        game: {
          playtimeHours: 41,
          steamAppId: 367520,
          lastPlayedOn: "2026-10-30",
          purchasedOn: "2019-06-12"
        }
      }
    }
  }
];

// Like the server: honour HTTPS_PROXY for TMDB / Bangumi when set.
const setGlobalProxyFromEnv = (http as { setGlobalProxyFromEnv?: () => void })
  .setGlobalProxyFromEnv;
if (
  (process.env.HTTPS_PROXY || process.env.https_proxy) &&
  typeof setGlobalProxyFromEnv === "function"
)
  setGlobalProxyFromEnv();

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required (see apps/api/.env.example)");

const prisma = createPrismaClient(databaseUrl);
const media = new PrismaMediaRepository(prisma);
const twitch =
  process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET
    ? { clientId: process.env.TWITCH_CLIENT_ID, clientSecret: process.env.TWITCH_CLIENT_SECRET }
    : null;
const sources = createMediaSources({
  tmdbKey: process.env.TMDB_API_KEY,
  googleBooksKey: process.env.GOOGLE_BOOKS_API_KEY,
  twitch
});
const store = new LocalImageStore(
  process.env.UPLOAD_DIR?.trim() || fileURLToPath(new URL("../../uploads", import.meta.url))
);

const people = new PrismaPersonRepository(prisma);
const relations = new PrismaRelationRepository(prisma);
const playlists = new PrismaPlaylistRepository(prisma);
const music = createMusicSource();

/** Entry ids by sample key, for the songs, people and links. */
const ids = new Map<string, string>();
const label = (title: LocalizedText, fallback: string | null) =>
  title.zh ?? title.en ?? Object.values(title).find(Boolean) ?? fallback ?? "";

let added = 0;
try {
  for (const sample of SAMPLES) {
    if (!sources.available()[sample.source]) {
      console.log(`skip  ${sample.sourceId ?? sample.query}: ${sample.source} is not configured`);
      continue;
    }
    const sourceId =
      sample.sourceId ??
      (await sources.search(sample.source, sample.kind, sample.query!))[0]?.sourceId;
    if (!sourceId) {
      console.log(`skip  "${sample.query}": no search result`);
      continue;
    }
    const existing = (await media.findBySource(sample.source, [sourceId])).get(sourceId);
    if (existing) {
      if (sample.key) ids.set(sample.key, existing);
      console.log(`have  ${sample.source} ${sourceId}`);
      continue;
    }
    const row = await importMedia({ media, sources, store }, sample.kind, sample.source, sourceId);
    // Game data is merged into what the source gave (platforms, publishers).
    const { extra, ...patch } = sample.patch;
    await media.update(row.id, {
      ...patch,
      ...(extra
        ? {
            extra: {
              ...row.extra,
              game: { ...(row.extra.game as object | undefined), ...(extra.game as object) }
            }
          }
        : {})
    });
    if (sample.key) ids.set(sample.key, row.id);
    added += 1;
    console.log(`added ${sample.kind.padEnd(5)} ${label(row.title, row.originalTitle)}`);
  }

  // Songs from iTunes, in the player when they have a preview.
  for (const song of SONGS) {
    try {
      // The original recording: the title, by the artist, on the album when given, not another version.
      const hits = (await music.search(song.query, song.country ?? "JP")).filter(
        (hit) =>
          hit.title.includes(song.query.split(" ")[0]!) &&
          hit.artist.includes(song.artist) &&
          (!song.album || hit.album === song.album) &&
          !/ver\.|version|piano|instrumental|サイズ|off vocal|カラオケ/i.test(hit.title)
      );
      const hit = hits[0];
      if (!hit) {
        console.log(`skip  song "${song.query}": no search result`);
        continue;
      }
      const have = (await media.findBySource("itunes", [hit.itunesId])).get(hit.itunesId);
      if (have) {
        ids.set(song.key, have);
        console.log(`have  song ${hit.title}`);
        continue;
      }
      const row = await importItunesSong(
        { media, sources, store, music },
        hit.itunesId,
        song.country ?? "JP"
      );
      ids.set(song.key, row.id);
      added += 1;
      console.log(`added song  ${hit.title} (${hit.artist})`);
    } catch (error) {
      if (!(error instanceof SourceError || error instanceof DuplicateMediaError)) throw error;
      console.log(`skip  song "${song.query}": ${error.message || "already in the collection"}`);
    }
  }

  // A playlist of the songs, in this order; songs already in it keep their place.
  const songIds = SONGS.map((song) => ids.get(song.key)).filter((id): id is string => Boolean(id));
  if (songIds.length) {
    const lists = await playlists.list({ includePrivate: true });
    const playlist =
      lists.find((list) => list.source === "manual" && list.name.zh === "动画歌曲") ??
      (await playlists.create({
        id: randomUUID(),
        name: { zh: "动画歌曲", en: "Anime songs", ja: "アニメソング" },
        description: { zh: "收藏里作品的主题曲和插曲。", en: "Themes and insert songs." },
        source: "manual",
        sourceId: null,
        sourceUrl: null,
        visibility: "public"
      }));
    await playlists.addTracks(playlist.id, songIds);
    console.log(`playlist 动画歌曲: ${songIds.length} songs`);
  }

  // People, matched by name when added by hand before.
  const everyone = await people.list({ includePrivate: true });
  const byName = (name: LocalizedText) =>
    everyone.find((person) =>
      Object.values(name).some((value) => value && Object.values(person.name).includes(value))
    );
  const personIds = new Map<string, string>();
  for (const sample of PEOPLE) {
    let person: PersonRow | undefined;
    if (sample.tmdbId && sources.available().tmdb) {
      const have = (await people.findBySource("tmdb", [sample.tmdbId])).get(sample.tmdbId);
      if (have) person = (await people.get(have)) ?? undefined;
      else {
        const { photoUrl, ...details } = await sources.person(sample.tmdbId);
        const id = randomUUID();
        let photo: StoredImage | null = null;
        if (photoUrl) {
          try {
            photo = await storePoster(
              store,
              id,
              await processImage(await sources.download(photoUrl)),
              "people"
            );
          } catch (error) {
            if (!(error instanceof SourceError || error instanceof InvalidImageError)) throw error;
          }
        }
        person = await people.create({ id, source: "tmdb", ...details, photo });
        added += 1;
        console.log(`added person ${label(person.name, null)} (TMDB)`);
      }
    }
    person ??= byName(sample.name);
    if (!person) {
      person = await people.create({
        id: randomUUID(),
        source: "manual",
        name: sample.name,
        originalName: sample.originalName ?? null
      });
      added += 1;
      console.log(`added person ${label(person.name, null)}`);
    }
    if (sample.featured && !person.featured) await people.update(person.id, { featured: true });
    personIds.set(sample.key, person.id);
  }

  // Links: credits, soundtracks, adaptations, related works. Existing ones are kept.
  const link = async (
    from: { media?: string; person?: string },
    to: string | undefined,
    type: RelationType,
    role: string | null,
    note: LocalizedText = {}
  ) => {
    if (!to || !(from.media ?? from.person)) return;
    const relation = {
      id: randomUUID(),
      fromMediaId: from.media ?? null,
      fromPersonId: from.person ?? null,
      toMediaId: to,
      type,
      role,
      note
    };
    try {
      await relations.create({ ...relation, key: relationKey(relation) });
      added += 1;
    } catch (error) {
      if (!(error instanceof DuplicateRelationError)) throw error;
    }
  };
  for (const sample of PEOPLE)
    for (const credit of sample.credits)
      await link(
        { person: personIds.get(sample.key) },
        ids.get(credit.work),
        "credit",
        credit.role,
        credit.note
      );
  for (const song of SONGS)
    if (song.work)
      await link(
        { media: ids.get(song.key) },
        ids.get(song.work.key),
        "soundtrack",
        song.work.role
      );
  for (const entry of LINKS)
    await link({ media: ids.get(entry.from) }, ids.get(entry.to), entry.type, null, entry.note);

  console.log(`Done: ${added} added.`);
} finally {
  await prisma.$disconnect();
}
