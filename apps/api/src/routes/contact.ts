import { createHash } from "node:crypto";
import { DEFAULT_CONTACT, type ContactContent } from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AdminAuthService } from "../auth/service";
import { HttpError } from "../lib/errors";
import { KeyedLock } from "../lib/keyed-lock";
import { parseInput } from "../lib/validation";
import type { SettingsRepository } from "../settings/types";

export const contactSchema = z
  .object({
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
    links: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(80),
            href: z
              .string()
              .trim()
              .max(2048)
              .url()
              .refine((value) => {
                try {
                  const url = new URL(value);
                  return url.protocol === "https:" && !url.username && !url.password;
                } catch {
                  return false;
                }
              }, "联系方式请使用不含登录凭据的 HTTPS 链接")
          })
          .strict()
      )
      .max(20)
  })
  .strict();

export function registerContactRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  repo: SettingsRepository | null
) {
  const key = "contact.v1";
  const lock = new KeyedLock();
  const revisionOf = (value: ContactContent) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const read = async () => {
    const stored = await repo?.get(key);
    const contact = stored == null ? DEFAULT_CONTACT : contactSchema.parse(stored);
    return { contact, revision: revisionOf(contact) };
  };
  app.get("/api/contact", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("x-snapshot-data-source", repo ? "database" : "fallback");
    // An unavailable database must not resurrect contact details removed by the owner.
    return (await read()).contact;
  });
  const admin = { preHandler: auth.requireAdmin };
  app.get("/api/admin/contact", admin, async () => {
    if (!repo) throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "联系方式管理需要数据库");
    return read();
  });
  app.put("/api/admin/contact", admin, async (request) => {
    if (!repo) throw new HttpError(503, "DATABASE_NOT_CONFIGURED", "联系方式管理需要数据库");
    const { contact, revision } = parseInput(
      z.object({ contact: contactSchema, revision: z.string().length(64) }).strict(),
      request.body
    );
    return lock.run(key, async () => {
      if ((await read()).revision !== revision)
        throw new HttpError(
          409,
          "CONTACT_OUT_OF_DATE",
          "联系方式已在其他页面修改，请重新加载后保存"
        );
      await repo.set(key, contact);
      return { contact, revision: revisionOf(contact) };
    });
  });
}
