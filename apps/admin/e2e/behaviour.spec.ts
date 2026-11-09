import { ADMIN_PATH } from "./constants";
import { apiPatch, expect, open, settingsNav, test, watchDialogs } from "./helpers";

const nameInput = (page: import("@playwright/test").Page) => page.getByLabel("显示姓名");

test.describe("drafts and leaving", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("moving around the admin keeps a draft without asking", async ({ page }) => {
    const { seen } = watchDialogs(page);
    await open(page, "/settings/site/identity");
    await nameInput(page).fill("草稿");
    await settingsNav(page, "页脚与版权").click();
    await expect(page.locator("main h1")).toHaveText("页脚与版权");
    await settingsNav(page, "基本资料").click();
    await expect(nameInput(page)).toHaveValue("草稿");
    expect(seen).toEqual([]);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the browser back button behaves like a link", async ({ page }) => {
    const { seen } = watchDialogs(page);
    await open(page, "/settings/site/identity");
    await nameInput(page).fill("草稿");
    await settingsNav(page, "页脚与版权").click();
    await page.goBack();
    await expect(nameInput(page)).toHaveValue("草稿");
    expect(seen).toEqual([]);
  });

  test("the page selector behaves like a link", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await open(page, "/settings/site/identity");
    await nameInput(page).fill("草稿");
    await page.locator("#settings-page-selector").click();
    await page.getByRole("option", { name: "隐私说明" }).click();
    await expect(page.locator("main h1")).toHaveText("隐私说明");
    await page.goBack();
    await expect(nameInput(page)).toHaveValue("草稿");
  });

  test("reloading warns, and a draft in memory is gone after it", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "beforeunload needs a real user gesture elsewhere");
    const { seen } = watchDialogs(page);
    await open(page, "/settings/site/identity");
    await nameInput(page).fill("草稿");
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(seen).toEqual(["beforeunload"]);
    await expect(nameInput(page)).toHaveValue("霜");
  });

  test("a form that would lose its input asks, and can stay", async ({ page }) => {
    await open(page, "/settings/admin/security");
    const password = page.locator("#pw-current");
    await password.fill("not-a-real-password");
    await settingsNav(page, "基本资料").click();
    const dialog = page.getByRole("dialog", { name: "离开此页？" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "继续编辑" }).click();
    await expect(page.locator("main h1")).toHaveText("账号与安全");
    await expect(password).toHaveValue("not-a-real-password");

    await settingsNav(page, "基本资料").click();
    await dialog.getByRole("button", { name: "离开" }).click();
    await expect(page.locator("main h1")).toHaveText("基本资料");
  });

  test("back is stopped the same way on a form that would lose input", async ({ page }) => {
    await open(page, "/settings/site/footer");
    await settingsNav(page, "账号与安全").click();
    await expect(page.locator("main h1")).toHaveText("账号与安全");
    await page.locator("#pw-current").fill("x");
    await page.goBack();
    await expect(page.getByRole("dialog", { name: "离开此页？" })).toBeVisible();
    await page.getByRole("button", { name: "继续编辑" }).click();
    await expect(page.locator("main h1")).toHaveText("账号与安全");
  });

  test("the save bar reports each state", async ({ page }) => {
    await open(page, "/settings/site/identity");
    const bar = page.getByRole("region", { name: "保存操作" });
    await expect(bar).toHaveCount(0);
    await nameInput(page).fill("新名字");
    await expect(bar).toBeVisible();
    await bar.getByRole("button", { name: "保存更改" }).click();
    await expect(page.locator("[data-admin-toasts]")).toContainText("已保存");
    await expect(bar).toHaveCount(0);
    await expect(page.getByText("更改已保存")).toBeVisible();
  });

  test("a failed save keeps the draft and says why", async ({ page }) => {
    await page.route("**/api/admin/site-settings/identity", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 500, json: { error: { code: "X", message: "模拟失败" } } })
        : route.fallback()
    );
    await open(page, "/settings/site/identity");
    await nameInput(page).fill("失败草稿");
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByRole("region", { name: "保存操作" })).toContainText("模拟失败");
    await expect(nameInput(page)).toHaveValue("失败草稿");
  });

  test("discard restores the saved value", async ({ page }) => {
    await open(page, "/settings/site/identity");
    await nameInput(page).fill("要放弃的");
    await page.getByRole("button", { name: "放弃修改" }).click();
    await expect(nameInput(page)).toHaveValue("霜");
  });

  test("language drafts are kept per language within one draft", async ({ page }) => {
    await open(page, "/settings/site/identity");
    await nameInput(page).fill("中文草稿");
    await page.getByRole("tab", { name: /English/ }).click();
    await nameInput(page).fill("English draft");
    await page.getByRole("tab", { name: /简体中文/ }).click();
    await expect(nameInput(page)).toHaveValue("中文草稿");
  });
});

