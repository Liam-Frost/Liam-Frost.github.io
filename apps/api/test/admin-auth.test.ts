import { describe, expect, it } from "vitest";

import { buildTestServer, csrf, login, PASSWORD, USERNAME } from "./helpers";

describe("admin session and login", () => {
  it("reports an anonymous session without revealing the admin path", async () => {
    const app = await buildTestServer({ ADMIN_PATH: "/secret-panel" });
    const response = await app.inject("/api/admin/session");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ authenticated: false, configured: true, user: null });
    expect(response.body).not.toContain("secret-panel");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("logs in with a strict HttpOnly cookie and reveals the admin path to the admin", async () => {
    const app = await buildTestServer({ ADMIN_PATH: "secret-panel/" });
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      headers: csrf,
      payload: { username: USERNAME, password: PASSWORD }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ authenticated: true, adminPath: "/secret-panel" });

    const setCookie = String(response.headers["set-cookie"]);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);

    const cookie = `${response.cookies[0].name}=${response.cookies[0].value}`;
    const session = await app.inject({ url: "/api/admin/session", headers: { cookie } });
    expect(session.json()).toMatchObject({ authenticated: true, user: { username: USERNAME }, adminPath: "/secret-panel" });
  });

  it("rejects writes without the CSRF header", async () => {
    const app = await buildTestServer();
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { username: USERNAME, password: PASSWORD }
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: { code: "CSRF", message: "Missing required request header" } });
  });

  it("rejects wrong credentials and invalid bodies", async () => {
    const app = await buildTestServer();
    const wrong = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      headers: csrf,
      payload: { username: USERNAME, password: "nope" }
    });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().error.code).toBe("INVALID_CREDENTIALS");

    const wrongUser = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      headers: csrf,
      payload: { username: "someone", password: PASSWORD }
    });
    expect(wrongUser.statusCode).toBe(401);

    const invalid = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      headers: csrf,
      payload: { username: USERNAME, password: "x", extra: true }
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("VALIDATION");

    const badJson = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      headers: { ...csrf, "content-type": "application/json" },
      payload: "{not json"
    });
    expect(badJson.statusCode).toBe(400);
    expect(badJson.json().error.code).toBe("REQUEST_ERROR");
  });

  it("rate-limits repeated failures per IP", async () => {
    const app = await buildTestServer();
    const attempt = () =>
      app.inject({
        method: "POST",
        url: "/api/admin/login",
        headers: csrf,
        payload: { username: USERNAME, password: "nope" }
      });

    for (let i = 0; i < 8; i++) {
      expect((await attempt()).statusCode).toBe(401);
    }
    const blocked = await attempt();
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("protects admin routes and revokes the session on logout", async () => {
    const app = await buildTestServer();
    expect((await app.inject("/api/admin/me")).statusCode).toBe(401);

    const cookie = await login(app);
    const me = await app.inject({ url: "/api/admin/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ user: { username: USERNAME } });

    const logout = await app.inject({ method: "POST", url: "/api/admin/logout", headers: { ...csrf, cookie } });
    expect(logout.statusCode).toBe(200);

    const after = await app.inject({ url: "/api/admin/me", headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });

  it("rejects a tampered session cookie", async () => {
    const app = await buildTestServer();
    const cookie = await login(app);
    const [name, value] = cookie.split("=");
    const [payload, signature] = value.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), exp: 9e9 })).toString("base64url");
    const response = await app.inject({ url: "/api/admin/me", headers: { cookie: `${name}=${forged}.${signature}` } });
    expect(response.statusCode).toBe(401);
  });

  it("reports an unconfigured admin and refuses login", async () => {
    const app = await buildTestServer({ ADMIN_PASSWORD_HASH: "", ADMIN_SESSION_SECRET: "" });
    expect((await app.inject("/api/admin/session")).json()).toEqual({ authenticated: false, configured: false, user: null });

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      headers: csrf,
      payload: { username: USERNAME, password: PASSWORD }
    });
    expect(response.statusCode).toBe(503);
    expect((await app.inject("/api/admin/me")).statusCode).toBe(503);
  });
});

describe("ADMIN_ALLOWED_IPS", () => {
  it("hides admin routes from other IPs with the same 404 as an unknown route", async () => {
    const app = await buildTestServer({ ADMIN_ALLOWED_IPS: "10.0.0.5" });
    const unknown = await app.inject("/api/does-not-exist");
    const session = await app.inject({ url: "/api/admin/session", remoteAddress: "127.0.0.1" });
    const login = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      remoteAddress: "127.0.0.1",
      payload: { username: USERNAME, password: PASSWORD }
    });

    expect(session.statusCode).toBe(404);
    expect(session.body).toBe(unknown.body);
    // The IP check runs before the CSRF check, so even a write without the header gets the plain 404.
    expect(login.statusCode).toBe(404);
    expect(login.body).toBe(unknown.body);
  });

  it("allows listed IPs and CIDR ranges", async () => {
    const app = await buildTestServer({ ADMIN_ALLOWED_IPS: "10.0.0.0/24" });
    const response = await app.inject({ url: "/api/admin/session", remoteAddress: "10.0.0.9" });
    expect(response.statusCode).toBe(200);
  });

  it("only trusts X-Forwarded-For when TRUST_PROXY is enabled", async () => {
    const headers = { "x-forwarded-for": "10.0.0.5" };

    const direct = await buildTestServer({ ADMIN_ALLOWED_IPS: "10.0.0.5" });
    expect((await direct.inject({ url: "/api/admin/session", remoteAddress: "127.0.0.1", headers })).statusCode).toBe(404);

    const proxied = await buildTestServer({ ADMIN_ALLOWED_IPS: "10.0.0.5", TRUST_PROXY: "true" });
    expect((await proxied.inject({ url: "/api/admin/session", remoteAddress: "127.0.0.1", headers })).statusCode).toBe(200);
  });

  it("with a proxy list, only trusts X-Forwarded-For from those proxies", async () => {
    const headers = { "x-forwarded-for": "10.0.0.5" };
    const app = await buildTestServer({ ADMIN_ALLOWED_IPS: "10.0.0.5", TRUST_PROXY: "127.0.0.1" });

    // Through the trusted proxy: the forwarded client IP is used.
    expect((await app.inject({ url: "/api/admin/session", remoteAddress: "127.0.0.1", headers })).statusCode).toBe(200);
    // Straight to the API from elsewhere: the spoofed header is ignored.
    expect((await app.inject({ url: "/api/admin/session", remoteAddress: "198.51.100.9", headers })).statusCode).toBe(404);
  });
});
