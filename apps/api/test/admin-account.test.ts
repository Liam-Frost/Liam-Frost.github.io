import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MemoryAdminAccountRepository } from "../src/auth/account-repository";
import {
  currentStep,
  matchTotp,
  newRecoveryCodes,
  newTotpSecret,
  totpCode
} from "../src/auth/totp";
import { buildTestServer, csrf, PASSWORD, USERNAME } from "./helpers";

type App = Awaited<ReturnType<typeof buildTestServer>>;
const NEW_PASSWORD = "a much longer new password";

const cookieOf = (response: { headers: Record<string, unknown> }) =>
  String(response.headers["set-cookie"]).split(";")[0]!;
const signIn = (app: App, payload: object) =>
  app.inject({ method: "POST", url: "/api/admin/login", headers: csrf, payload });

async function setup(env: Record<string, string> = {}, extra: object = {}) {
  const adminAccount = new MemoryAdminAccountRepository();
  const app = await buildTestServer(env, { adminAccount, ...extra });
  let cookie = cookieOf(await signIn(app, { username: USERNAME, password: PASSWORD }));
  const call = (method: "GET" | "POST" | "DELETE", url: string, payload?: object, headers = {}) =>
    app.inject({
      method,
      url,
      headers: { ...csrf, cookie, ...headers },
      ...(payload ? { payload } : {})
    });
  const status = async () => (await call("GET", "/api/admin/account")).json();
  const setCookie = (value: string) => (cookie = value);
  const enableTotp = async () => {
    const { secret } = (
      await call("POST", "/api/admin/account/totp/setup", { currentPassword: PASSWORD })
    ).json();
    const code = totpCode(secret, currentStep(Date.now()) - 1);
    const { recoveryCodes } = (
      await call("POST", "/api/admin/account/totp/enable", { code })
    ).json();
    return { secret: secret as string, recoveryCodes: recoveryCodes as string[] };
  };
  return { app, adminAccount, call, status, setCookie, enableTotp };
}

describe("TOTP", () => {
  it("matches the RFC 6238 test vector", () => {
    // "12345678901234567890" in base32, at T = 59 s; the RFC's 8-digit 94287082 ends in 287082.
    expect(totpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1)).toBe("287082");
  });

  it("allows a step of drift and refuses a code already used", () => {
    const secret = newTotpSecret();
    const now = 1_800_000_000_000;
    const step = currentStep(now);
    expect(matchTotp(secret, totpCode(secret, step), now, null)).toBe(step);
    expect(matchTotp(secret, totpCode(secret, step - 1), now, null)).toBe(step - 1);
    expect(matchTotp(secret, totpCode(secret, step - 3), now, null)).toBeNull();
    expect(matchTotp(secret, totpCode(secret, step), now, step)).toBeNull();
    expect(matchTotp(secret, "12345", now, null)).toBeNull();
  });

  it("makes distinct recovery codes", () => {
    const codes = newRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
  });
});

