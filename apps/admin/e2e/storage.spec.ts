import sharp from "sharp";

import { expect, open, test } from "./helpers";

const jpeg = (width: number) =>
  sharp({ create: { width, height: 600, channels: 3, background: "#537" } })
    .jpeg()
    .toBuffer();

test.describe("file management", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("shows totals, finds an orphan folder, adopts one and deletes another", async ({ page }) => {
    await open(page, "/photos");
    await page.getByRole("button", { name: "添加照片" }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "pier.jpg", mimeType: "image/jpeg", buffer: await jpeg(920) });
    await expect(
      page.getByRole("region", { name: "添加进度" }).getByText("1 / 1 已完成")
    ).toBeVisible();

    for (const [name, width] of [
      ["lost-album", 921],
      ["old-export", 922]
    ] as const) {
      const response = await page.request.post(`/__e2e/orphan/${name}`, {
        data: { original: (await jpeg(width)).toString("base64") }
      });
      expect(response.ok()).toBe(true);
    }

    await page.getByRole("link", { name: "文件管理" }).click();
    await expect(page.getByRole("heading", { name: "文件管理" })).toBeVisible();
    await expect(page.getByText("1 份图片 · 原图")).toBeVisible();

    await page.getByRole("button", { name: "扫描文件" }).click();
    const orphans = page.getByRole("region", { name: "孤儿文件夹" });
    await expect(orphans.getByRole("listitem")).toHaveCount(2);
    const adoptable = orphans.getByRole("listitem").filter({ hasText: "lost-album" });
    await expect(adoptable.locator("img")).toHaveJSProperty("complete", true);

    await adoptable.getByRole("button", { name: /作为照片添加/ }).click();
    await expect(page.getByText("已作为隐藏照片添加")).toBeVisible();
    await expect(orphans.getByRole("listitem")).toHaveCount(1);

    await orphans.getByRole("button", { name: /^删除文件夹/ }).click();
    await page
      .getByRole("dialog", { name: "删除文件夹" })
      .getByRole("button", { name: "删除" })
      .click();
    await expect(page.getByText("没有发现问题")).toBeVisible();

    await page.getByRole("link", { name: "返回照片" }).click();
    await expect(page.locator("li.card").filter({ hasText: "lost-album" })).toHaveCount(1);
  });

  test("a version's original can be downloaded from the editor", async ({ page }) => {
    await open(page, "/photos");
    await page.getByRole("button", { name: "添加照片" }).click();
    const buffer = await jpeg(923);
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "quay.jpg", mimeType: "image/jpeg", buffer });
    await expect(
      page.getByRole("region", { name: "添加进度" }).getByText("1 / 1 已完成")
    ).toBeVisible();
    await page.getByRole("button", { name: "编辑 quay" }).first().click();
    const link = page
      .getByRole("dialog", { name: "编辑照片" })
      .getByRole("link", { name: "下载原图" });
    const response = await page.request.get((await link.getAttribute("href"))!);
    expect(response.status()).toBe(200);
    expect((await response.body()).equals(buffer)).toBe(true);
  });
});
