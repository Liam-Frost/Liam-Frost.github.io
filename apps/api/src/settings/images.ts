import { DEFAULT_SITE_SETTINGS, type SiteSettingsGroups } from "@liam-frost/shared";
import { z } from "zod";

import type { SettingsRepository } from "./types";

export type ImageSettings = SiteSettingsGroups["images"];

/** 网站设置 → 图片管理: how long the trash keeps images, and how many versions a photo may have. */
export const imageSettingsSchema = z
  .object({
    trashRetentionDays: z.number().int().min(1).max(365),
    maxPhotoVersions: z.number().int().min(1).max(50)
  })
  .strict();

/** The saved image settings, or the defaults when nothing (or nothing readable) is saved. */
export async function readImageSettings(repo: SettingsRepository | null): Promise<ImageSettings> {
  const stored = await repo?.get("site.images").catch(() => null);
  const parsed = imageSettingsSchema.safeParse(stored ?? DEFAULT_SITE_SETTINGS.images);
  return parsed.success ? parsed.data : DEFAULT_SITE_SETTINGS.images;
}
