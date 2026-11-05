import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { hasCatalogIcon, readCatalogIcon, searchCatalog } from "../src/stack/catalog";
import { processIcon } from "../src/stack/icons";
import { buildTestServer, csrf, login, multipartFile } from "./helpers";
import { MemoryStackRepository } from "./memory-stack-repository";

const MIGRATION = new URL(
  "../prisma/migrations/20261110090000_stack/migration.sql",
  import.meta.url
);

async function setup() {
  const stack = new MemoryStackRepository();
  const app = await buildTestServer({}, { stack });
  const headers = { ...csrf, cookie: await login(app) };
  const call = async (
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    url: string,
    payload?: object
  ) => app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
  const addCategory = async (zh: string, extra: object = {}) => {
    const response = await call("POST", "/api/admin/stack/categories", { name: { zh }, ...extra });
    expect(response.statusCode).toBe(201);
    return response.json().categories.at(-1) as { id: string };
  };
  const addTechnology = async (categoryId: string, name: string, extra: object = {}) =>
    call("POST", "/api/admin/stack/technologies", { categoryId, name, ...extra });
  const layout = async () =>
    (await call("GET", "/api/admin/stack")).json().categories as {
      id: string;
      name: { zh?: string };
      technologies: { id: string; name: string; iconUrl: string | null; iconProvider: string }[];
    }[];
  return { app, stack, headers, call, addCategory, addTechnology, layout };
}

describe("migrated defaults", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const rows = [
    ...sql.matchAll(/\('[0-9a-f-]{36}', '([0-9a-f-]{36})', '([^']+)', '(\w+)', (NULL|'[^']+')/g)
  ];

  it("keeps every technology of the old hard-coded list, in its order", () => {
    expect(rows.map((row) => row[2])).toEqual([
      "React",
      "React Router",
      "CSS",
      "TypeScript",
      "Vite",
      "Java",
      "C++",
      "Python",
      "Spring Boot",
      "Lightroom",
      "Photoshop",
      "After Effects",
      "DaVinci Resolve",
      "Premiere"
    ]);
    // Inserted with fixed ids and ON CONFLICT: running it again adds nothing.
    expect(sql.match(/ON CONFLICT \("id"\) DO NOTHING/g)).toHaveLength(2);
  });

  it("points every logo at an icon that exists in its library", async () => {
    for (const [, , name, provider, key] of rows) {
      if (provider === "none") {
        expect(name).toBe("Lightroom");
        continue;
      }
      const iconKey = key!.slice(1, -1);
      expect(
        hasCatalogIcon(provider as "devicon", iconKey),
        `${name}: ${provider}/${iconKey}`
      ).toBe(true);
      expect((await readCatalogIcon(provider!, iconKey))?.toString()).toMatch(/^<svg/);
    }
  });
});

describe("icon catalog", () => {
  it("finds icons by name, aliases and Simple Icons spelling", () => {
    expect(searchCatalog("react")[0]).toEqual({
      provider: "devicon",
      key: "react",
      title: "React",
      url: "/uploads/icons/devicon/react.svg"
    });
    expect(searchCatalog("React Router").map((i) => i.key)).toContain("reactrouter");
    expect(searchCatalog("c++")[0]?.key).toBe("cplusplus");
    expect(searchCatalog("spring boot").some((i) => i.key === "springboot")).toBe(true);
    expect(searchCatalog("lightroom")).toEqual([]);
  });

  it("serves only real icons, as images that cannot run anything", async () => {
    const app = await buildTestServer();
    const ok = await app.inject("/uploads/icons/simpleicons/springboot.svg");
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["content-type"]).toBe("image/svg+xml");
    expect(ok.headers["content-security-policy"]).toContain("sandbox");
    expect(ok.body).toMatch(/^<svg fill="#[0-9A-Fa-f]{6}"/);
    for (const url of [
      "/uploads/icons/devicon/not-an-icon.svg",
      "/uploads/icons/devicon/react.png",
      "/uploads/icons/other/react.svg",
      "/uploads/icons/devicon/..%2F..%2Fpackage.json"
    ]) {
      expect((await app.inject(url)).statusCode, url).toBe(404);
    }
  });
});

