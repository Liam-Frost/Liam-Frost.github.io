import { describe, it, expect } from "vitest";
import { buildTestServer, csrf, login, PASSWORD, USERNAME } from "./helpers";
describe("admin audit log", () => {
  it("records login outcomes and logout without credentials and enforces read-only authenticated access", async () => {
    const app = await buildTestServer();
    const anon = await app.inject("/api/admin/audit");
    expect(anon.statusCode).toBe(401);
    await app.inject({
      method: "POST",
      url: "/api/admin/login?token=hidden-query",
      headers: csrf,
      payload: { username: USERNAME, password: "wrong-password-sentinel" }
    });
    const cookie = await login(app);
    const response = await app.inject({
      url: "/api/admin/audit?action=login",
      headers: { cookie }
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const rows = response.json().items;
    expect(rows.some((r: { status: number }) => r.status === 401)).toBe(true);
    expect(rows.some((r: { status: number }) => r.status === 200)).toBe(true);
    expect(response.body).not.toContain(PASSWORD);
    expect(response.body).not.toContain("wrong-password-sentinel");
    expect(response.body).not.toContain("hidden-query");
    expect(response.body).not.toContain(cookie);
    const reject = await app.inject({
      method: "DELETE",
      url: "/api/admin/audit",
      headers: { cookie, ...csrf }
    });
    expect(reject.statusCode).toBe(404);
    await app.inject({ method: "POST", url: "/api/admin/logout", headers: { cookie, ...csrf } });
    const nextCookie = await login(app);
    const log = await app.inject({
      url: "/api/admin/audit?action=logout",
      headers: { cookie: nextCookie }
    });
    expect(log.json().items[0]).toMatchObject({ action: "logout", actor: USERNAME, status: 200 });
    await app.close();
  });
  it("filters rejected access records and caps pages", async () => {
    const app = await buildTestServer();
    await app.inject("/api/admin/me");
    const cookie = await login(app);
    const response = await app.inject({
      url: "/api/admin/audit?action=access&outcome=failure&page=-1",
      headers: { cookie }
    });
    expect(response.json().page).toBe(0);
    expect(response.json().items.every((r: { status: number }) => r.status >= 400)).toBe(true);
    await app.close();
  });
});
