import { photos as seedPhotos, type Photo } from "@liam-frost/content";

import type { Photo as PhotoRecord } from "../generated/prisma/client";
import { getPrismaClient } from "./client";

type Logger = {
  warn: (data: unknown, message?: string) => void;
};

function localized(value: unknown) {
  return value as Photo["title"];
}

function tags(value: unknown) {
  return value as Photo["tags"];
}

function toPhoto(record: PhotoRecord): Photo {
  return {
    id: record.id,
    title: localized(record.title),
    date: record.date,
    category: localized(record.category),
    location: record.location ? localized(record.location) : undefined,
    camera: record.camera ?? undefined,
    lens: record.lens ?? undefined,
    settings: record.settings ?? undefined,
    description: record.description ? localized(record.description) : undefined,
    tags: tags(record.tags),
    src: record.src,
    alt: localized(record.alt),
    width: record.width,
    height: record.height
  };
}

function logDatabaseFallback(logger: Logger | undefined, error: unknown) {
  logger?.warn({ error }, "Photo database unavailable; using seed photo data");
}

export async function listPhotos(logger?: Logger): Promise<Photo[]> {
  const client = getPrismaClient();
  if (!client) {
    return seedPhotos;
  }

  try {
    const records = await client.photo.findMany({
      where: { visibility: "PUBLIC" },
      orderBy: [{ sortOrder: "asc" }, { date: "desc" }, { id: "asc" }]
    });

    return records.length ? records.map(toPhoto) : seedPhotos;
  } catch (error) {
    logDatabaseFallback(logger, error);
    return seedPhotos;
  }
}

export async function getPhoto(id: string, logger?: Logger): Promise<Photo | null> {
  const client = getPrismaClient();
  if (!client) {
    return seedPhotos.find((photo) => photo.id === id) ?? null;
  }

  try {
    const record = await client.photo.findUnique({
      where: { id }
    });

    return record ? toPhoto(record) : seedPhotos.find((photo) => photo.id === id) ?? null;
  } catch (error) {
    logDatabaseFallback(logger, error);
    return seedPhotos.find((photo) => photo.id === id) ?? null;
  }
}
