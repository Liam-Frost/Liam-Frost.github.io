import { photos as seedPhotos } from "@liam-frost/content";
import type { AnalyticsContentType, LocalizedText } from "@liam-frost/shared";

import type { MediaRepository } from "../media/types";
import type { PersonRepository } from "../people/types";
import type { PhotoRepository } from "../photos/types";
import type { PlaylistRepository } from "../playlists/types";
import type { ProjectRepository } from "../projects/types";
import type { ContentName } from "./types";

const TTL_MS = 5 * 60 * 1000;
/** A miss reloads the catalog at most this often, so content published a moment ago still counts. */
const MISS_RELOAD_MS = 30 * 1000;

export type CatalogSources = {
  projects: ProjectRepository | null;
  photos: PhotoRepository | null;
  media: MediaRepository | null;
  people: PersonRepository | null;
  playlists: PlaylistRepository | null;
};

/** The admin reads Chinese first. */
export function displayName(text: LocalizedText | null | undefined) {
  if (!text) return "";
  return (
    text.zh ||
    text["zh-Hant"] ||
    text.en ||
    Object.values(text).find((value) => value) ||
    ""
  ).trim();
}

/**
 * The public content events may name: projects (by slug), photos, collection entries, people and
 * playlists, with their names. Loaded from the repositories and cached for a few minutes.
 */
export class ContentCatalog {
  private entries: Map<string, ContentName> | null = null;
  private loadedAt = 0;
  private loading: Promise<Map<string, ContentName>> | null = null;

  constructor(
    private readonly sources: CatalogSources,
    private readonly now: () => number = Date.now
  ) {}

  private async load() {
    const { projects, photos, media, people, playlists } = this.sources;
    const entries = new Map<string, ContentName>();
    const add = (
      type: AnalyticsContentType,
      id: string,
      name: string,
      kind: string | null = null
    ) => entries.set(`${type}:${id}`, { key: `${type}:${id}`, type, contentId: id, name, kind });

    const [projectRows, photoRows, mediaRows, personRows, playlistRows] = await Promise.all([
      projects?.list() ?? [],
      photos ? photos.list() : null,
      media?.list() ?? [],
      people?.list() ?? [],
      playlists?.list() ?? []
    ]);
    for (const row of projectRows) add("project", row.slug, displayName(row.title));
    if (photoRows) for (const row of photoRows) add("photo", row.id, displayName(row.title));
    else for (const photo of seedPhotos) add("photo", photo.id, displayName(photo.title));
    for (const row of mediaRows) add("media", row.id, displayName(row.title), row.kind);
    for (const row of personRows) add("person", row.id, displayName(row.name));
    for (const row of playlistRows) add("playlist", row.id, displayName(row.name));
    return entries;
  }

  /** Every public piece of content, keyed "type:id". */
  async all() {
    const fresh = this.entries && this.now() - this.loadedAt < TTL_MS;
    if (fresh) return this.entries!;
    return this.reload();
  }

  private async reload() {
    this.loading ??= this.load()
      .then((entries) => {
        this.entries = entries;
        this.loadedAt = this.now();
        return entries;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  async get(type: string, id: string) {
    const key = `${type}:${id}`;
    const found = (await this.all()).get(key);
    if (found || this.now() - this.loadedAt < MISS_RELOAD_MS) return found ?? null;
    return (await this.reload()).get(key) ?? null;
  }
}
