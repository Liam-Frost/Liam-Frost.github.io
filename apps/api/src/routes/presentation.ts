import { createHash } from "node:crypto";
import {
  conflictingFields,
  DEFAULT_PRESENTATION,
  HOME_SECTIONS,
  ROTATION_MODES,
  type PresentationSettings,
  type SettingsConflictDetails
} from "@liam-frost/shared";
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
import { settingsFieldPatch } from "./site-settings";

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
        // "none" and "rotate" (on a timer, with intervalSeconds) are from older saves.
        mode: z.enum([...ROTATION_MODES, "none", "rotate"]),
        photoIds: z.array(id).max(20),
        intervalSeconds: z.unknown().optional()
      })
      .strict()
      .transform(({ mode, photoIds }): PresentationSettings["loginBackground"] =>
        mode === "none"
          ? { mode: "fixed", photoIds: [] }
          : { mode: mode === "rotate" ? "visit" : mode, photoIds }
      )
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
  app.patch("/api/admin/presentation", admin, async (request) => {
    if (!repo) throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "外观管理需要数据库");
    const patch = parseInput(settingsFieldPatch, request.body);
    return lock.run(key, async () => {
      const before = await read();
      const fields = conflictingFields(before.settings, patch);
      if (fields.length)
        throw new HttpError(409, "SETTINGS_CONFLICT", "设置已被其他页面修改", {
          fields,
          current: before
        } satisfies SettingsConflictDetails);
      const next = parseInput(schema, { ...before.settings, ...patch.changes });
      if ("loginBackground" in patch.changes) {
        // Only what this save adds must be public now. A chosen photo hidden later stays in the list
        // (the login page shows public photos only), so it cannot block other changes.
        const kept = new Set(before.settings.loginBackground.photoIds);
        const added = next.loginBackground.photoIds.filter((photo) => !kept.has(photo));
        const available = new Set(
          ((await photos?.list()) ?? []).filter((p) => p.visibility === "public").map((p) => p.id)
        );
        if (added.some((photo) => !available.has(photo)))
          throw new HttpError(400, "INVALID_PHOTO", "只能选择图库中当前公开的照片");
      }
      const settings = {
        ...next,
        loginBackground: {
          ...next.loginBackground,
          photoIds: [...new Set(next.loginBackground.photoIds)]
        }
      };
      await repo.set(key, settings);
      return { settings, revision: revisionOf(settings) };
    });
  });
}
