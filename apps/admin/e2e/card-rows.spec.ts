import { ADMIN_PATH } from "./constants";
import { apiPatch, expect, open, SETTINGS_PAGES, test, VIEWPORTS } from "./helpers";
import type { Page } from "@playwright/test";

const ROUTES = [
  ...SETTINGS_PAGES.map(([, route]) => route),
  "/",
  "/about",
  "/stack",
  "/projects",
  "/projects/project1",
  "/photos",
  "/contact",
  "/music",
  "/analytics",
  "/analytics/content",
  "/analytics/audience",
  "/analytics/health",
  "/analytics/settings",
  "/audit"
];

type Row = { cards: string[]; tops: number[]; bottoms: number[]; heights: number[] };

/** Every row of cards placed side by side in one parent, wherever it is on the page. */
function cardRows(page: Page) {
  return page.evaluate(() => {
    const CARD = ".card, .settings-section, .settings-list";
    const cardOf = (element: Element) =>
      element.matches(CARD)
        ? element
        : element.children.length === 1 && element.children[0]!.matches(CARD)
          ? element.children[0]!
          : null;
    const rows: Row[] = [];
    for (const parent of document.querySelectorAll("main *")) {
      const cards = [...parent.children]
        .map(cardOf)
        .filter((card): card is Element => Boolean(card?.getBoundingClientRect().width));
      const byTop = new Map<number, Element[]>();
      for (const card of cards) {
        const top = Math.round(card.getBoundingClientRect().top / 3);
        byTop.set(top, [...(byTop.get(top) ?? []), card]);
      }
      for (const group of byTop.values()) {
        if (group.length < 2) continue;
        const boxes = group.map((card) => card.getBoundingClientRect());
        rows.push({
          cards: group.map(
            (card) => card.querySelector("h2,h3")?.textContent?.trim().slice(0, 20) ?? ""
          ),
          tops: boxes.map((box) => Math.round(box.top)),
          bottoms: boxes.map((box) => Math.round(box.bottom * 10) / 10),
          heights: boxes.map((box) => Math.round(box.height * 10) / 10)
        });
      }
    }
    return rows;
  });
}

const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

async function expectEqualRows(page: Page, where: string) {
  const rows = await cardRows(page);
  for (const row of rows) {
    expect(spread(row.tops), `${where} top of ${row.cards.join(" | ")}`).toBeLessThanOrEqual(1);
    expect(spread(row.heights), `${where} height of ${row.cards.join(" | ")}`).toBeLessThanOrEqual(
      1
    );
  }
  return rows;
}

const identityCards = (page: Page) =>
  page
    .locator(".settings-section")
    .filter({ has: page.getByRole("heading", { name: /身份信息|首屏头像/ }) });

async function expectIdentityRow(page: Page, width: number) {
  const [first, second] = await identityCards(page).evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      return { left: box.left, top: box.top, bottom: box.bottom, height: box.height };
    })
  );
  const sideBySide = second!.left > first!.left + 10;
  // The content is 485px wide at 768, too narrow for two columns of 260px.
  expect(sideBySide).toBe(width >= 1024);
  if (sideBySide) {
    expect(Math.abs(first!.top - second!.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(first!.bottom - second!.bottom)).toBeLessThanOrEqual(1);
  }
}

/** A card with no height of its own ends just below its last line. */
const expectNoSpareHeight = (page: Page) =>
  identityCards(page).evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      const inner = card.lastElementChild!.getBoundingClientRect();
      return box.bottom - inner.bottom;
    })
  );

for (const [width, height] of VIEWPORTS) {
  test.describe(`${width}×${height}`, () => {
    test.use({ viewport: { width, height } });

    test("every row of cards in the admin ends on one line", async ({ page }) => {
      test.setTimeout(120_000);
      for (const route of ROUTES) {
        await page.goto(`${ADMIN_PATH}${route}`);
        // Not every page has a page title (editors open with a back link).
        await page.waitForSelector("main *");
        await page.waitForLoadState("networkidle");
        await expectEqualRows(page, route);
      }
    });

    test("basic details stay aligned through its content states", async ({ page }) => {
      await open(page, "/settings/site/identity");
      await expectIdentityRow(page, width);

      for (const tab of await page.getByRole("tab").all()) {
        await tab.click();
        await expectIdentityRow(page, width);
      }

      await page.getByLabel("显示姓名").fill("一个非常长的名字".repeat(8));
      await expectIdentityRow(page, width);

      await page.getByRole("button", { name: "保存更改" }).waitFor();
      await expectIdentityRow(page, width);
    });

    test("one column keeps no spare height", async ({ page }) => {
      test.skip(width >= 1024, "two columns at this width");
      await open(page, "/settings/site/identity");
      for (const gap of await expectNoSpareHeight(page)) expect(gap).toBeLessThanOrEqual(21);
    });
  });
}

test.describe("basic details", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("wrapped language tabs stretch the row, not overflow it", async ({ page }) => {
    await open(page, "/settings/site/identity");
    const tabs = page.getByRole("tablist");
    const box = await tabs.boundingBox();
    expect(box!.height).toBeGreaterThan(30);
    await expectIdentityRow(page, 1024);
  });

  test("an uploaded avatar keeps the row aligned", async ({ page }) => {
    await open(page, "/settings/site/identity");
    await page.getByLabel(/头像图片/).setInputFiles({
      name: "avatar.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" fill="#36a"/></svg>'
      )
    });
    await expect(page.getByRole("button", { name: "恢复默认" })).toBeVisible();
    await expectIdentityRow(page, 1024);
  });

  test("a conflict appears below the row without disturbing it", async ({ page }) => {
    await open(page, "/settings/site/identity");
    await page.getByLabel("显示姓名").fill("我的版本");
    const start = await (await page.request.get("/api/admin/site-settings/identity")).json();
    await apiPatch(
      page,
      "/api/admin/site-settings/identity",
      { name: { zh: "别人的版本" } },
      { name: start.value.name }
    );
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "别处" })).toBeVisible();
    await expectIdentityRow(page, 1024);
  });
});

test.describe("player settings", () => {
  for (const [width, height, sideBySide] of [
    [768, 1024, false],
    [1024, 768, true],
    [1280, 800, true],
    [1440, 900, true]
  ] as const)
    test(`cards line up at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, "/music");
      const rows = await expectEqualRows(page, "/music");
      expect(rows.length).toBe(sideBySide ? 1 : 0);
      await expect(page.getByRole("button", { name: "保存", exact: true })).toBeVisible();
    });

  test("saving still works from inside the card", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, "/music");
    const collapse = page.locator("#spotify-collapse");
    await collapse.fill("30");
    const save = page.getByRole("button", { name: "保存", exact: true });
    await save.click();
    await expect(page.locator("[data-admin-toasts]")).toContainText("已保存");
    await expect(save).toBeDisabled();
  });
});
