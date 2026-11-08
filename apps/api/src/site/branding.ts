import { BRAND_SLOTS, type BrandSlot } from "@liam-frost/shared";
import { z } from "zod";

import { KeyedLock } from "../lib/keyed-lock";
import type { SettingsRepository } from "../settings/types";

const KEY = "site.branding";

export type BrandAsset = { id: string; width: number; height: number };
export type BrandAssets = Record<BrandSlot, BrandAsset | null>;

const asset = z
  .object({
    id: z.string().regex(/^[a-z0-9]{8,40}$/),
    width: z.number().int().positive(),
    height: z.number().int().positive()
  })
  .strict()
  .nullable()
  .default(null);
const schema = z.object({ publicLogo: asset, adminLogo: asset, favicon: asset }).strict();

const EMPTY: BrandAssets = { publicLogo: null, adminLogo: null, favicon: null };

/** "publicLogo" -> "public-logo": storage keys and URLs are lowercase. */
export const brandFolder = (slot: BrandSlot) =>
  slot.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
export const slotOfFolder = (folder: string) =>
  BRAND_SLOTS.find((slot) => brandFolder(slot) === folder) ?? null;
export const brandKey = (slot: BrandSlot, id: string) => `branding/${brandFolder(slot)}/${id}`;
/** Logos keep their shape; the icon is one square source its sizes are generated from. */
export const brandFileName = (image: BrandAsset) => `${Math.max(image.width, image.height)}.webp`;
export const brandUrl = (slot: BrandSlot, image: BrandAsset | null) =>
  image ? `/uploads/${brandKey(slot, image.id)}/${brandFileName(image)}` : null;

/** The uploaded logos and site icon: which file is current in each slot. Writes are serialized. */
export class BrandingStore {
  private readonly lock = new KeyedLock();

  constructor(private readonly repo: SettingsRepository | null) {}

  get writable() {
    return this.repo !== null;
  }

  async get(): Promise<BrandAssets> {
    const stored = await this.repo?.get(KEY);
    const parsed = schema.safeParse(stored ?? EMPTY);
    return parsed.success ? parsed.data : EMPTY;
  }

  /** Puts a file in the slot (null empties it) and returns the one it replaced. */
  replace(slot: BrandSlot, image: BrandAsset | null): Promise<BrandAsset | null> {
    return this.lock.run(KEY, async () => {
      const current = await this.get();
      await this.repo!.set(KEY, { ...current, [slot]: image });
      return current[slot];
    });
  }
}