describe("public stack", () => {
  it("is unavailable (not silently empty) without a database", async () => {
    const app = await buildTestServer();
    const response = await app.inject("/api/stack");
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("UNAVAILABLE");
  });

  it("returns visible categories and technologies in order, with public fields only", async () => {
    const { app, call, addCategory, addTechnology } = await setup();
    const front = await addCategory("前端", { description: { en: "UI" } });
    const hidden = await addCategory("隐藏", { visible: false });
    const empty = await addCategory("空");
    await addTechnology(front.id, "React", {
      icon: { provider: "devicon", key: "react" },
      prominence: "primary"
    });
    await addTechnology(front.id, "Draft", { visible: false });
    await addTechnology(front.id, "Lightroom", { websiteUrl: "https://example.com/lr" });
    await addTechnology(hidden.id, "Secret");
    void empty;

    const response = await app.inject("/api/stack");
    expect(response.headers["x-snapshot-data-source"]).toBe("database");
    const { categories } = response.json();
    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({ name: { zh: "前端" }, description: { en: "UI" } });
    expect(categories[0].technologies).toEqual([
      {
        id: expect.any(String),
        name: "React",
        iconUrl: "/uploads/icons/devicon/react.svg",
        websiteUrl: null,
        prominence: "primary"
      },
      {
        id: expect.any(String),
        name: "Lightroom",
        iconUrl: null,
        websiteUrl: "https://example.com/lr",
        prominence: "standard"
      }
    ]);
    expect(Object.keys(categories[0]).sort()).toEqual([
      "description",
      "id",
      "name",
      "technologies"
    ]);
    // Hiding the category hides everything in it.
    await call("PATCH", `/api/admin/stack/categories/${front.id}`, { visible: false });
    expect((await app.inject("/api/stack")).json().categories).toEqual([]);
  });
});

