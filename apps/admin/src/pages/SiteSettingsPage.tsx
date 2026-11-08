import { useId, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import type {
  LocalizedText,
  SiteSettingsGroup,
  SiteSettingsGroups,
  SiteSettingsDocument
} from "@liam-frost/shared";
import { Field, Switch } from "../components/ui/Field";
import { IconButton } from "../components/ui/IconButton";
import { LanguageTabPanel, LanguageTabs } from "../components/ui/LanguageTabs";
import { Select } from "../components/ui/Select";
import { api, request } from "../lib/api";
import { mediaKey } from "../hooks/useMedia";
import { LANGS, LANG_LABELS, type Lang } from "../lib/i18n";
import { refreshSiteSettings } from "../../../web/src/data/useSiteSettings";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import { settingsDate } from "../components/settings/copy";
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
  privacy: tr("隐私说明"),
  dictionary: tr("标签词典")
};
const descriptions: Record<SiteSettingsGroup, string> = {
  identity: tr("设置公开姓名和首屏头像。"),
  footer: tr("设置版权署名及年份范围。"),
  preferences: tr("决定访客首次访问时的显示偏好。"),
  privacy: tr("编辑公开隐私说明，历史版本可载入为草稿。"),
  dictionary: tr("为收藏标签补齐多语言翻译，保留原有内容标识。")
};
const fieldLabels: Record<string, string> = {
  name: tr("显示姓名"),
  title: tr("标题"),
  adminTitle: tr("后台页面标题"),
  owner: tr("版权署名"),
  startYear: tr("起始年份"),
  showRole: tr("显示身份说明"),
  links: tr("页脚链接"),
  theme: tr("默认主题"),
  language: tr("默认语言"),
  body: tr("隐私正文"),
  effectiveDate: tr("生效日期"),
  entries: tr("词条")
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
    [expanded, setExpanded] = useState<string | null>(null);
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
    privacy = value as SiteSettingsGroups["privacy"],
    dictionary = value as SiteSettingsGroups["dictionary"];
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
        {group === "footer" ? (
          <>
            <SettingsSection title={tr("版权信息")}>
              <div className="space-y-4">
                {languageTabs()}
                <LanguageTabPanel id={tabs} lang={lang} className="space-y-4">
                  {localized(
                    tr("版权署名"),
                    footer.owner,
                    (owner) => change({ ...footer, owner }),
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
                    max={new Date().getFullYear()}
                    value={footer.startYear ?? ""}
                    onChange={(event) =>
                      change({
                        ...footer,
                        startYear: event.target.value ? Number(event.target.value) : null
                      })
                    }
                  />
                </Field>
                <div className="space-y-2 border-t border-line-soft pt-4">
                  <p className="text-sm text-brand-dark">{tr("页脚链接")}</p>
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
                <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-4">
                  <span className="text-sm text-brand-dark">{tr("显示身份说明")}</span>
                  <Switch
                    id="settings-show-role"
                    label={<span className="sr-only">{tr("显示身份说明")}</span>}
                    checked={footer.showRole}
                    onChange={(showRole) => change({ ...footer, showRole })}
                  />
                </div>
                <SettingsPreview title={tr("版权署名预览")}>
                  <p className="break-words text-sm text-muted">
                    ©{" "}
                    {footer.startYear && footer.startYear !== new Date().getFullYear()
                      ? `${footer.startYear}–`
                      : ""}
                    {new Date().getFullYear()}{" "}
                    {footer.owner[lang] || footer.owner.en || footer.owner.zh || tr("沿用站点署名")}
                  </p>
                </SettingsPreview>
              </div>
            </SettingsSection>
          </>
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
