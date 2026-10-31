// Development helper: fills the collection with sample films, series and anime imported from TMDB and
// Bangumi, with ratings, reviews and statuses covering what the site shows. Entries already in the
// collection are skipped, so it can be run again. Usage: npm run db:seed:collection
import "dotenv/config";

import * as http from "node:http";
import { fileURLToPath } from "node:url";

import type { MediaKind } from "@liam-frost/shared";

import { importMedia } from "../media/import";
import { PrismaMediaRepository } from "../media/prisma-repository";
import { createMediaSources, type SearchSource } from "../media/sources";
import type { MediaPatch } from "../media/types";
import { LocalImageStore } from "../storage/local";
import { createPrismaClient } from "./client";

type Sample = { kind: MediaKind; source: SearchSource; sourceId?: string; query?: string; patch: MediaPatch };

const SAMPLES: Sample[] = [
  {
    kind: "movie",
    source: "tmdb",
    sourceId: "movie:129",
    patch: {
      rating: 5,
      watchedOn: "2026-10-20",
      rewatchCount: 3,
      featured: true,
      review: { zh: "每次重看都能发现新的细节。\n汤屋的夜景永远看不腻。", en: "Something new on every rewatch." }
    }
  },
  { kind: "movie", source: "tmdb", sourceId: "movie:4935", patch: { rating: 4, watchedOn: "2026-09-02" } },
  { kind: "movie", source: "tmdb", sourceId: "movie:496243", patch: { rating: 5, watchedOn: "2026-08-15", review: { zh: "后半段一直坐立不安。" } } },
  { kind: "movie", source: "tmdb", sourceId: "movie:194", patch: { rating: 4, watchedOn: "2026-05-03", review: { fr: "Un conte de Paris plein de charme." } } },
  { kind: "movie", source: "tmdb", sourceId: "movie:27205", patch: { status: "want" } },
  // Hidden: must not appear on the site.
  { kind: "movie", source: "tmdb", sourceId: "movie:157336", patch: { rating: 5, watchedOn: "2026-04-11", visibility: "private" } },
  { kind: "tv", source: "tmdb", sourceId: "tv:64010", patch: { rating: 5, watchedOn: "2026-07-01", review: { zh: "看完像告别了一整条街坊。" } } },
  { kind: "tv", source: "tmdb", sourceId: "tv:1396", patch: { status: "watching", rating: 4, progress: { watched: 30, total: 62 } } },
  { kind: "tv", source: "tmdb", sourceId: "tv:42009", patch: { status: "dropped", rating: 3, progress: { watched: 7, total: null } } },
  {
    kind: "anime",
    source: "bangumi",
    sourceId: "328609",
    patch: { rating: 5, watchedOn: "2026-10-28", featured: true, review: { zh: "社恐吉他手，太真实了。", ja: "リアルすぎる。" } }
  },
  { kind: "anime", source: "bangumi", sourceId: "400602", patch: { status: "watching", rating: 4, progress: { watched: 10, total: 28 } } },
  { kind: "anime", source: "tmdb", sourceId: "movie:372058", patch: { rating: 4, watchedOn: "2026-06-12" } },
  { kind: "anime", source: "bangumi", query: "进击的巨人", patch: { status: "want" } }
];

// Like the server: honour HTTPS_PROXY for TMDB / Bangumi when set.
const setGlobalProxyFromEnv = (http as { setGlobalProxyFromEnv?: () => void }).setGlobalProxyFromEnv;
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && typeof setGlobalProxyFromEnv === "function") setGlobalProxyFromEnv();

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required (see apps/api/.env.example)");

const prisma = createPrismaClient(databaseUrl);
const media = new PrismaMediaRepository(prisma);
const sources = createMediaSources({ tmdbKey: process.env.TMDB_API_KEY });
const store = new LocalImageStore(process.env.UPLOAD_DIR?.trim() || fileURLToPath(new URL("../../uploads", import.meta.url)));

let added = 0;
try {
  for (const sample of SAMPLES) {
    if (sample.source === "tmdb" && !sources.available().tmdb) {
      console.log(`skip  ${sample.sourceId}: TMDB_API_KEY is not set`);
      continue;
    }
    const sourceId = sample.sourceId ?? (await sources.search(sample.source, sample.kind, sample.query!))[0]?.sourceId;
    if (!sourceId) {
      console.log(`skip  "${sample.query}": no search result`);
      continue;
    }
    if ((await media.findBySource(sample.source, [sourceId])).size) {
      console.log(`have  ${sample.source} ${sourceId}`);
      continue;
    }
    const row = await importMedia({ media, sources, store }, sample.kind, sample.source, sourceId);
    await media.update(row.id, sample.patch);
    added += 1;
    console.log(`added ${sample.kind.padEnd(5)} ${row.title.zh ?? row.title.en ?? row.originalTitle}`);
  }
  console.log(`Done: ${added} added.`);
} finally {
  await prisma.$disconnect();
}
