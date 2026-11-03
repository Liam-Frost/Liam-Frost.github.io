import type {
  AdminDashboard,
  DashboardActivity,
  DashboardConnections,
  DashboardContent,
  DashboardPart,
  DashboardSource,
  DashboardTask,
  LocalizedText,
  MediaKind,
  MediaSource,
  SteamAccountStatus
} from "@liam-frost/shared";

import { displayName } from "../analytics/catalog";
import type { AnalyticsService } from "../analytics/service";
import { isDatabaseUnavailable } from "../lib/errors";
import type { MediaRepository, MediaRow } from "../media/types";
import type { MediaSources } from "../media/sources";
import type { PersonRepository, PersonRow } from "../people/types";
import type { PhotoRepository, PhotoRow } from "../photos/types";
import type { PlaylistRepository, PlaylistRow } from "../playlists/types";
import type { ProjectRepository, ProjectRow } from "../projects/types";
import type { SpotifyAccount } from "../spotify/account";
import type { SteamAccount } from "../steam/account";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A connected Steam library not synced for this long is a task. */
export const STEAM_STALE_DAYS = 30;
const EXAMPLES = 5;
const EDITED = 6;
const JOBS = 8;
/** Kinds that can be rated (songs and albums are not). */
const RATED: MediaKind[] = ["movie", "tv", "anime", "book", "comic", "game"];
const KIND_ORDER: MediaKind[] = ["movie", "tv", "anime", "book", "comic", "game", "track", "album"];
/** Sources that need a key or app in the environment; the others work without one. */
const KEYED: MediaSource[] = ["tmdb", "igdb", "googlebooks"];

export type DashboardDeps = {
  photos: PhotoRepository | null;
  projects: ProjectRepository | null;
  media: MediaRepository | null;
  people: PersonRepository | null;
  playlists: PlaylistRepository | null;
  analytics: AnalyticsService | null;
  sources: Pick<MediaSources, "available">;
  steam: Pick<SteamAccount, "status">;
  spotify: Pick<SpotifyAccount, "status">;
  now?: () => Date;
  /** Logs why a part failed. */
  onError?: (error: unknown) => void;
};

type Rows = {
  photos: PhotoRow[];
  projects: ProjectRow[];
  media: MediaRow[];
  people: PersonRow[];
  playlists: PlaylistRow[];
};

/**
 * Runs one part; a failure becomes that part's error and does not fail the others. The page gets a
 * short reason; the details (queries, file paths) go to the server log only.
 */
async function part<T>(
  work: () => Promise<T>,
  onError: (error: unknown) => void
): Promise<DashboardPart<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof NotConfiguredError) return { ok: false, error: error.message };
    onError(error);
    return {
      ok: false,
      error: isDatabaseUnavailable(error) ? "无法连接数据库" : "读取失败，详情见服务器日志"
    };
  }
}

/** A part that cannot work in this setup; its message is shown as is. */
class NotConfiguredError extends Error {}

const hidden = (rows: { visibility: string }[]) =>
  rows.filter((row) => row.visibility === "private").length;
const missingEn = (text: LocalizedText) => !text.en?.trim();
const nameOf = (text: LocalizedText, fallback: string) => displayName(text) || fallback;

/** Admin paths of content, as the admin app routes them. */
const paths = {
  photo: () => "/photos",
  project: (id: string) => `/projects/${id}`,
  media: (id: string) => `/collection/${id}`,
  person: (id: string) => `/people/${id}`,
  playlist: (id: string) => `/collection?kind=track&view=playlists&group=${encodeURIComponent(id)}`
};

/**
 * The admin's 概览: today's visits, what needs attention, account and source status, content counts
 * and recent activity, in one request. Each part is loaded on its own so one failing (the database,
 * analytics) leaves the rest.
 */
export class DashboardService {
  constructor(private readonly deps: DashboardDeps) {}

  private now() {
    return this.deps.now ? this.deps.now() : new Date();
  }

