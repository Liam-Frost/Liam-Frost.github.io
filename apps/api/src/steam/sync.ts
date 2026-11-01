import type { LocalizedText, MediaStatus, SteamSyncJob } from "@liam-frost/shared";
import { randomBytes, randomUUID } from "node:crypto";

import { importMedia, storePoster } from "../media/import";
import { SourceError, type MediaSources } from "../media/sources";
import { DuplicateMediaError, type MediaRepository } from "../media/types";
import { InvalidImageError, processImage } from "../photos/images";
import type { StoredImage } from "../projects/types";
import type { LocalImageStore } from "../storage/local";
import type { OwnedGame, SteamAccount } from "./account";

const STORE = "https://store.steampowered.com/api/appdetails";
const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com/steam/apps";
const MAX_JOBS = 10;
const MAX_ERRORS = 5;

type StoreDetails = {
  name?: string;
  short_description?: string;
  developers?: string[];
  publishers?: string[];
  genres?: { description?: string }[];
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
  release_date?: { date?: string };
  header_image?: string;
};

const day = (time: number | null) => (time ? new Date(time).toISOString().slice(0, 10) : null);

/** What Steam knows about a game, merged into `extra.game`. */
const steamFields = (game: OwnedGame) => ({ steamAppId: game.appId, playtimeHours: Math.round(game.minutes / 60), lastPlayedOn: day(game.lastPlayed) });

/** New games: played in the last two weeks → playing, played → played, never → want to play. */
const statusOf = (game: OwnedGame): MediaStatus => (game.minutesTwoWeeks > 0 ? "watching" : game.minutes > 0 ? "done" : "want");

/**
 * Syncs the Steam library into the collection, one job at a time. Games already in the collection (by
 * Steam id, or by the IGDB game Steam's id points to) get their playtime and last played date; new games
 * are imported with IGDB's details, or the Steam store's when IGDB does not know them, and start hidden.
 */
export class SteamSync {
  private readonly jobs = new Map<string, SteamSyncJob>();
  private running: string | null = null;

  constructor(
    private readonly deps: { media: MediaRepository; sources: MediaSources; store: LocalImageStore; account: SteamAccount; fetchImpl?: typeof fetch },
    private readonly onError: (error: unknown) => void = () => {}
  ) {}

  get(id: string) {
    return this.jobs.get(id) ?? null;
  }

  start(): SteamSyncJob {
    if (this.running) return this.jobs.get(this.running)!;
    const job: SteamSyncJob = { id: randomBytes(8).toString("hex"), state: "running", total: 0, processed: 0, added: 0, fromStore: 0, updated: 0, failed: 0, errors: [], error: null };
    this.jobs.set(job.id, job);
    while (this.jobs.size > MAX_JOBS) this.jobs.delete(this.jobs.keys().next().value!);
    this.running = job.id;
    void this.run(job).finally(() => {
      this.running = null;
    });
    return job;
  }

  private async run(job: SteamSyncJob) {
    const { media, sources, account } = this.deps;
    try {
      const games = await account.ownedGames();
      job.total = games.length;
      const collected = await media.list({ kind: "game", includePrivate: true });
      const bySteam = new Map(collected.flatMap((row) => (typeof (row.extra.game as { steamAppId?: unknown } | undefined)?.steamAppId === "number" ? [[(row.extra.game as { steamAppId: number }).steamAppId, row] as const] : [])));
      const unknown = games.filter((game) => !bySteam.has(game.appId)).map((game) => String(game.appId));
      // IGDB knows most Steam games; without the Twitch app, every new game comes from the store.
      const igdbIds = sources.available().igdb && unknown.length ? await sources.steamGames(unknown) : new Map<string, string>();
      const byIgdb = await media.findBySource("igdb", [...igdbIds.values()]);

      for (const game of games) {
        try {
          const existingId = bySteam.get(game.appId)?.id ?? byIgdb.get(igdbIds.get(String(game.appId)) ?? "");
          if (existingId) {
            await this.refresh(existingId, game);
            job.updated += 1;
          } else {
            await this.add(job, game, igdbIds.get(String(game.appId)) ?? null);
          }
        } catch (error) {
          if (!(error instanceof SourceError || error instanceof DuplicateMediaError)) throw error;
          job.failed += 1;
          if (job.errors.length < MAX_ERRORS) job.errors.push(`${game.name}：${error.message || "已在收藏中"}`);
        }
        job.processed += 1;
      }
      await account.markSynced();
      job.state = "done";
    } catch (error) {
      this.onError(error);
      job.state = "failed";
      job.error = error instanceof SourceError ? error.message : "同步失败";
    }
  }

