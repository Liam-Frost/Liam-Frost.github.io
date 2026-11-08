import { expect, open, SETTINGS_PAGES, test, VIEWPORTS } from "./helpers";

const MIN_COLUMN = 260;

for (const [width, height] of VIEWPORTS) {
  test.describe(`${width}×${height}`, () => {
    test.use({ viewport: { width, height } });

    for (const [name, route, variant] of SETTINGS_PAGES) {
      test(`${name} keeps the layout contract`, async ({ page }) => {
        await open(page, route);
        const m = await page.evaluate(() => {
          const content = document.querySelector<HTMLElement>(".settings-content")!;
          const box = (e: Element) => e.getBoundingClientRect();
          const c = box(content);
          const surfaces = [
            ...content.querySelectorAll(".settings-section, .settings-list, .card")
          ].filter((e) => box(e).width > 0);
          const columns = (selector: string) =>
            [...content.querySelectorAll(selector)].map((e) =>
              getComputedStyle(e).gridTemplateColumns.split(" ").map(parseFloat)
            );
          const controls = [
            ...content.querySelectorAll(
              "input:not([type=checkbox],[type=radio],[type=file]),textarea,.select-trigger"
            )
          ].filter((e) => box(e).width > 0 && !e.closest("[inert]"));
          const vw = document.documentElement.clientWidth;
          return {
            contentWidth: c.width,
            contentLeft: c.left,
            contentRight: c.right,
            available: content.parentElement!.clientWidth,
            titleLeft: box(document.querySelector("main h1")!).left,
            pageOverflow: document.documentElement.scrollWidth - vw,
            outOfBounds: surfaces.filter(
              (e) => box(e).left < c.left - 1 || box(e).right > c.right + 1
            ).length,
            offscreen: controls.filter((e) => box(e).right > vw + 1).length,
            controlOverflow: controls.filter((e) => {
              const surface = e.closest(".settings-section, .settings-list, .card");
              return surface && box(e).right > box(surface).right;
            }).length,
            equal: columns(".settings-grid-equal"),
            aside: columns(".settings-grid-aside"),
            fieldHeights: controls
              .filter((e) => e.tagName !== "TEXTAREA" && box(e).height > 2)
              .map((e) => Math.round(box(e).height)),
            settingsNav: getComputedStyle(document.querySelector(".settings-navigation")!).display,
            picker: box(document.querySelector("#settings-page-selector")!).width,
            sidebar: getComputedStyle(document.querySelector("aside")!).display
          };
        });

        expect(m.pageOverflow).toBeLessThanOrEqual(0);
        expect(Math.abs(m.contentWidth - Math.min(variant, m.available))).toBeLessThanOrEqual(1);
        expect(Math.abs(m.titleLeft - m.contentLeft)).toBeLessThanOrEqual(1);
        expect(m.outOfBounds).toBe(0);
        expect(m.offscreen).toBe(0);
        expect(m.controlOverflow).toBe(0);
        for (const columns of m.equal)
          if (columns.length === 2)
            for (const column of columns) expect(column).toBeGreaterThanOrEqual(MIN_COLUMN);
        for (const columns of m.aside)
          if (columns.length === 2) expect(columns[0]!).toBeGreaterThanOrEqual(300);
        for (const fieldHeight of m.fieldHeights) expect(fieldHeight).toBe(38);

        if (width >= 1280) {
          expect(m.settingsNav).not.toBe("none");
          expect(m.picker).toBe(0);
        } else {
          expect(m.settingsNav).toBe("none");
          expect(m.picker).toBeGreaterThan(0);
        }
        expect(m.sidebar === "none").toBe(width < 768);
      });
    }

    test("settings pages share one left edge", async ({ page }) => {
      const lefts = new Set<number>();
      for (const [, route] of SETTINGS_PAGES) {
        await open(page, route);
        lefts.add(
          Math.round(
            await page.locator(".settings-content").evaluate((e) => e.getBoundingClientRect().left)
          )
        );
      }
      expect(lefts.size).toBe(1);
    });
  });
}

const columnsOf = (locator: import("@playwright/test").Locator) =>
  locator.evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);

test.describe("columns follow the content width", () => {
  test("768: basic profile is one column", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page, "/settings/site/identity");
    expect(await columnsOf(page.locator(".settings-content .settings-grid-equal").first())).toBe(1);
  });
  test("1024: icon and page titles sit side by side", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await open(page, "/settings/site/branding");
    const icon = await page.getByRole("heading", { name: "网站图标" }).boundingBox();
    const titles = await page.getByRole("heading", { name: "页面标题" }).boundingBox();
    expect(Math.abs(icon!.y - titles!.y)).toBeLessThanOrEqual(2);
    expect(titles!.x).toBeGreaterThan(icon!.x + 260);
  });
  test("1280: login settings sit beside the preview", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, "/settings/admin/login");
    expect(await columnsOf(page.locator(".settings-grid-aside").first())).toBe(2);
    const form = await page.getByRole("heading", { name: "背景设置" }).boundingBox();
    const preview = await page.getByRole("region", { name: "登录页效果预览" }).boundingBox();
    expect(preview!.x).toBeGreaterThan(form!.x + 300);
  });
  test("wide screens: settings content starts where ordinary pages do", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await open(page, "/settings/experience/home");
    const settings = await page.locator(".settings-content").boundingBox();
    await open(page, "/stack");
    const stack = await page.locator("main h1").boundingBox();
    expect(Math.abs(settings!.x - stack!.x)).toBeLessThanOrEqual(1);
  });
});

test.describe("surfaces share one contract", () => {
  test("form, list and card surfaces match", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const read = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((e) => {
          const s = getComputedStyle(e);
          return [s.borderTopLeftRadius, s.borderTopColor, s.boxShadow];
        });
    await open(page, "/settings/site/identity");
    const form = await read(".settings-section");
    await open(page, "/settings/experience/home");
    expect(await read(".settings-list")).toEqual(form);
    await open(page, "/settings/privacy/integrations");
    expect(await read(".card")).toEqual(form);
  });
});

test.describe("save bar", () => {
  for (const [width, height] of [
    [390, 844],
    [1280, 800]
  ] as const)
    test(`does not cover the field being edited at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, "/settings/site/footer");
      await page.locator("main input.field").first().fill("页脚草稿");
      const inputs = page.locator("main input.field");
      for (let i = 0; i < (await inputs.count()); i++) {
        await inputs.nth(i).focus();
        const overlap = await page.evaluate(() => {
          const bar = document.querySelector(".settings-actions")!.getBoundingClientRect();
          const field = document.activeElement!.getBoundingClientRect();
          return field.bottom > bar.top + 1 && field.top < bar.bottom - 1;
        });
        expect(overlap).toBe(false);
      }
    });
});

test.describe("data volume", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  for (const scenario of ["empty", "large"] as const)
    for (const [name, route] of SETTINGS_PAGES)
      test(`${name} holds up with ${scenario} data`, async ({ page }) => {
        await page.request.post("/__e2e/seed", { data: { scenario } });
        await open(page, route);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
});
