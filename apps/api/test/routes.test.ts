import { describe, expect, it } from "vitest";

import { buildTestServer } from "./helpers";

describe("public routes", () => {
  it("reports health in seed mode", async () => {
    const app = await buildTestServer();
    const response = await app.inject("/api/health");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, database: "seed" });
  });

  it("serves seed photos and a single photo", async () => {
    const app = await buildTestServer();
    const list = await app.inject("/api/photos");
    expect(list.statusCode).toBe(200);
    expect(list.json().length).toBeGreaterThan(0);

    const id = list.json()[0].id as string;
    const one = await app.inject(`/api/photos/${encodeURIComponent(id)}`);
    expect(one.statusCode).toBe(200);
    expect(one.json().id).toBe(id);
  });

  it("returns structured 404s for unknown photos and routes", async () => {
    const app = await buildTestServer();
    const photo = await app.inject("/api/photos/no-such-photo");
    expect(photo.statusCode).toBe(404);
    expect(photo.json()).toEqual({ error: { code: "NOT_FOUND", message: "Photo not found" } });

    const route = await app.inject("/api/nope");
    expect(route.statusCode).toBe(404);
    expect(route.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
  });

  it("sets security headers on every response", async () => {
    const app = await buildTestServer();
    const response = await app.inject("/api/health");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});
