import {
  DEFAULT_PRESENTATION,
  HOME_SECTIONS,
  type AdminPresentation,
  type PresentationSettings,
  type SiteLogo
} from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { useHomeContentCounts } from "../hooks/useHomeContentCounts";
import { useState } from "react";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { PageHeader } from "../components/layout/AdminLayout";
import { Field, Switch } from "../components/ui/Field";
import { request } from "../lib/api";
import { usePhotos } from "../hooks/usePhotos";
import { pickText } from "../lib/i18n";
import { useToast } from "../components/ui/Toast";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import { refreshPresentation } from "../../../web/src/data/usePresentation";

const labels = {
  top: "首屏介绍",
  about: "关于 / 宣言与设备",
  skills: "技术栈",
  projects: "精选项目",
  watching: "收藏",
  featured: "精选照片",
  contact: "联系我"
};
const key = ["admin", "presentation"];
export function AppearancePage({ scope = "all" }: { scope?: "front" | "back" | "all" }) {
  const q = useQuery({
    queryKey: key,
    queryFn: () => request<AdminPresentation>("/api/admin/presentation")
  });
  const content = useHomeContentCounts(scope !== "back");
  const { data: photos = [] } = usePhotos();
  const available = photos.filter((p) => p.visibility === "public");
  const [draft, setDraft] = useState<AdminPresentation | null>(null);
  const value = draft?.settings ?? q.data?.settings ?? DEFAULT_PRESENTATION;
  const toast = useToast(),
    qc = useQueryClient();
  const save = useMutation({
    mutationFn: (body: AdminPresentation) =>
      request<AdminPresentation>("/api/admin/presentation", { method: "PUT", json: body }),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      setDraft(null);
      refreshPresentation();
      toast("外观与首页设置已保存");
    },
    onError: (e: Error) => toast(e.message, "error")
  });
  useUnsavedChanges(Boolean(draft));
  const change = (settings: PresentationSettings) => {
    if (q.data && !save.isPending)
      setDraft({ settings, revision: draft?.revision ?? q.data.revision });
  };
  if (q.isPending) return <LoadingSkeleton label="加载外观设置…" variant="form" />;
  if (q.error) return <p role="alert">{q.error.message}</p>;
  const logoEditor = (name: "publicLogo" | "adminLogo", title: string) => {
    const logo = value[name];
    const update = (patch: Partial<SiteLogo>) =>
      change({ ...value, [name]: { ...logo, ...patch } });
    const photo = available.find((p) => p.id === logo.photoId);
    return (
      <fieldset className="card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold text-brand-dark">{title}</legend>
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center overflow-hidden rounded-xl bg-canvas text-xl font-semibold text-brand">
            {photo ? (
              <img
                className="size-full object-contain"
                src={photo.variants[0]?.url ?? photo.src}
                alt="Logo 预览"
              />
            ) : (
              logo.text || "LF"
            )}
          </span>
          <p className="text-xs text-muted">
            默认沿用现有 Logo。图片优先；图片被隐藏或删除后回退到文字。
          </p>
        </div>
        <Field label="文字标记（留空使用默认 Logo）" htmlFor={`${name}-text`}>
          <input
            id={`${name}-text`}
            className="field"
            maxLength={12}
            value={logo.text}
            onChange={(e) => update({ text: e.target.value })}
          />
        </Field>
        <Field
          label="Logo 替代文字"
          htmlFor={`${name}-alt`}
          hint="留空作为装饰性标记；填写时向屏幕阅读器说明品牌。"
        >
          <input
            id={`${name}-alt`}
            className="field"
            maxLength={120}
            value={logo.alt ?? ""}
            onChange={(e) => update({ alt: e.target.value })}
          />
        </Field>
        <Field label="图库图片" htmlFor={`${name}-photo`}>
          <select
            id={`${name}-photo`}
            className="field"
            value={logo.photoId ?? ""}
            onChange={(e) => update({ photoId: e.target.value || null })}
          >
            <option value="">不使用图片</option>
            {logo.photoId && !photo ? (
              <option value={logo.photoId}>图片已隐藏或删除，请重新选择</option>
            ) : null}
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {pickText(p.title, p.id)}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>
    );
  };
  return (
    <>
      <PageHeader
        title={
          scope === "front"
            ? "Logo 与首页板块"
            : scope === "back"
              ? "后台 Logo 与登录背景"
              : "外观与首页"
        }
        description="控制首页板块、两套 Logo 与后台登录背景。设置保存后生效。"
      />
      {scope !== "back" && (
        <fieldset className="card mb-5 p-5">
          <legend className="px-1 text-sm font-semibold text-brand-dark">首页板块</legend>
          <p className="mb-4 text-xs text-muted">
            总开关关闭时不展示；开启后仍需有公开内容。空板块自动隐藏，加载中保留骨架反馈。首屏使用网站已有介绍。
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {HOME_SECTIONS.map((id) => (
              <div key={id} className="rounded-xl border border-line-soft p-3">
                <Switch
                  id={`section-${id}`}
                  label={labels[id]}
                  checked={value.sections[id]}
                  onChange={(checked) =>
                    change({ ...value, sections: { ...value.sections, [id]: checked } })
                  }
                />
                <p className="mt-1 text-xs text-muted">
                  {!value.sections[id]
                    ? "已关闭；保留内容"
                    : content.isPending
                      ? "正在核验公开内容…"
                      : content.data?.[id] == null
                        ? "内容暂时无法核验"
                        : content.data[id] === 0
                          ? "暂无公开内容，自动隐藏"
                          : `公开候选内容 ${content.data[id]} 项 · 可显示`}
                </p>
                <Link
                  className="mt-1 inline-block text-xs text-brand underline"
                  to={
                    {
                      top: "/settings/frontend/identity",
                      about: "/about",
                      skills: "/stack",
                      projects: "/projects",
                      watching: "/collection",
                      featured: "/photos",
                      contact: "/contact"
                    }[id]
                  }
                >
                  编辑内容
                </Link>
              </div>
            ))}
          </div>
        </fieldset>
      )}
      <div className="mb-5 grid gap-5 sm:grid-cols-2">
        {scope !== "back" && logoEditor("publicLogo", "主页 Logo")}
        {scope !== "front" && logoEditor("adminLogo", "管理后台 Logo")}
      </div>
      {scope !== "front" && (
        <fieldset className="card space-y-4 p-5">
          <legend className="px-1 text-sm font-semibold text-brand-dark">登录页背景</legend>
          <p className="text-xs text-muted">
            登录前可见，因此只提供公开照片。固定模式使用第一张，轮换模式按选择顺序循环；减少动态效果时保持第一张。最多选择20张。
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="展示方式" htmlFor="background-mode">
              <select
                id="background-mode"
                className="field"
                value={value.loginBackground.mode}
                onChange={(e) =>
                  change({
                    ...value,
                    loginBackground: {
                      ...value.loginBackground,
                      mode: e.target.value as PresentationSettings["loginBackground"]["mode"]
                    }
                  })
                }
              >
                <option value="none">纯色背景</option>
                <option value="fixed">固定照片</option>
                <option value="rotate">轮换照片</option>
              </select>
            </Field>
            <Field label="轮换间隔（秒）" htmlFor="background-interval">
              <input
                id="background-interval"
                type="number"
                className="field"
                min={10}
                max={3600}
                value={value.loginBackground.intervalSeconds}
                onChange={(e) =>
                  change({
                    ...value,
                    loginBackground: {
                      ...value.loginBackground,
                      intervalSeconds: Number(e.target.value)
                    }
                  })
                }
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>已选择 {value.loginBackground.photoIds.length} / 20 张</span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                change({ ...value, loginBackground: { ...value.loginBackground, photoIds: [] } })
              }
            >
              清空选择
            </button>
            {value.loginBackground.photoIds.some((id) => !available.some((p) => p.id === id)) && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  change({
                    ...value,
                    loginBackground: {
                      ...value.loginBackground,
                      photoIds: value.loginBackground.photoIds.filter((id) =>
                        available.some((p) => p.id === id)
                      )
                    }
                  })
                }
              >
                移除已隐藏或删除的选择
              </button>
            )}
          </div>
          <div
            className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4"
            role="region"
            aria-label="可选背景照片"
            tabIndex={0}
          >
            {available.map((p) => (
              <label
                key={p.id}
                className="relative cursor-pointer overflow-hidden rounded-xl border border-line"
              >
                <img
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                  src={p.variants[0]?.url ?? p.src}
                  alt=""
                />
                <span className="flex items-center gap-2 p-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={value.loginBackground.photoIds.includes(p.id)}
                    disabled={
                      !value.loginBackground.photoIds.includes(p.id) &&
                      value.loginBackground.photoIds.length >= 20
                    }
                    onChange={(e) =>
                      change({
                        ...value,
                        loginBackground: {
                          ...value.loginBackground,
                          photoIds: e.target.checked
                            ? [...value.loginBackground.photoIds, p.id]
                            : value.loginBackground.photoIds.filter((id) => id !== p.id)
                        }
                      })
                    }
                  />
                  <span className="truncate">
                    {value.loginBackground.photoIds.includes(p.id)
                      ? `${value.loginBackground.photoIds.indexOf(p.id) + 1}. `
                      : ""}
                    {pickText(p.title, p.id)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {!available.length && <p className="text-xs text-muted">图库尚无公开照片。</p>}
        </fieldset>
      )}
      <div className="sticky bottom-3 mt-5 flex justify-end gap-3 rounded-xl border border-line bg-white p-3 shadow-card">
        <button
          className="btn-secondary"
          disabled={!draft || save.isPending}
          onClick={() => setDraft(null)}
        >
          放弃修改
        </button>
        <button
          className="btn-primary"
          disabled={!draft || save.isPending}
          onClick={() => draft && save.mutate(draft)}
        >
          {save.isPending ? "保存中…" : "保存设置"}
        </button>
      </div>
    </>
  );
}
