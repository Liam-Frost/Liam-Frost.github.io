import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import {
  conflictingFields,
  DEFAULT_SITE_SETTINGS,
  type SettingsConflictDetails,
  type SiteSettingsGroup
} from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";
import type { AdminAuthService } from "../auth/service";
import type { MediaRepository } from "../media/types";
import type { SettingsRepository } from "../settings/types";
import type { LocalImageStore } from "../storage/local";
import {
  brandFileName,
  brandKey,
  brandUrl,
  type BrandAsset,
  type BrandingStore
} from "../site/branding";
import { KeyedLock } from "../lib/keyed-lock";
import { HttpError } from "../lib/errors";
import { parseInput } from "../lib/validation";

const text = (max: number) =>
  z
    .object({
      zh: z.string().max(max).optional(),
      "zh-Hant": z.string().max(max).optional(),
      en: z.string().max(max).optional(),
      ja: z.string().max(max).optional(),
      fr: z.string().max(max).optional()
    })
    .strict();
const schemas = {
  identity: z
    .object({
      name: text(120),
      title: text(160),
      adminTitle: text(80).default({}),
      // Saved before the avatar was uploaded; a gallery choice no longer applies.
      avatarPhotoId: z.unknown().optional()
    })
    .strict()
    .transform(({ avatarPhotoId: _avatarPhotoId, ...rest }) => rest),
  footer: z
    .object({
      owner: text(120),
      startYear: z.number().int().min(1900).max(3000).nullable(),
      showRole: z.boolean(),
      links: z
        .array(
          z
            .object({
              label: text(40).refine(
                (v) => Object.values(v).some((s) => s?.trim()),
                "请填写链接文字"
              ),
              url: z
                .string()
                .trim()
                .max(300)
                .regex(/^(https:\/\/\S+|mailto:\S+|\/[^\s/]\S*)$/, "链接地址无效")
            })
            .strict()
        )
        .max(8)
        .default([])
    })
    .strict(),
  preferences: z
    .object({
      theme: z.enum(["system", "light", "dark"]),
      language: z.enum(["auto", "zh", "zh-Hant", "en", "ja", "fr"])
    })
    .strict(),
  navigation: z
    .object({
      tabBarMode: z.enum(["always", "adaptive", "hover"]),
      glass: z.enum(["regular", "clear", "opaque"]),
      selectedButton: z.enum(["lens", "ring", "text"]),
      refraction: z.number().min(0).max(3),
      showLabels: z.boolean(),
      bottomOffset: z.number().int().min(16).max(40)
    })
    .strict(),
  privacy: z
    .object({ title: text(160), body: text(20000), effectiveDate: z.string().date().nullable() })
    .strict(),
  dictionary: z
    .object({
      entries: z
        .array(
          z
            .object({
              id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
              aliases: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
              labels: text(120)
            })
            .strict()
        )
        .max(500)
    })
    .strict()
    .superRefine((v, ctx) => {
      const ids = new Set<string>(),
        aliases = new Set<string>();
      for (const entry of v.entries) {
        if (ids.has(entry.id)) ctx.addIssue({ code: "custom", message: "词条 ID 重复" });
        ids.add(entry.id);
        for (const alias of entry.aliases) {
          const key = alias.normalize("NFKC").toLowerCase();
          if (aliases.has(key))
            ctx.addIssue({ code: "custom", message: "同一别名不能属于多个词条" });
          aliases.add(key);
        }
      }
    })
};
export const settingsFieldPatch = z
  .object({
    changes: z.record(z.string(), z.unknown()),
    base: z.record(z.string(), z.unknown())
  })
  .strict();
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function registerSiteSettingsRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  repo: SettingsRepository | null,
  store: LocalImageStore,
  media: MediaRepository | null,
  branding: BrandingStore
) {
  const lock = new KeyedLock();
  const groupOf = (params: unknown) =>
    parseInput(
      z.object({
        group: z.enum(Object.keys(schemas) as [SiteSettingsGroup, ...SiteSettingsGroup[]])
      }),
      params
    ).group;
  const read = async (group: SiteSettingsGroup) => {
    const stored = await repo?.get(`site.${group}`);
    const parsed = schemas[group].safeParse(stored ?? DEFAULT_SITE_SETTINGS[group]);
    if (!parsed.success) throw new HttpError(503, "SETTINGS_INVALID", "设置无法读取，请联系管理员");
    return { value: parsed.data, revision: digest(parsed.data), saved: stored != null };
  };
  const faviconVersion = (image: BrandAsset) => digest(image.id).slice(0, 24);
  app.get("/api/site-settings", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    reply.header("x-snapshot-data-source", repo ? "database" : "fallback");
    const [
      identityDoc,
      footerDoc,
      preferencesDoc,
      navigationDoc,
      privacyDoc,
      dictionaryDoc,
      assets
    ] = await Promise.all([
      read("identity"),
      read("footer"),
      read("preferences"),
      read("navigation"),
      read("privacy"),
      read("dictionary"),
      branding.get()
    ]);
    const identity = identityDoc.value as typeof DEFAULT_SITE_SETTINGS.identity;
    return {
      identity,
      footer: footerDoc.value,
      preferences: preferencesDoc.value,
      navigation: navigationDoc.value,
      privacy: privacyDoc.value,
      dictionary: dictionaryDoc.value,
      avatarUrl: brandUrl("avatar", assets.avatar),
      faviconUrl: assets.favicon
        ? `/api/site-favicon/${faviconVersion(assets.favicon)}/32.png`
        : null
    };
  });
  app.get("/api/site-favicon/:version/:file", async (request, reply) => {
    const { version, file } = parseInput(
      z.object({
        version: z.string().regex(/^[a-f0-9]{24}$/),
        file: z.enum(["32.png", "180.png", "192.png", "512.png", "favicon.ico"])
      }),
      request.params
    );
    const image = (await branding.get()).favicon;
    if (!image || faviconVersion(image) !== version)
      throw new HttpError(404, "NOT_FOUND", "Icon not found");
    const source = await store.readPublic(brandKey("favicon", image.id), brandFileName(image));
    if (!source) throw new HttpError(404, "NOT_FOUND", "Icon not found");
    const size = file === "favicon.ico" ? 32 : parseInt(file, 10),
      png = await sharp(source)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    reply.header("cache-control", "public, max-age=31536000, immutable");
    if (file !== "favicon.ico") return reply.type("image/png").send(png);
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header[6] = 32;
    header[7] = 32;
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(png.length, 14);
    header.writeUInt32LE(22, 18);
    return reply.type("image/x-icon").send(Buffer.concat([header, png]));
  });
  const admin = { preHandler: auth.requireAdmin };
  app.get("/api/admin/site-settings/:group", admin, async (request) => {
    if (!repo) throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "网站设置需要数据库");
    return read(groupOf(request.params));
  });
  app.get("/api/admin/site-settings/privacy/history", admin, async () => ({
    history: (await repo?.get("site.privacy.history")) ?? []
  }));
  app.patch("/api/admin/site-settings/:group", admin, async (request, reply) => {
    if (!repo) throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "网站设置需要数据库");
    const group = groupOf(request.params);
    const patch = parseInput(settingsFieldPatch, request.body);
    return lock.run(group, async () => {
      const before = await read(group);
      const fields = conflictingFields(before.value, patch);
      if (fields.length)
        throw new HttpError(409, "SETTINGS_CONFLICT", "设置已被其他页面修改", {
          fields,
          current: before
        } satisfies SettingsConflictDetails);
      const body = {
        value: parseInput(schemas[group], { ...before.value, ...patch.changes })
      };
      if (group === "dictionary") {
        const normalize = (v: string) => v.normalize("NFKC").trim().toLowerCase();
        const used = new Set(
          ((await media?.list({ includePrivate: true })) ?? []).flatMap((item) =>
            item.genres.flatMap((genre) =>
              Object.values(genre)
                .filter((v): v is string => Boolean(v))
                .map(normalize)
            )
          )
        );
        const previous = before.value as typeof DEFAULT_SITE_SETTINGS.dictionary,
          next = body.value as typeof DEFAULT_SITE_SETTINGS.dictionary;
        for (const entry of previous.entries) {
          const replacement = next.entries.find((e) => e.id === entry.id);
          for (const alias of entry.aliases)
            if (
              used.has(normalize(alias)) &&
              !replacement?.aliases.some((a) => normalize(a) === normalize(alias))
            )
              throw new HttpError(
                409,
                "DICTIONARY_IN_USE",
                "词条或别名正在被收藏使用，请先保留匹配别名或调整对应内容"
              );
        }
      }
      if (group === "privacy" && before.saved) {
        const history = ((await repo.get("site.privacy.history")) ?? []) as unknown[];
        await repo.set(
          "site.privacy.history",
          [{ ...before, savedAt: new Date().toISOString() }, ...history].slice(0, 10)
        );
      }
      await repo.set(`site.${group}`, body.value);
      const result = await read(group);
      reply.header("x-settings-revision", result.revision);
      return result;
    });
  });
}
