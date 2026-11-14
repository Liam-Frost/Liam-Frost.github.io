import sharp from "sharp";

import { expect, open, test } from "./helpers";

const image = (name: string, width: number) =>
  sharp({ create: { width, height: 600, channels: 3, background: "#753" } })
    .jpeg()
    .toBuffer()
    .then((buffer) => ({ name, mimeType: "image/jpeg", buffer }));

test.describe("trash", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("a deleted photo goes to the trash, can be restored, and can be removed for good", async ({
    page
  }) => {
    await open(page, "/photos");
    await page.getByRole("button", { name: "添加照片" }).click();
    await page.locator('input[type="file"]').setInputFiles(await image("harbour.jpg", 910));
    await expect(
      page.getByRole("region", { name: "添加进度" }).getByText("1 / 1 已完成")
    ).toBeVisible();

    const card = page.locator("li.card").filter({ hasText: "harbour" });
    await card.getByRole("button", { name: /删除/ }).click();
    const dialog = page.getByRole("dialog", { name: "删除照片" });
    await expect(dialog.getByText("30 天内可以恢复")).toBeVisible();
    await dialog.getByRole("button", { name: "删除" }).click();
    await expect(page.getByText("已移到回收站")).toBeVisible();
    await expect(card).toHaveCount(0);

    await page.getByRole("link", { name: /回收站/ }).click();
    await expect(page.getByRole("heading", { name: "回收站" })).toBeVisible();
    const item = page.locator("li.card").filter({ hasText: "harbour" });
    await expect(item.getByText("照片 · 1 个版本")).toBeVisible();
    await expect(item.getByText("30 天后彻底删除")).toBeVisible();
    await expect(item.locator("img")).toHaveJSProperty("complete", true);
    expect(
      await item.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)
    ).toBeGreaterThan(0);

    await item.getByRole("button", { name: "恢复 harbour" }).click();
    await expect(page.getByText("回收站是空的。")).toBeVisible();
    await page.getByRole("link", { name: "返回照片" }).click();
    await expect(page.locator("li.card").filter({ hasText: "harbour" })).toHaveCount(1);

    // Delete again and remove it for good.
    await page
      .locator("li.card")
      .filter({ hasText: "harbour" })
      .getByRole("button", { name: /删除/ })
      .click();
    await page
      .getByRole("dialog", { name: "删除照片" })
      .getByRole("button", { name: "删除" })
      .click();
    await page.getByRole("link", { name: /回收站/ }).click();
    await page.getByRole("button", { name: "彻底删除 harbour" }).click();
    await page
      .getByRole("dialog", { name: "彻底删除" })
      .getByRole("button", { name: "彻底删除" })
      .click();
    await expect(page.getByText("回收站是空的。")).toBeVisible();
    const { photos } = await (await page.request.get("/api/admin/photos")).json();
    expect(
      photos.some((p: { source: { ref: string } | null }) => p.source?.ref === "harbour.jpg")
    ).toBe(false);
  });

  test("deleting a login background photo says so", async ({ page }) => {
    await open(page, "/settings/admin/login");
    const { settings } = await (await page.request.get("/api/admin/presentation")).json();
    const [used] = settings.loginBackground.photoIds as string[];
    test.skip(!used, "the seed has no login background");
    await open(page, "/photos");
    const { photos } = await (await page.request.get("/api/admin/photos")).json();
    const title = photos.find((p: { id: string }) => p.id === used).title.zh as string;
    await page
      .locator("li.card")
      .filter({ hasText: title })
      .first()
      .getByRole("button", { name: /删除/ })
      .click();
    await expect(
      page.getByRole("dialog", { name: "删除照片" }).getByText("这张照片正用作登录页背景")
    ).toBeVisible();
  });
});
