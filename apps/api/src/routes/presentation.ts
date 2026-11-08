import { createHash } from "node:crypto";
import { DEFAULT_PRESENTATION, HOME_SECTIONS, type PresentationSettings } from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AdminAuthService } from "../auth/service";
import { HttpError } from "../lib/errors";
import { KeyedLock } from "../lib/keyed-lock";
import { parseInput } from "../lib/validation";
import type { SettingsRepository } from "../settings/types";
import type { PhotoRepository } from "../photos/types";
import type { LocalImageStore } from "../storage/local";
import { toPublicPhoto } from "../photos/mapping";
import { brandUrl, type BrandingStore } from "../site/branding";

const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
const logo = z
  .object({
    text: z.string().trim().max(12),
    // Saved before logos were uploaded; a gallery choice no longer applies.
    photoId: z.unknown().optional(),
    alt: z.string().trim().max(120).optional()
  })
  .strict()
  .transform(({ photoId: _photoId, ...rest }) => rest);
const schema = z
  .object({
    sections: z
      .object(
        Object.fromEntries(HOME_SECTIONS.map((k) => [k, z.boolean()])) as Record<
          (typeof HOME_SECTIONS)[number],
          z.ZodBoolean
        >
      )
      .strict(),
    publicLogo: logo,
    adminLogo: logo,
    loginBackground: z
      .object({
        mode: z.enum(["none", "fixed", "rotate"]),
        photoIds: z.array(id).max(20),
        intervalSeconds: z.number().int().min(10).max(3600)
      })
      .strict()
  })
  .strict();

export function registerPresentationRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  repo: SettingsRepository | null,
  photos: PhotoRepository | null,
  store: LocalImageStore,
  branding: BrandingStore
) {
  const key = "presentation.v1",
    lock = new KeyedLock();
  const revisionOf = (value: PresentationSettings) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const read = async () => {
    const value = await repo?.get(key);
    const settings = value == null ? DEFAULT_PRESENTATION : schema.parse(value);
    return { settings, revision: revisionOf(settings) };
  };
  app.get("/api/presentation", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    reply.header("x-snapshot-data-source", repo ? "database" : "fallback");
    const { settings } = await read();
    const ids = new Set(settings.loginBackground.photoIds);
    const publicPhotos = ids.size && photos ? await photos.list() : [];
    // Resolve only currently public photos. Hidden/deleted images must never leak at the login screen.
    const images = Object.fromEntries(
      publicPhotos
        .filter((p) => p.visibility === "public" && ids.has(p.id))
        .map((p) => {
          const photo = toPublicPhoto(p, store);
          const suitable = photo.variants?.find((v) => v.width >= 1600) ?? photo.variants?.at(-1);
          return [p.id, suitable?.url ?? photo.src];
        })
    );
    const assets = await branding.get();
    return {
      ...settings,
      images,
      logoUrls: {
        publicLogo: brandUrl("publicLogo", assets.publicLogo),
        adminLogo: brandUrl("adminLogo", assets.adminLogo)
      }
    };
  });
  const admin = { preHandler: auth.requireAdmin };
  app.get("/api/admin/presentation", admin, async () => {
    if (!repo) throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "外观管理需要数据库");
    return read();
  });
  app.put("/api/admin/presentation", admin, async (request) => {
    if (!repo) throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "外观管理需要数据库");
    const input = parseInput(
      z.object({ settings: schema, revision: z.string().length(64) }).strict(),
      request.body
    );
    return lock.run(key, async () => {
      if ((await read()).revision !== input.revision)
        throw new HttpError(409, "PRESENTATION_OUT_OF_DATE", "设置已在其他页面修改，请重新加载");
      const ids = new Set(input.settings.loginBackground.photoIds);
      const available = new Set(
        ((await photos?.list()) ?? []).filter((p) => p.visibility === "public").map((p) => p.id)
      );
      if ([...ids].some((v) => !available.has(v)))
        throw new HttpError(400, "INVALID_PHOTO", "只能选择图库中当前公开的照片");
      if (
        input.settings.loginBackground.mode !== "none" &&
        !input.settings.loginBackground.photoIds.length
      )
        throw new HttpError(400, "BACKGROUND_REQUIRED", "请选择至少一张背景图");
      const settings = {
        ...input.settings,
        loginBackground: {
          ...input.settings.loginBackground,
          photoIds: [...new Set(input.settings.loginBackground.photoIds)]
        }
      };
      await repo.set(key, settings);
      return { settings, revision: revisionOf(settings) };
    });
  });
}