test.describe("saving across pages", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("page titles and the profile draft do not block each other", async ({ page }) => {
    await open(page, "/settings/site/identity");
    await nameInput(page).fill("跨页草稿");
    await settingsNav(page, /Logo/).click();
    await page.getByLabel("前台页面标题").fill("新标题");
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByRole("region", { name: "保存操作" })).toHaveCount(0);
    await settingsNav(page, "基本资料").click();
    await expect(nameInput(page)).toHaveValue("跨页草稿");
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByText("更改已保存")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);

    const saved = await (await page.request.get("/api/admin/site-settings/identity")).json();
    expect(saved.value.name.zh).toBe("跨页草稿");
    expect(saved.value.title.zh).toBe("新标题");
  });

  test("a real conflict is explained in words and can be resolved", async ({ page }) => {
    await open(page, "/settings/site/identity");
    await nameInput(page).fill("我的版本");
    const start = await (await page.request.get("/api/admin/site-settings/identity")).json();
    expect(
      (
        await apiPatch(
          page,
          "/api/admin/site-settings/identity",
          { name: { zh: "别人的版本" } },
          { name: start.value.name }
        )
      ).status()
    ).toBe(200);
    await page.getByRole("button", { name: "保存更改" }).click();
    const panel = page.getByRole("alert").filter({ hasText: "有设置已在别处被修改" });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("显示姓名");
    await expect(panel).toContainText("别人的版本");
    await expect(panel).toContainText("我的版本");
    await expect(panel).not.toContainText("{");

    await panel.getByRole("button", { name: "保留我的修改" }).click();
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByText("更改已保存")).toBeVisible();
    const saved = await (await page.request.get("/api/admin/site-settings/identity")).json();
    expect(saved.value.name.zh).toBe("我的版本");
  });
});

