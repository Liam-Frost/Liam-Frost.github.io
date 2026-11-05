import type {
  AdminStackIconSearchResponse,
  AdminStackResponse,
  PublicStackResponse
} from "@liam-frost/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";

import type { AdminAuthService } from "../auth/service";
import { HttpError, notFound } from "../lib/errors";
import { KeyedLock } from "../lib/keyed-lock";
import {
  parseInput,
  stackCategoryCreateSchema,
  stackCategoryDeleteSchema,
  stackCategoryUpdateSchema,
  stackIconSearchSchema,
  stackIdSchema,
  stackOrderSchema,
  stackTechnologyCreateSchema,
  stackTechnologyUpdateSchema
} from "../lib/validation";
import { variantFileName } from "../photos/mapping";
import type { StoredImage } from "../projects/types";
import { hasCatalogIcon, readCatalogIcon, searchCatalog } from "../stack/catalog";
import { readUploadedIcon } from "../stack/icons";
import { toAdminStack, toPublicStack } from "../stack/mapping";
import type {
  StackCategoryRow,
  StackRepository,
  StackTechnologyPatch,
  StackTechnologyRow
} from "../stack/types";
import { isStorageKey, type LocalImageStore } from "../storage/local";

const MAX_CATEGORIES = 30;
const MAX_TECHNOLOGIES = 300;

const duplicateName = (name: string) =>
  new HttpError(409, "NAME_TAKEN", `“${name}” is already in this category`);

/** Same name, ignoring case and surrounding space: "react" and "React" are one technology. */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The home page's tech stack. Public: GET /api/stack (one request for the whole stack) and the logos
 * (library icons under /uploads/icons, uploads under /uploads/stack). Admin: categories, technologies,
 * order and logos; every write answers with the whole stack.
 */
