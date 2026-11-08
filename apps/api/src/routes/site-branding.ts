import { BRAND_SLOTS, type AdminBranding, type BrandSlot } from "@liam-frost/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import type { AdminAuthService } from "../auth/service";
import { HttpError, notFound } from "../lib/errors";
import { parseInput } from "../lib/validation";
import {
  brandFileName,
  brandKey,
  brandUrl,
  slotOfFolder,
  type BrandAsset,
  type BrandAssets,
  type BrandingStore
} from "../site/branding";
import { readUploadedIcon } from "../stack/icons";
import type { LocalImageStore } from "../storage/local";

/** Logos can be wide and are shown on high-density screens; the icon needs its largest size, 512. */
const LOGO_SIZE = 512;
const FAVICON_SIZE = 512;
/** The home avatar shows at up to 300 CSS px, on high-density screens. */
const AVATAR_SIZE = 1024;

const toAdmin = (assets: BrandAssets): AdminBranding =>
  Object.fromEntries(
    BRAND_SLOTS.map((slot) => [slot, brandUrl(slot, assets[slot])])
  ) as AdminBranding;

/**
 * Uploaded front-end logo, admin logo and site icon. Public: only the file currently in a slot is
 * served, cached forever because every upload gets a new address. Admin: upload (replaces the slot
 * at once) and remove (back to the default).
 */
export function registerBrandingRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  branding: BrandingStore,
  store: LocalImageStore
) {
  app.get("/uploads/branding/:folder/:id/:file", async (request, reply) => {
    const { folder, id, file } = request.params as { folder: string; id: string; file: string };
    const slot = slotOfFolder(folder);
    if (!slot) throw notFound();
    const current = (await branding.get())[slot];
    if (!current || current.id !== id || brandFileName(current) !== file) throw notFound();
    const data = await store.readPublic(brandKey(slot, id), file);
    if (!data) throw notFound();
    reply.header("content-type", "image/webp");
    reply.header("cache-control", "public, max-age=31536000, immutable");
    return reply.send(data);
  });

  const admin = { preHandler: auth.requireAdmin };
  const slotOf = (request: FastifyRequest): BrandSlot =>
    parseInput(z.object({ slot: z.enum(BRAND_SLOTS) }), request.params).slot;
  const assertWritable = () => {
    if (!branding.writable)
      throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "品牌素材管理需要数据库");
  };
  const discard = async (request: FastifyRequest, slot: BrandSlot, old: BrandAsset | null) => {
    if (!old) return;
    await store
      .remove(brandKey(slot, old.id))
      .catch((error) => request.log.warn({ error, slot }, "Failed to remove an old brand file"));
  };

  app.get("/api/admin/branding", admin, async () => toAdmin(await branding.get()));

  app.post("/api/admin/branding/:slot", admin, async (request, reply) => {
    assertWritable();
    const slot = slotOf(request);
    const { icon } = await readUploadedIcon(request, {
      size: slot === "favicon" ? FAVICON_SIZE : slot === "avatar" ? AVATAR_SIZE : LOGO_SIZE,
      square: slot === "favicon",
      allowJpeg: true
    });
    const image: BrandAsset = {
      id: randomBytes(8).toString("hex"),
      width: icon.width,
      height: icon.height
    };
    const key = brandKey(slot, image.id);
    let previous: BrandAsset | null;
    try {
      await store.write(key, brandFileName(image), icon.data);
      previous = await branding.replace(slot, image);
    } catch (error) {
      await store.remove(key).catch(() => undefined);
      throw error;
    }
    await discard(request, slot, previous);
    reply.code(201);
    return toAdmin(await branding.get());
  });

  app.delete("/api/admin/branding/:slot", admin, async (request) => {
    assertWritable();
    const slot = slotOf(request);
    await discard(request, slot, await branding.replace(slot, null));
    return toAdmin(await branding.get());
  });
}
