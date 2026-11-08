import {
  DEFAULT_PRESENTATION,
  HOME_SECTIONS,
  type AdminPhoto,
  type AdminPresentation,
  type PresentationSettings,
  type SiteLogo,
  type SiteSettingsDocument,
  type SiteSettingsGroups
} from "@liam-frost/shared";
import { ArrowDown, ArrowUp, ArrowUpRight, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";

import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import SiteMark from "../../../web/src/components/SiteMark";
import { refreshPresentation } from "../../../web/src/data/usePresentation";
import { refreshSiteSettings } from "../../../web/src/data/useSiteSettings";
import { BrandUpload, useBranding } from "../components/settings/BrandUpload";
import {
  SettingsActions,
  SettingsConflict,
  SettingsGrid,
  SettingsPage,
  SettingsPreview,
  SettingsSection,
  SettingsState
} from "../components/settings/SettingsUI";
import { useSettingsDocument } from "../components/settings/useSettingsDocument";
import { Field, Switch } from "../components/ui/Field";
import { IconButton } from "../components/ui/IconButton";
import { LanguageTabPanel, LanguageTabs } from "../components/ui/LanguageTabs";
import { Select } from "../components/ui/Select";
import { useAdminTitle } from "../hooks/useAdminTitle";
import { useHomeContentCounts } from "../hooks/useHomeContentCounts";
import { usePhotos } from "../hooks/usePhotos";
import { pickText, type Lang } from "../lib/i18n";
import { tr } from "../lib/messages";
import { LoginForm, LoginStage } from "./LoginPage";

const key = ["admin", "presentation"];
const fieldLabels: Record<string, string> = {
  sections: tr("首页模块"),
  publicLogo: tr("主页 Logo"),
  adminLogo: tr("后台 Logo"),
  loginBackground: tr("登录背景"),
  title: tr("前台页面标题"),
  adminTitle: tr("后台页面标题")
};

type Mode = "branding" | "home" | "login";

const usePresentationDocument = (mode: Mode) =>
  useSettingsDocument<AdminPresentation, PresentationSettings>({
    draftKey: `presentation:${mode}`,
    queryKey: key,
    url: "/api/admin/presentation",
    read: (document) => document.settings,
    onSaved: refreshPresentation
  });

export function AppearancePage({ mode }: { mode: Mode }) {
  if (mode === "branding") return <BrandingSettings />;
  return mode === "home" ? <HomeSettings /> : <LoginSettings />;
}

function Loading({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return error ? (
    <SettingsState error={error.message} onRetry={onRetry} />
  ) : (
    <LoadingSkeleton label={tr("加载外观设置…")} variant="form" />
  );
}

/* ---------------------------------- Logo, icon and titles ---------------------------------- */

function LogoSection({
  name,
  title,
  description,
  logo,
  onChange,
  preview
}: {
  name: "publicLogo" | "adminLogo";
  title: string;
  description: string;
  logo: SiteLogo;
  onChange: (patch: Partial<SiteLogo>) => void;
  preview: React.ReactNode;
}) {
  return (
    <SettingsSection title={title} description={description}>
      <SettingsGrid variant="aside">
        <div className="space-y-4">
          <BrandUpload
            slot={name}
            label={tr("{0}图片", title)}
            hint={tr("SVG、PNG、WebP 或 JPEG，不超过 2 MB，建议使用透明背景。")}
          />
          <SettingsGrid variant="equal">
            <Field label={tr("文字标记")} htmlFor={`${name}-text`} hint={tr("留空使用默认 Logo。")}>
              <input
                id={`${name}-text`}
                className="field"
                maxLength={12}
                value={logo.text}
                onChange={(event) => onChange({ text: event.target.value })}
              />
            </Field>
            <Field
              label={tr("Logo 替代文字")}
              htmlFor={`${name}-alt`}
              hint={tr("留空时作为装饰；填写后向屏幕阅读器说明品牌。")}
            >
              <input
                id={`${name}-alt`}
                className="field"
                maxLength={120}
                value={logo.alt ?? ""}
                onChange={(event) => onChange({ alt: event.target.value })}
              />
            </Field>
          </SettingsGrid>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">{tr("图片与文字的回退规则")}</summary>
            <p className="mt-2">
              {tr("有上传的图片时显示图片；没有图片时显示文字标记，文字也为空则使用默认 Logo。")}
            </p>
          </details>
        </div>
        <SettingsPreview title={tr("{0}效果", title)}>{preview}</SettingsPreview>
      </SettingsGrid>
    </SettingsSection>
  );
}

type Identity = SiteSettingsGroups["identity"];

function BrandingSettings() {
  const doc = usePresentationDocument("branding");
  const titles = useSettingsDocument<SiteSettingsDocument<"identity">, Identity>({
    draftKey: "site:identity:titles",
    queryKey: ["admin", "site-settings", "identity"],
    url: "/api/admin/site-settings/identity",
    read: (document) => document.value,
    onSaved: refreshSiteSettings
  });
  const branding = useBranding();
  const adminTitle = useAdminTitle();
  const tabs = useId();
  const [lang, setLang] = useState<Lang>("zh");

  if (!doc.value)
    return <Loading error={doc.query.error} onRetry={() => void doc.query.refetch()} />;
  const value = doc.value,
    identity = titles.value;
  const update = (name: "publicLogo" | "adminLogo") => (patch: Partial<SiteLogo>) =>
    doc.change({ ...value, [name]: { ...value[name], ...patch } });
  const logoOf = (name: "publicLogo" | "adminLogo") => ({
    text: value[name].text,
    alt: value[name].alt,
    src: branding.data?.[name] ?? null
  });
  const titleField = (name: "title" | "adminTitle", label: string, max: number) => (
    <Field label={label} htmlFor={`page-title-${name}`}>
      <input
        id={`page-title-${name}`}
        className="field"
        maxLength={max}
        value={identity?.[name][lang] ?? ""}
        onChange={(event) =>
          identity &&
          titles.change({
            ...identity,
            [name]: { ...identity[name], [lang]: event.target.value }
          })
        }
      />
    </Field>
  );

  return (
    <SettingsPage
      title={tr("Logo、图标与标题")}
      description={tr("统一管理主页、后台品牌、浏览器图标和页面标题。")}
    >
      <fieldset disabled={doc.busy || titles.busy} className="min-w-0 space-y-5">
        <LogoSection
          name="publicLogo"
          title={tr("主页 Logo")}
          description={tr("用于个人主页的品牌标记。")}
          logo={value.publicLogo}
          onChange={update("publicLogo")}
          preview={
            <div className="site-mark-preview flex min-h-20 items-center justify-center rounded-lg bg-white p-3 text-brand-dark">
              <SiteMark override={logoOf("publicLogo")} />
            </div>
          }
        />
        <LogoSection
          name="adminLogo"
          title={tr("后台 Logo")}
          description={tr("用于管理后台导航。")}
          logo={value.adminLogo}
          onChange={update("adminLogo")}
          preview={
            <div className="flex min-h-20 items-center gap-2.5 rounded-lg bg-brand-dark px-3 py-3 text-white">
              <SiteMark admin override={logoOf("adminLogo")} />
              <span className="min-w-0 truncate text-[15px] font-semibold">{adminTitle}</span>
            </div>
          }
        />
        <SettingsGrid variant="equal">
          <SettingsSection
            title={tr("网站图标")}
            description={tr("同时用于前台和后台的浏览器标签页。")}
          >
            <BrandUpload
              slot="favicon"
              label={tr("图标图片")}
              hint={tr(
                "建议使用正方形图片；非正方形会完整缩放并留出透明边。SVG、PNG、WebP 或 JPEG，不超过 2 MB。"
              )}
            />
            <SettingsPreview title={tr("浏览器标签页预览")}>
              <div className="flex min-w-0 items-center gap-2 rounded-t-lg border border-line bg-white px-3 py-2">
                <img
                  className="size-4 shrink-0 object-contain"
                  src={branding.data?.favicon ?? new URL("favicon.svg", document.baseURI).href}
                  alt=""
                />
                <span className="truncate text-xs text-brand">
                  {identity?.title[lang] || tr("网站标题")}
                </span>
                <span className="ml-auto text-xs text-muted" aria-hidden="true">
                  ×
                </span>
              </div>
            </SettingsPreview>
          </SettingsSection>
          <SettingsSection
            title={tr("页面标题")}
            description={tr(
              "显示在浏览器标签页上。后台标题也用作侧栏顶部的名称。留空使用默认标题。"
            )}
          >
            <LanguageTabs
              id={tabs}
              size="sm"
              value={lang}
              onChange={setLang}
              isFilled={(l) =>
                Boolean(identity?.title[l]?.trim() || identity?.adminTitle[l]?.trim())
              }
            />
            <LanguageTabPanel id={tabs} lang={lang} className="space-y-3.5">
              {titleField("title", tr("前台页面标题"), 160)}
              {titleField("adminTitle", tr("后台页面标题"), 80)}
            </LanguageTabPanel>
          </SettingsSection>
        </SettingsGrid>
      </fieldset>
      {doc.conflict ? (
        <SettingsConflict
          conflict={doc.conflict}
          labels={fieldLabels}
          onUseLatest={doc.useLatest}
          onKeepMine={doc.keepMine}
        />
      ) : null}
      {titles.conflict ? (
        <SettingsConflict
          conflict={titles.conflict}
          labels={fieldLabels}
          onUseLatest={titles.useLatest}
          onKeepMine={titles.keepMine}
        />
      ) : null}
      <SettingsActions
        saved={doc.saved || titles.saved}
        dirty={doc.dirty || titles.dirty}
        pending={doc.busy || titles.busy}
        error={doc.error ?? titles.error}
        blocked={Boolean(doc.conflict || titles.conflict)}
        scope={tr("保存文字标记和页面标题；已上传的图片已生效，不受影响。")}
        onSave={() => {
          doc.save();
          titles.save();
        }}
        onDiscard={() => {
          doc.discard();
          titles.discard();
        }}
      />
    </SettingsPage>
  );
}

/* --------------------------------------- Home modules --------------------------------------- */

const moduleLabels = {
  top: tr("首屏介绍"),
  about: tr("关于 / 宣言与设备"),
  skills: tr("技术栈"),
  projects: tr("精选项目"),
  watching: tr("收藏"),
  featured: tr("精选照片"),
  contact: tr("联系我")
};
const moduleLinks = {
  top: "/settings/site/identity",
  about: "/about",
  skills: "/stack",
  projects: "/projects",
  watching: "/collection",
  featured: "/photos",
  contact: "/contact"
};

function HomeSettings() {
  const doc = usePresentationDocument("home");
  const content = useHomeContentCounts(true);
  if (!doc.value)
    return <Loading error={doc.query.error} onRetry={() => void doc.query.refetch()} />;
  const value = doc.value;
  return (
    <SettingsPage
      title={tr("首页模块")}
      description={tr("控制首页显示哪些内容，关闭后仍保留原有资料。")}
    >
      <fieldset disabled={doc.busy} className="min-w-0 space-y-3">
        <p className="text-xs text-muted">
          {tr("开关开启且存在公开内容才显示；无内容时自动隐藏，加载期间保留骨架反馈。")}
        </p>
        <div className="settings-list">
          <div className="home-module-row home-module-head">
            <span>{tr("模块")}</span>
            <span>{tr("候选内容")}</span>
            <span>{tr("可见性")}</span>
            <span>{tr("开关")}</span>
            <span>{tr("内容管理")}</span>
          </div>
          {HOME_SECTIONS.map((id) => (
            <div className="home-module-row surface-row" key={id} data-section-row={id}>
              <span className="min-w-0 text-[13.5px] font-medium break-words text-brand-dark">
                {moduleLabels[id]}
              </span>
              <span className="text-xs text-muted">
                {content.isPending
                  ? tr("核验中…")
                  : content.data?.[id] == null
                    ? tr("无法核验")
                    : tr("{0} 项", content.data[id])}
              </span>
              <span className="text-xs text-muted">
                {!value.sections[id]
                  ? tr("已关闭")
                  : content.isPending
                    ? tr("加载中")
                    : content.data?.[id] == null
                      ? tr("待核验")
                      : content.data[id] === 0
                        ? tr("无内容，隐藏")
                        : tr("可显示")}
              </span>
              <Switch
                id={`section-${id}`}
                label={<span className="sr-only">{moduleLabels[id]}</span>}
                checked={value.sections[id]}
                onChange={(checked) =>
                  doc.change({ ...value, sections: { ...value.sections, [id]: checked } })
                }
              />
              <Link
                className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                to={moduleLinks[id]}
                aria-label={tr("编辑内容：{0}", moduleLabels[id])}
              >
                {tr("编辑内容")}
                <ArrowUpRight aria-hidden="true" className="size-3" />
              </Link>
            </div>
          ))}
        </div>
        {content.data && Object.values(content.data).some((count) => count == null) ? (
          <SettingsState
            error={tr("部分公开内容暂时无法核验，开关草稿不受影响。")}
            onRetry={() => void content.refetch()}
          />
        ) : null}
      </fieldset>
      {doc.conflict ? (
        <SettingsConflict
          conflict={doc.conflict}
          labels={fieldLabels}
          onUseLatest={doc.useLatest}
          onKeepMine={doc.keepMine}
        />
      ) : null}
      <SettingsActions
        saved={doc.saved}
        dirty={doc.dirty}
        pending={doc.busy}
        error={doc.error}
        blocked={Boolean(doc.conflict)}
        onSave={doc.save}
        onDiscard={doc.discard}
      />
    </SettingsPage>
  );
}

/* --------------------------------------- Login appearance --------------------------------------- */

const LIMIT = 20;
const PAGE_SIZE = 24;
/** The same size the login page asks for. */
const photoUrl = (photo: AdminPhoto) =>
  (photo.variants.find((variant) => variant.width >= 1600) ?? photo.variants.at(-1))?.url ??
  photo.src;

/** The real login page, drawn at a desktop size and scaled to fit, so its crop matches. */
function LoginPreview({ image }: { image?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => setScale(element.clientWidth / 1280);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={frame}
      inert
      aria-hidden="true"
      className="relative aspect-[16/10] overflow-hidden rounded-lg bg-canvas"
    >
      <div
        style={{ width: 1280, height: 800, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      >
        <LoginStage image={image} fill>
          <LoginForm preview />
        </LoginStage>
      </div>
    </div>
  );
}

function LoginSettings() {
  const doc = usePresentationDocument("login");
  const photoQuery = usePhotos();
  const available = (photoQuery.data ?? []).filter((photo) => photo.visibility === "public");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [previewIndex, setPreviewIndex] = useState(0);

  const background = (doc.value ?? DEFAULT_PRESENTATION).loginBackground;
  const selected = background.photoIds.flatMap((id) => {
    const photo = available.find((item) => item.id === id);
    return photo ? [photo] : [];
  });
  const rotating = background.mode === "rotate";
  useEffect(() => {
    setPreviewIndex(0);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!rotating || motion.matches || selected.length < 2) return;
    const timer = setInterval(
      () => setPreviewIndex((index) => index + 1),
      Math.max(10, Math.min(3600, background.intervalSeconds || 10)) * 1000
    );
    return () => clearInterval(timer);
  }, [rotating, background.intervalSeconds, selected.length]);

  if (!doc.value)
    return <Loading error={doc.query.error} onRetry={() => void doc.query.refetch()} />;
  const value = doc.value;
  const setBackground = (patch: Partial<typeof background>) =>
    doc.change({ ...value, loginBackground: { ...background, ...patch } });
  const fixed = background.mode === "fixed";
  const ids = background.photoIds;
  // A fixed background is the first photo: picking another puts it first and keeps the rest.
  const pick = (id: string, on: boolean) =>
    setBackground({
      photoIds: fixed
        ? [id, ...ids.filter((item) => item !== id)].slice(0, LIMIT)
        : on
          ? [...ids, id]
          : ids.filter((item) => item !== id)
    });
  const move = (index: number, direction: number) => {
    const next = [...ids];
    [next[index], next[index + direction]] = [next[index + direction]!, next[index]!];
    setBackground({ photoIds: next });
  };
  const listed = fixed ? ids.slice(0, 1) : ids;
  const preview =
    background.mode === "none" || !selected.length
      ? undefined
      : photoUrl(selected[(fixed ? 0 : previewIndex) % selected.length]!);
  const matches = available.filter((photo) =>
    pickText(photo.title, photo.id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SettingsPage title={tr("登录外观")} description={tr("选择登录背景，并预览固定或轮换效果。")}>
      <fieldset disabled={doc.busy} className="min-w-0 space-y-5">
        <SettingsGrid variant="aside">
          <div className="space-y-5">
            <SettingsSection title={tr("背景设置")} description={tr("仅使用公开图库照片。")}>
              <SettingsGrid variant="equal">
                <Field label={tr("展示方式")} htmlFor="background-mode">
                  <Select
                    id="background-mode"
                    value={background.mode}
                    onChange={(mode) => setBackground({ mode })}
                    options={[
                      { value: "none" as const, label: tr("纯色背景") },
                      { value: "fixed" as const, label: tr("固定照片") },
                      { value: "rotate" as const, label: tr("轮换照片") }
                    ]}
                  />
                </Field>
                {rotating ? (
                  <Field
                    label={tr("轮换间隔（秒）")}
                    htmlFor="background-interval"
                    hint={tr("10–3600 秒。减少动态效果时保持第一张照片。")}
                  >
                    <input
                      id="background-interval"
                      className="field"
                      type="number"
                      min={10}
                      max={3600}
                      value={background.intervalSeconds}
                      onChange={(event) =>
                        setBackground({ intervalSeconds: Number(event.target.value) })
                      }
                    />
                  </Field>
                ) : null}
              </SettingsGrid>
            </SettingsSection>
            {background.mode !== "none" ? (
              <SettingsSection
                title={fixed ? tr("当前照片") : tr("已选照片 · {0} / {1}", ids.length, LIMIT)}
                description={fixed ? undefined : tr("按此顺序轮换。")}
                actions={
                  ids.length && !fixed ? (
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setBackground({ photoIds: [] })}
                    >
                      {tr("清空选择")}
                    </button>
                  ) : undefined
                }
              >
                {listed.length ? (
                  <ol className="-my-1 divide-y divide-line-soft">
                    {listed.map((id, index) => {
                      const photo = available.find((item) => item.id === id);
                      const name = photo ? pickText(photo.title, photo.id) : tr("照片已隐藏或删除");
                      return (
                        <li className="flex items-center gap-2.5 py-1.5" key={id}>
                          {fixed ? null : (
                            <span className="w-5 text-center text-xs text-muted">{index + 1}</span>
                          )}
                          <span className="block h-9 w-12 shrink-0 overflow-hidden rounded-md bg-canvas">
                            {photo ? (
                              <img
                                className="size-full object-cover"
                                alt=""
                                src={photo.thumbnail}
                              />
                            ) : null}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate text-[13px] ${photo ? "text-ink" : "text-status-warn"}`}
                          >
                            {name}
                          </span>
                          {fixed ? null : (
                            <>
                              <IconButton
                                label={tr("上移第{0}张背景", index + 1)}
                                disabled={!index}
                                onClick={() => move(index, -1)}
                              >
                                <ArrowUp aria-hidden="true" className="size-4" />
                              </IconButton>
                              <IconButton
                                label={tr("下移第{0}张背景", index + 1)}
                                disabled={index === ids.length - 1}
                                onClick={() => move(index, 1)}
                              >
                                <ArrowDown aria-hidden="true" className="size-4" />
                              </IconButton>
                            </>
                          )}
                          <IconButton
                            danger
                            label={tr("移除第{0}张背景", index + 1)}
                            onClick={() =>
                              setBackground({ photoIds: ids.filter((item) => item !== id) })
                            }
                          >
                            <X aria-hidden="true" className="size-4" />
                          </IconButton>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <SettingsState empty={tr("从下方公开图库选择照片")} />
                )}
              </SettingsSection>
            ) : null}
          </div>
          <div className="login-preview-sticky">
            <SettingsPreview title={tr("登录页效果预览")}>
              <LoginPreview image={preview} />
              <p className="mt-2 text-xs text-muted">
                {rotating && selected.length > 1
                  ? tr("当前第 {0} / {1} 张", (previewIndex % selected.length) + 1, selected.length)
                  : tr("配置预览，保存后生效")}
              </p>
            </SettingsPreview>
          </div>
        </SettingsGrid>
        {background.mode !== "none" ? (
          <SettingsSection
            title={tr("公开图库")}
            description={
              fixed ? tr("选择一张作为登录背景。") : tr("选择顺序即轮换顺序；最多20张。")
            }
            actions={
              <Link className="btn-secondary btn-sm" to="/photos">
                {tr("管理照片")}
              </Link>
            }
          >
            <Field label={tr("搜索背景照片")} htmlFor="background-search" width="short">
              <input
                id="background-search"
                className="field"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setShown(PAGE_SIZE);
                }}
              />
            </Field>
            {photoQuery.isPending ? (
              <LoadingSkeleton label={tr("加载图库…")} variant="cards" />
            ) : photoQuery.error ? (
              <SettingsState
                error={photoQuery.error.message}
                onRetry={() => void photoQuery.refetch()}
              />
            ) : matches.length ? (
              <>
                <div className="photo-grid" role="group" aria-label={tr("可选背景照片")}>
                  {matches.slice(0, shown).map((photo) => {
                    const position = (fixed ? ids.slice(0, 1) : ids).indexOf(photo.id);
                    const isSelected = position >= 0;
                    return (
                      <label className="photo-option" data-selected={isSelected} key={photo.id}>
                        <input
                          className="sr-only"
                          type={fixed ? "radio" : "checkbox"}
                          name={fixed ? "login-photo" : undefined}
                          checked={isSelected}
                          disabled={!fixed && !isSelected && ids.length >= LIMIT}
                          onChange={(event) => pick(photo.id, event.target.checked)}
                        />
                        <img
                          className="aspect-[4/3] w-full rounded-lg object-cover"
                          loading="lazy"
                          src={photo.thumbnail}
                          alt=""
                        />
                        {isSelected ? (
                          <span className="photo-option-mark" aria-hidden="true">
                            {fixed ? "✓" : position + 1}
                          </span>
                        ) : null}
                        <span className="mt-1.5 block truncate px-0.5 text-xs text-ink">
                          {pickText(photo.title, photo.id)}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {matches.length > shown ? (
                  <div className="text-center">
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setShown((count) => count + PAGE_SIZE)}
                    >
                      {tr("显示更多（还有 {0} 张）", matches.length - shown)}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <SettingsState
                empty={
                  available.length
                    ? tr("没有匹配的背景照片")
                    : tr("图库暂无公开照片，请先上传并公开。")
                }
              />
            )}
          </SettingsSection>
        ) : null}
      </fieldset>
      {doc.conflict ? (
        <SettingsConflict
          conflict={doc.conflict}
          labels={fieldLabels}
          onUseLatest={doc.useLatest}
          onKeepMine={doc.keepMine}
        />
      ) : null}
      <SettingsActions
        saved={doc.saved}
        dirty={doc.dirty}
        pending={doc.busy}
        error={doc.error}
        blocked={Boolean(doc.conflict)}
        onSave={doc.save}
        onDiscard={doc.discard}
      />
    </SettingsPage>
  );
}
