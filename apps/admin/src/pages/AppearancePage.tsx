import {
  DEFAULT_PRESENTATION,
  HOME_SECTIONS,
  type AdminPresentation,
  type PresentationSettings,
  type SiteLogo
} from "@liam-frost/shared";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, ArrowUpRight, Check } from "lucide-react";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { useHomeContentCounts } from "../hooks/useHomeContentCounts";
import { Field, Switch } from "../components/ui/Field";
import { ApiError, request } from "../lib/api";
import { usePhotos } from "../hooks/usePhotos";
import { pickText } from "../lib/i18n";
import { useToast } from "../components/ui/Toast";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import { refreshPresentation } from "../../../web/src/data/usePresentation";
import { clearSettingsDraftIfUnchanged, useSettingsDraft } from "../components/settings/drafts";
import {
  SettingsBrandPreview,
  SettingsActions,
  SettingsAssetPicker,
  SettingsConflict,
  SettingsPage,
  SettingsPreview,
  SettingsSection,
  SettingsState
} from "../components/settings/SettingsUI";
import { SiteSettingsPage } from "./SiteSettingsPage";

const labels = {
  top: "首屏介绍",
  about: "关于 / 宣言与设备",
  skills: "技术栈",
  projects: "精选项目",
  watching: "收藏",
  featured: "精选照片",
  contact: "联系我"
};
const links = {
  top: "/settings/site/identity",
  about: "/about",
  skills: "/stack",
  projects: "/projects",
  watching: "/collection",
  featured: "/photos",
  contact: "/contact"
};
const key = ["admin", "presentation"];
type Mode = "branding" | "home" | "login";
// Keep untouched responsibilities from the newest document when resolving a conflict.
const mergeScope = (
  current: PresentationSettings,
  draft: PresentationSettings,
  mode: Mode
): PresentationSettings =>
  mode === "branding"
    ? { ...current, publicLogo: draft.publicLogo, adminLogo: draft.adminLogo }
    : mode === "home"
      ? { ...current, sections: draft.sections }
      : { ...current, loginBackground: draft.loginBackground };
