import "dotenv/config";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import * as http from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";

import { ContentCatalog } from "./analytics/catalog";
import { createCountryLookup } from "./analytics/geo";
import { PrismaAnalyticsStore } from "./analytics/prisma-store";
import { AnalyticsService } from "./analytics/service";
import { RequestRecorder, SystemLog, withSourceLog } from "./analytics/system";
import { AnalyticsClock } from "./analytics/time";
import type { AnalyticsStore } from "./analytics/types";
import { AdminAuthService } from "./auth/service";
import { ConfigError, loadConfig, type AppConfig } from "./config/env";
import { DashboardService } from "./dashboard/service";
import { getPrismaClient, hasDatabaseUrl } from "./db/client";
import { HttpError, isDatabaseUnavailable, notFound } from "./lib/errors";
import { registerAdminRoutes } from "./routes/admin";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerAdminApp } from "./routes/admin-app";
import { registerAdminDashboardRoutes } from "./routes/admin-dashboard";
import { registerAdminPhotoRoutes } from "./routes/admin-photos";
import { registerAdminMediaRoutes } from "./routes/admin-media";
import { registerAdminMusicRoutes } from "./routes/admin-music";
import { registerAdminPeopleRoutes } from "./routes/admin-people";
import {
  AutomaticRelations,
  withAutomaticMedia,
  withAutomaticPeople
} from "./people/automatic-relations";
import { registerAdminPlaylistRoutes } from "./routes/admin-playlists";
import { registerAdminProjectRoutes } from "./routes/admin-projects";
import { registerCollectionRoutes } from "./routes/collection";
import { registerPhotoRoutes } from "./routes/photos";
import { registerProjectRoutes } from "./routes/projects";
import { registerSpotifyRoutes } from "./routes/spotify";
import { registerSteamRoutes } from "./routes/steam";
import { registerUploadRoutes } from "./routes/uploads";
import { registerWebApp } from "./routes/web-app";
import { CollectionSettingsStore } from "./media/collection-settings";
import { createMusicSource, type MusicSource } from "./media/itunes";
import { MusicImports } from "./media/music-import";
import { SpotifyAccount } from "./spotify/account";
import { SteamAccount } from "./steam/account";
import { SteamSync } from "./steam/sync";
import { PrismaMediaRepository } from "./media/prisma-repository";
import { createMediaSources, type MediaSources } from "./media/sources";
import type { MediaRepository } from "./media/types";
import { PrismaPersonRepository, PrismaRelationRepository } from "./people/prisma-repository";
import type { PersonRepository, RelationRepository } from "./people/types";
import { PrismaPlaylistRepository } from "./playlists/prisma-repository";
import type { PlaylistRepository } from "./playlists/types";
import { PhotoSources } from "./photos/photo-sources";
import { PrismaPhotoRepository } from "./photos/prisma-repository";
import type { PhotoRepository } from "./photos/types";
import { PrismaProjectRepository } from "./projects/prisma-repository";
import type { ProjectRepository } from "./projects/types";
import { PrismaSettingsRepository } from "./settings/prisma-repository";
import { MemorySettingsRepository, type SettingsRepository } from "./settings/types";
import { IntegrationSettings } from "./settings/integrations";
import { AnalyticsSettings } from "./settings/analytics";
import { liveService } from "./settings/live-service";
import { registerIntegrationRoutes } from "./routes/integrations";
import { createPlaylistFetcher, fetchTrackPreview, type PlaylistFetcher } from "./spotify/playlist";
import { SpotifyService } from "./spotify/service";
import { LocalImageStore } from "./storage/local";

/** apps/admin/dist relative to this file (apps/api/src). */
const DEFAULT_ADMIN_DIST_DIR = fileURLToPath(new URL("../../admin/dist", import.meta.url));
/** apps/web/dist relative to this file (apps/api/src, or apps/api/dist when built). */
const DEFAULT_WEB_DIST_DIR = fileURLToPath(new URL("../../web/dist", import.meta.url));
/** apps/api/uploads, used when UPLOAD_DIR is not set. */
const DEFAULT_UPLOAD_DIR = fileURLToPath(new URL("../uploads", import.meta.url));