describe("admin account", () => {
  it("reports state without any secret", async () => {
    const { status, call, enableTotp } = await setup();
    await enableTotp();
    const state = await status();
    expect(state).toMatchObject({
      username: USERNAME,
      managedBy: "database",
      editable: true,
      totp: { enabled: true, recoveryCodesLeft: 10 },
      protections: { maxLoginAttempts: 8, loginWindowMinutes: 15 }
    });
    expect(state.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    const body = (await call("GET", "/api/admin/account")).body;
    expect(body).not.toMatch(/scrypt|passwordHash|totpSecret|sessionSecret/);
  });

  it("changes the password only with the current one and ends other sessions", async () => {
    const { app, call, setCookie, status } = await setup();
    const other = cookieOf(await signIn(app, { username: USERNAME, password: PASSWORD }));

    const wrong = await call("POST", "/api/admin/account/password", {
      currentPassword: "not the password",
      newPassword: NEW_PASSWORD
    });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json().error.code).toBe("WRONG_PASSWORD");
    expect(
      (
        await call("POST", "/api/admin/account/password", {
          currentPassword: PASSWORD,
          newPassword: "short"
        })
      ).statusCode
    ).toBe(400);
    expect(
      (
        await call("POST", "/api/admin/account/password", {
          currentPassword: PASSWORD,
          newPassword: PASSWORD
        })
      ).json().error.code
    ).toBe("SAME_PASSWORD");

    const changed = await call("POST", "/api/admin/account/password", {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD
    });
    expect(changed.statusCode).toBe(200);
    setCookie(cookieOf(changed));
    expect((await status()).username).toBe(USERNAME);
    expect(
      (await app.inject({ url: "/api/admin/account", headers: { cookie: other } })).statusCode
    ).toBe(401);
    expect((await signIn(app, { username: USERNAME, password: PASSWORD })).statusCode).toBe(401);
    expect((await signIn(app, { username: USERNAME, password: NEW_PASSWORD })).statusCode).toBe(
      200
    );
  });

  it("survives a restart: the saved password and revoked sessions still apply", async () => {
    const adminAccount = new MemoryAdminAccountRepository();
    const first = await setup({}, { adminAccount });
    const other = cookieOf(await signIn(first.app, { username: USERNAME, password: PASSWORD }));
    const id = (await first.status()).sessions.find((s: { current: boolean }) => !s.current).id;
    expect((await first.call("DELETE", `/api/admin/account/sessions/${id}`)).statusCode).toBe(200);
    expect(
      (await first.app.inject({ url: "/api/admin/account", headers: { cookie: other } })).statusCode
    ).toBe(401);
    await first.call("POST", "/api/admin/account/password", {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD
    });

    const second = await buildTestServer({}, { adminAccount });
    expect(
      (await second.inject({ url: "/api/admin/account", headers: { cookie: other } })).statusCode
    ).toBe(401);
    expect((await signIn(second, { username: USERNAME, password: PASSWORD })).statusCode).toBe(401);
    expect((await signIn(second, { username: USERNAME, password: NEW_PASSWORD })).statusCode).toBe(
      200
    );
  });

  it("changes the username and keeps this session signed in", async () => {
    const { app, call, setCookie, status } = await setup();
    const changed = await call("POST", "/api/admin/account/username", {
      currentPassword: PASSWORD,
      username: "frost"
    });
    expect(changed.statusCode).toBe(200);
    setCookie(cookieOf(changed));
    expect((await status()).username).toBe("frost");
    expect((await signIn(app, { username: USERNAME, password: PASSWORD })).statusCode).toBe(401);
    expect((await signIn(app, { username: "frost", password: PASSWORD })).statusCode).toBe(200);
  });

  it("will not end the current session from the list; ends all the others at once", async () => {
    const { app, call, status } = await setup();
    const other = cookieOf(await signIn(app, { username: USERNAME, password: PASSWORD }));
    const current = (await status()).sessions.find((s: { current: boolean }) => s.current).id;
    expect((await call("DELETE", `/api/admin/account/sessions/${current}`)).statusCode).toBe(400);
    expect((await call("POST", "/api/admin/account/sessions/revoke-others")).statusCode).toBe(200);
    expect(
      (await app.inject({ url: "/api/admin/account", headers: { cookie: other } })).statusCode
    ).toBe(401);
    expect((await status()).sessions).toHaveLength(1);
  });

  it("asks for a second factor, and accepts each code once", async () => {
    const { app, enableTotp, adminAccount } = await setup();
    const { secret, recoveryCodes } = await enableTotp();
    const login = { username: USERNAME, password: PASSWORD };

    const needs = await signIn(app, login);
    expect(needs.statusCode).toBe(401);
    expect(needs.json().error.code).toBe("TOTP_REQUIRED");
    expect((await signIn(app, { ...login, password: "wrong" })).json().error.code).toBe(
      "INVALID_CREDENTIALS"
    );
    expect((await signIn(app, { ...login, totp: "000000" })).json().error.code).toBe(
      "INVALID_TOTP"
    );

    const code = totpCode(secret, currentStep(Date.now()));
    expect((await signIn(app, { ...login, totp: code })).statusCode).toBe(200);
    expect((await signIn(app, { ...login, totp: code })).json().error.code).toBe("INVALID_TOTP");

    const lower = recoveryCodes[0]!.toLowerCase().replace("-", "");
    expect((await signIn(app, { ...login, recoveryCode: lower })).statusCode).toBe(200);
    expect((await signIn(app, { ...login, recoveryCode: lower })).statusCode).toBe(401);
    expect(adminAccount.account!.recoveryCodes).toHaveLength(9);
    expect(JSON.stringify(adminAccount.account)).not.toContain(secret);
    expect(JSON.stringify(adminAccount.account)).not.toContain(recoveryCodes[1]);
  });

  it("does not turn on until a code is confirmed, and turns off only with one", async () => {
    const { app, call, status } = await setup();
    const { secret } = (
      await call("POST", "/api/admin/account/totp/setup", { currentPassword: PASSWORD })
    ).json();
    expect((await status()).totp.enabled).toBe(false);
    expect((await signIn(app, { username: USERNAME, password: PASSWORD })).statusCode).toBe(200);
    expect(
      (await call("POST", "/api/admin/account/totp/enable", { code: "000000" })).statusCode
    ).toBe(400);
    await call("POST", "/api/admin/account/totp/enable", {
      code: totpCode(secret, currentStep(Date.now()) - 1)
    });
    expect((await status()).totp.enabled).toBe(true);
    expect(
      (
        await call("POST", "/api/admin/account/totp/disable", {
          currentPassword: PASSWORD,
          totp: "000000"
        })
      ).statusCode
    ).toBe(400);
    expect(
      (
        await call("POST", "/api/admin/account/totp/disable", {
          currentPassword: PASSWORD,
          totp: totpCode(secret, currentStep(Date.now()))
        })
      ).statusCode
    ).toBe(200);
    expect((await status()).totp.enabled).toBe(false);
  });

  it("limits repeated wrong current passwords", async () => {
    const { call } = await setup();
    let last = 0;
    for (let i = 0; i < 9; i++)
      last = (
        await call("POST", "/api/admin/account/password", {
          currentPassword: "wrong wrong wrong",
          newPassword: NEW_PASSWORD
        })
      ).statusCode;
    expect(last).toBe(429);
  });

  it("needs a session and the CSRF header; without a database the account is read-only", async () => {
    const { app, call } = await setup();
    expect((await app.inject({ url: "/api/admin/account" })).statusCode).toBe(401);
    const noHeader = await app.inject({ method: "POST", url: "/api/admin/account/password" });
    expect(noHeader.statusCode).toBe(403);
    expect((await call("GET", "/api/admin/account")).statusCode).toBe(200);

    const plain = await buildTestServer();
    const cookie = cookieOf(await signIn(plain, { username: USERNAME, password: PASSWORD }));
    const read = await plain.inject({ url: "/api/admin/account", headers: { cookie } });
    expect(read.json()).toMatchObject({ editable: false, managedBy: "environment" });
    expect(
      (
        await plain.inject({
          method: "POST",
          url: "/api/admin/account/password",
          headers: { ...csrf, cookie },
          payload: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }
        })
      ).statusCode
    ).toBe(503);
  });

  it("refuses to sign anyone in while the saved account cannot be read", async () => {
    const adminAccount = new MemoryAdminAccountRepository();
    adminAccount.loadAccount = async () => {
      throw new Error("database down");
    };
    const app = await buildTestServer({}, { adminAccount });
    expect((await signIn(app, { username: USERNAME, password: PASSWORD })).statusCode).toBe(503);
    await app.close();
  });
});

