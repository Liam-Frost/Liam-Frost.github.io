import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  matchTechnologies,
  technologyKey,
  TECHNOLOGY_ALIASES
} from "../src/projects/technology-matching";
import { MAX_PROJECT_TECHNOLOGIES, MAX_TECHNOLOGY_PROJECTS } from "../src/lib/validation";
import { measureIcon } from "../src/stack/optics";
import { buildTestServer, csrf, login } from "./helpers";
import { MemoryProjectRepository } from "./memory-project-repository";
import { MemoryStackRepository } from "./memory-stack-repository";

type AdminTechnology = { id: string; name: string; projectIds: string[] };
type PublicTechnology = { name: string; projects: { slug: string }[] };

async function setup() {
  const stack = new MemoryStackRepository();
  const projects = new MemoryProjectRepository(stack);
  const app = await buildTestServer({}, { stack, projects });
  const headers = { ...csrf, cookie: await login(app) };
  const call = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url, headers, ...(payload ? { payload } : {}) });

  const category = (
    await call("POST", "/api/admin/stack/categories", { name: { zh: "前端" } })
  ).json().categories[0] as { id: string };
  const technology = async (name: string, extra: object = {}) => {
    const response = await call("POST", "/api/admin/stack/technologies", {
      categoryId: category.id,
      name,
      ...extra
    });
    expect(response.statusCode).toBe(201);
    return (response.json().categories[0].technologies as AdminTechnology[]).find(
      (t) => t.name === name
    )!;
  };
  const project = async (slug: string, visibility: "public" | "private" = "public") => {
    const created = await call("POST", "/api/admin/projects", { slug, title: { en: slug } });
    const id = created.json().project.id as string;
    await call("PATCH", `/api/admin/projects/${id}`, { visibility });
    return id;
  };
  const adminTechnology = async (id: string) =>
    (
      (await call("GET", "/api/admin/stack")).json().categories as {
        technologies: AdminTechnology[];
      }[]
    )
      .flatMap((c) => c.technologies)
      .find((t) => t.id === id);
  const adminProject = async (id: string) =>
    (await call("GET", `/api/admin/projects/${id}`)).json().project as {
      technologyIds: string[];
      techStack: string[];
      otherTechnologies: string[];
    };
  const publicStack = async () =>
    (
      (await app.inject("/api/stack")).json().categories as { technologies: PublicTechnology[] }[]
    ).flatMap((c) => c.technologies);
  return {
    app,
    stack,
    projects,
    call,
    category,
    technology,
    project,
    adminTechnology,
    adminProject,
    publicStack
  };
}