/** The Prisma-backed photo store when DATABASE_URL is set, otherwise none (public routes use seed data). */
function defaultPhotoRepository(): PhotoRepository | null {
  const client = getPrismaClient();
  return client ? new PrismaPhotoRepository(client) : null;
}

/** The Prisma-backed project store when DATABASE_URL is set, otherwise none (no projects are shown). */
function defaultProjectRepository(): ProjectRepository | null {
  const client = getPrismaClient();
  return client ? new PrismaProjectRepository(client) : null;
}

/** The Prisma-backed collection when DATABASE_URL is set, otherwise none. */
function defaultMediaRepository(): MediaRepository | null {
  const client = getPrismaClient();
  return client ? new PrismaMediaRepository(client) : null;
}

/** Prisma-backed people when DATABASE_URL is set, otherwise none. */
function defaultPersonRepository(): PersonRepository | null {
  const client = getPrismaClient();
  return client ? new PrismaPersonRepository(client) : null;
}

/** Prisma-backed links between entries and people when DATABASE_URL is set, otherwise none. */
function defaultRelationRepository(): RelationRepository | null {
  const client = getPrismaClient();
  return client ? new PrismaRelationRepository(client) : null;
}

/** Prisma-backed playlists when DATABASE_URL is set, otherwise none. */
function defaultPlaylistRepository(): PlaylistRepository | null {
  const client = getPrismaClient();
  return client ? new PrismaPlaylistRepository(client) : null;
}

/** Prisma-backed visitor analytics when DATABASE_URL is set, otherwise none (events are dropped). */
function defaultAnalyticsStore(): AnalyticsStore | null {
  const client = getPrismaClient();
  return client ? new PrismaAnalyticsStore(client) : null;
}

/** Prisma-backed settings when DATABASE_URL is set, otherwise none (defaults, kept in memory). */
function defaultSettingsRepository(): SettingsRepository | null {
  const client = getPrismaClient();
  return client ? new PrismaSettingsRepository(client) : null;
}

export type BuildServerOptions = {
  /** Per-IP requests per minute, shared across routes; defaults to 600. */
  requestLimit?: number;
  config?: AppConfig;
  logger?: boolean;
  /** Where the admin app build lives; defaults to apps/admin/dist. */
  adminDistDir?: string;
  /** Where the public site build lives; defaults to apps/web/dist. */
  webDistDir?: string;
  /** Photo storage; defaults to Prisma when DATABASE_URL is set. Pass null for none. */
  photos?: PhotoRepository | null;
  /** Project storage; defaults to Prisma when DATABASE_URL is set. Pass null for none. */
  projects?: ProjectRepository | null;
  /** Collection storage; defaults to Prisma when DATABASE_URL is set. Pass null for none. */
  media?: MediaRepository | null;
  /** People; defaults to Prisma when DATABASE_URL is set. Pass null for none. */
  people?: PersonRepository | null;
  /** Links between entries and people; defaults to Prisma when DATABASE_URL is set. Pass null for none. */
  relations?: RelationRepository | null;
  /** Playlists; defaults to Prisma when DATABASE_URL is set. Pass null for none. */
  playlists?: PlaylistRepository | null;
  /** Visitor analytics; defaults to Prisma when DATABASE_URL is set. Pass null for none. */
  analyticsStore?: AnalyticsStore | null;
  /** The analytics clock; defaults to the real time. */
  now?: () => Date;
  /** TMDB / Bangumi access; defaults to the real services. */
  mediaSources?: MediaSources;
  /** Settings storage; defaults to Prisma when DATABASE_URL is set. Pass null for none. */
  settings?: SettingsRepository | null;
  /** Spotify Web API access; defaults to one built from the config. */
  spotifyAccount?: SpotifyAccount;
  /** Steam sign-in and library; defaults to one built from the config. */
  steamAccount?: SteamAccount;
  /** Downloads of photo links (and Flickr lookups); defaults to fetch. */
  photoFetch?: typeof fetch;
  /** Host name resolution for photo links; defaults to DNS. */
  photoLookup?: (host: string) => Promise<string[]>;
  /** Requests to Steam (sign-in check, Web API, store); defaults to fetch. */
  steamFetch?: typeof fetch;
  /** One track's Spotify preview; defaults to its embed page. */
  trackPreview?: (trackId: string) => Promise<string | null>;
  /** iTunes song search; defaults to the real service. */
  musicSource?: MusicSource;
  /** Loads Spotify playlists for imports; defaults to Spotify's embed page. */
  fetchPlaylist?: PlaylistFetcher;
};