  /** Playtime and last played date only; the admin's own record (status, rating, review) stays. */
  private async refresh(id: string, game: OwnedGame) {
    const row = await this.deps.media.get(id);
    if (!row) return;
    await this.deps.media.update(id, { extra: { ...row.extra, game: { ...(row.extra.game as object | undefined), ...steamFields(game) } } });
  }

  private async add(job: SteamSyncJob, game: OwnedGame, igdbId: string | null) {
    const initial = { status: statusOf(game), visibility: "private" as const, extra: { game: steamFields(game) } };
    if (igdbId) {
      try {
        await importMedia({ media: this.deps.media, sources: this.deps.sources, store: this.deps.store }, "game", "igdb", igdbId, initial);
        job.added += 1;
        return;
      } catch (error) {
        // IGDB failed for this one; the store still knows it.
        if (!(error instanceof SourceError)) throw error;
      }
    }
    await this.fromStore(game, initial);
    job.added += 1;
    job.fromStore += 1;
  }

  /** A game IGDB does not know, from the Steam store (Simplified Chinese where the store has it). */
  private async fromStore(game: OwnedGame, initial: { status: MediaStatus; visibility: "private"; extra: { game: ReturnType<typeof steamFields> } }) {
    const fetchImpl = this.deps.fetchImpl ?? fetch;
    const appId = String(game.appId);
    let details: StoreDetails = {};
    try {
      const response = await fetchImpl(`${STORE}?appids=${appId}&l=schinese`, { signal: AbortSignal.timeout(15_000) });
      if (response.ok) details = ((await response.json()) as Record<string, { success?: boolean; data?: StoreDetails }>)[appId]?.data ?? {};
      else await response.body?.cancel();
    } catch {
      // The library's name is enough to add it.
    }
    const zh = details.name?.trim();
    const title: LocalizedText = { en: game.name, ...(zh && zh !== game.name ? { zh } : {}) };
    const id = randomUUID();
    const poster = await this.cover(id, [`${STEAM_CDN}/${appId}/library_600x900_2x.jpg`, details.header_image]);
    try {
      await this.deps.media.create({
        id,
        kind: "game",
        source: "steam",
        sourceId: appId,
        sourceUrl: `https://store.steampowered.com/app/${appId}/`,
        title,
        originalTitle: game.name,
        year: Number(/\d{4}/.exec(details.release_date?.date ?? "")?.[0]) || null,
        genres: (details.genres ?? []).map((genre) => genre.description?.trim()).filter((name): name is string => Boolean(name)).map((name) => ({ zh: name })),
        credits: (details.developers ?? []).slice(0, 3),
        overview: details.short_description ? { zh: details.short_description.replace(/<[^>]+>/g, "").trim() } : {},
        poster,
        status: initial.status,
        visibility: initial.visibility,
        extra: {
          game: {
            platforms: [details.platforms?.windows ? "PC (Microsoft Windows)" : "", details.platforms?.mac ? "Mac" : "", details.platforms?.linux ? "Linux" : ""].filter(Boolean),
            publishers: (details.publishers ?? []).slice(0, 3),
            ...initial.extra.game
          }
        }
      });
    } catch (error) {
      if (poster) await this.deps.store.remove(`media/${id}`).catch(() => undefined);
      throw error;
    }
  }

  /** The first cover that downloads and decodes; none is fine. */
  private async cover(id: string, urls: (string | undefined)[]): Promise<StoredImage | null> {
    for (const url of urls) {
      if (!url) continue;
      try {
        return await storePoster(this.deps.store, id, await processImage(await this.deps.sources.download(url)));
      } catch (error) {
        if (!(error instanceof SourceError || error instanceof InvalidImageError)) throw error;
      }
    }
    return null;
  }
}

