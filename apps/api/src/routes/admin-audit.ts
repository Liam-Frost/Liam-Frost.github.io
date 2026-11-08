import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { AdminAuthService } from "../auth/service";
import { getPrismaClient } from "../db/client";

type AuditRow = {
  id: string;
  createdAt: Date;
  actor: string | null;
  action: string;
  method: string;
  resource: string;
  status: number;
  ip: string;
};
export function registerAdminAudit(app: FastifyInstance, auth: AdminAuthService) {
  const db = getPrismaClient();
  const memory: AuditRow[] = [];
  const actors = new WeakMap<object, string | null>();
  app.addHook("onRequest", async (request) => {
    if (request.routeOptions.url?.startsWith("/api/admin/"))
      actors.set(request, auth.identify(request)?.username ?? null);
  });
  app.addHook("onResponse", async (request, reply) => {
    const route = request.routeOptions.url ?? "";
    if (!route.startsWith("/api/admin/")) return;
    const write = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (!write && reply.statusCode < 400 && !route.endsWith("/callback")) return;
    const action = route.endsWith("/login")
      ? "login"
      : route.endsWith("/logout")
        ? "logout"
        : write
          ? "write"
          : "access";
    const params = request.params as Record<string, unknown> | null;
    const id = params?.id ?? params?.slug ?? params?.group;
    const resource =
      typeof id === "string" && /^[a-zA-Z0-9_.:-]{1,80}$/.test(id) ? `${route} [${id}]` : route;
    const settingsRevision = reply.getHeader("x-settings-revision");
    const revisionSuffix =
      route.includes("/site-settings/") &&
      typeof settingsRevision === "string" &&
      /^[a-f0-9]{64}$/.test(settingsRevision)
        ? ` @${settingsRevision}`
        : "";
    const row: AuditRow = {
      id: randomUUID(),
      createdAt: new Date(),
      actor:
        action === "login" && reply.statusCode < 400
          ? auth.config.username
          : (actors.get(request) ?? null),
      action,
      method: request.method,
      resource: (resource + revisionSuffix).slice(0, 280),
      status: reply.statusCode,
      ip: request.ip
    };
    try {
      if (db) await db.adminAuditEvent.create({ data: row });
      else {
        memory.unshift(row);
        memory.splice(1000);
      }
    } catch {
      request.log.error({ action, status: reply.statusCode }, "Admin audit persistence failed");
    }
  });
  app.get("/api/admin/audit", { preHandler: auth.requireAdmin }, async (request, reply) => {
    reply.header("cache-control", "no-store");
    const q = request.query as Record<string, string | undefined>;
    const page = Math.max(
      0,
      Math.min(10000, Number.isFinite(Number(q.page)) ? Math.floor(Number(q.page)) : 0)
    );
    const action = ["login", "logout", "write", "access"].includes(q.action ?? "")
      ? q.action
      : undefined;
    const status =
      q.outcome === "failure" ? { gte: 400 } : q.outcome === "success" ? { lt: 400 } : undefined;
    const where = { ...(action ? { action } : {}), ...(status ? { status } : {}) };
    const rows = db
      ? await db.adminAuditEvent.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: page * 50,
          take: 51
        })
      : memory
          .filter(
            (r) =>
              (!action || r.action === action) &&
              (!status || (q.outcome === "failure" ? r.status >= 400 : r.status < 400))
          )
          .slice(page * 50, page * 50 + 51);
    return { items: rows.slice(0, 50), page, hasMore: rows.length > 50, persistent: Boolean(db) };
  });
}