export async function buildServer({
  requestLimit = 600,
  config = loadConfig(),
  logger = true,
  adminDistDir = DEFAULT_ADMIN_DIST_DIR,
  webDistDir = DEFAULT_WEB_DIST_DIR,
  photos = defaultPhotoRepository(),
  projects = defaultProjectRepository(),
  media = defaultMediaRepository(),
  people = defaultPersonRepository(),
  relations = defaultRelationRepository(),
  playlists = defaultPlaylistRepository(),
  analyticsStore = defaultAnalyticsStore(),
  now,
  mediaSources,
  settings = defaultSettingsRepository(),
  fetchPlaylist = createPlaylistFetcher(),
  musicSource = createMusicSource(),
  spotifyAccount,
  steamAccount,
  steamFetch = fetch,
  photoFetch,
  photoLookup,
  trackPreview = (trackId: string) => fetchTrackPreview(trackId)
}: BuildServerOptions = {}) {
  const app = Fastify({
    logger: logger && {
      // Never log credentials or session cookies.
      redact: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]']
    },
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 1024
  });

  const auth = new AdminAuthService(config.admin);
  const integrations = new IntegrationSettings(settings, config);
  await integrations.refresh();
  const requireAdmin = auth.requireAdmin;
  auth.requireAdmin = async (request) => {
    await requireAdmin(request);
    await integrations.refresh();
  };
  // OAuth callbacks are authorized by a one-time state rather than the admin session.
  app.addHook("preHandler", async (request) => {
    if (
      ["/api/admin/spotify/callback", "/api/admin/steam/callback"].includes(
        request.routeOptions.url ?? ""
      )
    )
      await integrations.refresh();
  });
  const activeSources = mediaSources ?? liveService(() => integrations.media(), createMediaSources);
  const store = new LocalImageStore(config.uploads.dir ?? DEFAULT_UPLOAD_DIR);
  const collection = settings ? new CollectionSettingsStore(settings) : null;
  const account =
    spotifyAccount ??
    liveService(
      () => integrations.spotify(),
      (app) => new SpotifyAccount(app, settings, config.admin.sessionSecret)
    );
  const steam =
    steamAccount ??
    liveService(
      () => integrations.values("steam").apiKey ?? "",
      (key) => new SteamAccount(key, settings, steamFetch)
    );
  const analyticsSettings = new AnalyticsSettings(settings, config.analytics, store.root);
  await analyticsSettings.load();
  const geo = liveService(
    () => ({
      header: analyticsSettings.config.countryHeader,
      geoipDb: analyticsSettings.config.geoipDb
    }),
    (options) =>
      createCountryLookup(options, (error) =>
        app.log.warn({ err: error }, "Cannot open analytics country database")
      )
  );
  const catalog = new ContentCatalog({ projects, photos, media, people, playlists }, () =>
    (now ? now() : new Date()).getTime()
  );
  const analytics = analyticsStore
    ? new AnalyticsService(analyticsStore, analyticsSettings.config, geo, now, catalog)
    : null;
  if (analytics) {
    const enabled = analytics.isEnabled.bind(analytics);
    analytics.isEnabled = async () => analyticsSettings.error === null && (await enabled());
  }
  // The job log, source status and API timings under 统计 → 体验与运行.
  const systemLog =
    analyticsStore && analytics
      ? new SystemLog(
          analyticsStore,
          now,
          (error) => app.log.warn({ err: error }, "Cannot write the analytics job log"),
          () => analytics.isEnabled()
        )
      : null;
  const requests =
    analytics && analyticsStore
      ? new RequestRecorder(analyticsStore, analytics.clock, now, () => analytics.isEnabled())
      : null;
  const sources = systemLog ? withSourceLog(activeSources, systemLog) : activeSources;
  const automaticRelations =
    media && people && relations ? new AutomaticRelations(media, people, relations, sources) : null;
  const automaticRelationError = (error: unknown) =>
    app.log.warn({ err: error }, "Automatic credits unavailable; retry from the person's links");
  if (automaticRelations && media && people) {
    media = withAutomaticMedia(media, automaticRelations, automaticRelationError);
    people = withAutomaticPeople(people, automaticRelations, automaticRelationError);
  }
  const spotify = new SpotifyService(
    settings ?? new MemorySettingsRepository(),
    media,
    collection,
    store,
    playlists
  );
  if (analytics) {
    // Hourly: write the totals of finished days and delete raw data past the retention period.
    const maintain = () =>
      (analyticsSettings.error ? Promise.resolve() : analytics.maintain()).catch((error: unknown) => {
        app.log.warn({ err: error }, "Analytics maintenance failed");
      });
    const flush = () =>
      requests?.flush().catch((error: unknown) => {
        app.log.warn({ err: error }, "Cannot write API request statistics");
      });
    const first = setTimeout(maintain, 10_000);
    const hourly = setInterval(maintain, 60 * 60 * 1000);
    const minutely = setInterval(flush, 60 * 1000);
    first.unref();
    hourly.unref();
    minutely.unref();
    app.addHook("onClose", async () => {
      clearTimeout(first);
      clearInterval(hourly);
      clearInterval(minutely);
      await flush();
    });
    // Public API routes only: not the admin, the event endpoint or health probes.
    app.addHook("onResponse", async (request, reply) => {
      const route = request.routeOptions.url;
      if (!requests || !route?.startsWith("/api/") || route.startsWith("/api/admin/")) return;
      if (route === "/api/analytics/events" || route === "/api/health") return;
      try {
        if (await analytics.isEnabled())
          requests.record(route, reply.statusCode, reply.elapsedTime);
      } catch (error) {
        app.log.warn({ err: error }, "Cannot read analytics collection setting");
      }
    });
  }

  const steamSync = media
    ? new SteamSync(
        { media, sources, store, account: steam, fetchImpl: steamFetch },
        (error) => app.log.warn({ err: error }, "Steam sync failed"),
        (job) =>
          systemLog?.record(
            "job",
            "steam-sync",
            job.state === "done",
            job.state === "done"
              ? `${job.total} 款：新增 ${job.added}，更新 ${job.updated}，失败 ${job.failed}`
              : job.error
          )
      )
    : null;
  const musicImports = media
    ? new MusicImports(
        {
          media,
          sources,
          store,
          music: musicSource,
          account,
          fetchPlaylist,
          trackPreview,
          playlists
        },
        (error) => app.log.warn({ err: error }, "Music import failed"),
        (job) =>
          systemLog?.record(
            "job",
            `music-${job.source}`,
            job.state === "done",
            job.state === "done"
              ? `${job.playlistName ?? ""} ${job.total} 首：新增 ${job.added}，已有 ${job.skipped}`.trim()
              : job.error
          )
      )
    : null;

  app.register(cors, { credentials: true, origin: config.corsOrigins });
  app.register(cookie);
  app.register(multipart, {
    limits: { fileSize: config.uploads.maxBytes, files: 1, fields: 0, parts: 1 }
  });

  // Register before defining routes so every route receives the onRequest limiter.
  // Health probes do not consume a visitor's budget. The stricter login limiter remains.
  await app.register(rateLimit, {
    global: true,
    max: requestLimit,
    timeWindow: "1 minute",
    cache: 10_000,
    allowList: (request) => request.routeOptions.url === "/api/health",
    errorResponseBuilder: () =>
      new HttpError(429, "RATE_LIMITED", "Too many requests. Try again later.")
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    if (_request.routeOptions.url?.startsWith("/api/admin/") && !reply.hasHeader("cache-control"))
      reply.header("cache-control", "no-store");
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "strict-origin-when-cross-origin");
    reply.header("x-frame-options", "DENY");
    return payload;
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send(error.toBody());
    }

    const err: Error & { statusCode?: number } =
      error instanceof Error ? error : new Error(String(error));
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    if (status < 500) {
      // Fastify's own client errors (bad JSON, body too large, unsupported media type).
      return reply.code(status).send(new HttpError(status, "REQUEST_ERROR", err.message).toBody());
    }

    if (isDatabaseUnavailable(err)) {
      request.log.error({ err }, "Database unavailable");
      return reply
        .code(503)
        .send(
          new HttpError(
            503,
            "DATABASE_UNAVAILABLE",
            "Cannot connect to the database; check that it is running and DATABASE_URL is correct"
          ).toBody()
        );
    }

    request.log.error({ err }, "Request failed");
    return reply.code(500).send(new HttpError(500, "INTERNAL", "Internal server error").toBody());
  });

  app.setNotFoundHandler(async (_request, reply) => reply.code(404).send(notFound().toBody()));

  app.get("/api/health", async () => ({
    ok: true,
    service: "liam-frost-api",
    database: hasDatabaseUrl() ? "configured" : "seed",
    storage: "local"
  }));

  registerAdminRoutes(app, auth);
  registerIntegrationRoutes(app, auth, integrations);
  registerAdminApp(app, auth, adminDistDir);
  registerAdminPhotoRoutes(
    app,
    auth,
    photos,
    store,
    config.uploads.maxBytes,
    new PhotoSources({
      store,
      maxBytes: config.uploads.maxBytes,
      importRoots: config.uploads.importDirs,
      fetchImpl: photoFetch,
      lookup: photoLookup
    })
  );
  registerAdminProjectRoutes(app, auth, projects, store, config.uploads.maxBytes);
  registerPhotoRoutes(app, photos, store);
  registerProjectRoutes(app, projects, store);
  registerAdminMediaRoutes(app, auth, {
    media,
    collection,
    sources,
    store,
    maxUploadBytes: config.uploads.maxBytes
  });
  registerAdminMusicRoutes(app, auth, {
    media,
    sources,
    music: musicSource,
    store,
    imports: musicImports
  });
  registerAdminPeopleRoutes(app, auth, {
    media,
    people,
    relations,
    automaticRelations,
    sources,
    store,
    maxUploadBytes: config.uploads.maxBytes
  });
  registerAdminPlaylistRoutes(app, auth, { media, playlists });
  const siteClock = new AnalyticsClock(config.analytics.timezone);
  registerCollectionRoutes(app, {
    media,
    people,
    relations,
    playlists,
    collection,
    store,
    today: () => siteClock.local(now ? now() : new Date()).day
  });
  registerUploadRoutes(app, store, { photos, projects, media, people, collection }, auth);
  registerSpotifyRoutes(app, auth, spotify, account, settings !== null);
  registerSteamRoutes(app, auth, steam, steamSync);
  registerAnalyticsRoutes(
    app,
    auth,
    analytics,
    geo,
    () => analyticsSettings.config.rateLimitPerMinute,
    analyticsSettings
  );
  registerAdminDashboardRoutes(
    app,
    auth,
    new DashboardService({
      photos,
      projects,
      media,
      people,
      playlists,
      analytics,
      sources: activeSources,
      steam,
      spotify: account,
      now,
      onError: (error) => app.log.warn({ err: error }, "A part of the admin dashboard failed")
    })
  );
  registerWebApp(app, webDistDir);

  return app;
}

export async function startServer() {
  let config: AppConfig;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  // fetch() ignores HTTPS_PROXY unless asked; honour it when set, e.g. a local proxy needed to reach
  // Spotify. setGlobalProxyFromEnv exists from Node 24.14/25.4; older versions can set NODE_USE_ENV_PROXY=1.
  const proxyEnv =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  const setGlobalProxyFromEnv = (http as { setGlobalProxyFromEnv?: () => void })
    .setGlobalProxyFromEnv;
  if (proxyEnv && typeof setGlobalProxyFromEnv === "function") setGlobalProxyFromEnv();

  const app = await buildServer({ config });
  if (!config.admin.configured) {
    app.log.warn(
      "Admin authentication is not configured; set ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET"
    );
  }

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";

if (import.meta.url === entryPoint) {
  await startServer();
}