describe("switching the admin address", () => {
  function dist() {
    const dir = mkdtempSync(join(tmpdir(), "admin-dist-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<html><head></head><body>admin</body></html>");
    return dir;
  }
  const page = (app: App, url: string, cookie?: string) =>
    app.inject({ url, headers: { accept: "text/html", ...(cookie ? { cookie } : {}) } });
  const start = (call: Awaited<ReturnType<typeof setup>>["call"], path: string) =>
    call("POST", "/api/admin/account/path", { currentPassword: PASSWORD, path });
  const confirmFrom = (call: Awaited<ReturnType<typeof setup>>["call"], url: string) =>
    call("POST", "/api/admin/account/path/confirm", { from: url });

  it("serves both addresses while trying, and only the new one after confirming", async () => {
    const { app, call, status } = await setup({}, { adminDistDir: dist() });
    expect((await page(app, "/admin")).statusCode).toBe(200);
    expect((await page(app, "/studio")).statusCode).toBe(404);

    expect((await start(call, "studio")).json()).toEqual({ pending: "/studio" });
    const trial = await page(app, "/studio/photos");
    expect(trial.statusCode).toBe(200);
    expect(trial.body).toContain('content="/studio"');
    expect((await page(app, "/admin")).statusCode).toBe(200);
    expect((await status()).path).toMatchObject({ current: "/admin", pending: "/studio" });

    const fromOld = await confirmFrom(call, "/admin");
    expect(fromOld.json().error.code).toBe("OPEN_NEW_ADDRESS");
    expect((await confirmFrom(call, "/studio")).statusCode).toBe(200);

    expect((await page(app, "/studio")).statusCode).toBe(200);
    expect((await page(app, "/admin")).statusCode).toBe(404);
    expect((await call("GET", "/api/admin/session")).json().adminPath).toBe("/studio");
    expect((await status()).path).toMatchObject({
      current: "/studio",
      pending: null,
      retiring: { path: "/admin" }
    });
  });

  it("tells only a signed-in admin where the old address went", async () => {
    const { app, call, adminAccount } = await setup({}, { adminDistDir: dist() });
    await start(call, "studio");
    await confirmFrom(call, "/studio");
    const session = cookieOf(await signIn(app, { username: USERNAME, password: PASSWORD }));

    const signedIn = await page(app, "/admin/photos?x=1", session);
    expect(signedIn.statusCode).toBe(302);
    expect(signedIn.headers.location).toBe("/studio/photos");
    const anonymous = await page(app, "/admin/photos");
    expect(anonymous.statusCode).toBe(404);
    expect(anonymous.body).not.toContain("studio");

    adminAccount.account!.adminPathRetireUntil = new Date(Date.now() - 1000);
    const later = await buildTestServer({}, { adminAccount, adminDistDir: dist() });
    const again = cookieOf(await signIn(later, { username: USERNAME, password: PASSWORD }));
    expect((await page(later, "/admin", again)).statusCode).toBe(404);
  });

  it("can be cancelled, leaving the current address alone", async () => {
    const { app, call } = await setup({}, { adminDistDir: dist() });
    await start(call, "studio");
    expect((await call("DELETE", "/api/admin/account/path")).statusCode).toBe(200);
    expect((await page(app, "/studio")).statusCode).toBe(404);
    expect((await page(app, "/admin")).statusCode).toBe(200);
    expect((await confirmFrom(call, "/studio")).statusCode).toBe(409);
  });

  it("refuses unusable addresses and needs the password", async () => {
    const { call } = await setup({}, { adminDistDir: dist() });
    for (const path of ["/api/x", "/projects", "/admin", "/admin/sub", "a b"])
      expect((await start(call, path)).statusCode).toBe(400);
    expect(
      (
        await call("POST", "/api/admin/account/path", {
          currentPassword: "wrong wrong",
          path: "studio"
        })
      ).statusCode
    ).toBe(403);
  });
});
