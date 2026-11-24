import { ADMIN_REQUEST_HEADER } from "@liam-frost/shared";

import { ADMIN_PATH } from "./constants";
import { expect, test } from "./helpers";

test.describe("what the owner did in a project", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("is edited in the project form and reaches the public project", async ({
    page,
    browserName
  }) => {
    const slug = `details-${browserName}`;
    const created = await page.request.post("/api/admin/projects", {
      data: { title: { zh: "团队项目示例" }, slug },
      headers: { [ADMIN_REQUEST_HEADER]: "1" }
    });
    const { project } = await created.json();
    await page.goto(`${ADMIN_PATH}/projects/${project.id}`);

    await page.getByLabel("我的角色").fill("后端负责人");
    await page.getByLabel("我的贡献").fill("设计接口\n编写部署脚本");
    await page.getByLabel("成果").fill("18 | 个接口");
    await page.getByLabel("难点：问题").fill("不能使用框架");
    await page.getByLabel("协作者").fill("队友 A | 前端");

    // The team size belongs to projects that are not the owner's own.
    await expect(page.getByLabel("团队人数")).toBeVisible();
    await page.locator("#project-kind").click();
    await page.getByRole("option", { name: "个人项目" }).click();
    await expect(page.getByLabel("团队人数")).toHaveCount(0);
    await page.locator("#project-kind").click();
    await page.getByRole("option", { name: "课程项目" }).click();
    await page.getByLabel("团队人数").fill("4");
    await page.getByLabel("我的参与：开始").fill("2025-11");

    // A technology outside the stack, marked as the owner's.
    await page.getByLabel("其他技术（不在技术栈中）").fill("Zetaframe");
    await page.getByLabel("其他技术（不在技术栈中）").press("Enter");
    await page.getByLabel("其他技术（不在技术栈中）").fill("Omegastore");
    await page.getByLabel("其他技术（不在技术栈中）").press("Enter");
    await page.getByRole("group", { name: "我负责的技术" }).getByLabel("Zetaframe").check();

    await page.getByLabel("公开显示").click();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.locator("[data-admin-toasts]")).toContainText("已保存");

    const shown = await (await page.request.get(`/api/projects/${slug}`)).json();
    expect(shown).toMatchObject({
      kind: "course",
      teamSize: 4,
      role: { zh: "后端负责人" },
      techStack: ["Zetaframe", "Omegastore"],
      details: {
        myStartedAt: "2025-11",
        myEndedAt: null,
        contributions: { zh: "设计接口\n编写部署脚本" },
        outcomes: { zh: "18 | 个接口" },
        challenge: { problem: { zh: "不能使用框架" }, solution: {}, result: {} },
        collaborators: { zh: "队友 A | 前端" },
        ownTechStack: ["Zetaframe"]
      }
    });

    // The saved values come back into the form.
    await page.reload();
    await expect(page.getByLabel("我的角色")).toHaveValue("后端负责人");
    await expect(page.locator("#project-kind")).toHaveText(/课程项目/);
    await expect(page.getByLabel("团队人数")).toHaveValue("4");
    await expect(
      page.getByRole("group", { name: "我负责的技术" }).getByLabel("Zetaframe")
    ).toBeChecked();
  });
});