test.describe("admin language", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  const switcher = (page: import("@playwright/test").Page) =>
    page.locator("aside").getByRole("combobox", { name: "界面语言" });
  const choose = async (page: import("@playwright/test").Page, name: string) => {
    await switcher(page).click();
    await page.getByRole("option", { name }).click();
  };
  const stored = (page: import("@playwright/test").Page) =>
    page.evaluate(() => localStorage.getItem("lf-admin-locale"));

  test("the visitor defaults page has no admin language control", async ({ page }) => {
    await open(page, "/settings/experience/preferences");
    await expect(page.locator("main").getByRole("combobox", { name: "界面语言" })).toHaveCount(0);
    await expect(page.locator("main .settings-section")).toHaveCount(1);
    await expect(page.getByLabel("默认语言")).toBeVisible();
  });

  test("cancelling keeps language, storage and page in step", async ({ page }) => {
    await open(page, "/settings/site/identity");
    await nameInput(page).fill("草稿");
    await choose(page, "English");
    const dialog = page.getByRole("dialog", { name: "切换后台语言？" });
    await expect(dialog).toBeVisible();
    expect(await stored(page)).toBe("zh");
    await dialog.getByRole("button", { name: "继续编辑" }).click();
    expect(await stored(page)).toBe("zh");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(switcher(page)).toHaveText(/简体中文/);
    await expect(nameInput(page)).toHaveValue("草稿");
  });

  test("confirming switches everything together, without a second prompt", async ({ page }) => {
    const { seen } = watchDialogs(page);
    await open(page, "/settings/site/identity");
    await nameInput(page).fill("草稿");
    await choose(page, "English");
    await page.getByRole("button", { name: "仍然切换" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-CA");
    await expect(page.locator("main h1")).toHaveText("Basic details");
    expect(await stored(page)).toBe("en");
    expect(seen).toEqual([]);
  });

  test("another tab's change is followed when nothing would be lost", async ({ page, context }) => {
    await open(page, "/settings/site/footer");
    const other = await context.newPage();
    await open(other, "/settings/site/footer");
    await page.bringToFront();
    await choose(page, "English");
    await expect(page.locator("html")).toHaveAttribute("lang", "en-CA");
    await expect(other.locator("html")).toHaveAttribute("lang", "en-CA");
    await other.close();
  });
});

test.describe("uploads", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  const SVG = {
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" fill="#3a3"/></svg>'
    )
  };

  test("a logo is live at once and discarding text does not undo it", async ({ page }) => {
    await open(page, "/settings/site/branding");
    await page.locator("#adminLogo-text").fill("XY");
    await page.getByLabel(/后台 Logo图片/).setInputFiles(SVG);
    await expect(page.locator("aside img")).toHaveAttribute("src", /branding\/admin-logo/);
    await page.getByRole("button", { name: "放弃修改" }).click();
    await expect(page.locator("aside img")).toHaveAttribute("src", /branding\/admin-logo/);
    await expect(page.locator("#adminLogo-text")).toHaveValue("");
    await page.reload();
    await expect(page.locator("aside img")).toHaveAttribute("src", /branding\/admin-logo/);
  });

  test("restoring the default says what it does", async ({ page }) => {
    await open(page, "/settings/site/branding");
    await page.getByLabel(/后台 Logo图片/).setInputFiles(SVG);
    await page.getByRole("button", { name: "恢复默认" }).click();
    const dialog = page.getByRole("dialog", { name: "恢复默认？" });
    await expect(dialog).toContainText("无法撤销");
    await dialog.getByRole("button", { name: "恢复默认" }).click();
    await expect(page.locator("aside img")).toHaveCount(0);
  });

  test("the admin logo preview shows the sidebar's mark", async ({ page }) => {
    await open(page, "/settings/site/branding");
    const preview = page.getByRole("region", { name: "后台 Logo效果" }).locator("span").first();
    const real = page.locator("aside span[aria-hidden]").first();
    const read = (locator: typeof real) =>
      locator.evaluate((e) => [
        getComputedStyle(e).backgroundImage,
        e.getBoundingClientRect().width
      ]);
    expect(await read(preview)).toEqual(await read(real));
  });

  test("page titles save from the shared save bar", async ({ page }) => {
    await open(page, "/settings/site/branding");
    await page.getByLabel("前台页面标题").fill("新标题");
    await page.locator("#publicLogo-text").fill("LF");
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByText("更改已保存")).toBeVisible();
    const identity = await (await page.request.get("/api/admin/site-settings/identity")).json();
    const presentation = await (await page.request.get("/api/admin/presentation")).json();
    expect(identity.value.title.zh).toBe("新标题");
    expect(presentation.settings.publicLogo.text).toBe("LF");
  });
});

