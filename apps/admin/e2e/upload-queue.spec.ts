import sharp from "sharp";

import { expect, open, test, watchDialogs } from "./helpers";

const image = (index: number) =>
  sharp({
    create: {
      width: 900 + index,
      height: 600,
      channels: 3,
      background: { r: 10 * index, g: 90, b: 140 }
    }
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

  test("a file that matches an existing photo asks: skip, replace or keep both", async ({
    page
  }) => {
    const [original, other, fresh] = await Promise.all([11, 12, 13].map(image));
    const choose = async (files: object[]) => {
      await page.getByRole("button", { name: "添加照片" }).click();
      await page.locator('input[type="file"]').setInputFiles(files as never);
    };
    await open(page, "/photos");
    await choose([{ ...original!, name: "trip.jpg" }]);
    const queue = page.getByRole("region", { name: "添加进度" });
    await expect(queue.getByText("1 / 1 已完成")).toBeVisible();
    await queue.getByRole("button", { name: "清除记录" }).click();

    // The same bytes under another name, another image under the same name, and a new file.
    await choose([
      { ...original!, name: "trip-copy.jpg" },
      { ...other!, name: "trip.jpg" },
      { ...fresh!, name: "new.jpg" }
    ]);
    const dialog = page.getByRole("dialog", { name: "照片已存在" });
    await expect(dialog.getByText("trip-copy.jpg")).toBeVisible();
    await expect(dialog.getByText("这个文件已经上传过")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "替换" })).toHaveCount(0);
    await expect(dialog.getByText("对剩下的 1 个冲突执行相同操作")).toBeVisible();
    await dialog.getByRole("button", { name: "跳过" }).click();

    await expect(dialog.getByText("来自一个同名文件")).toBeVisible();
    await dialog.getByRole("button", { name: "替换" }).click();
    await expect(dialog).toHaveCount(0);

    await expect(queue.getByText("2 / 3 已完成，1 个已跳过")).toBeVisible();
    // Replacing kept one photo for trip.jpg; only new.jpg was added.
    const { photos } = await (await page.request.get("/api/admin/photos")).json();
    const uploaded = photos.filter(
      (p: { source: { type: string } | null }) => p.source?.type === "upload"
    );
    expect(uploaded.map((p: { source: { ref: string } }) => p.source.ref).sort()).toEqual([
      "new.jpg",
      "trip.jpg"
    ]);
  });

  test("after a reload mid-upload, the page says which files to choose again", async ({ page }) => {
    const files = await Promise.all([14, 15].map(image));
    await page.route("**/api/admin/photos", async (route) => {
      // Never answered: the reload cuts these uploads off before they reach the server.
      if (route.request().method() !== "POST") return route.continue();
    });
    await open(page, "/photos");
    await page.getByRole("button", { name: "添加照片" }).click();
    await page.locator('input[type="file"]').setInputFiles(files);
    await expect(page.getByRole("region", { name: "添加进度" }).getByText("上传中")).toHaveCount(2);

    watchDialogs(page, "accept");
    await page.reload();
    const notice = page.getByRole("region", { name: "中断的上传" });
    await expect(notice.getByText("0 张已完成，2 张没有完成")).toBeVisible();
    await expect(notice.getByText("batch-14.jpg、batch-15.jpg")).toBeVisible();
    await notice.getByRole("button", { name: "知道了" }).click();
    await expect(notice).toHaveCount(0);
  });
});
