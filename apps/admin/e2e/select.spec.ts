import { expect, open, test, VIEWPORTS } from "./helpers";
import type { Page } from "@playwright/test";

const STORAGE_KEY = "lf-admin-locale";
const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

/** The sidebar on wide screens, the drawer on phones. */
async function switcher(page: Page) {
  const width = page.viewportSize()!.width;
  if (width < 768) await page.getByRole("button", { name: "打开导航" }).click();
  return page.getByRole("combobox", { name: "界面语言" }).filter({ visible: true });
}

test.describe("no native select is left", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("anywhere a user can reach in settings", async ({ page }) => {
    for (const route of [
      "/settings/site/identity",
      "/settings/experience/preferences",
      "/settings/admin/login",
      "/music",
      "/audit"
    ]) {
      await open(page, route);
      expect(await page.locator("select").count()).toBe(0);
    }
  });
});

test("the login page has no language switch", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, storageState: undefined });
  const page = await context.newPage();
  await page.goto("/e2e-admin/");
  await page.waitForSelector("#admin-username");
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await context.close();
});

for (const [width, height] of VIEWPORTS) {
  test.describe(`language switch at ${width}×${height}`, () => {
    test.use({ viewport: { width, height } });

    test("opens a list of our own, whole and on screen", async ({ page }) => {
      await open(page, "/settings/site/identity");
      const trigger = await switcher(page);
      await trigger.click();
      const list = page.getByRole("listbox");
      await expect(list).toBeVisible();
      await expect(page.getByRole("option")).toHaveText(["跟随系统", "简体中文", "English"]);

      const facts = await page.locator(".select-popup").evaluate((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const inside = (x: number, y: number) => element.contains(document.elementFromPoint(x, y));
        return {
          top: box.top,
          bottom: box.bottom,
          left: box.left,
          right: box.right,
          viewport: [innerWidth, innerHeight],
          radius: style.borderTopLeftRadius,
          shadow: style.boxShadow !== "none",
          uncovered: [
            inside(box.left + 8, box.top + 8),
            inside(box.right - 8, box.top + 8),
            inside(box.left + 8, box.bottom - 8),
            inside(box.right - 8, box.bottom - 8)
          ]
        };
      });
      expect(facts.top).toBeGreaterThanOrEqual(0);
      expect(facts.left).toBeGreaterThanOrEqual(0);
      expect(facts.bottom).toBeLessThanOrEqual(facts.viewport[1]!);
      expect(facts.right).toBeLessThanOrEqual(facts.viewport[0]!);
      expect(facts.uncovered).toEqual([true, true, true, true]);
      expect(facts.radius).toBe("12px");
      expect(facts.shadow).toBe(true);

      // At the bottom of the sidebar there is only room above the trigger.
      const trig = await trigger.boundingBox();
      if (trig!.y + trig!.height + 130 > height) expect(facts.bottom).toBeLessThanOrEqual(trig!.y);
      await page.keyboard.press("Escape");
      await expect(list).toHaveCount(0);
    });
  });
}

test.describe("language switch", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  const trigger = (page: Page) => page.locator("aside").getByRole("combobox");

  test("shows hover, focus, open and selected states", async ({ page }) => {
    await open(page, "/settings/site/footer");
    const button = trigger(page);
    const border = () => button.evaluate((e) => getComputedStyle(e).borderTopColor);
    const rest = await border();
    await button.hover();
    await expect.poll(border).not.toBe(rest);
    await page.mouse.move(600, 400);
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(button).toHaveAttribute("data-popup-open", "");
    const selected = page.getByRole("option", { name: "简体中文" });
    await expect(selected).toHaveAttribute("aria-selected", "true");
    await expect(selected).toHaveCSS("font-weight", "600");
    await page.keyboard.press("Escape");
  });

  test("works from the keyboard", async ({ page }) => {
    await open(page, "/settings/site/footer");
    const button = trigger(page);
    await button.focus();
    await page.keyboard.press("ArrowDown");
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
    await expect(button).toBeFocused();
    expect(await stored(page)).toBe("zh");
  });

  test("following the system stores nothing and keeps a draft when nothing changes", async ({
    page
  }) => {
    await open(page, "/settings/site/identity");
    await page.getByLabel("显示姓名").fill("草稿");
    await trigger(page).click();
    await page.getByRole("option", { name: "跟随系统" }).click();
    // The browser is set to Chinese, so the language stays and no reload is needed.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger(page)).toHaveText(/跟随系统/);
    expect(await stored(page)).toBe(null);
    await expect(page.getByLabel("显示姓名")).toHaveValue("草稿");
  });

  test("cancelling with a draft changes nothing", async ({ page }) => {
    await open(page, "/settings/site/identity");
    await page.getByLabel("显示姓名").fill("草稿");
    await trigger(page).click();
    await page.getByRole("option", { name: "English" }).click();
    await page.getByRole("button", { name: "继续编辑" }).click();
    expect(await stored(page)).toBe("zh");
    await expect(trigger(page)).toHaveText(/简体中文/);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByLabel("显示姓名")).toHaveValue("草稿");
  });

  test("switching works and survives a reload", async ({ page }) => {
    await open(page, "/settings/site/footer");
    await trigger(page).click();
    await page.getByRole("option", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-CA");
    await page.reload();
    await expect(page.locator("main h1")).toHaveText("Footer and copyright");
    await expect(trigger(page)).toHaveText(/English/);
  });
});

test.describe("settings selects share the control", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("trigger and list match the sidebar's shape", async ({ page }) => {
    await open(page, "/settings/experience/preferences");
    const theme = page.locator("#settings-theme");
    expect(await theme.evaluate((e) => e.tagName)).toBe("BUTTON");
    await theme.click();
    await expect(page.locator(".select-popup")).toHaveCSS("border-top-left-radius", "12px");
    await page.keyboard.press("Escape");
  });
});