test.describe("login appearance", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("a hidden login photo does not block other pages", async ({ page }) => {
    await page.request.post("/__e2e/photo-visibility", {
      data: { id: "photo0", visibility: "private" }
    });
    await open(page, "/settings/site/branding");
    await page.locator("#publicLogo-text").fill("LF");
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByText("更改已保存")).toBeVisible();

    await open(page, "/settings/admin/login");
    await expect(page.getByText("照片已隐藏或删除")).toBeVisible();
    await page.getByRole("radio", { name: /^每次访问/ }).check();
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByText("更改已保存")).toBeVisible();

    const published = await (await page.request.get("/api/presentation")).json();
    expect(published.images.photo0).toBeUndefined();
    expect(published.images.photo1).toBeTruthy();
  });

  test("photos are chosen and ordered with their position shown", async ({ page }) => {
    await open(page, "/settings/admin/login");
    const gallery = page.getByRole("group", { name: "可选背景照片" });
    await gallery.getByText("示例照片 8").click();
    await expect(page.getByText("已选照片 · 7 / 20")).toBeVisible();
    await expect(gallery.locator(".photo-option", { hasText: "示例照片 8" })).toContainText("7");
    await page.getByRole("button", { name: "下移第1张背景" }).click();
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByText("更改已保存")).toBeVisible();
    const saved = await (await page.request.get("/api/admin/presentation")).json();
    expect(saved.settings.loginBackground.photoIds.slice(0, 2)).toEqual(["photo1", "photo0"]);
    expect(saved.settings.loginBackground.photoIds.at(-1)).toBe("photo7");
  });

  test("only what the mode uses is shown", async ({ page }) => {
    await open(page, "/settings/admin/login");
    const modes = page.getByRole("group", { name: "展示方式" }).getByRole("radio");
    await expect(modes).toHaveCount(4);
    const moveDown = page.getByRole("button", { name: "下移第1张背景" });
    await expect(moveDown).toBeVisible();
    await page.getByRole("radio", { name: /^每次访问/ }).check();
    await expect(moveDown).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /已选照片/ })).toBeVisible();
    await page.getByRole("radio", { name: /^固定/ }).check();
    await expect(page.getByRole("heading", { name: "当前照片" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "公开图库" })).toBeVisible();
  });

  test("the login page follows the mode", async ({ page, browser }) => {
    const shown = async (mode: RegExp, loads: number) => {
      await open(page, "/settings/admin/login");
      await page.getByRole("radio", { name: mode }).check();
      await page.getByRole("button", { name: "保存更改" }).click();
      await expect(page.getByText("更改已保存")).toBeVisible();
      const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const tab = await visitor.newPage();
      const seen: (string | null)[] = [];
      for (let load = 0; load < loads; load++) {
        await tab.goto(`${ADMIN_PATH}/`);
        const photo = tab.locator("img.-z-20");
        await expect(photo).toHaveCount(1);
        seen.push(await photo.getAttribute("src"));
      }
      await visitor.close();
      return seen;
    };
    const fixed = await shown(/^固定/, 3);
    expect(new Set(fixed).size).toBe(1);
    expect(fixed[0]).toContain("/image/0/");
    const daily = await shown(/^每天/, 3);
    expect(new Set(daily).size).toBe(1);
    const session = await shown(/^每个浏览会话/, 3);
    expect(new Set(session).size).toBe(1);
    const visit = await shown(/^每次访问/, 3);
    expect(visit[1]).not.toBe(visit[0]);
    expect(visit[2]).not.toBe(visit[1]);
  });

  test("with no photos the login page has a plain background", async ({ page, browser }) => {
    await open(page, "/settings/admin/login");
    await page.getByRole("button", { name: "清空选择" }).click();
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByText("更改已保存")).toBeVisible();
    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const tab = await visitor.newPage();
    await tab.goto(`${ADMIN_PATH}/`);
    await expect(tab.locator("#admin-username")).toBeVisible();
    await expect(tab.locator("img.-z-20")).toHaveCount(0);
    await visitor.close();
  });

  test("the limit of twenty is enforced", async ({ page }) => {
    await page.request.post("/__e2e/seed", { data: { scenario: "large" } });
    await open(page, "/settings/admin/login");
    await expect(page.getByText("已选照片 · 20 / 20")).toBeVisible();
    const free = page.locator(".photo-option[data-selected=false] input").first();
    await expect(free).toBeDisabled();
  });

  test("choosing a fixed photo stays within the limit", async ({ page }) => {
    await page.request.post("/__e2e/seed", { data: { scenario: "large" } });
    await open(page, "/settings/admin/login");
    await page.getByRole("radio", { name: /^固定/ }).check();
    await page.locator(".photo-option", { hasText: "示例照片 24" }).click();
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByText("更改已保存")).toBeVisible();
    const saved = await (await page.request.get("/api/admin/presentation")).json();
    expect(saved.settings.loginBackground.photoIds[0]).toBe("photo23");
    expect(saved.settings.loginBackground.photoIds).toHaveLength(20);
  });

  test("the gallery does not scroll inside the page", async ({ page }) => {
    await page.request.post("/__e2e/seed", { data: { scenario: "large" } });
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "/settings/admin/login");
    const nested = await page.evaluate(
      () =>
        [...document.querySelectorAll("main *")].filter((e) => {
          const style = getComputedStyle(e);
          return /(auto|scroll)/.test(style.overflowY) && e.scrollHeight > e.clientHeight + 1;
        }).length
    );
    expect(nested).toBe(0);
    await page.getByRole("button", { name: /显示更多/ }).click();
    await expect(page.locator(".photo-option")).toHaveCount(48);
  });

  test("the preview is the real login card, cropped like the screen", async ({ page }) => {
    await open(page, "/settings/admin/login");
    const preview = page.getByRole("region", { name: "登录页效果预览" });
    await expect(
      preview.getByRole("heading", { name: "管理员登录", includeHidden: true })
    ).toHaveCount(1);
    const frame = await preview.locator(".aspect-\\[16\\/10\\]").boundingBox();
    expect(Math.abs(frame!.width / frame!.height - 1.6)).toBeLessThan(0.02);
    await expect(preview).toContainText(/今天显示第 \d \/ 6 张/);
  });
});

