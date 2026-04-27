import { photos as seedPhotos, type Photo } from "@liam-frost/content";
import type { PrismaClient } from "@prisma/client";

import { getPrismaClient } from "./client";

type Logger = {
  warn: (data: unknown, message?: string) => void;
};

type PhotoRecord = {
  id: string;
  title: unknown;
  date: string;
  category: unknown;
  location: unknown | null;
  camera: string | null;
  lens: string | null;
  settings: string | null;
  description: unknown | null;
  tags: unknown;
  src: string;
  alt: unknown;
  width: number;
  height: number;
};

type PhotoDelegate = {
  findMany: (args: unknown) => Promise<PhotoRecord[]>;
  findUnique: (args: unknown) => Promise<PhotoRecord | null>;
};

type PhotoPrismaClient = PrismaClient & {
  photo: PhotoDelegate;
};

function getPhotoDelegate(client: PrismaClient) {
  return (client as PhotoPrismaClient).photo;
}

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
    const records = await getPhotoDelegate(client).findMany({
      where: { visibility: "public" },
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
    const record = await getPhotoDelegate(client).findUnique({
      where: { id }
    });

    return record ? toPhoto(record) : seedPhotos.find((photo) => photo.id === id) ?? null;
  } catch (error) {
    logDatabaseFallback(logger, error);
    return seedPhotos.find((photo) => photo.id === id) ?? null;
  }
}