export function registerStackRoutes(
  app: FastifyInstance,
  auth: AdminAuthService,
  stack: StackRepository | null,
  store: LocalImageStore
) {
  app.get("/api/stack", async (request, reply): Promise<PublicStackResponse> => {
    if (!stack)
      throw new HttpError(503, "UNAVAILABLE", "The tech stack is temporarily unavailable");
    let rows;
    try {
      rows = await stack.list();
    } catch (error) {
      request.log.warn({ error }, "Stack database unavailable");
      throw new HttpError(503, "UNAVAILABLE", "The tech stack is temporarily unavailable");
    }
    reply.header("x-snapshot-data-source", "database");
    return { categories: toPublicStack(rows, store) };
  });

  // Library logos, read from the installed icon packages. Content only changes with a package upgrade.
  app.get("/uploads/icons/:provider/:file", async (request, reply) => {
    const { provider, file } = request.params as { provider: string; file: string };
    const match = /^(.+)\.svg$/.exec(file);
    const svg = match ? await readCatalogIcon(provider, match[1]!) : null;
    if (!svg) throw notFound();
    reply.header("content-type", "image/svg+xml");
    // Shown as images only; opened directly, nothing in it can run.
    reply.header(
      "content-security-policy",
      "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    );
    reply.header("x-content-type-options", "nosniff");
    reply.header("cache-control", "public, max-age=604800");
    return reply.send(svg);
  });

  // Uploaded logos: public while the technology and its category are shown.
  app.get("/uploads/stack/:id/:imageId/:file", async (request, reply) => {
    const { id, imageId, file } = request.params as { id: string; imageId: string; file: string };
    const key = `stack/${id}/${imageId}`;
    if (!stack || !isStorageKey(key)) throw notFound();
    const rows = await stack.list().catch(() => null);
    const category = rows?.find((c) => c.technologies.some((t) => t.id === id));
    const technology = category?.technologies.find((t) => t.id === id);
    if (!category || !technology || technology.customIcon?.key !== key) throw notFound();
    const isPublic = category.visible && technology.visible;
    if (!isPublic && !auth.identify(request)) throw notFound();
    const data = await store.readPublic(key, file);
    if (!data) throw notFound();
    reply.header("content-type", "image/webp");
    reply.header(
      "cache-control",
      isPublic ? "public, max-age=31536000, immutable" : "private, no-store"
    );
    return reply.send(data);
  });

  const repo = () => {
    if (!stack) {
      throw new HttpError(
        503,
        "DATABASE_NOT_CONFIGURED",
        "Tech stack management needs a database (set DATABASE_URL)"
      );
    }
    return stack;
  };
  const admin = { preHandler: auth.requireAdmin };
  // One lock for the whole stack: names are unique per category and orders span categories.
  const lock = new KeyedLock();
  const serialized = <T>(work: () => Promise<T>) => lock.run("stack", work);
  const respond = async (): Promise<AdminStackResponse> => ({
    categories: toAdminStack(await repo().list(), store)
  });
  const idOf = (request: FastifyRequest) => parseInput(stackIdSchema, request.params).id;

  const findCategory = (rows: StackCategoryRow[], id: string) => {
    const category = rows.find((c) => c.id === id);
    if (!category) throw notFound("Category not found");
    return category;
  };
  const findTechnology = (rows: StackCategoryRow[], id: string) => {
    for (const category of rows) {
      const technology = category.technologies.find((t) => t.id === id);
      if (technology) return technology;
    }
    throw notFound("Technology not found");
  };
  const checkIcon = (icon: { provider: string; key?: string }) => {
    if (icon.provider === "devicon" || icon.provider === "simpleicons") {
      if (!hasCatalogIcon(icon.provider, icon.key!))
        throw new HttpError(400, "UNKNOWN_ICON", "That icon is not in the library");
    }
  };
  const removeIcon = async (request: FastifyRequest, icon: StoredImage | null) => {
    if (!icon) return;
    await store
      .remove(icon.key)
      .catch((error) => request.log.warn({ error, key: icon.key }, "Failed to remove stack icon"));
    // The technology's folder goes too once its last logo is gone (removeIfEmpty keeps a new one).
    await store.removeIfEmpty(icon.key.split("/").slice(0, 2).join("/"));
  };

  app.get("/api/admin/stack", admin, respond);

  app.get(
    "/api/admin/stack/icons",
    admin,
    async (request): Promise<AdminStackIconSearchResponse> => {
      const { q } = parseInput(stackIconSearchSchema, request.query);
      return { icons: searchCatalog(q) };
    }
  );

  app.post("/api/admin/stack/categories", admin, async (request, reply) => {
    const input = parseInput(stackCategoryCreateSchema, request.body);
    const result = await serialized(async () => {
      if ((await repo().list()).length >= MAX_CATEGORIES)
        throw new HttpError(400, "TOO_MANY", `At most ${MAX_CATEGORIES} categories`);
      await repo().createCategory({ id: randomUUID(), ...input });
      return respond();
    });
    reply.code(201);
    return result;
  });

  app.patch("/api/admin/stack/categories/:id", admin, async (request) => {
    const id = idOf(request);
    const patch = parseInput(stackCategoryUpdateSchema, request.body);
    return serialized(async () => {
      if (!(await repo().updateCategory(id, patch))) throw notFound("Category not found");
      return respond();
    });
  });

  /**
   * Deletes a category. One with technologies needs an explicit choice: ?technologies=move&to=<id>
   * moves them to the end of another category, ?technologies=delete deletes them (and their logos).
   */
  app.delete("/api/admin/stack/categories/:id", admin, async (request) => {
    const id = idOf(request);
    const choice = parseInput(stackCategoryDeleteSchema, request.query);
    const removed = await serialized(async () => {
      const rows = await repo().list();
      const category = findCategory(rows, id);
      const technologies = category.technologies;
      if (technologies.length && !choice.technologies) {
        throw new HttpError(
          409,
          "CATEGORY_NOT_EMPTY",
          "Move or delete this category's technologies first"
        );
      }
      if (technologies.length && choice.technologies === "move") {
        if (choice.to === id) throw new HttpError(400, "VALIDATION", "Choose another category");
        const target = findCategory(rows, choice.to!);
        const clash = technologies.find((t) =>
          target.technologies.some((other) => sameName(other.name, t.name))
        );
        if (clash) throw duplicateName(clash.name);
        await repo().moveTechnologies(id, target.id);
      }
      if (technologies.length && choice.technologies === "delete") {
        for (const technology of technologies) await repo().deleteTechnology(technology.id);
      }
      await repo().deleteCategory(id);
      return choice.technologies === "delete" ? technologies : [];
    });
    for (const technology of removed) await removeIcon(request, technology.customIcon);
    request.log.info(
      {
        categoryId: id,
        technologies: choice.technologies ?? "none",
        by: request.adminUser?.username
      },
      "Stack category deleted"
    );
    return respond();
  });

  app.post("/api/admin/stack/technologies", admin, async (request, reply) => {
    const { icon, ...input } = parseInput(stackTechnologyCreateSchema, request.body);
    checkIcon(icon);
    const result = await serialized(async () => {
      const rows = await repo().list();
      const category = findCategory(rows, input.categoryId);
      if (rows.reduce((n, c) => n + c.technologies.length, 0) >= MAX_TECHNOLOGIES)
        throw new HttpError(400, "TOO_MANY", `At most ${MAX_TECHNOLOGIES} technologies`);
      if (category.technologies.some((t) => sameName(t.name, input.name)))
        throw duplicateName(input.name);
      await repo().createTechnology({
        id: randomUUID(),
        ...input,
        iconProvider: icon.provider,
        iconKey: icon.provider === "none" ? null : icon.key
      });
      return respond();
    });
    reply.code(201);
    return result;
  });

  app.patch("/api/admin/stack/technologies/:id", admin, async (request) => {
    const id = idOf(request);
    const { icon, ...input } = parseInput(stackTechnologyUpdateSchema, request.body);
    if (icon) checkIcon(icon);
    let dropped: StoredImage | null = null;
    const result = await serialized(async () => {
      const rows = await repo().list();
      const current = findTechnology(rows, id);
      const categoryId = input.categoryId ?? current.categoryId;
      const category = findCategory(rows, categoryId);
      const name = input.name ?? current.name;
      if (category.technologies.some((t) => t.id !== id && sameName(t.name, name)))
        throw duplicateName(name);

      const patch: StackTechnologyPatch = { ...input };
      if (icon) {
        // A library icon (or none) replaces an uploaded logo, whose files are then removed.
        patch.iconProvider = icon.provider;
        patch.iconKey = icon.provider === "none" ? null : icon.key;
        patch.customIcon = null;
        dropped = current.customIcon;
      }
      if (!(await repo().updateTechnology(id, patch))) throw notFound("Technology not found");
      return respond();
    });
    await removeIcon(request, dropped);
    return result;
  });

  app.delete("/api/admin/stack/technologies/:id", admin, async (request) => {
    const id = idOf(request);
    const removed = await serialized(async () => {
      const technology = findTechnology(await repo().list(), id);
      await repo().deleteTechnology(id);
      return technology;
    });
    await removeIcon(request, removed.customIcon);
    return respond();
  });

  /** Uploads a logo (SVG, PNG or WebP), replacing the current icon. */
  app.post("/api/admin/stack/technologies/:id/icon", admin, async (request, reply) => {
    const id = idOf(request);
    findTechnology(await repo().list(), id);
    const { icon, bytes } = await readUploadedIcon(request);
    const imageId = randomBytes(6).toString("hex");
    const key = `stack/${id}/${imageId}`;
    const stored: StoredImage = {
      id: imageId,
      key,
      width: icon.width,
      height: icon.height,
      variants: [{ width: icon.width, height: icon.height }]
    };
    let previous: StackTechnologyRow["customIcon"] = null;
    let result: AdminStackResponse;
    try {
      await store.write(key, variantFileName(icon.width), icon.data);
      result = await serialized(async () => {
        const current = findTechnology(await repo().list(), id);
        previous = current.customIcon;
        await repo().updateTechnology(id, {
          iconProvider: "custom",
          iconKey: null,
          customIcon: stored
        });
        return respond();
      });
    } catch (error) {
      await store.remove(key).catch(() => undefined);
      throw error;
    }
    await removeIcon(request, previous);
    request.log.info(
      { technologyId: id, bytes, by: request.adminUser?.username },
      "Stack icon uploaded"
    );
    reply.code(201);
    return result;
  });

  /**
   * Replaces the whole layout: category order, each category's technologies and their order (moving
   * a technology between categories included). The layout must list every category and technology
   * exactly once, so a stale page cannot drop anything.
   */
  app.put("/api/admin/stack/order", admin, async (request) => {
    const { categories } = parseInput(stackOrderSchema, request.body);
    return serialized(async () => {
      const rows = await repo().list();
      const technologies = new Map(
        rows.flatMap((c) => c.technologies.map((t) => [t.id, t] as const))
      );
      const listedCategories = new Set(categories.map((c) => c.id));
      const listed = categories.flatMap((c) => c.technologies);
      const stale =
        categories.length !== rows.length ||
        listedCategories.size !== rows.length ||
        rows.some((c) => !listedCategories.has(c.id)) ||
        listed.length !== technologies.size ||
        new Set(listed).size !== listed.length ||
        listed.some((id) => !technologies.has(id));
      if (stale)
        throw new HttpError(
          409,
          "ORDER_OUT_OF_DATE",
          "The tech stack changed; reload and try again"
        );
      for (const category of categories) {
        const names = category.technologies.map((id) => technologies.get(id)!.name.toLowerCase());
        const clash = names.find((name, index) => names.indexOf(name) !== index);
        if (clash)
          throw duplicateName(technologies.get(category.technologies[names.indexOf(clash)]!)!.name);
      }
      await repo().reorder(categories);
      return respond();
    });
  });
}
