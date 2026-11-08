import {
  ADMIN_PASSWORD_MAX,
  ADMIN_PASSWORD_MIN,
  type AdminAccountStatus,
  type AdminRecoveryCodes,
  type AdminTotpSetup
} from "@liam-frost/shared";
import type { FastifyInstance } from "fastify";
import qrcode from "qrcode-generator";
import { z } from "zod";

import type { AdminAuthService } from "../auth/service";
import { parseInput } from "../lib/validation";

const currentPassword = z.string().min(1, "Enter your current password").max(ADMIN_PASSWORD_MAX);
const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");
const secondFactor = {
  totp: code.optional(),
  recoveryCode: z.string().trim().min(1).max(40).optional()
};

function qrDataUrl(text: string) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The signed-in admin's own account: password, sessions, two-step sign-in and address. */
export function registerAdminAccountRoutes(app: FastifyInstance, auth: AdminAuthService) {
  const admin = { preHandler: auth.requireAdmin };
  const status = async (request: Parameters<AdminAuthService["status"]>[0]) => {
    return auth.status(request);
  };

  app.get("/api/admin/account", admin, async (request, reply): Promise<AdminAccountStatus> => {
    reply.header("cache-control", "no-store");
    return status(request);
  });

  app.post("/api/admin/account/password", admin, async (request, reply) => {
    const body = parseInput(
      z
        .object({
          currentPassword,
          newPassword: z
            .string()
            .min(ADMIN_PASSWORD_MIN, `Use at least ${ADMIN_PASSWORD_MIN} characters`)
            .max(ADMIN_PASSWORD_MAX)
        })
        .strict(),
      request.body
    );
    await auth.changePassword(request, reply, body.currentPassword, body.newPassword);
    return { ok: true };
  });

  app.post("/api/admin/account/username", admin, async (request, reply) => {
    const body = parseInput(
      z
        .object({
          currentPassword,
          username: z
            .string()
            .trim()
            .regex(/^[\w.@-]{1,100}$/, "Use letters, digits and . _ - @ only")
        })
        .strict(),
      request.body
    );
    await auth.changeUsername(request, reply, body.currentPassword, body.username);
    return { ok: true, username: body.username };
  });

  app.delete("/api/admin/account/sessions/:id", admin, async (request) => {
    const { id } = parseInput(z.object({ id: z.string().min(8).max(100) }), request.params);
    await auth.revokeSession(request, id);
    return { ok: true };
  });

  app.post("/api/admin/account/sessions/revoke-others", admin, async (request) => {
    await auth.revokeOtherSessions(request);
    return { ok: true };
  });

  app.post("/api/admin/account/totp/setup", admin, async (request): Promise<AdminTotpSetup> => {
    const body = parseInput(z.object({ currentPassword }).strict(), request.body);
    const { secret, otpauthUri } = await auth.beginTotp(request, body.currentPassword);
    return { secret, otpauthUri, qrCode: qrDataUrl(otpauthUri) };
  });

  app.post(
    "/api/admin/account/totp/enable",
    admin,
    async (request): Promise<AdminRecoveryCodes> => {
      const body = parseInput(z.object({ code }).strict(), request.body);
      return { recoveryCodes: await auth.confirmTotp(body.code) };
    }
  );

  app.post("/api/admin/account/totp/disable", admin, async (request) => {
    const { currentPassword: password, ...second } = parseInput(
      z.object({ currentPassword, ...secondFactor }).strict(),
      request.body
    );
    await auth.disableTotp(request, password, second);
    return { ok: true };
  });

  app.post(
    "/api/admin/account/totp/recovery-codes",
    admin,
    async (request): Promise<AdminRecoveryCodes> => {
      const body = parseInput(z.object({ currentPassword, totp: code }).strict(), request.body);
      return {
        recoveryCodes: await auth.regenerateRecoveryCodes(request, body.currentPassword, body.totp)
      };
    }
  );

  app.post("/api/admin/account/path", admin, async (request) => {
    const body = parseInput(
      z.object({ currentPassword, path: z.string().trim().min(1).max(100) }).strict(),
      request.body
    );
    return { pending: await auth.beginPathSwitch(request, body.currentPassword, body.path) };
  });

  app.post("/api/admin/account/path/confirm", admin, async (request) => {
    const { from } = parseInput(z.object({ from: z.string().max(100) }).strict(), request.body);
    return { current: await auth.confirmPathSwitch(from) };
  });

  app.delete("/api/admin/account/path", admin, async () => {
    await auth.cancelPathSwitch();
    return { ok: true };
  });
}
