import { useState, useMemo } from "react";
import { useIsMutating, useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ChevronDown, Plus, ShieldCheck } from "lucide-react";
import type {
  LocalizedText,
  SiteSettingsGroup,
  SiteSettingsGroups,
  SiteSettingsDocument
} from "@liam-frost/shared";
import { Field, Switch } from "../components/ui/Field";
import { useToast } from "../components/ui/Toast";
import { ApiError, api, request } from "../lib/api";
import { mediaKey } from "../hooks/useMedia";
import { usePhotos } from "../hooks/usePhotos";
import { LANGS, LANG_LABELS, type Lang } from "../lib/i18n";
import { refreshSiteSettings } from "../../../web/src/data/useSiteSettings";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import { clearSettingsDraftIfUnchanged, useSettingsDraft } from "../components/settings/drafts";
import { settingsDate } from "../components/settings/copy";
import {
  SettingsActions,
  SettingsAssetPicker,
  SettingsConflict,
  SettingsLanguages,
  SettingsPage,
  SettingsPreview,
  SettingsSection,
  SettingsState
} from "../components/settings/SettingsUI";

const titles: Record<SiteSettingsGroup, string> = {
  identity: "基本资料",
  footer: "页脚与版权",
  preferences: "默认显示与语言",
  privacy: "隐私说明",
  dictionary: "标签词典"
};
const descriptions: Record<SiteSettingsGroup, string> = {
  identity: "设置公开姓名、前台和后台的页面标题，以及首屏头像。",
  footer: "设置版权署名及年份范围。",
  preferences: "决定访客首次访问时的显示偏好。",
  privacy: "编辑公开隐私说明，历史版本可载入为草稿。",
  dictionary: "为收藏标签补齐多语言翻译，保留原有内容标识。"
};
export function SiteSettingsPage({
  group,
  embedded = false
}: {
  group: SiteSettingsGroup;
  embedded?: boolean;
}) {
  const key = ["admin", "site-settings", group],
    qc = useQueryClient(),
    toast = useToast();
  const q = useQuery({
      queryKey: key,
      queryFn: () => request<SiteSettingsDocument>(`/api/admin/site-settings/${group}`)
    }),
    photoQuery = usePhotos();
  const [draft, setDraft] = useSettingsDraft<SiteSettingsDocument>(`site:${group}`),
    [conflict, setConflict] = useState<SiteSettingsDocument | null>(null),
    [lang, setLang] = useState<Lang>("zh"),
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
  const value = draft?.value ?? q.data?.value;
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
  const busy = useIsMutating({ mutationKey: key }) > 0;
  const save = useMutation({
    mutationKey: key,
    mutationFn: (body: SiteSettingsDocument) =>
      request<SiteSettingsDocument>(`/api/admin/site-settings/${group}`, {
        method: "PUT",
        json: {
          value:
            group === "dictionary"
              ? {
                  entries: (body.value as SiteSettingsGroups["dictionary"]).entries.map(
                    (entry) => ({
                      ...entry,
                      aliases: entry.aliases.map((alias) => alias.trim()).filter(Boolean)
                    })
                  )
                }
              : body.value,
          revision: body.revision
        }
      }),
    onSuccess: (data, submitted) => {
      qc.setQueryData(key, data);
      clearSettingsDraftIfUnchanged(`site:${group}`, submitted);
      setConflict(null);
      refreshSiteSettings();
      void qc.invalidateQueries({ queryKey: ["admin", "privacy-history"] });
    },
    onError: async (error: Error) => {
      toast(error.message, "error");
      if (error instanceof ApiError && error.code === "SETTINGS_OUT_OF_DATE") {
        try {
          setConflict(await request<SiteSettingsDocument>(`/api/admin/site-settings/${group}`));
        } catch {
          toast("最新版本读取失败；草稿仍保留，请稍后重试。", "error");
        }
      }
    }
  });
  const change = (next: SiteSettingsGroups[SiteSettingsGroup]) => {
    if (q.data && !busy)
      setDraft(
        JSON.stringify(next) === JSON.stringify(q.data.value)
          ? null
          : { value: next, revision: draft?.revision ?? q.data.revision, saved: q.data.saved }
      );
  };
  const localized = (
    label: string,
    data: LocalizedText,
    onChange: (value: LocalizedText) => void,
    multiline = false,
    suffix = ""
  ) => (
    <Field
      label={label}
      htmlFor={`settings-${group}-${label}-${suffix}`}
      className={multiline ? "" : "max-w-md"}
    >
      {multiline ? (
        <textarea
          id={`settings-${group}-${label}-${suffix}`}
          className="field min-h-64"
          maxLength={20000}
          value={data[lang] ?? ""}
          onChange={(event) => onChange({ ...data, [lang]: event.target.value })}
        />
      ) : (
        <input
          id={`settings-${group}-${label}-${suffix}`}
          className="field"
          maxLength={
            group === "identity" && label === "后台页面标题"
              ? 80
              : group === "identity" && label === "前台页面标题"
                ? 160
                : group === "privacy"
                  ? 160
                  : 120
          }
          value={data[lang] ?? ""}
          onChange={(event) => onChange({ ...data, [lang]: event.target.value })}
        />
      )}
    </Field>
  );
  if (q.isPending) return <LoadingSkeleton label="加载网站设置…" variant="form" />;
  if (q.error || !value)
    return (
      <SettingsState error={q.error?.message ?? "无法读取设置"} onRetry={() => void q.refetch()} />
    );
  const identity = value as SiteSettingsGroups["identity"],
    footer = value as SiteSettingsGroups["footer"],
    preferences = value as SiteSettingsGroups["preferences"],
    privacy = value as SiteSettingsGroups["privacy"],
    dictionary = value as SiteSettingsGroups["dictionary"];
  const available = (photoQuery.data ?? []).filter((photo) => photo.visibility === "public");
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
  const languageControl = ["identity", "footer", "privacy", "dictionary"].includes(group) ? (
    <SettingsLanguages value={lang} onChange={setLang} />
  ) : null;
  const body = (
    <>
      {group !== "dictionary" ? languageControl : null}
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        {group === "identity" ? (
          <>
            <SettingsSection
              title="身份信息"
              description="当前语言未填写时，沿用站点现有语言回退。"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {localized("显示姓名", identity.name, (name) => change({ ...identity, name }))}
              </div>
            </SettingsSection>
            <SettingsSection
              title="页面标题"
              description="显示在浏览器标签页上。后台标题也用作侧栏顶部的名称。留空使用默认标题。"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {localized("前台页面标题", identity.title, (title) =>
                  change({ ...identity, title })
                )}
                {localized("后台页面标题", identity.adminTitle ?? {}, (adminTitle) =>
                  change({ ...identity, adminTitle })
                )}
              </div>
            </SettingsSection>
            <SettingsSection title="首屏头像" description="选择公开图库照片；留空沿用现有头像。">
              <SettingsAssetPicker
                label="首屏头像"
                photos={available}
                selected={identity.avatarPhotoId}
                onChange={(avatarPhotoId) => change({ ...identity, avatarPhotoId })}
                defaultLabel="现有默认头像"
                loading={photoQuery.isPending}
                error={photoQuery.error?.message}
                onRetry={() => void photoQuery.refetch()}
              />
            </SettingsSection>
          </>
        ) : null}
        {group === "footer" ? (
          <>
            <SettingsSection title="版权信息">
              <div className="space-y-4">
                {localized("版权署名", footer.owner, (owner) => change({ ...footer, owner }))}
                <Field
                  label="起始年份"
                  htmlFor="settings-year"
                  className="max-w-40"
                  hint="留空只显示当年；填写后自动延续至当年。"
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
                  <p className="text-sm text-brand-dark">页脚链接</p>
                  {(footer.links ?? []).map((link, index) => {
                    const setLink = (next: typeof link) =>
                      change({
                        ...footer,
                        links: footer.links.map((item, i) => (i === index ? next : item))
                      });
                    return (
                      <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                        <input
                          className="field"
                          aria-label={`链接 ${index + 1} 的文字`}
                          placeholder="文字"
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
                          aria-label={`链接 ${index + 1} 的地址`}
                          placeholder="https://… 或 /privacy"
                          maxLength={300}
                          value={link.url}
                          onChange={(event) => setLink({ ...link, url: event.target.value })}
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            change({
                              ...footer,
                              links: footer.links.filter((_, i) => i !== index)
                            })
                          }
                        >
                          移除
                        </button>
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
                    添加链接
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-4">
                  <span className="text-sm text-brand-dark">显示身份说明</span>
                  <Switch
                    id="settings-show-role"
                    label={<span className="sr-only">显示身份说明</span>}
                    checked={footer.showRole}
                    onChange={(showRole) => change({ ...footer, showRole })}
                  />
                </div>
              </div>
            </SettingsSection>
            <SettingsPreview title="版权署名预览">
              <p className="break-words text-sm text-muted">
                ©{" "}
                {footer.startYear && footer.startYear !== new Date().getFullYear()
                  ? `${footer.startYear}–`
                  : ""}
                {new Date().getFullYear()}{" "}
                {footer.owner[lang] || footer.owner.en || footer.owner.zh || "沿用站点署名"}
              </p>
            </SettingsPreview>
          </>
        ) : null}
        {group === "preferences" ? (
          <>
            <SettingsSection title="首次访问默认值" description="访客自己保存的主题和语言优先。">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="默认主题" htmlFor="settings-theme">
                  <select
                    className="field"
                    id="settings-theme"
                    value={preferences.theme}
                    onChange={(event) =>
                      change({
                        ...preferences,
                        theme: event.target.value as typeof preferences.theme
                      })
                    }
                  >
                    <option value="system">跟随系统</option>
                    <option value="light">浅色</option>
                    <option value="dark">深色</option>
                  </select>
                </Field>
                <Field label="默认语言" htmlFor="settings-language">
                  <select
                    className="field"
                    id="settings-language"
                    value={preferences.language}
                    onChange={(event) =>
                      change({
                        ...preferences,
                        language: event.target.value as typeof preferences.language
                      })
                    }
                  >
                    <option value="auto">自动识别浏览器</option>
                    {LANGS.map((language) => (
                      <option key={language} value={language}>
                        {LANG_LABELS[language]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </SettingsSection>
            <SettingsSection
              title="后台语言与格式"
              description="当前后台支持简体中文；与前台默认语言独立。"
            >
              <dl className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
                <div>
                  <dt className="text-muted">语言</dt>
                  <dd className="mt-1 text-brand-dark">简体中文</dd>
                </div>
                <div>
                  <dt className="text-muted">日期示例</dt>
                  <dd className="mt-1 text-brand-dark">{settingsDate(new Date().toISOString())}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted">
                完整后台国际化将在后续阶段实施，届时开放语言选择。
              </p>
            </SettingsSection>
          </>
        ) : null}
        {group === "privacy" ? (
          <>
            <SettingsSection title="公开说明" description="支持 Markdown；不渲染原始 HTML。">
              {localized("隐私标题", privacy.title, (title) => change({ ...privacy, title }))}
              {localized("隐私正文", privacy.body, (body) => change({ ...privacy, body }), true)}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Field label="生效日期" htmlFor="privacy-date" className="max-w-56">
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
                <p className="max-w-sm text-xs leading-relaxed text-muted">
                  正文留空时沿用现有隐私说明。公开页面继续显示实际统计采集状态。
                </p>
              </div>
            </SettingsSection>
            <SettingsSection
              title="历史版本"
              description="保留最近10个旧版本；载入后需检查并保存。"
            >
              {history.isPending ? (
                <LoadingSkeleton label="读取历史版本…" variant="rows" count={1} />
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
                        载入为草稿
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <SettingsState empty="暂无历史版本" />
              )}
            </SettingsSection>
          </>
        ) : null}
        {group === "dictionary" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {languageControl}
              <button
                type="button"
                className="btn-primary"
                disabled={dictionary.entries.length >= 500}
                onClick={addEntry}
              >
                <Plus aria-hidden="true" className="size-4" />
                添加词条
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <Field
                label="查找词条"
                htmlFor="dictionary-filter"
                className="min-w-0 flex-1 sm:max-w-sm"
              >
                <input
                  id="dictionary-filter"
                  className="field"
                  placeholder="原标签、别名或翻译"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
              </Field>
              <div className="pb-2">
                <Switch
                  id="dictionary-missing"
                  label="只看当前语言缺译"
                  checked={missingOnly}
                  onChange={setMissingOnly}
                />
              </div>
              <p className="pb-2 text-xs text-muted">
                {filtered.length} / {dictionary.entries.length} 条
              </p>
            </div>
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">翻译与引用规则</summary>
              <p className="mt-2 leading-relaxed">
                已有内容翻译优先，词典补齐当前语言与英文，最后回退内置词典及原标签。别名匹配不改写原内容；稳定ID不可编辑。在用词条及别名不能直接删除，服务端会再次核验。
              </p>
            </details>
            {usage.error ? (
              <SettingsState
                error="引用情况暂时无法核验，移除功能暂停；仍可编辑翻译。"
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
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas"
                        aria-expanded={open}
                        aria-controls={`dictionary-row-${entry.id}`}
                        onClick={() => setExpanded(open ? null : entry.id)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-brand-dark">
                            {entry.aliases[0] || "新词条"}
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted">
                            {entry.labels[lang] || "当前语言缺译"}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {usage.isPending ? "核验中" : usage.error ? "未核验" : `${count} 项引用`}
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
                          <div className="grid items-start gap-4 sm:grid-cols-2">
                            <Field
                              label="匹配别名（每行一个）"
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
                              "标签翻译",
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
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-muted">
                              {count
                                ? "此词条正在使用；可补充别名与翻译，请保留原匹配别名。"
                                : "无引用词条可以移除。"}
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
                              移除词条
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
                    ? "没有匹配的词条，试试调整搜索或缺译筛选。"
                    : "词典还没有词条。添加原标签与别名，为收藏补齐翻译。"
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
                    清除筛选
                  </button>
                ) : (
                  <button className="btn-primary mt-3" type="button" onClick={addEntry}>
                    添加第一个词条
                  </button>
                )}
              </SettingsState>
            )}
          </>
        ) : null}
      </fieldset>
      {conflict && draft ? (
        <SettingsConflict
          current={conflict.value}
          draft={draft.value}
          onUseCurrent={() => {
            qc.setQueryData(key, conflict);
            setDraft(null);
            setConflict(null);
            save.reset();
          }}
          onKeepDraft={() => {
            qc.setQueryData(key, conflict);
            setDraft({ ...draft, revision: conflict.revision });
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
        inline={embedded}
        label={embedded ? "保存网站图标" : undefined}
        onSave={() => draft && save.mutate(draft)}
        onDiscard={() => {
          setDraft(null);
          setConflict(null);
          save.reset();
        }}
      />
    </>
  );
  return embedded ? (
    <div className="space-y-4 border-t border-line pt-5">{body}</div>
  ) : (
    <SettingsPage title={titles[group]} description={descriptions[group]}>
      {body}
    </SettingsPage>
  );
}
export function RuntimeSettingsPage() {
  const q = useQuery({
    queryKey: ["admin", "settings", "security-status"],
    queryFn: () =>
      request<{
        username: string;
        security: { csrf: boolean; signedSessions: boolean; loginRateLimit: boolean };
      }>("/api/admin/site-settings/security/status")
  });
  return (
    <SettingsPage title="账号与安全" description="查看当前账号及实际生效的登录保护。">
      <SettingsSection title="当前状态">
        {q.isPending ? (
          <LoadingSkeleton label="读取安全状态…" variant="rows" count={1} />
        ) : q.error ? (
          <SettingsState error={q.error.message} onRetry={() => void q.refetch()} />
        ) : q.data ? (
          <>
            <dl className="flex items-center justify-between gap-3 border-b border-line-soft pb-3 text-sm">
              <dt className="text-muted">登录账号</dt>
              <dd className="break-all font-medium text-brand-dark">{q.data.username}</dd>
            </dl>
            <ul className="space-y-3">
              {[
                ["登录尝试限制", q.data.security.loginRateLimit],
                ["CSRF 校验", q.data.security.csrf],
                ["签名会话", q.data.security.signedSessions]
              ].map(([label, enabled]) => (
                <li key={String(label)} className="flex items-center gap-2 text-sm">
                  <ShieldCheck aria-hidden="true" className="size-4 text-brand" />
                  <span className="flex-1">{String(label)}</span>
                  <span className="text-xs text-muted">{enabled ? "已启用" : "未启用"}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-muted">
              账号、密码和后台路径由受保护的运行配置管理。此页当前为只读状态。
            </p>
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">后续安全功能</summary>
              <p className="mt-2 leading-relaxed">
                在线改密、会话撤销、TOTP及恢复码属于账号安全阶段；后台地址切换最后单独实施。当前没有修改凭据或地址的控件。
              </p>
            </details>
          </>
        ) : null}
      </SettingsSection>
    </SettingsPage>
  );
}
