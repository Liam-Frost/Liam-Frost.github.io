import type {
  AdminPlaylist,
  AdminPlaylistResponse,
  AdminPlaylistsResponse
} from "@liam-frost/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";

import type { AdminAuthService } from "../auth/service";
import { badRequest, HttpError, notFound } from "../lib/errors";
import { KeyedLock } from "../lib/keyed-lock";
import {
  parseInput,
  playlistCreateSchema,
  playlistIdSchema,
  playlistOrderSchema,
  playlistTracksSchema,
  playlistUpdateSchema
} from "../lib/validation";
import type { MediaRepository } from "../media/types";
import type { PlaylistRepository, PlaylistRow } from "../playlists/types";

export function toAdminPlaylist(row: PlaylistRow): AdminPlaylist {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    source: row.source,
    sourceUrl: row.sourceUrl,
    visibility: row.visibility,
    trackIds: row.trackIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

/** Playlists of songs: create, rename, hide, delete, add and remove songs, reorder. */
export function registerAdminPlaylistRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  deps: { media: MediaRepository | null; playlists: PlaylistRepository | null }
) {
  const repo = () => {
    if (!deps.media || !deps.playlists)
      throw new HttpError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "Playlists need a database (set DATABASE_URL)"
      );
    return { media: deps.media, playlists: deps.playlists };
  };
  const admin = { preHandler: auth.requireAdmin };
  const playlistId = (request: FastifyRequest) => parseInput(playlistIdSchema, request.params).id;
  const found = (row: PlaylistRow | null): AdminPlaylistResponse => {
    if (!row) throw notFound("Playlist not found");
    return { playlist: toAdminPlaylist(row) };
  };
  // Track changes read the playlist and write it back; one at a time per playlist.
  const lock = new KeyedLock();

  app.get("/api/admin/playlists", admin, async (): Promise<AdminPlaylistsResponse> => ({
    playlists: (await repo().playlists.list({ includePrivate: true })).map(toAdminPlaylist)
  }));

  app.post(
    "/api/admin/playlists",
    admin,
    async (request, reply): Promise<AdminPlaylistResponse> => {
      const { name, description } = parseInput(playlistCreateSchema, request.body);
      const row = await repo().playlists.create({
        id: randomUUID(),
        name,
        description: description ?? {},
        source: "manual"
      });
      reply.code(201);
      return found(row);
    }
  );

  app.get("/api/admin/playlists/:id", admin, async (request) =>
    found(await repo().playlists.get(playlistId(request)))
  );

  app.patch("/api/admin/playlists/:id", admin, async (request) => {
    const id = playlistId(request);
    const patch = parseInput(playlistUpdateSchema, request.body);
    return found(await repo().playlists.update(id, patch));
  });

  app.delete("/api/admin/playlists/:id", admin, async (request, reply) => {
    if (!(await repo().playlists.delete(playlistId(request)))) throw notFound("Playlist not found");
    return reply.code(204).send();
  });

  /** Adds songs to the end (songs already in it stay where they are), or removes them. */
  app.post("/api/admin/playlists/:id/tracks", admin, async (request) => {
    const id = playlistId(request);
    const { action, ids } = parseInput(playlistTracksSchema, request.body);
    const { media, playlists } = repo();
    return lock.run(id, async () => {
      if (action === "remove") return found(await playlists.removeTracks(id, ids));
      const rows = await Promise.all(ids.map((mediaId) => media.get(mediaId)));
      const notSongs = ids.filter((_, index) => rows[index]?.kind !== "track");
      if (notSongs.length)
        throw badRequest(
          `Only songs go in playlists (${notSongs.length} of ${ids.length} are not songs)`,
          "VALIDATION"
        );
      return found(await playlists.addTracks(id, ids));
    });
  });

  /** Puts the playlist's songs in the given order; the ids must be exactly its songs. */
  app.put("/api/admin/playlists/:id/order", admin, async (request) => {
    const id = playlistId(request);
    const { ids } = parseInput(playlistOrderSchema, request.body);
    const { playlists } = repo();
    return lock.run(id, async () => {
      const current = await playlists.get(id);
      if (!current) throw notFound("Playlist not found");
      const same =
        ids.length === current.trackIds.length &&
        ids.every((mediaId) => current.trackIds.includes(mediaId));
      if (!same) throw badRequest("The order must list exactly the playlist's songs", "VALIDATION");
      return found(await playlists.reorder(id, ids));
    });
  });
}
