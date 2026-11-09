import { describe, expect, it } from "vitest";
import { DEFAULT_CONTACT } from "@liam-frost/shared";
import { MemorySettingsRepository } from "../src/settings/types";
import { buildTestServer, csrf, login } from "./helpers";

describe("contact management", () => {
  it("keeps a link's icon, shows old links as text and refuses unknown icons", async () => {
    const app = await buildTestServer({}, { settings: new MemorySettingsRepository() });
    const headers = { ...csrf, cookie: await login(app) };
    const put = async (links: unknown[]) => {
      const { revision } = (await app.inject({ url: "/api/admin/contact", headers })).json();
      return app.inject({
        method: "PUT",
        url: "/api/admin/contact",
        headers,
        payload: { revision, contact: { email: "", links } }
      });
    };
    const href = "https://github.com/someone";
    const links = [
      { label: "GitHub", href, icon: "github" },
      { label: "Blog", href }
    ];
    expect((await put(links)).statusCode).toBe(200);
    expect((await app.inject("/api/contact")).json().links).toEqual(links);
    expect((await put([{ label: "GitHub", href, icon: "<svg>" }])).statusCode).toBe(400);
    await app.close();
  });

  it("requires authentication and CSRF, persists edits, rejects stale saves and unsafe links", async () => {
    const settings = new MemorySettingsRepository();
    const app = await buildTestServer({}, { settings });
    const cookie = await login(app);
    const headers = { ...csrf, cookie };
    const initial = (await app.inject({ url: "/api/admin/contact", headers })).json();
    expect(initial.contact).toEqual(DEFAULT_CONTACT);
    const payload = {
      contact: {
        email: "hi@example.com",
        links: [{ label: "Website", href: "https://example.com/" }]
      },
      revision: initial.revision
    };
    expect(
      (await app.inject({ method: "PUT", url: "/api/admin/contact", headers: csrf, payload }))
        .statusCode
    ).toBe(401);
    expect(
      (await app.inject({ method: "PUT", url: "/api/admin/contact", headers: { cookie }, payload }))
        .statusCode
    ).toBe(403);
    expect(
      (await app.inject({ method: "PUT", url: "/api/admin/contact", headers, payload })).statusCode
    ).toBe(200);
    const published = await app.inject("/api/contact");
    expect(published.json()).toEqual(payload.contact);
    expect(published.headers["x-snapshot-data-source"]).toBe("database");
    expect(
      (await app.inject({ method: "PUT", url: "/api/admin/contact", headers, payload })).statusCode
    ).toBe(409);
    const revision = (await app.inject({ url: "/api/admin/contact", headers })).json().revision;
    for (const href of [
      "javascript:alert(1)",
      "http://example.com",
      "https://user:password@example.com"
    ])
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/api/admin/contact",
            headers,
            payload: { revision, contact: { ...payload.contact, links: [{ label: "x", href }] } }
          })
        ).statusCode
      ).toBe(400);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/contact",
          headers,
          payload: { revision, contact: { email: "", links: [] } }
        })
      ).statusCode
    ).toBe(200);
    expect((await app.inject("/api/contact")).json()).toEqual({ email: "", links: [] });
    await app.close();
    const reopened = await buildTestServer({}, { settings });
    expect((await reopened.inject("/api/contact")).json()).toEqual({ email: "", links: [] });
    await reopened.close();
  });

  it("does not resurrect removed details when storage fails", async () => {
    const app = await buildTestServer(
      {},
      {
        settings: {
          get: async (key) => {
            if (key === "contact.v1") throw new Error("offline");
            return null;
          },
          set: async () => {}
        }
      }
    );
    expect((await app.inject("/api/contact")).statusCode).toBe(500);
    await app.close();
  });
});
