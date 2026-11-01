import type { LocalizedText } from "@liam-frost/shared";

import type { Playlist, PlaylistTrack, PrismaClient } from "../generated/prisma/client";
import type { NewPlaylist, PlaylistPatch, PlaylistRepository, PlaylistRow } from "./types";

const WITH_TRACKS = {
  tracks: { orderBy: { position: "asc" }, select: { mediaId: true } }
} as const;

function toRow(record: Playlist & { tracks: Pick<PlaylistTrack, "mediaId">[] }): PlaylistRow {
  return {
    id: record.id,
    name: record.name as LocalizedText,
    description: record.description as LocalizedText,
    source: record.source as PlaylistRow["source"],
    sourceId: record.sourceId,
    sourceUrl: record.sourceUrl,
    visibility: record.visibility === "PRIVATE" ? "private" : "public",
    trackIds: record.tracks.map((track) => track.mediaId),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export class PrismaPlaylistRepository implements PlaylistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list({ includePrivate = false }: { includePrivate?: boolean } = {}) {
    const records = await this.prisma.playlist.findMany({
      where: includePrivate ? {} : { visibility: "PUBLIC" },
      include: WITH_TRACKS,
      orderBy: { createdAt: "desc" }
    });
    return records.map(toRow);
  }

  async get(id: string) {
    const record = await this.prisma.playlist.findUnique({ where: { id }, include: WITH_TRACKS });
    return record ? toRow(record) : null;
  }

  async findBySource(source: PlaylistRow["source"], sourceId: string) {
    const record = await this.prisma.playlist.findUnique({
      where: { source_sourceId: { source, sourceId } },
      include: WITH_TRACKS
    });
    return record ? toRow(record) : null;
  }

  async create({ visibility, ...playlist }: NewPlaylist) {
    const record = await this.prisma.playlist.create({
      data: {
        description: {},
        ...playlist,
        visibility: visibility === "private" ? "PRIVATE" : "PUBLIC"
      },
      include: WITH_TRACKS
    });
    return toRow(record);
  }

  async update(id: string, { visibility, ...patch }: PlaylistPatch) {
    const found = await this.prisma.playlist.findUnique({ where: { id }, select: { id: true } });
    if (!found) return null;
    const record = await this.prisma.playlist.update({
      where: { id },
      data: {
        ...patch,
        ...(visibility ? { visibility: visibility === "private" ? "PRIVATE" : "PUBLIC" } : {})
      },
      include: WITH_TRACKS
    });
    return toRow(record);
  }

  async delete(id: string) {
    const current = await this.get(id);
    if (!current) return null;
    await this.prisma.playlist.delete({ where: { id } });
    return current;
  }

  async addTracks(id: string, mediaIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const playlist = await tx.playlist.findUnique({
        where: { id },
        include: { tracks: { select: { mediaId: true, position: true } } }
      });
      if (!playlist) return null;
      const present = new Set(playlist.tracks.map((track) => track.mediaId));
      let position = Math.max(-1, ...playlist.tracks.map((track) => track.position));
      const added = [...new Set(mediaIds)].filter((mediaId) => !present.has(mediaId));
      if (added.length)
        await tx.playlistTrack.createMany({
          data: added.map((mediaId) => ({ playlistId: id, mediaId, position: (position += 1) }))
        });
      await tx.playlist.update({ where: { id }, data: { updatedAt: new Date() } });
      return toRow((await tx.playlist.findUnique({ where: { id }, include: WITH_TRACKS }))!);
    });
  }

  async removeTracks(id: string, mediaIds: string[]) {
    const found = await this.prisma.playlist.findUnique({ where: { id }, select: { id: true } });
    if (!found) return null;
    await this.prisma.playlistTrack.deleteMany({
      where: { playlistId: id, mediaId: { in: mediaIds } }
    });
    return this.get(id);
  }

  async reorder(id: string, mediaIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.playlist.findUnique({ where: { id }, select: { id: true } });
      if (!found) return null;
      for (const [position, mediaId] of mediaIds.entries()) {
        await tx.playlistTrack.update({
          where: { playlistId_mediaId: { playlistId: id, mediaId } },
          data: { position }
        });
      }
      return toRow((await tx.playlist.findUnique({ where: { id }, include: WITH_TRACKS }))!);
    });
  }
}
