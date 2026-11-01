import type { LocalizedText, MediaKind, MediaProgress, MediaSource, MediaStatus } from "@liam-frost/shared";

import { Prisma, type MediaItem, type PrismaClient } from "../generated/prisma/client";
import type { StoredImage } from "../projects/types";
import { DuplicateMediaError, type MediaPatch, type MediaRepository, type MediaRow, type NewMedia } from "./types";

const ORDER = [{ watchedOn: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }] satisfies Prisma.MediaItemOrderByWithRelationInput[];

const KIND_TO_DB = { movie: "MOVIE", tv: "TV", anime: "ANIME", book: "BOOK", comic: "COMIC", game: "GAME", track: "TRACK", album: "ALBUM" } as const;
const KIND_FROM_DB: Record<MediaItem["kind"], MediaKind> = {
  MOVIE: "movie",
  TV: "tv",
  ANIME: "anime",
  BOOK: "book",
  COMIC: "comic",
  GAME: "game",
  TRACK: "track",
  ALBUM: "album"
};
const STATUS_TO_DB = { want: "WANT", watching: "WATCHING", done: "DONE", dropped: "DROPPED" } as const;
const STATUS_FROM_DB: Record<NonNullable<MediaItem["status"]>, MediaStatus> = { WANT: "want", WATCHING: "watching", DONE: "done", DROPPED: "dropped" };

function toRow(record: MediaItem): MediaRow {
  return {
    ...record,
    kind: KIND_FROM_DB[record.kind],
    source: record.source as MediaSource,
    title: record.title as LocalizedText,
    genres: record.genres as LocalizedText[],
    credits: record.credits as string[],
    overview: record.overview as LocalizedText,
    poster: record.poster as StoredImage | null,
    status: record.status ? STATUS_FROM_DB[record.status] : null,
    review: record.review as LocalizedText,
    progress: record.progress as MediaProgress | null,
    extra: record.extra as Record<string, unknown>,
    visibility: record.visibility === "PRIVATE" ? "private" : "public"
  };
}

/** Nullable Json columns need Prisma.DbNull; a plain null is rejected. */
const json = (value: unknown) => (value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue));

function toData(patch: MediaPatch): Prisma.MediaItemUpdateInput {
  const { poster, progress, status, visibility, extra, ...rest } = patch;
  const data: Prisma.MediaItemUpdateInput = { ...rest };
  if (poster !== undefined) data.poster = json(poster);
  if (progress !== undefined) data.progress = json(progress);
  if (extra !== undefined) data.extra = extra as Prisma.InputJsonValue;
  if (status !== undefined) data.status = status ? STATUS_TO_DB[status] : null;
  if (visibility !== undefined) data.visibility = visibility === "private" ? "PRIVATE" : "PUBLIC";
  return data;
}

const isUniqueConflict = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
const isMissing = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list({ kind, includePrivate = false }: { kind?: MediaKind; includePrivate?: boolean } = {}) {
    const records = await this.prisma.mediaItem.findMany({
      where: { ...(kind ? { kind: KIND_TO_DB[kind] } : {}), ...(includePrivate ? {} : { visibility: "PUBLIC" }) },
      orderBy: ORDER
    });
    return records.map(toRow);
  }

  async get(id: string) {
    const record = await this.prisma.mediaItem.findUnique({ where: { id } });
    return record ? toRow(record) : null;
  }

  async findBySource(source: MediaSource, sourceIds: string[]) {
    if (!sourceIds.length) return new Map<string, string>();
    const records = await this.prisma.mediaItem.findMany({ where: { source, sourceId: { in: sourceIds } }, select: { id: true, sourceId: true } });
    return new Map(records.map((record) => [record.sourceId!, record.id]));
  }

  async imageAccess(id: string) {
    const record = await this.prisma.mediaItem.findUnique({ where: { id }, select: { kind: true, status: true, visibility: true, poster: true } });
    if (!record) return null;
    return {
      kind: KIND_FROM_DB[record.kind],
      status: record.status ? STATUS_FROM_DB[record.status] : null,
      visibility: record.visibility === "PRIVATE" ? ("private" as const) : ("public" as const),
      poster: record.poster as StoredImage | null
    };
  }

  async create(item: NewMedia) {
    const { kind, status, visibility, poster, progress, extra, ...rest } = item;
    try {
      const record = await this.prisma.mediaItem.create({
        data: {
          genres: [],
          credits: [],
          overview: {},
          review: {},
          ...rest,
          kind: KIND_TO_DB[kind],
          status: status ? STATUS_TO_DB[status] : null,
          visibility: visibility === "private" ? "PRIVATE" : "PUBLIC",
          poster: json(poster ?? null),
          progress: json(progress ?? null),
          extra: (extra ?? {}) as Prisma.InputJsonValue
        }
      });
      return toRow(record);
    } catch (error) {
      if (isUniqueConflict(error)) throw new DuplicateMediaError();
      throw error;
    }
  }

  async update(id: string, patch: MediaPatch) {
    try {
      return toRow(await this.prisma.mediaItem.update({ where: { id }, data: toData(patch) }));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async delete(id: string) {
    try {
      return toRow(await this.prisma.mediaItem.delete({ where: { id } }));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }
}
