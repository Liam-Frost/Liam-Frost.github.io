import { expect, open, test } from "./helpers";

// A few stable pages only; the geometry and behaviour specs do the detailed checking.
test.use({ viewport: { width: 1280, height: 800 } });

for (const [name, route] of [
  ["preferences", "/settings/experience/preferences"],
  ["identity", "/settings/site/identity"],
  ["home", "/settings/experience/home"]
] as const)
  test(`${name} looks the same`, async ({ page }) => {
    await open(page, route);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: "disabled" });
  });
