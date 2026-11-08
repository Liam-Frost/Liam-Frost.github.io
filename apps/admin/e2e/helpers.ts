import { test as base, expect, type Page } from "@playwright/test";
import { ADMIN_REQUEST_HEADER } from "@liam-frost/shared";

import { ADMIN_PATH } from "./constants";

export type Scenario = "default" | "empty" | "large";

export const SETTINGS_PAGES = [
  ["identity", "/settings/site/identity", 880],
  ["branding", "/settings/site/branding", 880],
  ["footer", "/settings/site/footer", 640],
  ["home", "/settings/experience/home", 1032],
  ["preferences", "/settings/experience/preferences", 640],
  ["dictionary", "/settings/experience/dictionary", 1032],
  ["privacy", "/settings/privacy/content", 880],
  ["integrations", "/settings/privacy/integrations", 880],
  ["login", "/settings/admin/login", 1032],
  ["security", "/settings/admin/security", 640]
] as const;

export const VIEWPORTS = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080]
] as const;

export async function seed(page: Page, scenario: Scenario = "default") {
  await page.request.post("/__e2e/seed", { data: { scenario } });
}

export async function open(page: Page, route: string) {
  await page.goto(`${ADMIN_PATH}${route}`);
  await page.waitForSelector("main h1");
  // Settings pages fill in after their data arrives.
  await page.waitForLoadState("networkidle");
}

/** Saves through the API as another editor would. */
export function apiPatch(page: Page, url: string, changes: object, base: object) {
  return page.request.patch(url, {
    data: { changes, base },
    headers: { [ADMIN_REQUEST_HEADER]: "1" }
  });
}

/** Records browser dialogs and answers them. */
export function watchDialogs(page: Page, answer: "accept" | "dismiss" = "accept") {
  const seen: string[] = [];
  const state = { answer };
  page.on("dialog", async (dialog) => {
    seen.push(dialog.type());
    await (state.answer === "accept" ? dialog.accept() : dialog.dismiss());
  });
  return { seen, state };
}

export const settingsNav = (page: Page, name: string | RegExp) =>
  page.locator(".settings-navigation").getByRole("link", { name });

export const test = base.extend<{ seeded: void }>({
  seeded: [
    async ({ page }, use) => {
      await seed(page);
      await use();
    },
    { auto: true }
  ]
});

export { expect };
