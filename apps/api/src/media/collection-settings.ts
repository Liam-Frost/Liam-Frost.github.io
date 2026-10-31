import type { CollectionSettings } from "@liam-frost/shared";

import { collectionSettingsSchema } from "../lib/validation";
import type { SettingsRepository } from "../settings/types";

const KEY = "collection";
const CACHE_MS = 30_000;

export const DEFAULT_COLLECTION_SETTINGS: CollectionSettings = {
  show: { movie: true, tv: true, anime: true, music: true },
  showWant: true
};

/**
 * Collection settings with a short cache: every poster request checks them. Saves go through this
 * store and update the cache at once, so the admin's changes apply immediately in this process.
 */
export class CollectionSettingsStore {
  private cached: { value: CollectionSettings; at: number } | null = null;

  constructor(
    private readonly repo: SettingsRepository,
    private readonly now: () => number = Date.now
  ) {}

  async get(): Promise<CollectionSettings> {
    if (this.cached && this.now() - this.cached.at < CACHE_MS) return this.cached.value;
    // Stored settings were validated on save; anything unreadable falls back to the defaults.
    const parsed = collectionSettingsSchema.safeParse(await this.repo.get(KEY));
    const value = parsed.success ? parsed.data : DEFAULT_COLLECTION_SETTINGS;
    this.cached = { value, at: this.now() };
    return value;
  }

  async save(settings: CollectionSettings) {
    await this.repo.set(KEY, settings);
    this.cached = { value: settings, at: this.now() };
  }
}
