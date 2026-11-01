// Fills the English and French titles of anime already in the collection with their romaji names from
// AniList (new imports get them automatically). Usage: npm run db:backfill:romaji
import "dotenv/config";

import * as http from "node:http";

import { PrismaMediaRepository } from "../media/prisma-repository";
import { createMediaSources } from "../media/sources";
import { createPrismaClient } from "./client";

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
const sources = createMediaSources({});

try {
  const anime = await media.list({ kind: "anime", includePrivate: true });
  for (const row of anime) {
    const native = row.originalTitle ?? row.title.ja;
    const label = row.title.zh ?? native ?? row.id;
    if (!native) {
      console.log(`skip  ${label}: no Japanese title`);
      continue;
    }
    const romaji = await sources.romaji(native, row.year);
    if (!romaji) {
      console.log(`skip  ${label}: not found on AniList`);
      continue;
    }
    if (row.title.en === romaji && row.title.fr === romaji) {
      console.log(`have  ${label}: ${romaji}`);
      continue;
    }
    await media.update(row.id, { title: { ...row.title, en: romaji, fr: romaji } });
    console.log(`set   ${label}: ${romaji}`);
  }
} finally {
  await prisma.$disconnect();
}