  private async rows(): Promise<Rows> {
    const { photos, projects, media, people, playlists } = this.deps;
    if (!photos || !projects || !media || !people || !playlists)
      throw new NotConfiguredError("需要数据库（设置 DATABASE_URL）");
    const all = { includePrivate: true };
    const [p, pr, m, pe, pl] = await Promise.all([
      photos.list(all),
      projects.list(all),
      media.list(all),
      people.list(all),
      playlists.list(all)
    ]);
    return { photos: p, projects: pr, media: m, people: pe, playlists: pl };
  }

  async load(): Promise<AdminDashboard> {
    const { analytics } = this.deps;
    // Several parts share a failed read; log it once.
    const logged = new Set<unknown>();
    const onError = (error: unknown) => {
      if (logged.has(error)) return;
      logged.add(error);
      this.deps.onError?.(error);
    };
    // Shared by content, tasks and activity: read the content once.
    const rows = this.rows();
    rows.catch(() => {});
    // Jobs and source status are extras: without them the accounts and content still show.
    const enabled = analytics
      ? await analytics.isEnabled().catch((error: unknown) => {
          onError(error);
          return false;
        })
      : false;
    const system =
      analytics && enabled
        ? analytics.system(JOBS).catch((error: unknown) => {
            onError(error);
            return null;
          })
        : Promise.resolve(null);
    // Read once for the task and the account row.
    const steam = this.deps.steam.status();
    steam.catch(() => {});

    const [traffic, content, tasks, connections, activity] = await Promise.all([
      analytics && enabled ? part(() => analytics.dashboard(), onError) : Promise.resolve(null),
      part(async () => this.content(await rows), onError),
      part(async () => this.tasks(await rows, await steam, (await system)?.sources ?? []), onError),
      part(async () => this.connections(await steam, (await system)?.sources ?? []), onError),
      part(async () => this.activity(await rows, (await system)?.jobs ?? []), onError)
    ]);
    return {
      generatedAt: this.now().toISOString(),
      traffic,
      content,
      tasks,
      connections,
      activity
    };
  }

  content(rows: Rows): DashboardContent {
    const kinds = new Map<MediaKind, number>();
    for (const item of rows.media) kinds.set(item.kind, (kinds.get(item.kind) ?? 0) + 1);
    return {
      photos: {
        total: rows.photos.length,
        hidden: hidden(rows.photos),
        featured: rows.photos.filter((photo) => photo.featured).length,
        referenced: rows.photos.filter((photo) => photo.storage === "remote-url").length
      },
      projects: {
        total: rows.projects.length,
        hidden: hidden(rows.projects),
        featured: rows.projects.filter((project) => project.featured).length
      },
      media: {
        total: rows.media.length,
        hidden: hidden(rows.media),
        watching: rows.media.filter((item) => item.status === "watching").length,
        byKind: KIND_ORDER.filter((kind) => kinds.has(kind)).map((kind) => ({
          kind,
          count: kinds.get(kind)!
        }))
      },
      people: { total: rows.people.length, hidden: hidden(rows.people) },
      playlists: { total: rows.playlists.length, hidden: hidden(rows.playlists) }
    };
  }

  /** Connected, and not synced (or connected without syncing) for STEAM_STALE_DAYS. */
  private steamStale(steam: SteamAccountStatus) {
    if (!steam.account) return false;
    const last = Date.parse(steam.account.lastSyncedAt ?? steam.account.connectedAt);
    return this.now().getTime() - last > STEAM_STALE_DAYS * DAY_MS;
  }

