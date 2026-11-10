import sharp from "sharp";

import { expect, open, test, watchDialogs } from "./helpers";

const image = (index: number) =>
  sharp({
    create: { width: 900, height: 600, channels: 3, background: { r: 40 * index, g: 90, b: 140 } }
  })
    .jpeg()
    .toBuffer()
    .then((buffer) => ({ name: `batch-${index}.jpg`, mimeType: "image/jpeg", buffer }));

test.describe("photo upload queue", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("uploads a few at a time, shows what is waiting, and retries a failure", async ({
    page
  }) => {
    const files = await Promise.all([1, 2, 3, 4, 5].map(image));
    // Hold every upload until released, and fail the first attempt of one file.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let failed = false;
    await page.route("**/api/admin/photos", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await gate;
      if (!failed && route.request().postDataBuffer()?.includes("batch-2.jpg")) {
        failed = true;
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "INTERNAL", message: "Disk is full" } })
        });
      }
      return route.continue();
    });

    await open(page, "/photos");
    await page.getByRole("button", { name: "添加照片" }).click();
    await page.locator('input[type="file"]').setInputFiles(files);

    const queue = page.getByRole("region", { name: "添加进度" });
    await expect(queue.getByText("等待中")).toHaveCount(2);
    await expect(queue.getByText("0 / 5 已完成")).toBeVisible();

    release();
    await expect(queue.getByText("4 / 5 已完成，1 个失败")).toBeVisible();
    await expect(queue.getByText("Disk is full")).toBeVisible();

    await queue.getByRole("button", { name: "重试 batch-2.jpg" }).click();
    await expect(queue.getByText("5 / 5 已完成")).toBeVisible();

    await queue.getByRole("button", { name: "清除记录" }).click();
    await expect(queue).toHaveCount(0);
  });

  test("waiting files can be cancelled, and leaving mid-upload asks first", async ({
    page,
    browserName
  }) => {
    const files = await Promise.all([6, 7, 8, 9].map(image));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/admin/photos", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await gate;
      return route.continue();
    });

    await open(page, "/photos");
    await page.getByRole("button", { name: "添加照片" }).click();
    await page.locator('input[type="file"]').setInputFiles(files);
    const queue = page.getByRole("region", { name: "添加进度" });
    await expect(queue.getByText("等待中")).toHaveCount(1);

    if (browserName === "chromium") {
      const { seen } = watchDialogs(page, "dismiss");
      // A dismissed reload never finishes, so it is not awaited.
      void page.reload().catch(() => undefined);
      await expect.poll(() => seen).toEqual(["beforeunload"]);
    }

    await queue.getByRole("button", { name: "取消 batch-9.jpg" }).click();
    await expect(queue.getByText("已取消")).toHaveCount(1);
    release();
    await expect(queue.getByText("3 / 4 已完成")).toBeVisible();
    await expect(queue.getByText("已取消")).toHaveCount(1);
  });
});
