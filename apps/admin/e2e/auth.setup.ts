import { test as setup } from "@playwright/test";

import { ADMIN_PATH, PASSWORD, USERNAME } from "./constants";

setup("sign in", async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem("lf-admin-locale", "zh"));
  await page.goto(`${ADMIN_PATH}/`);
  await page.fill("#admin-username", USERNAME);
  await page.fill("#admin-password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForSelector("main h1");
  await page.context().storageState({
    path: `e2e/.auth/${info.project.name.replace("setup-", "")}.json`
  });
});