test.describe("footer copyright", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("each page keeps its own notice", async ({ page }) => {
    await open(page, "/settings/site/footer");
    const preview = page.getByRole("region", { name: "版权声明预览" });
    await expect(preview.getByRole("listitem")).toHaveCount(4);
    await page.locator("#settings-copyright-page").click();
    await page.getByRole("option", { name: "照片", exact: true }).click();
    await page.getByLabel("版权署名").fill("摄影：霜");
    await expect(preview.getByRole("listitem").nth(3)).toContainText("摄影：霜");
    await expect(preview.getByRole("listitem").nth(0)).not.toContainText("摄影：霜");
    await page.getByRole("button", { name: "保存更改" }).click();
    await expect(page.getByText("更改已保存")).toBeVisible();
    const { footer } = await (await page.request.get("/api/site-settings")).json();
    expect(footer.copyright.portfolio.owner.zh).toBe("摄影：霜");
    expect(footer.copyright.home.owner.zh).toBe("霜");
    expect(footer.copyright.home.startYear).toBe(2024);
  });
});

test.describe("contact links", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("a link can show an icon and go back to text", async ({ page }) => {
    const saved = async () =>
      (await (await page.request.get("/api/contact")).json()).links.find(
        (link: { label: string }) => link.label === "GitHub"
      );
    const choose = async (option: string) => {
      await page.getByRole("button", { name: "编辑 GitHub" }).click();
      await page.getByRole("combobox", { name: "显示为" }).click();
      await page.getByRole("option", { name: option, exact: true }).click();
      await page.getByRole("button", { name: "应用到草稿" }).click();
      await page.getByRole("button", { name: "保存更改" }).click();
      await expect(page.getByText("联系方式已保存，网站上马上生效").first()).toBeVisible();
    };
    await open(page, "/contact");
    await choose("GitHub");
    expect((await saved()).icon).toBe("github");
    await page.reload();
    await choose("文字");
    expect((await saved()).icon).toBeUndefined();
  });
});

