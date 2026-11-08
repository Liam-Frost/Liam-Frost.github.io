// The real API and built admin with in-memory repositories and a throwaway account, for Playwright.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MemoryAdminAccountRepository } from "../../api/src/auth/account-repository";
import { hashPassword } from "../../api/src/auth/password";
import { loadConfig } from "../../api/src/config/env";
import type { PhotoRow } from "../../api/src/photos/types";
import { buildServer } from "../../api/src/server";
import type { SettingsRepository } from "../../api/src/settings/types";
import { MemoryAnalyticsStore } from "../../api/test/memory-analytics-store";
import { MemoryMediaRepository } from "../../api/test/memory-media-repository";
import { MemoryPhotoRepository } from "../../api/test/memory-photo-repository";
import { MemoryPlaylistRepository } from "../../api/test/memory-playlist-repository";
import { MemoryProjectRepository } from "../../api/test/memory-project-repository";
import { MemoryStackRepository } from "../../api/test/memory-stack-repository";
import { ADMIN_PATH, PASSWORD, PORT, USERNAME } from "./constants";

const here = dirname(fileURLToPath(import.meta.url));

class Settings implements SettingsRepository {
  values = new Map<string, unknown>();
  async get(key: string) {
    return structuredClone(this.values.get(key) ?? null);
  }
  async set(key: string, value: unknown) {
    this.values.set(key, structuredClone(value));
  }
}

const settings = new Settings();
const photos = new MemoryPhotoRepository();
const stack = new MemoryStackRepository();
const media = new MemoryMediaRepository();
const projects = new MemoryProjectRepository(stack);
const playlists = new MemoryPlaylistRepository(media);

const SIZES = [
  [1600, 1067],
  [1067, 1600],
  [1600, 900],
  [1200, 1200]
] as const;

function photo(index: number): PhotoRow {
  const [width, height] = SIZES[index % 4]!;
  const now = new Date("2026-01-01");
  return {
    id: `photo${index}`,
    slug: `photo${index}`,
    title: { zh: `示例照片 ${index + 1}`, en: `Sample ${index + 1}` },
    date: "2026-01-01",
    category: { zh: "城市" },
    location: null,
    camera: null,
    lens: null,
    settings: null,
    description: null,
    tags: [],
    alt: {},
    width,
    height,
    src: `/__e2e/image/${index}/${width}/${height}.svg`,
    storage: "remote-url",
    storageKey: null,
    variants: null,
    source: null,
    visibility: "public",
    featured: index < 4,
    sortOrder: index,
    createdAt: now,
    updatedAt: now
  };
}

async function seed(scenario: "default" | "empty" | "large") {
  settings.values.clear();
  photos.rows.clear();
  stack.categories.clear();
  stack.technologies.clear();
  projects.rows.clear();
  if (scenario === "empty") return;
  const large = scenario === "large";
  await projects.create({ id: "project1", slug: "sample", title: { zh: "示例项目" } });
  for (let i = 0; i < (large ? 120 : 24); i++) photos.rows.set(`photo${i}`, photo(i));
  await settings.set("presentation.v1", {
    sections: {
      top: true,
      about: true,
      skills: true,
      projects: true,
      watching: false,
      featured: true,
      contact: true
    },
    publicLogo: { text: "" },
    adminLogo: { text: "" },
    loginBackground: {
      mode: "daily",
      photoIds: Array.from({ length: large ? 20 : 6 }, (_, i) => `photo${i}`)
    }
  });
  await settings.set("site.identity", {
    name: { zh: "霜", en: "Frost" },
    title: { zh: "霜的主页" },
    adminTitle: {}
  });
  await settings.set("site.footer", {
    owner: { zh: "霜" },
    startYear: 2024,
    showRole: true,
    links: Array.from({ length: large ? 8 : 4 }, (_, i) => ({
      label: { zh: `链接 ${i + 1}` },
      url: `https://example.com/${i}`
    }))
  });
  await settings.set("site.dictionary", {
    entries: Array.from({ length: large ? 500 : 14 }, (_, i) => ({
      id: `entry-${i}`,
      aliases: [`标签 ${i + 1}`, `alias-${i}`],
      labels: { zh: `标签 ${i + 1}`, ...(i % 3 ? { en: `Tag ${i + 1}` } : {}) }
    }))
  });
  const groups: [string, string[]][] = [
    ["前端", ["React", "TypeScript", "Vite", "Tailwind CSS", "CSS"]],
    ["后端", ["Node.js", "Fastify", "Prisma", "PostgreSQL"]],
    ["工具", ["Git", "Docker", "Playwright"]]
  ];
  for (const [position, [name, items]] of groups.entries()) {
    const categoryId = `category${position}`;
    await stack.createCategory({
      id: categoryId,
      name: { zh: name, en: name },
      description: { zh: "分类说明文字" },
      visible: true
    });
    for (const [index, item] of items.entries())
      await stack.createTechnology({
        id: `${categoryId}-${index}`,
        categoryId,
        name: item,
        iconProvider: "none",
        iconKey: null,
        websiteUrl: `https://example.com/${position}/${index}`,
        prominence: index ? "standard" : "primary",
        visible: true
      });
  }
}

const config = loadConfig({
  HOST: "127.0.0.1",
  PORT: String(PORT),
  ADMIN_USERNAME: USERNAME,
  ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD),
  ADMIN_SESSION_SECRET: "e2e-session-secret-e2e-session-secret-0123456789",
  ADMIN_PATH,
  ADMIN_COOKIE_SECURE: "false",
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), "lf-admin-e2e-"))
});
const app = await buildServer({
  config,
  logger: false,
  // One test client makes far more requests than one visitor.
  requestLimit: 100_000,
  adminDistDir: join(here, "dist"),
  webDistDir: join(here, "../../web/public"),
  photos,
  projects,
  stack,
  media,
  people: null,
  relations: null,
  playlists,
  analyticsStore: new MemoryAnalyticsStore(),
  settings,
  adminAccount: new MemoryAdminAccountRepository()
});

// Test-only controls, absent from the real server.
app.post("/__e2e/seed", async (request) => {
  await seed((request.body as { scenario?: "default" | "empty" | "large" }).scenario ?? "default");
  return { ok: true };
});
app.post("/__e2e/photo-visibility", async (request) => {
  const { id, visibility } = request.body as { id: string; visibility: "public" | "private" };
  photos.rows.set(id, { ...photos.rows.get(id)!, visibility });
  return { ok: true };
});
// The public site is not built here; its default logo is the one asset the admin borrows.
app.get("/LOGO2.svg", async (_request, reply) =>
  reply.type("image/svg+xml").send(readFileSync(join(here, "../../web/public/LOGO2.svg")))
);
app.get("/__e2e/image/:index/:width/:height", async (request, reply) => {
  const { index, width, height } = request.params as Record<string, string>;
  const [h, name] = [Number(index) * 37, Number(index) + 1];
  return reply
    .type("image/svg+xml")
    .send(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${parseInt(height!, 10)}"><rect width="100%" height="100%" fill="hsl(${h} 45% 55%)"/><text x="50%" y="50%" font-size="160" fill="#fff" text-anchor="middle">${name}</text></svg>`
    );
});

await seed("default");
await app.listen({ host: "127.0.0.1", port: PORT });
