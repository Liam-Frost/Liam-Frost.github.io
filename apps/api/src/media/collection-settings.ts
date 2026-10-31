import type { CollectionSettings } from "@liam-frost/shared";

import { collectionSettingsSchema } from "../lib/validation";
import type { SettingsRepository } from "../settings/types";

const KEY = "collection";

export const DEFAULT_COLLECTION_SETTINGS: CollectionSettings = {
  show: { movie: true, tv: true, anime: true, music: true },
  showWant: true
};

/** Stored settings were validated on save; anything unreadable falls back to the defaults. */
export async function readCollectionSettings(repo: SettingsRepository): Promise<CollectionSettings> {
  const parsed = collectionSettingsSchema.safeParse(await repo.get(KEY));
  return parsed.success ? parsed.data : DEFAULT_COLLECTION_SETTINGS;
}

export async function saveCollectionSettings(repo: SettingsRepository, settings: CollectionSettings) {
  await repo.set(KEY, settings);
}
