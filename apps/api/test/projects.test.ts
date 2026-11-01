import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { buildTestServer, csrf, login, multipartFile } from "./helpers";
import { MemoryProjectRepository } from "./memory-project-repository";

let png: Buffer;

beforeAll(async () => {
  png = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#3a6" } })
    .png()
    .toBuffer();
});

async function setup() {
  const uploadDir = mkdtempSync(join(tmpdir(), "lf-projects-"));
  const projects = new MemoryProjectRepository();
  const app = await buildTestServer({ UPLOAD_DIR: uploadDir }, { projects });
  const cookie = await login(app);
  const headers = { ...csrf, cookie };

  const create = async (slug = "site", title = { en: "Site" }) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/projects",
      headers,
      payload: { title, slug }
    });
    return response;
  };
  const patch = (id: string, payload: object) =>
    app.inject({ method: "PATCH", url: `/api/admin/projects/${id}`, headers, payload });
  const upload = (id: string, slot: "cover" | "gallery") => {
    const body = multipartFile("shot.png", png, "image/png");
    return app.inject({
      method: "POST",
      url: `/api/admin/projects/${id}/images?slot=${slot}`,
      headers: { ...headers, ...body.headers },
      payload: body.payload
    });
  };
  return { app, projects, cookie, headers, uploadDir, create, patch, upload };
}

describe("public project routes", () => {
  it("returns no projects without a database", async () => {
    const app = await buildTestServer();
    expect((await app.inject("/api/projects")).json()).toEqual([]);
    expect((await app.inject("/api/projects/anything")).statusCode).toBe(404);
  });

  it("shows only public projects, by slug", async () => {
    const { app, create, patch } = await setup();
    const hidden = (await create("hidden")).json().project;
    const shown = (await create("shown", { en: "Shown" })).json().project;
    await patch(shown.id, {
      visibility: "public",
      summary: { en: "One line" },
      body: { en: "# Hello" }
    });

    const list = (await app.inject("/api/projects")).json();
    expect(list.map((p: { slug: string }) => p.slug)).toEqual(["shown"]);
    expect(list[0].body).toBeUndefined();
    expect(list[0].id).toBeUndefined();

    const detail = (await app.inject("/api/projects/shown")).json();
    expect(detail).toMatchObject({ slug: "shown", body: { en: "# Hello" }, gallery: [] });
    expect((await app.inject(`/api/projects/${hidden.slug}`)).statusCode).toBe(404);
  });
});

