import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config/env";
import { buildServer } from "../src/server";

describe("global request rate limit", () => {
  it("shares a per-IP budget across routes, returns 429, and leaves health probes available", async () => {
    const app = await buildServer({ config: loadConfig({}), logger: false, requestLimit: 2 });
    try {
      expect((await app.inject("/api/admin/session")).statusCode).toBe(200);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/admin/logout",
            headers: { "x-admin-request": "1" }
          })
        ).statusCode
      ).toBe(200);
      const blocked = await app.inject("/api/photos");
      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().error.code).toBe("RATE_LIMITED");
      expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
      expect((await app.inject("/api/health")).statusCode).toBe(200);
      expect(
        (await app.inject({ url: "/api/admin/session", remoteAddress: "192.0.2.1" })).statusCode
      ).toBe(200);
    } finally {
      await app.close();
    }
  });
});
