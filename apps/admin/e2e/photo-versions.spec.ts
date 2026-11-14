import sharp from "sharp";

import { expect, open, test } from "./helpers";

const image = (name: string, width: number, format: "jpeg" | "png") =>
  sharp({ create: { width, height: 600, channels: 3, background: "#357" } })
    [format]()
    .toBuffer()
    .then((buffer) => ({ name, mimeType: `image/${format}`, buffer }));

test.describe("photo versions", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("a photo gets a second version, switches to it, and the old one can be deleted", async ({
    page
  }) => {
    await open(page, "/photos");
    await page.getByRole("button", { name: "添加照片" }).click();
    await page.locator('input[type="file"]').setInputFiles(await image("lake.jpg", 900, "jpeg"));
    await expect(
      page.getByRole("region", { name: "添加进度" }).getByText("1 / 1 已完成")
    ).toBeVisible();

    await page.getByRole("button", { name: "编辑 lake" }).first().click();
    const editor = page.getByRole("dialog", { name: "编辑照片" });
    const versions = editor.getByRole("listitem");
    await expect(versions).toHaveCount(1);
    await expect(versions.first().getByText("当前显示")).toBeVisible();
    await expect(versions.first().getByText(/900 × 600 · JPG/)).toBeVisible();

    await editor.getByRole("button", { name: "添加版本" }).click();
    const add = page.getByRole("dialog", { name: "添加版本" });
    await add.getByLabel("设为当前显示的版本").uncheck();
    await add.locator('input[type="file"]').setInputFiles(await image("lake.png", 1800, "png"));
    await expect(add).toHaveCount(0);
    await expect(versions).toHaveCount(2);
    await expect(editor.getByText("2 / 10")).toBeVisible();
    // Added without showing it: the first is still current.
    await expect(versions.nth(0).getByText("当前显示")).toBeVisible();
    await expect(versions.nth(1).getByText(/1800 × 600 · PNG/)).toBeVisible();

    await versions.nth(1).getByLabel("版本 2 的名称").fill("PNG 无损");
    await versions.nth(1).getByLabel("版本 2 的名称").blur();
    await versions.nth(1).getByRole("button", { name: "设为当前" }).click();
    await expect(versions.nth(1).getByText("当前显示")).toBeVisible();
    await expect(editor.getByText(/1800 × 600\s*ID：/)).toBeVisible();
    await expect(versions.nth(1).getByLabel("版本 2 的名称")).toHaveValue("PNG 无损");

    await versions.nth(0).getByRole("button", { name: "删除版本 1" }).click();
    await page
      .getByRole("dialog", { name: "删除版本" })
      .getByRole("button", { name: "删除" })
      .click();
    await expect(versions).toHaveCount(1);
    await expect(editor.getByText("1 / 10")).toBeVisible();
  });

  test("the version limit is a site setting", async ({ page }) => {
    await open(page, "/settings/admin/images");
    await expect(page.getByLabel("回收站保留天数")).toHaveValue("30");
    await page.getByLabel("每张照片的版本上限").fill("1");
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByText("更改已保存")).toBeVisible();

    await open(page, "/photos");
    await page.getByRole("button", { name: "添加照片" }).click();
    await page.locator('input[type="file"]').setInputFiles(await image("hill.jpg", 901, "jpeg"));
    await expect(
      page.getByRole("region", { name: "添加进度" }).getByText("1 / 1 已完成")
    ).toBeVisible();
    await page.getByRole("button", { name: "编辑 hill" }).first().click();
    const editor = page.getByRole("dialog", { name: "编辑照片" });
    await expect(editor.getByText("1 / 1")).toBeVisible();
    await editor.getByRole("button", { name: "添加版本" }).click();
    const add = page.getByRole("dialog", { name: "添加版本" });
    await add.locator('input[type="file"]').setInputFiles(await image("hill.png", 1801, "png"));
    await expect(add.getByText("这张照片的版本数已达上限，请先删除一个版本")).toBeVisible();
  });
});
