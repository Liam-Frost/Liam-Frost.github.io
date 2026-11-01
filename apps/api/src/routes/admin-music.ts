import type {
  AdminMediaResponse,
  AdminMusicSearchResponse,
  MusicImportJob
} from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";

import type { AdminAuthService } from "../auth/service";
import { HttpError, notFound } from "../lib/errors";
import {
  musicAccountImportSchema,
  musicImportSchema,
  musicJobParamsSchema,
  musicSearchQuerySchema,
  parseInput,
  playlistImportSchema
} from "../lib/validation";
import type { MusicSource } from "../media/itunes";
import { toAdminMedia } from "../media/mapping";
import { ImportBusyError, importItunesSong, type MusicImports } from "../media/music-import";
import { SourceError, type MediaSources } from "../media/sources";
import { DuplicateMediaError, type MediaRepository } from "../media/types";
import { PlaylistError } from "../spotify/playlist";
import type { LocalImageStore } from "../storage/local";

/** Songs in the collection: iTunes search and import, and Spotify playlist imports (background jobs). */
export function registerAdminMusicRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  deps: {
    media: MediaRepository | null;
    sources: MediaSources;
    music: MusicSource;
    store: LocalImageStore;
    imports: MusicImports | null;
  }
) {
  const admin = { preHandler: auth.requireAdmin };
  const repo = () => {
    if (!deps.media || !deps.imports)
      throw new HttpError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "The collection needs a database (set DATABASE_URL)"
      );
    return { media: deps.media, imports: deps.imports };
  };
  const sourceFailure = (error: unknown): never => {
    if (error instanceof SourceError || error instanceof PlaylistError)
      throw new HttpError(502, "SOURCE_ERROR", error.message);
    throw error;
  };

  app.get("/api/admin/music/search", admin, async (request): Promise<AdminMusicSearchResponse> => {
    const { q, country } = parseInput(musicSearchQuerySchema, request.query);
    const songs = await deps.music.search(q, country).catch(sourceFailure);
    const existing = await repo().media.findBySource(
      "itunes",
      songs.map((song) => song.itunesId)
    );
    return {
      results: songs.map(({ artworkLarge: _large, genre: _genre, ...song }) => ({
        ...song,
        existingId: existing.get(song.itunesId) ?? null
      }))
    };
  });

  app.post(
    "/api/admin/music/import",
    admin,
    async (request, reply): Promise<AdminMediaResponse> => {
      const { itunesId, country } = parseInput(musicImportSchema, request.body);
      try {
        const row = await importItunesSong(
          { media: repo().media, sources: deps.sources, music: deps.music, store: deps.store },
          itunesId,
          country
        );
        reply.code(201);
        return { item: toAdminMedia(row, deps.store) };
      } catch (error) {
        if (error instanceof DuplicateMediaError)
          throw new HttpError(409, "MEDIA_EXISTS", "This song is already in the collection");
        return sourceFailure(error);
      }
    }
  );

  const startJob = (start: () => MusicImportJob) => {
    try {
      return { job: start() };
    } catch (error) {
      if (error instanceof PlaylistError) throw new HttpError(400, "VALIDATION", error.message);
      if (error instanceof ImportBusyError) throw new HttpError(409, "IMPORT_BUSY", error.message);
      throw error;
    }
  };

  /** Starts importing a public Spotify playlist from its link (or returns that import if it is running). */
  app.post(
    "/api/admin/music/playlist-import",
    admin,
    async (request, reply): Promise<{ job: MusicImportJob }> => {
      const { playlistUrl } = parseInput(playlistImportSchema, request.body);
      const result = startJob(() => repo().imports.startPlaylistLink(playlistUrl));
      reply.code(202);
      return result;
    }
  );

  /** Starts importing the connected account's Liked Songs or one of its playlists. */
  app.post(
    "/api/admin/music/spotify-import",
    admin,
    async (request, reply): Promise<{ job: MusicImportJob }> => {
      const body = parseInput(musicAccountImportSchema, request.body);
      const result = startJob(() => repo().imports.startAccount(body));
      reply.code(202);
      return result;
    }
  );

  app.get("/api/admin/music/jobs/:id", admin, async (request): Promise<{ job: MusicImportJob }> => {
    const { id } = parseInput(musicJobParamsSchema, request.params);
    const job = repo().imports.get(id);
    if (!job) throw notFound("Import not found");
    return { job };
  });
}
