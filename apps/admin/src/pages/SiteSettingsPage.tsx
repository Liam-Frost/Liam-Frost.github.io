import { useId, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  FOOTER_PAGES,
  type FooterCopyright,
  type FooterPage,
  type LocalizedText,
  type SiteSettingsGroup,
  type SiteSettingsGroups,
  type SiteSettingsDocument
} from "@liam-frost/shared";
import { Field, Switch } from "../components/ui/Field";
import { IconButton } from "../components/ui/IconButton";
import { LanguageTabPanel, LanguageTabs } from "../components/ui/LanguageTabs";
import { Select } from "../components/ui/Select";
import { Slider } from "../components/ui/Slider";
import { api, request } from "../lib/api";
import { mediaKey } from "../hooks/useMedia";
import { LANGS, LANG_LABELS, type Lang } from "../lib/i18n";
import { refreshSiteSettings } from "../../../web/src/data/useSiteSettings";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import { copyrightPageLabels, settingsDate } from "../components/settings/copy";
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
import { AvatarUpload } from "../components/settings/BrandUpload";
import { tr } from "../lib/messages";

const titles: Record<SiteSettingsGroup, string> = {
  identity: tr("基本资料"),
  footer: tr("页脚与版权"),
  preferences: tr("默认显示与语言"),
  navigation: tr("导航外观"),
  privacy: tr("隐私说明"),
  dictionary: tr("标签词典"),
  images: tr("图片管理")
};
const descriptions: Record<SiteSettingsGroup, string> = {
  identity: tr("设置公开姓名和首屏头像。"),
  footer: tr("为四个页面分别设置版权声明，并管理页脚链接。"),
  preferences: tr("决定访客首次访问时的显示偏好。"),
  navigation: tr("调整前台底部导航和页面按钮的玻璃效果。"),
  privacy: tr("编辑公开隐私说明，历史版本可载入为草稿。"),
  dictionary: tr("为收藏标签补齐多语言翻译，保留原有内容标识。"),
  images: tr("设置回收站保留时间和每张照片的版本上限。")
};
const fieldLabels: Record<string, string> = {
  name: tr("显示姓名"),
  title: tr("标题"),
  adminTitle: tr("后台页面标题"),
  copyright: tr("版权声明"),
  links: tr("页脚链接"),
  theme: tr("默认主题"),
  language: tr("默认语言"),
  tabBarMode: tr("显示模式"),
  glass: tr("玻璃材质"),
  selectedButton: tr("选中按钮样式"),
  refraction: tr("边缘折射"),
  showLabels: tr("显示文字"),
  bottomOffset: tr("底部距离"),
  body: tr("隐私正文"),
  effectiveDate: tr("生效日期"),
  entries: tr("词条"),
  trashRetentionDays: tr("回收站保留天数"),
  maxPhotoVersions: tr("每张照片的版本上限")
};
export function SiteSettingsPage({ group }: { group: SiteSettingsGroup }) {
  const key = ["admin", "site-settings", group];
  const qc = useQueryClient();
  const tabs = useId();
  const doc = useSettingsDocument<SiteSettingsDocument, SiteSettingsGroups[SiteSettingsGroup]>({
    draftKey: `site:${group}`,
    queryKey: key,
    url: `/api/admin/site-settings/${group}`,
    read: (document) => document.value,
    onSaved: () => {
      refreshSiteSettings();
      void qc.invalidateQueries({ queryKey: ["admin", "privacy-history"] });
    }
  });
  const q = doc.query;
  const [lang, setLang] = useState<Lang>("zh"),
    [filter, setFilter] = useState(""),
    [missingOnly, setMissingOnly] = useState(false),
    [expanded, setExpanded] = useState<string | null>(null),
    [copyrightPage, setCopyrightPage] = useState<FooterPage>("home");
  const usage = useQuery({
    queryKey: mediaKey,
    queryFn: api.media,
    enabled: group === "dictionary"
  });
  const usageIndex = useMemo(() => {
    const index = new Map<string, Set<string>>();
    for (const item of usage.data?.items ?? [])
      for (const genre of item.genres)
        for (const value of Object.values(genre)) {
          if (!value) continue;
          const key = value.normalize("NFKC").trim().toLowerCase(),
            ids = index.get(key) ?? new Set<string>();
          ids.add(item.id);
          index.set(key, ids);
        }
    return index;
  }, [usage.data]);
  const usedCount = (aliases: string[]) =>
    new Set(
      aliases.flatMap((alias) => [
        ...(usageIndex.get(alias.normalize("NFKC").trim().toLowerCase()) ?? [])
      ])
    ).size;
  const value = doc.value;
  const savedEntries = new Map(
    ((q.data?.value as SiteSettingsGroups["dictionary"] | undefined)?.entries ?? []).map(
      (entry) => [entry.id, entry]
    )
  );
  const history = useQuery({
    queryKey: ["admin", "privacy-history"],
    queryFn: () =>
      request<{ history: (SiteSettingsDocument<"privacy"> & { savedAt: string })[] }>(
        "/api/admin/site-settings/privacy/history"
      ),
    enabled: group === "privacy"
  });
  const change = doc.change;
  const localized = (
    label: string,
    data: LocalizedText,
    onChange: (value: LocalizedText) => void,
    multiline = false,
    suffix = "",
    width?: "short" | "long"
  ) => (
    <Field label={label} htmlFor={`settings-${group}-${label}-${suffix}`} width={width}>
      {multiline ? (
        <textarea
          id={`settings-${group}-${label}-${suffix}`}
          className="field min-h-56"
          maxLength={20000}
          value={data[lang] ?? ""}
          onChange={(event) => onChange({ ...data, [lang]: event.target.value })}
        />
      ) : (
        <input
          id={`settings-${group}-${label}-${suffix}`}
          className="field"
          maxLength={group === "privacy" ? 160 : 120}
          value={data[lang] ?? ""}
          onChange={(event) => onChange({ ...data, [lang]: event.target.value })}
        />
      )}
    </Field>
  );
  if (q.isPending) return <LoadingSkeleton label={tr("加载网站设置…")} variant="form" />;
  if (q.error || !value)
    return (
      <SettingsState
        error={q.error?.message ?? tr("无法读取设置")}
        onRetry={() => void q.refetch()}
      />
    );
  const identity = value as SiteSettingsGroups["identity"],
    footer = value as SiteSettingsGroups["footer"],
    preferences = value as SiteSettingsGroups["preferences"],
    navigation = value as SiteSettingsGroups["navigation"],
    privacy = value as SiteSettingsGroups["privacy"],
    dictionary = value as SiteSettingsGroups["dictionary"],
    images = value as SiteSettingsGroups["images"];
  /** A whole number within the field's range, or the lower bound while the field is empty. */
  const whole = (text: string, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.round(Number(text)) || min));
  const filtered =
    group === "dictionary"
      ? dictionary.entries
          .map((entry, index) => ({ entry, index }))
          .filter(
            ({ entry }) =>
              (!missingOnly || !savedEntries.get(entry.id)?.labels[lang]?.trim()) &&
              (!filter ||
                [
                  ...entry.aliases,
                  ...Object.values(entry.labels),
                  ...(savedEntries.get(entry.id)?.aliases ?? []),
                  ...Object.values(savedEntries.get(entry.id)?.labels ?? {})
                ].some((text) => text?.toLocaleLowerCase().includes(filter.toLocaleLowerCase())))
          )
      : [];
  const addEntry = () => {
    const id = crypto.randomUUID();
    setFilter("");
    setMissingOnly(false);
    setExpanded(id);
    change({ entries: [...dictionary.entries, { id, aliases: [""], labels: {} }] });
  };
  const languageTabs = (isFilled?: (lang: Lang) => boolean) => (
    <LanguageTabs id={tabs} size="sm" value={lang} onChange={setLang} isFilled={isFilled} />
  );
  const copyright = group === "footer" ? footer.copyright[copyrightPage] : null;
  const setCopyright = (next: FooterCopyright) =>
    change({ ...footer, copyright: { ...footer.copyright, [copyrightPage]: next } });
  const thisYear = new Date().getFullYear();
  const moveLink = (index: number, direction: number) => {
    const links = [...footer.links];
    [links[index], links[index + direction]] = [links[index + direction]!, links[index]!];
    change({ ...footer, links });
  };
  const body = (
    <>
      <fieldset disabled={doc.busy} className="min-w-0 space-y-5">
        {group === "identity" ? (
          <SettingsGrid variant="equal">
            <SettingsSection
              title={tr("身份信息")}
              description={tr("当前语言未填写时，沿用站点现有语言回退。")}
            >
              {languageTabs((l) => Boolean(identity.name[l]?.trim()))}
              <LanguageTabPanel id={tabs} lang={lang}>
                {localized(
                  tr("显示姓名"),
                  identity.name,
                  (name) => change({ ...identity, name }),
                  false,
                  "",
                  "short"
                )}
              </LanguageTabPanel>
            </SettingsSection>
            <SettingsSection title={tr("首屏头像")}>
              <AvatarUpload />
            </SettingsSection>
          </SettingsGrid>
        ) : null}
        {group === "footer" && copyright ? (
          <>
            <SettingsSection
              title={tr("版权声明")}
              description={tr("四个页面各用各的；隐私说明等其他页面沿用主页的设置。")}
            >
              <div className="space-y-4">
                <Field label={tr("页面")} htmlFor="settings-copyright-page" width="short">
                  <Select
                    id="settings-copyright-page"
                    value={copyrightPage}
                    onChange={setCopyrightPage}
                    options={FOOTER_PAGES.map((page) => ({
                      value: page,
                      label: copyrightPageLabels[page]
                    }))}
                  />
                </Field>
                {languageTabs()}
                <LanguageTabPanel id={tabs} lang={lang} className="space-y-4">
                  {localized(
                    tr("版权署名"),
                    copyright.owner,
                    (owner) => setCopyright({ ...copyright, owner }),
                    false,
                    "",
                    "short"
                  )}
                </LanguageTabPanel>
                <Field
                  label={tr("起始年份")}
                  htmlFor="settings-year"
                  width="meta"
                  hint={tr("留空只显示当年；填写后自动延续至当年。")}
                >
                  <input
                    className="field"
                    id="settings-year"
                    type="number"
                    min={1900}
                    max={thisYear}
                    value={copyright.startYear ?? ""}
                    onChange={(event) =>
                      setCopyright({
                        ...copyright,
                        startYear: event.target.value ? Number(event.target.value) : null
                      })
                    }
                  />
                </Field>
                <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-4">
                  <span className="text-sm text-brand-dark">{tr("显示身份说明")}</span>
                  <Switch
                    id="settings-show-role"
                    label={<span className="sr-only">{tr("显示身份说明")}</span>}
                    checked={copyright.showRole}
                    onChange={(showRole) => setCopyright({ ...copyright, showRole })}
                  />
                </div>
                <SettingsPreview title={tr("版权声明预览")}>
                  <ul className="space-y-1 text-sm text-muted">
                    {FOOTER_PAGES.map((page) => {
                      const item = footer.copyright[page];
                      return (
                        <li key={page} className="flex gap-3">
                          <span className="w-10 shrink-0 text-faint">
                            {copyrightPageLabels[page]}
                          </span>
                          <span className="min-w-0 break-words">
                            ©{" "}
                            {item.startYear && item.startYear < thisYear
                              ? `${item.startYear}–`
                              : ""}
                            {thisYear}{" "}
                            {item.owner[lang] ||
                              item.owner.en ||
                              item.owner.zh ||
                              tr("沿用站点署名")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </SettingsPreview>
              </div>
            </SettingsSection>
            <SettingsSection title={tr("页脚链接")} description={tr("四个页面共用。")}>
              <div className="space-y-2">
                {(footer.links ?? []).map((link, index) => {
                  const setLink = (next: typeof link) =>
                    change({
                      ...footer,
                      links: footer.links.map((item, i) => (i === index ? next : item))
                    });
                  return (
                    <div key={index} className="settings-link-row">
                      <input
                        className="field"
                        aria-label={tr("链接 {0} 的文字", index + 1)}
                        placeholder={tr("文字")}
                        maxLength={40}
                        value={link.label[lang] ?? ""}
                        onChange={(event) =>
                          setLink({
                            ...link,
                            label: { ...link.label, [lang]: event.target.value }
                          })
                        }
                      />
                      <input
                        className="field"
                        aria-label={tr("链接 {0} 的地址", index + 1)}
                        placeholder={tr("https://… 或 /privacy")}
                        maxLength={300}
                        value={link.url}
                        onChange={(event) => setLink({ ...link, url: event.target.value })}
                      />
                      <div className="flex items-center justify-end">
                        <IconButton
                          label={tr("上移链接 {0}", index + 1)}
                          disabled={index === 0}
                          onClick={() => moveLink(index, -1)}
                        >
                          <ArrowUp aria-hidden="true" className="size-4" />
                        </IconButton>
                        <IconButton
                          label={tr("下移链接 {0}", index + 1)}
                          disabled={index === footer.links.length - 1}
                          onClick={() => moveLink(index, 1)}
                        >
                          <ArrowDown aria-hidden="true" className="size-4" />
                        </IconButton>
                        <IconButton
                          danger
                          label={tr("移除链接 {0}", index + 1)}
                          onClick={() =>
                            change({
                              ...footer,
                              links: footer.links.filter((_, i) => i !== index)
                            })
                          }
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={(footer.links ?? []).length >= 8}
                  onClick={() =>
                    change({
                      ...footer,
                      links: [...(footer.links ?? []), { label: {}, url: "" }]
                    })
                  }
                >
                  {tr("添加链接")}
                </button>
              </div>
            </SettingsSection>
          </>
        ) : null}
        {group === "images" ? (
          <SettingsSection
            title={tr("保留与上限")}
            description={tr("修改后对之后的操作生效，已有的版本不会被删除。")}
          >
            <SettingsGrid variant="equal">
              <Field
                label={tr("回收站保留天数")}
                htmlFor="settings-trash-days"
                hint={tr("删除的图片在回收站里保留这么多天，之后彻底删除。1 到 365 天。")}
              >
                <input
                  className="field"
                  id="settings-trash-days"
                  type="number"
                  min={1}
                  max={365}
                  value={images.trashRetentionDays}
                  onChange={(event) =>
                    change({ ...images, trashRetentionDays: whole(event.target.value, 1, 365) })
                  }
                />
              </Field>
              <Field
                label={tr("每张照片的版本上限")}
                htmlFor="settings-max-versions"
                hint={tr("一张照片最多保留这么多个版本，达到后需要先删除一个。1 到 50 个。")}
              >
                <input
                  className="field"
                  id="settings-max-versions"
                  type="number"
                  min={1}
                  max={50}
                  value={images.maxPhotoVersions}
                  onChange={(event) =>
                    change({ ...images, maxPhotoVersions: whole(event.target.value, 1, 50) })
                  }
                />
              </Field>
            </SettingsGrid>
          </SettingsSection>
        ) : null}
        {group === "preferences" ? (
          <SettingsSection
            title={tr("首次访问默认值")}
            description={tr("访客自己保存的主题和语言优先。")}
          >
            <SettingsGrid variant="equal">
              <Field label={tr("默认主题")} htmlFor="settings-theme">
                <Select
                  id="settings-theme"
                  value={preferences.theme}
                  onChange={(theme) => change({ ...preferences, theme })}
                  options={[
                    { value: "system" as const, label: tr("跟随系统") },
                    { value: "light" as const, label: tr("浅色") },
                    { value: "dark" as const, label: tr("深色") }
                  ]}
                />
              </Field>
              <Field label={tr("默认语言")} htmlFor="settings-language">
                <Select
                  id="settings-language"
                  value={preferences.language}
                  onChange={(language) => change({ ...preferences, language })}
                  options={[
                    { value: "auto" as const, label: tr("自动识别浏览器") },
                    ...LANGS.map((language) => ({ value: language, label: LANG_LABELS[language] }))
                  ]}
                />
              </Field>
            </SettingsGrid>
          </SettingsSection>
        ) : null}
        {group === "navigation" ? (
          <>
            <SettingsSection title={tr("底部导航")}>
              <SettingsGrid variant="equal">
                <Field
                  label={tr("显示模式")}
                  htmlFor="settings-tab-mode"
                  hint={tr("触屏设备没有悬停，悬停模式下保持收起。")}
                >
                  <Select
                    id="settings-tab-mode"
                    value={navigation.tabBarMode}
                    onChange={(tabBarMode) => change({ ...navigation, tabBarMode })}
                    options={[
                      { value: "always" as const, label: tr("始终展开") },
                      { value: "adaptive" as const, label: tr("滚动时收起") },
                      { value: "hover" as const, label: tr("鼠标悬停时展开") }
                    ]}
                  />
                </Field>
                <Field label={tr("玻璃材质")} htmlFor="settings-glass">
                  <Select
                    id="settings-glass"
                    value={navigation.glass}
                    onChange={(glass) => change({ ...navigation, glass })}
                    options={[
                      { value: "regular" as const, label: tr("常规") },
                      { value: "clear" as const, label: tr("透明") },
                      { value: "opaque" as const, label: tr("磨砂") }
                    ]}
                  />
                </Field>
                <Field
                  label={tr("底部距离：{0}px", navigation.bottomOffset)}
                  hint={tr("手机上按一半距离显示。")}
                >
                  <Slider
                    label={tr("底部距离")}
                    min={16}
                    max={40}
                    step={2}
                    value={navigation.bottomOffset}
                    onChange={(bottomOffset) => change({ ...navigation, bottomOffset })}
                  />
                </Field>
                <div className="flex items-center pt-6">
                  <Switch
                    id="settings-show-labels"
                    label={tr("显示文字")}
                    checked={navigation.showLabels}
                    onChange={(showLabels) => change({ ...navigation, showLabels })}
                  />
                </div>
              </SettingsGrid>
            </SettingsSection>
            <SettingsSection title={tr("玻璃效果")}>
              <SettingsGrid variant="equal">
                <Field label={tr("选中按钮样式")} htmlFor="settings-selected-button">
                  <Select
                    id="settings-selected-button"
                    value={navigation.selectedButton}
                    onChange={(selectedButton) => change({ ...navigation, selectedButton })}
                    options={[
                      { value: "lens" as const, label: tr("透镜") },
                      { value: "ring" as const, label: tr("描边") },
                      { value: "text" as const, label: tr("文字") }
                    ]}
                  />
                </Field>
                <Field
                  label={tr("边缘折射：{0}×", navigation.refraction.toFixed(1))}
                  hint={tr("1.0 是默认强度。Safari 和 Firefox 只显示毛玻璃，看不到边缘折射。")}
                >
                  <Slider
                    label={tr("边缘折射")}
                    min={0}
                    max={3}
                    step={0.1}
                    value={navigation.refraction}
                    onChange={(refraction) => change({ ...navigation, refraction })}
                  />
                </Field>
              </SettingsGrid>
            </SettingsSection>
          </>
        ) : null}
        {group === "privacy" ? (
          <>
            <SettingsSection
              title={tr("公开说明")}
              description={tr("支持 Markdown；不渲染原始 HTML。")}
            >
              {languageTabs((l) => Boolean(privacy.body[l]?.trim()))}
              <LanguageTabPanel id={tabs} lang={lang} className="space-y-4">
                {localized(
                  tr("隐私标题"),
                  privacy.title,
                  (title) => change({ ...privacy, title }),
                  false,
                  "",
                  "long"
                )}
                {localized(
                  tr("隐私正文"),
                  privacy.body,
                  (body) => change({ ...privacy, body }),
                  true
                )}
              </LanguageTabPanel>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Field
                  label={tr("生效日期")}
                  htmlFor="privacy-date"
                  width="meta"
                  className="w-full"
                >
                  <input
                    className="field"
                    id="privacy-date"
                    type="date"
                    value={privacy.effectiveDate ?? ""}
                    onChange={(event) =>
                      change({ ...privacy, effectiveDate: event.target.value || null })
                    }
                  />
                </Field>
                <p className="field-width-short text-xs leading-relaxed text-muted">
                  {tr("正文留空时沿用现有隐私说明。公开页面继续显示实际统计采集状态。")}
                </p>
              </div>
            </SettingsSection>
            <SettingsSection
              title={tr("历史版本")}
              description={tr("保留最近10个旧版本；载入后需检查并保存。")}
            >
              {history.isPending ? (
                <LoadingSkeleton label={tr("读取历史版本…")} variant="rows" count={1} />
              ) : history.error ? (
                <SettingsState
                  error={history.error.message}
                  onRetry={() => void history.refetch()}
                />
              ) : history.data?.history.length ? (
                <ul className="divide-y divide-line-soft">
                  {history.data.history.map((old, index) => (
                    <li
                      key={old.savedAt + index}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <time className="text-xs text-muted" dateTime={old.savedAt}>
                        {settingsDate(old.savedAt)}
                      </time>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => change(old.value)}
                      >
                        {tr("载入为草稿")}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <SettingsState empty={tr("暂无历史版本")} />
              )}
            </SettingsSection>
          </>
        ) : null}
        {group === "dictionary" ? (
          <>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <Field
                label={tr("查找词条")}
                htmlFor="dictionary-filter"
                width="short"
                className="min-w-48 flex-1"
              >
                <input
                  id="dictionary-filter"
                  className="field"
                  placeholder={tr("原标签、别名或翻译")}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
              </Field>
              <div className="pb-2">
                <Switch
                  id="dictionary-missing"
                  label={tr("只看当前语言缺译")}
                  checked={missingOnly}
                  onChange={setMissingOnly}
                />
              </div>
              <p className="pb-2.5 text-xs text-muted">
                {tr("{0} / {1} 条", filtered.length, dictionary.entries.length)}
              </p>
              <button
                type="button"
                className="btn-primary ml-auto"
                disabled={dictionary.entries.length >= 500}
                onClick={addEntry}
              >
                <Plus aria-hidden="true" className="size-4" />
                {tr("添加词条")}
              </button>
            </div>
            {languageTabs()}
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">{tr("翻译与引用规则")}</summary>
              <p className="mt-2 leading-relaxed">
                {tr(
                  "已有内容翻译优先，词典补齐当前语言与英文，最后回退内置词典及原标签。别名匹配不改写原内容；稳定ID不可编辑。在用词条及别名不能直接删除，服务端会再次核验。"
                )}
              </p>
            </details>
            {usage.error ? (
              <SettingsState
                error={tr("引用情况暂时无法核验，移除功能暂停；仍可编辑翻译。")}
                onRetry={() => void usage.refetch()}
              />
            ) : null}
            {filtered.length ? (
              <div className="settings-list">
                {filtered.map(({ entry, index }) => {
                  const count = usedCount([
                      ...entry.aliases,
                      ...(savedEntries.get(entry.id)?.aliases ?? [])
                    ]),
                    open = expanded === entry.id;
                  return (
                    <div key={entry.id}>
                      <button
                        type="button"
                        className="surface-row flex w-full items-center gap-3 text-left"
                        aria-expanded={open}
                        aria-controls={`dictionary-row-${entry.id}`}
                        onClick={() => setExpanded(open ? null : entry.id)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-brand-dark">
                            {entry.aliases[0] || tr("新词条")}
                          </span>
                          <span className="block truncate text-[11.5px] text-muted">
                            {entry.labels[lang] || tr("当前语言缺译")}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {usage.isPending
                            ? tr("核验中")
                            : usage.error
                              ? tr("未核验")
                              : tr("{0} 项引用", count)}
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`size-4 shrink-0 text-muted ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      {open ? (
                        <div
                          id={`dictionary-row-${entry.id}`}
                          className="space-y-4 border-t border-line-soft bg-canvas/40 p-4"
                        >
                          <SettingsGrid variant="equal">
                            <Field
                              label={tr("匹配别名（每行一个）")}
                              htmlFor={`dictionary-alias-${entry.id}`}
                            >
                              <textarea
                                className="field"
                                id={`dictionary-alias-${entry.id}`}
                                rows={3}
                                value={entry.aliases.join("\n")}
                                onChange={(event) =>
                                  change({
                                    entries: dictionary.entries.map((item, i) =>
                                      i === index
                                        ? { ...item, aliases: event.target.value.split("\n") }
                                        : item
                                    )
                                  })
                                }
                              />
                            </Field>
                            {localized(
                              tr("标签翻译"),
                              entry.labels,
                              (labels) =>
                                change({
                                  entries: dictionary.entries.map((item, i) =>
                                    i === index ? { ...item, labels } : item
                                  )
                                }),
                              false,
                              entry.id
                            )}
                          </SettingsGrid>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-muted">
                              {count
                                ? tr("此词条正在使用；可补充别名与翻译，请保留原匹配别名。")
                                : tr("无引用词条可以移除。")}
                            </p>
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={usage.isPending || Boolean(usage.error) || count > 0}
                              onClick={() =>
                                change({
                                  entries: dictionary.entries.filter((_, i) => i !== index)
                                })
                              }
                            >
                              {tr("移除词条")}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <SettingsState
                empty={
                  dictionary.entries.length
                    ? tr("没有匹配的词条，试试调整搜索或缺译筛选。")
                    : tr("词典还没有词条。添加原标签与别名，为收藏补齐翻译。")
                }
              >
                {dictionary.entries.length ? (
                  <button
                    className="btn-secondary mt-3"
                    type="button"
                    onClick={() => {
                      setFilter("");
                      setMissingOnly(false);
                    }}
                  >
                    {tr("清除筛选")}
                  </button>
                ) : (
                  <button className="btn-primary mt-3" type="button" onClick={addEntry}>
                    {tr("添加第一个词条")}
                  </button>
                )}
              </SettingsState>
            )}
          </>
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
        scope={group === "identity" ? tr("保存姓名；头像上传后已生效，不受影响。") : undefined}
        onSave={doc.save}
        onDiscard={doc.discard}
      />
    </>
  );
  return (
    <SettingsPage title={titles[group]} description={descriptions[group]}>
      {body}
    </SettingsPage>
  );
}