describe("admin stack management", () => {
  it("needs a signed-in admin and a database", async () => {
    const { app } = await setup();
    expect((await app.inject("/api/admin/stack")).statusCode).toBe(401);
    const bare = await buildTestServer();
    const cookie = await login(bare);
    expect((await bare.inject({ url: "/api/admin/stack", headers: { cookie } })).statusCode).toBe(
      503
    );
  });

  it("validates names, icons and websites on the server", async () => {
    const { addCategory, addTechnology, call } = await setup();
    const category = await addCategory("前端");
    expect((await call("POST", "/api/admin/stack/categories", { name: {} })).statusCode).toBe(400);
    expect((await addTechnology(category.id, "  ")).statusCode).toBe(400);
    const unknown = await addTechnology(category.id, "X", {
      icon: { provider: "devicon", key: "nope-nope" }
    });
    expect(unknown.json().error.code).toBe("UNKNOWN_ICON");
    for (const websiteUrl of ["javascript:alert(1)", "ftp://x.test", "https://u:p@x.test"]) {
      expect((await addTechnology(category.id, "X", { websiteUrl })).statusCode, websiteUrl).toBe(
        400
      );
    }
    expect(
      (await addTechnology(category.id, "X", { icon: { provider: "custom" } })).statusCode
    ).toBe(400);
    expect((await addTechnology("00000000-0000-4000-8000-000000000000", "X")).statusCode).toBe(404);
  });

  it("rejects the same name twice in a category, ignoring case", async () => {
    const { addCategory, addTechnology, call, layout } = await setup();
    const a = await addCategory("A");
    const b = await addCategory("B");
    expect((await addTechnology(a.id, "React")).statusCode).toBe(201);
    expect((await addTechnology(a.id, "react")).json().error.code).toBe("NAME_TAKEN");
    // Another category may have it.
    expect((await addTechnology(b.id, "React")).statusCode).toBe(201);
    const inB = (await layout())[1]!.technologies[0]!;
    expect(
      (await call("PATCH", `/api/admin/stack/technologies/${inB.id}`, { categoryId: a.id })).json()
        .error.code
    ).toBe("NAME_TAKEN");
  });

  it("edits, hides, moves and deletes technologies", async () => {
    const { addCategory, addTechnology, call, layout } = await setup();
    const a = await addCategory("A");
    const b = await addCategory("B");
    await addTechnology(a.id, "One");
    await addTechnology(a.id, "Two");
    await addTechnology(b.id, "Three");
    const [one, two] = (await layout())[0]!.technologies;

    const edited = await call("PATCH", `/api/admin/stack/technologies/${one!.id}`, {
      name: "Uno",
      icon: { provider: "simpleicons", key: "springboot" },
      websiteUrl: "https://spring.io/projects/spring-boot",
      prominence: "primary",
      visible: false
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().categories[0].technologies[0]).toMatchObject({
      name: "Uno",
      iconProvider: "simpleicons",
      iconKey: "springboot",
      iconUrl: "/uploads/icons/simpleicons/springboot.svg",
      prominence: "primary",
      visible: false
    });

    // Moving goes to the end of the other category.
    await call("PATCH", `/api/admin/stack/technologies/${two!.id}`, { categoryId: b.id });
    expect((await layout()).map((c) => c.technologies.map((t) => t.name))).toEqual([
      ["Uno"],
      ["Three", "Two"]
    ]);

    await call("DELETE", `/api/admin/stack/technologies/${two!.id}`);
    expect((await layout())[1]!.technologies.map((t) => t.name)).toEqual(["Three"]);
  });

  it("reorders categories and technologies, across categories, only with a complete layout", async () => {
    const { addCategory, addTechnology, call, layout } = await setup();
    const a = await addCategory("A");
    const b = await addCategory("B");
    for (const name of ["1", "2", "3"]) await addTechnology(a.id, name);
    await addTechnology(b.id, "4");
    const before = await layout();
    const [t1, t2, t3] = before[0]!.technologies.map((t) => t.id);
    const t4 = before[1]!.technologies[0]!.id;

    const saved = await call("PUT", "/api/admin/stack/order", {
      categories: [
        { id: b.id, technologies: [t4, t3] },
        { id: a.id, technologies: [t2, t1] }
      ]
    });
    expect(saved.statusCode).toBe(200);
    const after = await layout();
    expect(after.map((c) => c.name.zh)).toEqual(["B", "A"]);
    expect(after.map((c) => c.technologies.map((t) => t.name))).toEqual([
      ["4", "3"],
      ["2", "1"]
    ]);

    // Missing, duplicated or unknown entries mean the page is stale.
    for (const categories of [
      [{ id: b.id, technologies: [t4, t3] }],
      [
        { id: b.id, technologies: [t4, t3, t3] },
        { id: a.id, technologies: [t2, t1] }
      ],
      [
        { id: b.id, technologies: [t4, t3] },
        { id: a.id, technologies: [t2] }
      ]
    ]) {
      expect((await call("PUT", "/api/admin/stack/order", { categories })).json().error.code).toBe(
        "ORDER_OUT_OF_DATE"
      );
    }
    expect((await layout()).map((c) => c.technologies.map((t) => t.name))).toEqual([
      ["4", "3"],
      ["2", "1"]
    ]);
  });

  it("never deletes a category's technologies without an explicit choice", async () => {
    const { addCategory, addTechnology, call, layout } = await setup();
    const a = await addCategory("A");
    const b = await addCategory("B");
    const c = await addCategory("C");
    await addTechnology(a.id, "One");
    await addTechnology(a.id, "Two");
    await addTechnology(b.id, "Three");

    const refused = await call("DELETE", `/api/admin/stack/categories/${a.id}`);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe("CATEGORY_NOT_EMPTY");
    expect((await layout())[0]!.technologies).toHaveLength(2);

    const moved = await call(
      "DELETE",
      `/api/admin/stack/categories/${a.id}?technologies=move&to=${b.id}`
    );
    expect(moved.statusCode).toBe(200);
    expect(
      (await layout()).map((cat) => [cat.name.zh, cat.technologies.map((t) => t.name)])
    ).toEqual([
      ["B", ["Three", "One", "Two"]],
      ["C", []]
    ]);

    expect((await call("DELETE", `/api/admin/stack/categories/${c.id}`)).statusCode).toBe(200);
    expect(
      (await call("DELETE", `/api/admin/stack/categories/${b.id}?technologies=delete`)).statusCode
    ).toBe(200);
    expect(await layout()).toEqual([]);
  });

  it("uploads, replaces and removes a custom logo", async () => {
    const { app, headers, addCategory, addTechnology, call, layout } = await setup();
    const category = await addCategory("A");
    await addTechnology(category.id, "Lightroom");
    const id = (await layout())[0]!.technologies[0]!.id;
    const upload = (name: string, data: Buffer, type: string) => {
      const body = multipartFile(name, data, type);
      return app.inject({
        method: "POST",
        url: `/api/admin/stack/technologies/${id}/icon`,
        headers: { ...headers, ...body.headers },
        payload: body.payload
      });
    };

    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24"><rect width="48" height="24" rx="4" fill="#31a8ff"/></svg>'
    );
    const first = await upload("lr.svg", svg, "image/svg+xml");
    expect(first.statusCode).toBe(201);
    const url = first.json().categories[0].technologies[0].iconUrl as string;
    expect(url).toMatch(/^\/uploads\/stack\/[0-9a-f-]+\/[0-9a-f]{12}\/256\.webp$/);
    const served = await app.inject(url);
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toBe("image/webp");
    // Rasterised at the target size, keeping the 2:1 ratio.
    expect(await sharp(served.rawPayload).metadata()).toMatchObject({
      width: 256,
      height: 128,
      format: "webp"
    });

    const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: "#123" } })
      .png()
      .toBuffer();
    const second = await upload("lr.png", png, "image/png");
    const replaced = second.json().categories[0].technologies[0].iconUrl as string;
    expect(replaced).not.toBe(url);
    expect((await app.inject(url)).statusCode).toBe(404);
    expect((await app.inject(replaced)).statusCode).toBe(200);

    // Removing the logo leaves the initials; the file is gone.
    await call("PATCH", `/api/admin/stack/technologies/${id}`, { icon: { provider: "none" } });
    expect((await layout())[0]!.technologies[0]).toMatchObject({
      iconProvider: "none",
      iconUrl: null
    });
    expect((await app.inject(replaced)).statusCode).toBe(404);
  });

  it("refuses unsafe or mislabelled logos", async () => {
    const bad = [
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "image/svg+xml"],
      ['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', "image/svg+xml"],
      [
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.test/x.png"/></svg>',
        "image/svg+xml"
      ],
      [
        '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>',
        "image/svg+xml"
      ],
      ['<svg xmlns="http://www.w3.org/2000/svg"/>', "image/png"],
      ["GIF89a", "image/gif"]
    ] as const;
    for (const [content, type] of bad) {
      await expect(processIcon(Buffer.from(content), type), content).rejects.toThrow();
    }
  });

  it("hides the logo of a hidden technology from visitors", async () => {
    const { app, headers, addCategory, addTechnology, call, layout } = await setup();
    const category = await addCategory("A");
    await addTechnology(category.id, "X", { visible: false });
    const id = (await layout())[0]!.technologies[0]!.id;
    const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: "#123" } })
      .png()
      .toBuffer();
    const body = multipartFile("x.png", png, "image/png");
    const url = (
      await app.inject({
        method: "POST",
        url: `/api/admin/stack/technologies/${id}/icon`,
        headers: { ...headers, ...body.headers },
        payload: body.payload
      })
    ).json().categories[0].technologies[0].iconUrl as string;
    expect((await app.inject(url)).statusCode).toBe(404);
    expect((await app.inject({ url, headers: { cookie: headers.cookie } })).statusCode).toBe(200);
    await call("PATCH", `/api/admin/stack/technologies/${id}`, { visible: true });
    expect((await app.inject(url)).statusCode).toBe(200);
  });
});
