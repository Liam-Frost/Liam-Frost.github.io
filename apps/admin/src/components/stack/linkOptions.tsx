import type { AdminProject, AdminStackCategory } from "@liam-frost/shared";

import { pickText, STATUS_LABELS } from "../../lib/i18n";
import type { MultiOption } from "../ui/MultiCombobox";
import { TechIcon } from "./TechIcon";

/** Projects as options for a technology's "关联项目": cover thumbnail, title, and whether it is public. */
export function projectOptions(projects: AdminProject[]): MultiOption[] {
  return projects.map((project) => {
    const thumb = project.cover?.variants[0]?.url;
    return {
      id: project.id,
      label: pickText(project.title, project.slug),
      keywords: `${project.slug} ${Object.values(project.title).join(" ")}`,
      detail:
        project.visibility === "public"
          ? STATUS_LABELS[project.status]
          : "未公开 · 不会在网站上显示",
      icon: (
        <span
          aria-hidden="true"
          className="block h-5 w-7 shrink-0 overflow-hidden rounded bg-canvas ring-1 ring-line-soft"
        >
          {thumb ? (
            <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />
          ) : null}
        </span>
      )
    };
  });
}

/** Technologies of the stack as options for a project's "技术栈": logo, name and category. */
export function technologyOptions(categories: AdminStackCategory[]): MultiOption[] {
  return categories.flatMap((category) =>
    category.technologies.map((technology) => ({
      id: technology.id,
      label: technology.name,
      detail:
        pickText(category.name, "未命名分类") +
        (technology.visible && category.visible ? "" : " · 已隐藏，不在网站上显示"),
      icon: <TechIcon name={technology.name} url={technology.iconUrl} size="sm" />
    }))
  );
}