test.describe("single select", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  const theme = (page: import("@playwright/test").Page) => page.locator("#settings-theme");

  test("is named by its field label", async ({ page }) => {
    await open(page, "/settings/experience/preferences");
    await expect(page.getByLabel("默认主题")).toHaveCount(1);
  });

  test("works from the keyboard", async ({ page }) => {
    await open(page, "/settings/experience/preferences");
    await theme(page).focus();
    await page.keyboard.press("Enter");
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(list).toHaveCount(0);
    await expect(theme(page)).toHaveText(/浅色/);
    await expect(theme(page)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(list).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
    await expect(theme(page)).toHaveText(/浅色/);
    await expect(theme(page)).toBeFocused();
  });

  test("finds options by typing", async ({ page }) => {
    await open(page, "/settings/experience/preferences");
    const language = page.locator("#settings-language");
    await language.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.type("Fr", { delay: 40 });
    await page.keyboard.press("Enter");
    await expect(language).toHaveText(/Français/);
  });

  test("keeps its list on screen near the bottom edge", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 330 });
    await open(page, "/settings/experience/preferences");
    await page.locator("#settings-language").click();
    const box = await page.getByRole("listbox").boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(330);
  });

  test("groups page options and keeps a disabled form closed", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await open(page, "/settings/site/identity");
    await page.locator("#settings-page-selector").click();
    await expect(page.getByRole("group", { name: "站点与品牌" })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("opens above a modal dialog", async ({ page }) => {
    await open(page, "/stack");
    await page.getByRole("button", { name: "添加技术" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#tech-category").click();
    const option = page.getByRole("option").first();
    await expect(option).toBeVisible();
    await option.click();
    await expect(dialog).toBeVisible();
  });
});

test.describe("language tabs", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("follow the tabs pattern", async ({ page }) => {
    await open(page, "/settings/site/identity");
    const first = page.getByRole("tab", { name: /简体中文/ });
    await expect(first).toHaveAttribute("aria-selected", "true");
    const panelId = await first.getAttribute("aria-controls");
    await expect(page.locator(`[id="${panelId}"]`)).toHaveAttribute("role", "tabpanel");
    await first.focus();
    await page.keyboard.press("ArrowRight");
    const second = page.getByRole("tab", { name: /繁體中文/ });
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(page.getByRole("tab").last()).toBeFocused();
  });
  test("control only the fields they belong to", async ({ page }) => {
    await open(page, "/settings/site/identity");
    const section = page.locator(".settings-section", { hasText: "身份信息" });
    await expect(section.getByRole("tablist")).toHaveCount(1);
    const avatar = page.locator(".settings-section", { hasText: "首屏头像" });
    await expect(avatar.getByRole("tablist")).toHaveCount(0);
  });
});

test.describe("secrets stay write-only", () => {
  test("saved credentials are not echoed", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, "/settings/privacy/integrations");
    await page.locator("main ul.card button").first().click();
    const inputs = page.locator("main ul.card input");
    for (let i = 0; i < (await inputs.count()); i++)
      await expect(inputs.nth(i)).toHaveValue(/^$|^https?:/);
  });
});

test.describe("phone navigation", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("reaches every page, shows where you are, and closes", async ({ page }) => {
    await open(page, "/settings/site/identity");
    await expect(page.getByRole("banner")).toContainText("网站设置");
    await page.getByRole("button", { name: "打开导航" }).tap();
    const drawer = page.getByRole("dialog", { name: "管理后台" });
    await expect(drawer).toBeVisible();
    const links = drawer.getByRole("link");
    await expect(links).toHaveCount(11);
    for (let i = 0; i < 11; i++) await expect(links.nth(i)).toBeInViewport();
    await expect(drawer.locator('a[aria-current="page"]')).toContainText("网站设置");
    await expect(drawer.getByRole("button", { name: "退出登录" })).toBeInViewport();
    await expect(drawer.getByRole("combobox", { name: "界面语言" })).toBeInViewport();

    await drawer.getByRole("link", { name: "技术栈" }).tap();
    await expect(page.locator("main h1")).toHaveText("技术栈");
    await expect(drawer).toBeHidden();
    await page.goBack();
    await expect(page.locator("main h1")).toHaveText("基本资料");
  });

  test("the language list opens inside the drawer", async ({ page }) => {
    await open(page, "/settings/site/identity");
    await page.getByRole("button", { name: "打开导航" }).tap();
    await page.getByRole("combobox", { name: "界面语言" }).tap();
    await expect(page.getByRole("option", { name: "English" })).toBeVisible();
  });

  test("the settings pages are easy to switch between", async ({ page }) => {
    await open(page, "/settings/site/identity");
    await page.locator("#settings-page-selector").tap();
    await page.getByRole("option", { name: "标签词典" }).tap();
    await expect(page.locator("main h1")).toHaveText("标签词典");
    await expect(page.locator("#settings-page-selector")).toHaveText(/标签词典/);
  });

  test("the top bar stays out of the way", async ({ page }) => {
    await open(page, "/settings/site/identity");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator("aside")).toBeHidden();
  });
});