  tasks(
    rows: Rows,
    steam: SteamAccountStatus,
    sources: { name: string; lastOk: string | null; lastError: string | null }[]
  ): DashboardTask[] {
    const tasks: DashboardTask[] = [];
    const add = <T>(
      id: DashboardTask["id"],
      severity: DashboardTask["severity"],
      items: T[],
      example: (item: T) => DashboardTask["examples"][number]
    ) => {
      if (items.length)
        tasks.push({
          id,
          severity,
          count: items.length,
          examples: items.slice(0, EXAMPLES).map(example)
        });
    };
    const photo = (row: PhotoRow) => ({
      id: row.id,
      name: nameOf(row.title, row.slug),
      to: null
    });
    const project = (row: ProjectRow) => ({
      id: row.id,
      name: nameOf(row.title, row.slug),
      to: paths.project(row.id)
    });

    const publicPhotos = rows.photos.filter((row) => row.visibility === "public");
    const publicProjects = rows.projects.filter((row) => row.visibility === "public");
    add(
      "photos-referenced",
      "info",
      rows.photos.filter((row) => row.storage === "remote-url"),
      photo
    );
    add(
      "photos-missing-en",
      "info",
      publicPhotos.filter((row) => missingEn(row.title)),
      photo
    );
    add(
      "projects-missing-en",
      "warning",
      publicProjects.filter((row) => missingEn(row.title)),
      project
    );
    add(
      "projects-no-cover",
      "warning",
      publicProjects.filter((row) => !row.cover),
      project
    );
    add(
      "media-unrated",
      "info",
      rows.media.filter(
        (row) => RATED.includes(row.kind) && row.status === "done" && row.rating === null
      ),
      (row) => ({ id: row.id, name: nameOf(row.title, row.id), to: paths.media(row.id) })
    );

    if (this.steamStale(steam))
      tasks.push({ id: "steam-stale", severity: "warning", count: 1, examples: [] });
    for (const source of sources) {
      if (source.lastError && (!source.lastOk || source.lastOk < source.lastError))
        tasks.push({
          id: "source-failing",
          subject: source.name,
          severity: "warning",
          count: 1,
          examples: []
        });
    }
    // Warnings first; otherwise in the order above.
    return tasks.sort((a, b) =>
      a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1
    );
  }

  async connections(
    steam: SteamAccountStatus,
    status: {
      name: string;
      lastOk: string | null;
      lastError: string | null;
      lastErrorMessage: string | null;
    }[]
  ): Promise<DashboardConnections> {
    const spotify = await this.deps.spotify.status();
    const available = this.deps.sources.available();
    const byName = new Map(status.map((source) => [source.name, source]));
    const sources: DashboardSource[] = (Object.keys(available) as MediaSource[]).map((name) => ({
      name,
      needsKey: KEYED.includes(name),
      configured: available[name as keyof typeof available],
      lastOk: byName.get(name)?.lastOk ?? null,
      lastError: byName.get(name)?.lastError ?? null,
      lastErrorMessage: byName.get(name)?.lastErrorMessage ?? null
    }));
    return {
      steam: {
        configured: steam.configured,
        account: steam.account && {
          name: steam.account.name,
          lastSyncedAt: steam.account.lastSyncedAt,
          stale: this.steamStale(steam)
        }
      },
      spotify: {
        configured: spotify.configured,
        account: spotify.account && { displayName: spotify.account.displayName }
      },
      sources
    };
  }

  activity(rows: Rows, jobs: DashboardActivity["jobs"]): DashboardActivity {
    const edited: DashboardActivity["edited"] = [
      ...rows.photos.map((row) => ({
        type: "photo" as const,
        id: row.id,
        name: nameOf(row.title, row.slug),
        kind: null,
        updatedAt: row.updatedAt,
        to: paths.photo()
      })),
      ...rows.projects.map((row) => ({
        type: "project" as const,
        id: row.id,
        name: nameOf(row.title, row.slug),
        kind: null,
        updatedAt: row.updatedAt,
        to: paths.project(row.id)
      })),
      ...rows.media.map((row) => ({
        type: "media" as const,
        id: row.id,
        name: nameOf(row.title, row.id),
        kind: row.kind,
        updatedAt: row.updatedAt,
        to: paths.media(row.id)
      })),
      ...rows.people.map((row) => ({
        type: "person" as const,
        id: row.id,
        name: nameOf(row.name, row.id),
        kind: null,
        updatedAt: row.updatedAt,
        to: paths.person(row.id)
      })),
      ...rows.playlists.map((row) => ({
        type: "playlist" as const,
        id: row.id,
        name: nameOf(row.name, row.id),
        kind: null,
        updatedAt: row.updatedAt,
        to: paths.playlist(row.id)
      }))
    ]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, EDITED)
      .map((item) => ({ ...item, updatedAt: item.updatedAt.toISOString() }));
    return { jobs, edited };
  }
}