export function AppearancePage({ mode }: { mode: Mode }) {
  const q = useQuery({
    queryKey: key,
    queryFn: () => request<AdminPresentation>("/api/admin/presentation")
  });
  const content = useHomeContentCounts(mode === "home"),
    photoQuery = usePhotos(),
    photos = photoQuery.data ?? [],
    available = photos.filter((photo) => photo.visibility === "public");
  const [draft, setDraft] = useSettingsDraft<AdminPresentation>(`presentation:${mode}`),
    [conflict, setConflict] = useState<AdminPresentation | null>(null),
    [search, setSearch] = useState("");
  const value = draft?.settings ?? q.data?.settings ?? DEFAULT_PRESENTATION,
    toast = useToast(),
    qc = useQueryClient();
  const busy = useIsMutating({ mutationKey: key }) > 0;
  const save = useMutation({
    mutationKey: key,
    mutationFn: (body: AdminPresentation) =>
      request<AdminPresentation>("/api/admin/presentation", { method: "PUT", json: body }),
    onSuccess: (data, submitted) => {
      qc.setQueryData(key, data);
      clearSettingsDraftIfUnchanged(`presentation:${mode}`, submitted);
      setConflict(null);
      refreshPresentation();
    },
    onError: async (error: Error) => {
      toast(error.message, "error");
      if (error instanceof ApiError && error.code === "PRESENTATION_OUT_OF_DATE") {
        try {
          setConflict(await request<AdminPresentation>("/api/admin/presentation"));
        } catch {
          toast("最新版本读取失败，草稿仍保留。", "error");
        }
      }
    }
  });
  const change = (settings: PresentationSettings) => {
    if (q.data && !busy)
      setDraft(
        JSON.stringify(settings) === JSON.stringify(q.data.settings)
          ? null
          : { settings, revision: draft?.revision ?? q.data.revision }
      );
  };
  const [previewIndex, setPreviewIndex] = useState(0);
  const selectedPhotos = value.loginBackground.photoIds
    .map((id) => available.find((photo) => photo.id === id))
    .filter((photo) => photo != null);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      clearInterval(timer);
      setPreviewIndex(0);
      if (
        mode === "login" &&
        value.loginBackground.mode === "rotate" &&
        !motion.matches &&
        selectedPhotos.length > 1
      )
        timer = setInterval(
          () => setPreviewIndex((index) => index + 1),
          (Number.isFinite(value.loginBackground.intervalSeconds)
            ? Math.max(10, Math.min(3600, value.loginBackground.intervalSeconds))
            : 10) * 1000
        );
    };
    update();
    motion.addEventListener("change", update);
    return () => {
      clearInterval(timer);
      motion.removeEventListener("change", update);
    };
  }, [
    mode,
    value.loginBackground.mode,
    value.loginBackground.intervalSeconds,
    selectedPhotos.length
  ]);
  if (q.isPending) return <LoadingSkeleton label="加载外观设置…" variant="form" />;
  if (q.error) return <SettingsState error={q.error.message} onRetry={() => void q.refetch()} />;
  const logoPreview = (logo: SiteLogo, admin = true) => {
    const photo = available.find((photo) => photo.id === logo.photoId);
    return (
      <SettingsBrandPreview
        src={photo?.variants[0]?.url ?? photo?.src}
        text={logo.text}
        alt={logo.alt}
        defaultSrc={admin ? new URL("favicon.svg", document.baseURI).href : "/LOGO2.svg"}
      />
    );
  };
  const logoEditor = (name: "publicLogo" | "adminLogo", title: string) => {
    const logo = value[name],
      update = (patch: Partial<SiteLogo>) => change({ ...value, [name]: { ...logo, ...patch } });
    return (
      <SettingsSection
        title={title}
        description={
          name === "publicLogo" ? "用于个人主页的品牌标记。" : "用于管理后台导航和登录页。"
        }
      >
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_160px]">
          <div className="min-w-0 space-y-4">
            <SettingsAssetPicker
              label={`${title}图片`}
              photos={available}
              selected={logo.photoId}
              onChange={(photoId) => update({ photoId })}
              loading={photoQuery.isPending}
              error={photoQuery.error?.message}
              onRetry={() => void photoQuery.refetch()}
              defaultLabel="不使用图片"
            />
            <Field
              label="文字标记"
              htmlFor={`${name}-text`}
              hint="留空使用默认 Logo。"
              className="max-w-xs"
            >
              <input
                id={`${name}-text`}
                className="field"
                maxLength={12}
                value={logo.text}
                onChange={(event) => update({ text: event.target.value })}
              />
            </Field>
            <Field
              label="Logo 替代文字"
              htmlFor={`${name}-alt`}
              hint="留空时作为装饰；填写后向屏幕阅读器说明品牌。"
              className="max-w-sm"
            >
              <input
                id={`${name}-alt`}
                className="field"
                maxLength={120}
                value={logo.alt ?? ""}
                onChange={(event) => update({ alt: event.target.value })}
              />
            </Field>
          </div>
          <SettingsPreview title={`${title}效果`}>
            <div
              className={`flex min-h-24 items-center justify-center gap-2 rounded-lg p-3 ${name === "adminLogo" ? "bg-brand-dark text-white" : "bg-white text-brand"}`}
            >
              {logoPreview(logo, name === "adminLogo")}
            </div>
          </SettingsPreview>
        </div>
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">图片与文字的回退规则</summary>
          <p className="mt-2">
            图片优先；图片隐藏或删除后使用文字，文字为空则使用默认
            Logo。此处预览不修改公开站点，保存后生效。
          </p>
        </details>
      </SettingsSection>
    );
  };
  const movePhoto = (index: number, direction: number) => {
    const ids = [...value.loginBackground.photoIds];
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    change({ ...value, loginBackground: { ...value.loginBackground, photoIds: ids } });
  };
  const background =
    value.loginBackground.mode !== "none"
      ? selectedPhotos[previewIndex % Math.max(1, selectedPhotos.length)]
      : undefined;
  return (
    <SettingsPage
      title={mode === "branding" ? "Logo 与网站图标" : mode === "home" ? "首页模块" : "登录外观"}
      description={
        mode === "branding"
          ? "统一管理主页、后台品牌和浏览器图标。"
          : mode === "home"
            ? "控制首页显示哪些内容，关闭后仍保留原有资料。"
            : "选择登录背景，并预览固定或轮换效果。"
      }
    >
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        {mode === "branding" ? (
          <>
            {logoEditor("publicLogo", "主页 Logo")}
            {logoEditor("adminLogo", "后台 Logo")}
          </>
        ) : null}
        {mode === "home" ? (
          <>
            <p className="text-xs text-muted">
              开关开启且存在公开内容才显示；无内容时自动隐藏，加载期间保留骨架反馈。
            </p>
            <div className="settings-list">
              <div className="hidden grid-cols-[minmax(0,1fr)_88px_100px_60px_80px] gap-3 bg-canvas px-4 py-2 text-[11px] text-muted lg:grid">
                <span>模块</span>
                <span>候选内容</span>
                <span>可见性</span>
                <span>开关</span>
                <span>内容管理</span>
              </div>
              {HOME_SECTIONS.map((id) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_88px_100px_60px_80px]"
                  key={id}
                  data-section-row={id}
                >
                  <span className="break-words text-sm font-medium text-brand-dark">
                    {labels[id]}
                  </span>
                  <span className="text-xs text-muted">
                    {content.isPending
                      ? "核验中…"
                      : content.data?.[id] == null
                        ? "无法核验"
                        : `${content.data[id]} 项`}
                  </span>
                  <span className="text-xs text-muted">
                    {!value.sections[id]
                      ? "已关闭"
                      : content.isPending
                        ? "加载中"
                        : content.data?.[id] == null
                          ? "待核验"
                          : content.data[id] === 0
                            ? "无内容，隐藏"
                            : "可显示"}
                  </span>
                  <Switch
                    id={`section-${id}`}
                    label={<span className="sr-only">{labels[id]}</span>}
                    checked={value.sections[id]}
                    onChange={(checked) =>
                      change({ ...value, sections: { ...value.sections, [id]: checked } })
                    }
                  />
                  <Link
                    className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                    to={links[id]}
                    aria-label={`编辑内容：${labels[id]}`}
                  >
                    编辑内容
                    <ArrowUpRight aria-hidden="true" className="size-3" />
                  </Link>
                </div>
              ))}
            </div>
            {content.data && Object.values(content.data).some((count) => count == null) ? (
              <SettingsState
                error="部分公开内容暂时无法核验，开关草稿不受影响。"
                onRetry={() => void content.refetch()}
              />
            ) : null}
          </>
        ) : null}
        {mode === "login" ? (
          <>
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <SettingsSection
                title="背景设置"
                description="仅使用公开图库照片；固定模式使用第一张，轮换按已选顺序播放。"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="展示方式" htmlFor="background-mode">
                    <select
                      id="background-mode"
                      className="field"
                      value={value.loginBackground.mode}
                      onChange={(event) =>
                        change({
                          ...value,
                          loginBackground: {
                            ...value.loginBackground,
                            mode: event.target.value as typeof value.loginBackground.mode
                          }
                        })
                      }
                    >
                      <option value="none">纯色背景</option>
                      <option value="fixed">固定照片</option>
                      <option value="rotate">轮换照片</option>
                    </select>
                  </Field>
                  <Field
                    label="轮换间隔（秒）"
                    htmlFor="background-interval"
                    hint="10–3600 秒，轮换模式生效。"
                  >
                    <input
                      id="background-interval"
                      className="field"
                      type="number"
                      min={10}
                      max={3600}
                      value={value.loginBackground.intervalSeconds}
                      onChange={(event) =>
                        change({
                          ...value,
                          loginBackground: {
                            ...value.loginBackground,
                            intervalSeconds: Number(event.target.value)
                          }
                        })
                      }
                    />
                  </Field>
                </div>
                <p className="text-xs text-muted">
                  减少动态效果时保持第一张照片。
                  <Link className="ml-1 text-brand underline" to="/settings/site/branding">
                    修改后台 Logo
                  </Link>
                </p>
              </SettingsSection>
              <SettingsPreview title="登录页效果预览">
                <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-xl bg-canvas p-5">
                  {background ? (
                    <>
                      <img
                        src={background.variants[0]?.url ?? background.src}
                        className="absolute inset-0 size-full object-cover"
                        alt=""
                      />
                      <div className="absolute inset-0 bg-black/40" />
                    </>
                  ) : null}
                  <div className="relative w-full max-w-56 rounded-xl border border-line bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-brand">
                      {logoPreview(value.adminLogo)}
                      <span className="text-sm font-semibold">管理员登录</span>
                    </div>
                    <div className="space-y-3" aria-hidden="true">
                      <div className="h-8 rounded-lg border border-line bg-canvas" />
                      <div className="h-8 rounded-lg border border-line bg-canvas" />
                      <div className="h-8 rounded-full bg-brand" />
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {value.loginBackground.mode === "rotate" && selectedPhotos.length > 1
                    ? `当前第 ${(previewIndex % selectedPhotos.length) + 1} / ${selectedPhotos.length} 张`
                    : "配置预览，保存后生效"}
                </p>
              </SettingsPreview>
            </div>
            <SettingsSection
              title={`已选照片 · ${value.loginBackground.photoIds.length} / 20`}
              actions={
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!value.loginBackground.photoIds.length}
                  onClick={() =>
                    change({
                      ...value,
                      loginBackground: { ...value.loginBackground, photoIds: [] }
                    })
                  }
                >
                  清空选择
                </button>
              }
            >
              {value.loginBackground.photoIds.length ? (
                <ol className="divide-y divide-line-soft">
                  {value.loginBackground.photoIds.map((id, index) => {
                    const photo = available.find((item) => item.id === id);
                    return (
                      <li className="flex items-center gap-2 py-2" key={id}>
                        <span className="w-5 text-xs text-muted">{index + 1}</span>
                        {photo ? (
                          <img
                            className="h-10 w-14 object-contain"
                            alt=""
                            src={photo.variants[0]?.url ?? photo.src}
                          />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate text-xs">
                          {photo ? pickText(photo.title, photo.id) : "照片已隐藏或删除"}
                        </span>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-brand disabled:opacity-40"
                          aria-label={`上移第${index + 1}张背景`}
                          disabled={!index}
                          onClick={() => movePhoto(index, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-brand disabled:opacity-40"
                          aria-label={`下移第${index + 1}张背景`}
                          disabled={index === value.loginBackground.photoIds.length - 1}
                          onClick={() => movePhoto(index, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-2 py-2 text-xs text-brand"
                          aria-label={`移除第${index + 1}张背景`}
                          onClick={() =>
                            change({
                              ...value,
                              loginBackground: {
                                ...value.loginBackground,
                                photoIds: value.loginBackground.photoIds.filter(
                                  (value) => value !== id
                                )
                              }
                            })
                          }
                        >
                          移除
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <SettingsState empty="尚未选择背景照片" />
              )}
            </SettingsSection>
            <SettingsSection
              title="公开图库"
              description="选择顺序即轮换顺序；最多20张。"
              actions={
                <Link className="btn-secondary" to="/photos">
                  管理照片
                </Link>
              }
            >
              <Field label="搜索背景照片" htmlFor="background-search" className="max-w-sm">
                <input
                  id="background-search"
                  className="field"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Field>
              {photoQuery.isPending ? (
                <LoadingSkeleton label="加载图库…" variant="cards" />
              ) : photoQuery.error ? (
                <SettingsState
                  error={photoQuery.error.message}
                  onRetry={() => void photoQuery.refetch()}
                />
              ) : null}
              <div
                className="grid max-h-[440px] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 lg:grid-cols-4"
                role="region"
                aria-label="可选背景照片"
                tabIndex={0}
              >
                {available
                  .filter((photo) =>
                    pickText(photo.title, photo.id).toLowerCase().includes(search.toLowerCase())
                  )
                  .map((photo) => {
                    const selected = value.loginBackground.photoIds.includes(photo.id);
                    return (
                      <label
                        key={photo.id}
                        className={`relative cursor-pointer rounded-xl border p-2 ${selected ? "border-brand bg-brand/5" : "border-line"}`}
                      >
                        <img
                          className="h-24 w-full object-contain sm:h-28"
                          loading="lazy"
                          src={photo.variants[0]?.url ?? photo.src}
                          alt=""
                        />
                        <span className="mt-2 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!selected && value.loginBackground.photoIds.length >= 20}
                            onChange={(event) =>
                              change({
                                ...value,
                                loginBackground: {
                                  ...value.loginBackground,
                                  photoIds: event.target.checked
                                    ? [...value.loginBackground.photoIds, photo.id]
                                    : value.loginBackground.photoIds.filter((id) => id !== photo.id)
                                }
                              })
                            }
                          />
                          <span className="min-w-0 truncate">
                            {pickText(photo.title, photo.id)}
                          </span>
                          {selected ? (
                            <Check className="size-3 shrink-0 text-brand" aria-hidden="true" />
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
              </div>
              {!photoQuery.isPending &&
              !photoQuery.error &&
              !available.some((photo) =>
                pickText(photo.title, photo.id).toLowerCase().includes(search.toLowerCase())
              ) ? (
                <SettingsState
                  empty={
                    available.length ? "没有匹配的背景照片" : "图库暂无公开照片，请先上传并公开。"
                  }
                />
              ) : null}
            </SettingsSection>
          </>
        ) : null}
      </fieldset>
      {conflict && draft ? (
        <SettingsConflict
          current={conflict.settings}
          draft={draft.settings}
          onUseCurrent={() => {
            qc.setQueryData(key, conflict);
            setDraft(null);
            setConflict(null);
            save.reset();
          }}
          onKeepDraft={() => {
            qc.setQueryData(key, conflict);
            setDraft({
              settings: mergeScope(conflict.settings, draft.settings, mode),
              revision: conflict.revision
            });
            setConflict(null);
            save.reset();
          }}
        />
      ) : null}
      <SettingsActions
        saved={save.isSuccess}
        dirty={Boolean(draft)}
        pending={busy}
        error={save.error?.message}
        blocked={Boolean(conflict)}
        inline={mode === "branding"}
        label={mode === "branding" ? "保存 Logo" : undefined}
        onDiscard={() => {
          setDraft(null);
          setConflict(null);
          save.reset();
        }}
        onSave={() => draft && save.mutate(draft)}
      />
      {mode === "branding" ? <SiteSettingsPage group="favicon" embedded /> : null}
    </SettingsPage>
  );
}