describe("project ↔ technology links", () => {
  it("are one set of links, edited from either side", async () => {
    const { call, technology, project, adminTechnology, adminProject } = await setup();
    const react = await technology("React");
    const vite = await technology("Vite");
    const site = await project("site");
    const tools = await project("tools");

    // From the technology: React is used by both projects.
    const linked = await call("PATCH", `/api/admin/stack/technologies/${react.id}`, {
      projectIds: [site, tools]
    });
    expect(linked.statusCode).toBe(200);
    expect((await adminProject(site)).technologyIds).toEqual([react.id]);
    expect((await adminProject(tools)).technologyIds).toEqual([react.id]);

    // From the project: the site also uses Vite, listed first.
    const saved = await call("PATCH", `/api/admin/projects/${site}`, {
      technologyIds: [vite.id, react.id],
      otherTechnologies: ["Fastify"]
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().project).toMatchObject({
      technologyIds: [vite.id, react.id],
      otherTechnologies: ["Fastify"],
      techStack: ["Vite", "React", "Fastify"]
    });
    expect((await adminTechnology(vite.id))!.projectIds).toEqual([site]);

    // A project linked from the technology side gets it at the end of its own list.
    await call("PATCH", `/api/admin/stack/technologies/${vite.id}`, { projectIds: [site, tools] });
    expect((await adminProject(tools)).technologyIds).toEqual([react.id, vite.id]);

    // Unlinking from the technology side is seen from the project.
    await call("PATCH", `/api/admin/stack/technologies/${react.id}`, { projectIds: [tools] });
    expect((await adminProject(site)).technologyIds).toEqual([vite.id]);

    // A new technology can be created with its projects.
    const css = await technology("CSS", { projectIds: [site] });
    expect(css.projectIds).toEqual([site]);
    expect((await adminProject(site)).technologyIds).toEqual([vite.id, css.id]);
  });

  it("keeps the per-project and per-technology limits from either side", async () => {
    const { call, stack, category, technology, project, adminProject } = await setup();
    const site = await project("site");
    // A project with the most technologies the project form accepts.
    const many = await Promise.all(
      Array.from({ length: MAX_PROJECT_TECHNOLOGIES }, (_, i) => technology(`T${i}`))
    );
    const full = await call("PATCH", `/api/admin/projects/${site}`, {
      technologyIds: many.map((t) => t.id)
    });
    expect(full.statusCode).toBe(200);

    // The stack side cannot push it past that, on update or on create…
    const extra = await technology("Extra");
    const refused = await call("PATCH", `/api/admin/stack/technologies/${extra.id}`, {
      projectIds: [site]
    });
    expect(refused.statusCode).toBe(400);
    expect(refused.json().error.code).toBe("TOO_MANY_TECHNOLOGIES");
    const created = await call("POST", "/api/admin/stack/technologies", {
      categoryId: category.id,
      name: "Never",
      projectIds: [site]
    });
    expect(created.json().error.code).toBe("TOO_MANY_TECHNOLOGIES");
    // …but a technology already linked to it can still be saved with it.
    const kept = await call("PATCH", `/api/admin/stack/technologies/${many[0]!.id}`, {
      projectIds: [site],
      name: "T0 renamed"
    });
    expect(kept.statusCode).toBe(200);
    expect((await adminProject(site)).technologyIds).toHaveLength(MAX_PROJECT_TECHNOLOGIES);

    // And the project side cannot push a technology past its number of projects.
    const busy = await technology("Busy");
    for (let i = 0; i < MAX_TECHNOLOGY_PROJECTS; i++)
      stack.links.push({ projectId: `p${i}`, technologyId: busy.id, sortOrder: 0 });
    const other = await project("other");
    const tooMany = await call("PATCH", `/api/admin/projects/${other}`, {
      technologyIds: [busy.id]
    });
    expect(tooMany.json().error.code).toBe("TOO_MANY_PROJECTS");
  });

  it("keeps the limit when requests race from both sides", async () => {
    const { call, stack, projects, technology, project, adminProject } = await setup();
    const site = await project("site");
    const many = await Promise.all(
      Array.from({ length: MAX_PROJECT_TECHNOLOGIES - 1 }, (_, i) => technology(`T${i}`))
    );
    const base = many.map((t) => t.id);
    await call("PATCH", `/api/admin/projects/${site}`, { technologyIds: base });
    const [a, b, c] = [await technology("A"), await technology("B"), await technology("C")];
    // Slow reads, like a real database: without one lock around check and write, both requests
    // would read 39 links before either writes.
    const slow = <T extends object, K extends keyof T>(repo: T, key: K) => {
      const read = (repo[key] as (...args: unknown[]) => Promise<unknown>).bind(repo);
      (repo as Record<K, unknown>)[key] = async (...args: unknown[]) => {
        const value = await read(...args);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value;
      };
    };
    slow(projects, "list");
    slow(stack, "list");

    // One slot left: two technologies race for it; only one may take it.
    const stackSide = await Promise.all([
      call("PATCH", `/api/admin/stack/technologies/${a.id}`, { projectIds: [site] }),
      call("PATCH", `/api/admin/stack/technologies/${b.id}`, { projectIds: [site] })
    ]);
    expect(stackSide.map((r) => r.statusCode).sort()).toEqual([200, 400]);
    expect((await adminProject(site)).technologyIds).toHaveLength(MAX_PROJECT_TECHNOLOGIES);

    // The project form (a whole list) racing a technology dialog never leaves more than the limit.
    await call("PATCH", `/api/admin/projects/${site}`, { technologyIds: base });
    await Promise.all([
      call("PATCH", `/api/admin/projects/${site}`, { technologyIds: [...base, c.id] }),
      call("PATCH", `/api/admin/stack/technologies/${a.id}`, { projectIds: [site] })
    ]);
    expect((await adminProject(site)).technologyIds.length).toBeLessThanOrEqual(
      MAX_PROJECT_TECHNOLOGIES
    );
  });

  it("refuses unknown or repeated ids and needs a signed-in admin", async () => {
    const { app, call, technology, project } = await setup();
    const react = await technology("React");
    const site = await project("site");
    const missing = "00000000-0000-4000-8000-000000000000";

    const unknownProject = await call("PATCH", `/api/admin/stack/technologies/${react.id}`, {
      projectIds: [missing]
    });
    expect(unknownProject.statusCode).toBe(400);
    expect(unknownProject.json().error.code).toBe("UNKNOWN_PROJECT");
    const unknownTechnology = await call("PATCH", `/api/admin/projects/${site}`, {
      technologyIds: [missing]
    });
    expect(unknownTechnology.statusCode).toBe(400);
    expect(unknownTechnology.json().error.code).toBe("UNKNOWN_TECHNOLOGY");
    expect(
      (await call("PATCH", `/api/admin/projects/${site}`, { technologyIds: [react.id, react.id] }))
        .statusCode
    ).toBe(400);
    expect(
      (await call("PATCH", `/api/admin/stack/technologies/${react.id}`, { projectIds: ["x"] }))
        .statusCode
    ).toBe(400);

    const anonymous = await app.inject({
      method: "PATCH",
      url: `/api/admin/stack/technologies/${react.id}`,
      headers: csrf,
      payload: { projectIds: [site] }
    });
    expect(anonymous.statusCode).toBe(401);
  });

  it("deleting a project or a technology removes only the links", async () => {
    const { call, technology, project, adminTechnology, adminProject } = await setup();
    const react = await technology("React");
    const vite = await technology("Vite");
    const site = await project("site");
    const tools = await project("tools");
    await call("PATCH", `/api/admin/projects/${site}`, { technologyIds: [react.id, vite.id] });
    await call("PATCH", `/api/admin/projects/${tools}`, { technologyIds: [react.id] });

    expect((await call("DELETE", `/api/admin/projects/${tools}`)).statusCode).toBe(204);
    expect((await adminTechnology(react.id))!.projectIds).toEqual([site]);

    await call("DELETE", `/api/admin/stack/technologies/${vite.id}`);
    expect(await adminTechnology(react.id)).toBeDefined();
    expect((await adminProject(site)).technologyIds).toEqual([react.id]);
  });

  it("shows only public projects, and never hidden technologies, on the site", async () => {
    const { app, call, category, technology, project, publicStack } = await setup();
    const react = await technology("React");
    const secret = await technology("Secret", { visible: false });
    const site = await project("site");
    const tools = await project("tools");
    const draft = await project("draft-project", "private");
    await call("PATCH", `/api/admin/projects/${tools}`, { technologyIds: [react.id] });
    await call("PATCH", `/api/admin/projects/${site}`, { technologyIds: [react.id, secret.id] });
    await call("PATCH", `/api/admin/projects/${draft}`, { technologyIds: [react.id] });

    const response = await app.inject("/api/stack");
    expect(response.body).not.toContain("draft-project");
    const technologies = await publicStack();
    expect(technologies.map((t) => t.name)).toEqual(["React"]);
    // In the projects' order (new projects go first).
    expect(technologies[0]!.projects.map((p) => p.slug)).toEqual(["tools", "site"]);
    expect(Object.keys(technologies[0]!.projects[0]!).sort()).toEqual([
      "slug",
      "status",
      "summary",
      "thumbnail",
      "title"
    ]);

    // The project's own page lists public technologies only.
    const page = (await app.inject("/api/projects/site")).json();
    expect(page.techStack).toEqual(["React"]);

    // Hiding the category hides its technologies from projects too.
    await call("PATCH", `/api/admin/stack/categories/${category.id}`, { visible: false });
    expect((await app.inject("/api/projects/site")).json().techStack).toEqual([]);
    expect(await publicStack()).toEqual([]);
  });
});

describe("matching old technology names", () => {
  const technologies = [
    { id: "react", name: "React" },
    { id: "boot", name: "Spring Boot" },
    { id: "pr", name: "Premiere" },
    { id: "cpp", name: "C++" },
    { id: "py-a", name: "Python" },
    { id: "py-b", name: "Python" }
  ];

  it("matches case, spacing, punctuation and common names only", () => {
    expect(
      matchTechnologies(
        [
          "react.js",
          "SpringBoot",
          "Adobe Premiere Pro",
          "cpp",
          "C#",
          "Reactive",
          "React",
          "Python"
        ],
        technologies
      )
    ).toEqual({
      linked: [
        { name: "react.js", technologyId: "react" },
        { name: "SpringBoot", technologyId: "boot" },
        { name: "Adobe Premiere Pro", technologyId: "pr" },
        { name: "cpp", technologyId: "cpp" }
      ],
      unmatched: ["C#", "Reactive"],
      ambiguous: ["Python"]
    });
    expect(technologyKey(" Node.js ")).toBe("nodejs");
    expect(technologyKey("Node")).toBe("nodejs");
  });

  it("uses the same aliases as the migration", () => {
    const sql = readFileSync(
      new URL(
        "../prisma/migrations/20261111090000_project_technologies/migration.sql",
        import.meta.url
      ),
      "utf8"
    );
    const pairs = Object.fromEntries(
      [...sql.matchAll(/\('([^']+)', '([^']+)'\)/g)].map((m) => [m[1], m[2]])
    );
    expect(pairs).toEqual(TECHNOLOGY_ALIASES);
  });
});

describe("logo optics", () => {
  const svg = (body: string) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`);

  it("shows filled squares smaller than outlines, and fills the slot with padded logos", async () => {
    const square = await measureIcon(svg('<rect width="24" height="24" fill="#3178c6"/>'));
    const ring = await measureIcon(
      svg('<circle cx="12" cy="12" r="10" fill="none" stroke="#61dafb" stroke-width="1.5"/>')
    );
    const padded = await measureIcon(
      svg('<circle cx="12" cy="12" r="5" fill="none" stroke="#61dafb"/>')
    );
    expect(square.scale).toBeLessThan(0.95);
    expect(ring.scale).toBeGreaterThan(square.scale);
    expect(padded.scale).toBeGreaterThan(1.3);
    expect(square.tone).toBeNull();
  });

  it("marks logos that would vanish in one theme", async () => {
    expect((await measureIcon(svg('<circle cx="12" cy="12" r="9" fill="#233a51"/>'))).tone).toBe(
      "dark"
    );
    expect((await measureIcon(svg('<circle cx="12" cy="12" r="9" fill="#fafafa"/>'))).tone).toBe(
      "light"
    );
    const brandSquare = svg(
      '<rect width="24" height="24" fill="#001e36"/><text x="4" y="17" fill="#31a8ff" font-size="12">Ps</text><rect x="6" y="6" width="8" height="8" fill="#31a8ff"/>'
    );
    expect((await measureIcon(brandSquare)).tone).toBe("contrast");
  });
});
