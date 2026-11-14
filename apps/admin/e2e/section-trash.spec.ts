import sharp from "sharp";

import { ADMIN_REQUEST_HEADER } from "@liam-frost/shared";

import { ADMIN_PATH } from "./constants";
import { expect, open, test } from "./helpers";

const cover = (width: number) =>
  sharp({ create: { width, height: 640, channels: 3, background: "#375" } })
    .png()
    .toBuffer()
    .then((buffer) => ({ name: "cover.png", mimeType: "image/png", buffer }));

test.describe("trash for other sections", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("a replaced project cover goes to the trash, where it can only be downloaded", async ({
    page
  }) => {
    const created = await page.request.post("/api/admin/projects", {
      data: { title: { zh: "测试项目" }, slug: "trash-test" },
      headers: { [ADMIN_REQUEST_HEADER]: "1" }
    });
    const { project } = await created.json();
    await page.goto(`${ADMIN_PATH}/projects/${project.id}`);
    await expect(page.getByRole("button", { name: "上传封面" })).toBeVisible();
    const input = page.locator('input[type="file"]').first();
    const first = await cover(1280);
    await input.setInputFiles(first);
    await expect(page.getByRole("button", { name: "更换封面" })).toBeVisible();
    await input.setInputFiles(await cover(1282));
    await expect(page.getByRole("button", { name: "更换封面" })).toBeEnabled();

    await expect
      .poll(async () => (await (await page.request.get("/api/admin/trash")).json()).items.length)
      .toBe(1);
    await open(page, "/photos/trash");
    const item = page.locator("li.card").filter({ hasText: "项目图片：测试项目" });
    await expect(item.getByText("被替换或删除的图片，只能下载")).toBeVisible();
    await expect(item.getByRole("button", { name: /^恢复/ })).toHaveCount(0);

    const link = item.getByRole("link", { name: /^下载/ });
    const response = await page.request.get((await link.getAttribute("href"))!);
    expect(response.status()).toBe(200);
    expect((await response.body()).equals(first.buffer)).toBe(true);

    await item.getByRole("button", { name: /^彻底删除/ }).click();
    await page
      .getByRole("dialog", { name: "彻底删除" })
      .getByRole("button", { name: "彻底删除" })
      .click();
    await expect(page.getByText("回收站是空的。")).toBeVisible();
  });
});
