import "dotenv/config";

import { photos } from "@liam-frost/content";

import { Prisma } from "../generated/prisma/client";
import { createPrismaClient } from "./client";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database (see apps/api/.env.example)");
}

const prisma = createPrismaClient(databaseUrl);

async function main() {
  for (const [index, photo] of photos.entries()) {
    // Nullable Json columns need Prisma.DbNull; a plain null is rejected.
    const data: Prisma.PhotoCreateInput = {
      id: photo.id,
      slug: photo.id,
      title: photo.title,
      date: photo.date,
      category: photo.category,
      location: photo.location ?? Prisma.DbNull,
      camera: photo.camera ?? null,
      lens: photo.lens ?? null,
      settings: photo.settings ?? null,
      description: photo.description ?? Prisma.DbNull,
      tags: photo.tags,
      src: photo.src,
      alt: photo.alt,
      width: photo.width,
      height: photo.height,
      visibility: "PUBLIC",
      sortOrder: index
    };

    await prisma.photo.upsert({
      where: { id: photo.id },
      update: data,
      create: data
    });
  }
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

await run();