describe("admin project management", () => {
  it("needs a database", async () => {
    const app = await buildTestServer();
    const cookie = await login(app);
    expect((await app.inject({ url: "/api/admin/projects", headers: { cookie } })).statusCode).toBe(
      503
    );
  });

  it("reports an unreachable database as 503 DATABASE_UNAVAILABLE", async () => {
    const { app, projects, cookie } = await setup();
    const refused = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
      code: "ECONNREFUSED"
    });
    projects.list = async () => {
      throw refused;
    };
    const response = await app.inject({ url: "/api/admin/projects", headers: { cookie } });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("DATABASE_UNAVAILABLE");
  });

  it("creates hidden projects with unique, normalized slugs", async () => {
    const { create } = await setup();
    const created = await create("My-Site");
    expect(created.statusCode).toBe(201);
    expect(created.json().project).toMatchObject({
      slug: "my-site",
      visibility: "private",
      status: "in-progress",
      gallery: [],
      cover: null
    });

    expect((await create("my-site")).statusCode).toBe(409);
    expect((await create("bad slug")).statusCode).toBe(400);
    expect((await create("ok", {} as { en: string })).statusCode).toBe(400);
  });

  it("validates and saves edits", async () => {
    const { create, patch } = await setup();
    const { id } = (await create()).json().project;
    await create("taken");

    expect((await patch(id, { slug: "taken" })).statusCode).toBe(409);
    expect((await patch(id, { links: { repo: "javascript:alert(1)" } })).statusCode).toBe(400);
    expect((await patch(id, { startedAt: "2025-06", endedAt: "2025-01" })).statusCode).toBe(400);
    expect((await patch(id, { techStack: ["React", "react"] })).statusCode).toBe(400);

    const saved = await patch(id, {
      summary: { zh: "个人网站", en: "Personal site" },
      techStack: ["React", "Fastify"],
      links: { repo: "https://github.com/x/y", demo: "" },
      status: "completed",
      startedAt: "2025-01",
      endedAt: "2025-06",
      featured: true
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().project).toMatchObject({
      techStack: ["React", "Fastify"],
      links: { repo: "https://github.com/x/y" },
      status: "completed",
      startedAt: "2025-01",
      endedAt: "2025-06",
      featured: true
    });
    expect((await patch(id, { endedAt: null })).json().project.endedAt).toBeNull();
  });

  it("uploads, replaces and deletes images, hiding them while the project is hidden", async () => {
    const { app, cookie, uploadDir, create, patch, upload, headers } = await setup();
    const { id } = (await create()).json().project;

    const first = await upload(id, "cover");
    expect(first.statusCode).toBe(201);
    const cover = first.json().project.cover;
    expect(cover.variants.map((v: { width: number }) => v.width)).toEqual([640, 1280, 1600]);
    expect(cover.src).toBe(`/uploads/projects/${id}/${cover.id}/1600.webp`);

    // Hidden project: only the admin can load its images.
    expect((await app.inject(cover.src)).statusCode).toBe(404);
    expect(
      (await app.inject({ url: cover.src, headers: { cookie } })).headers["cache-control"]
    ).toBe("private, no-store");

    // Replacing the cover removes the old files.
    const second = (await upload(id, "cover")).json().project.cover;
    expect(second.id).not.toBe(cover.id);
    expect(existsSync(join(uploadDir, "projects", id, cover.id))).toBe(false);
    expect(existsSync(join(uploadDir, "projects", id, second.id))).toBe(true);

    const a = (await upload(id, "gallery")).json().project.gallery[0];
    const b = (await upload(id, "gallery")).json().project.gallery[1];
    expect((await patch(id, { gallery: [a.id] })).statusCode).toBe(409);
    const reordered = await patch(id, { gallery: [b.id, a.id] });
    expect(reordered.json().project.gallery.map((g: { id: string }) => g.id)).toEqual([b.id, a.id]);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/admin/projects/${id}/images/${a.id}`,
      headers
    });
    expect(removed.json().project.gallery.map((g: { id: string }) => g.id)).toEqual([b.id]);
    expect(existsSync(join(uploadDir, "projects", id, a.id))).toBe(false);

    // Published: anyone can load the images, cached forever.
    await patch(id, { visibility: "public" });
    const publicCover = await app.inject(second.src);
    expect(publicCover.statusCode).toBe(200);
    expect(publicCover.headers["cache-control"]).toMatch(/immutable/);
    expect((await app.inject(`/uploads/projects/${id}/${second.id}/original.png`)).statusCode).toBe(
      404
    );
    expect((await app.inject(`/uploads/projects/${id}/${a.id}/640.webp`)).statusCode).toBe(404);
  });

  it("keeps every screenshot when uploads run concurrently", async () => {
    const { create, upload } = await setup();
    const { id } = (await create()).json().project;
    const responses = await Promise.all([
      upload(id, "gallery"),
      upload(id, "gallery"),
      upload(id, "gallery")
    ]);
    expect(responses.map((r) => r.statusCode)).toEqual([201, 201, 201]);
    const ids = responses.map((r) => r.json().project.gallery.at(-1).id);
    const last = responses.map((r) => r.json().project.gallery.length).sort();
    expect(last).toEqual([1, 2, 3]);
    expect(new Set(ids).size).toBe(3);
  });

  it("deletes a project with all its files", async () => {
    const { app, uploadDir, create, upload, headers } = await setup();
    const { id } = (await create()).json().project;
    await upload(id, "cover");
    await upload(id, "gallery");

    expect(
      (await app.inject({ method: "DELETE", url: `/api/admin/projects/${id}`, headers })).statusCode
    ).toBe(204);
    expect(existsSync(join(uploadDir, "projects", id))).toBe(false);
    expect((await app.inject({ url: `/api/admin/projects/${id}`, headers })).statusCode).toBe(404);
  });

  it("reorders projects only with the complete, current list", async () => {
    const { app, create, headers } = await setup();
    const ids = [];
    for (const slug of ["a", "b", "c"]) ids.push((await create(slug)).json().project.id);

    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/projects/order",
          headers,
          payload: { ids: ids.slice(1) }
        })
      ).statusCode
    ).toBe(409);
    const ok = await app.inject({
      method: "PUT",
      url: "/api/admin/projects/order",
      headers,
      payload: { ids: [ids[2], ids[0], ids[1]] }
    });
    expect(ok.json().projects.map((p: { slug: string }) => p.slug)).toEqual(["c", "a", "b"]);
  });
});
