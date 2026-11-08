import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type {
  LocalizedText,
  SiteSettingsGroup,
  SiteSettingsGroups,
  SiteSettingsDocument
} from "@liam-frost/shared";
import { PageHeader } from "../components/layout/AdminLayout";
import { Field, Switch } from "../components/ui/Field";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { ApiError, api, request } from "../lib/api";
import { mediaKey } from "../hooks/useMedia";
import { usePhotos } from "../hooks/usePhotos";
import { LANGS, LANG_LABELS, pickText, type Lang } from "../lib/i18n";
import { refreshSiteSettings } from "../../../web/src/data/useSiteSettings";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";

const titles: Record<SiteSettingsGroup, string> = {
  identity: "基本资料",
  footer: "页脚版权",
  preferences: "默认显示",
  privacy: "隐私说明",
  dictionary: "标签词典",
  favicon: "网站图标"
};
export function SiteSettingsPage({ group }: { group: SiteSettingsGroup }) {
  const key = ["admin", "site-settings", group],
    qc = useQueryClient(),
    toast = useToast();
  const q = useQuery({
    queryKey: key,
    queryFn: () => request<SiteSettingsDocument>(`/api/admin/site-settings/${group}`)
  });
  const { data: photos = [] } = usePhotos();
  const [draft, setDraft] = useState<SiteSettingsDocument | null>(null),
    [conflict, setConflict] = useState<SiteSettingsDocument | null>(null),
    [lang, setLang] = useState<Lang>("zh"),
    [filter, setFilter] = useState(""),
    [missingOnly, setMissingOnly] = useState(false);
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
          const key = value.normalize("NFKC").trim().toLowerCase();
          const ids = index.get(key) ?? new Set<string>();
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
  const save = useMutation({
    mutationFn: (body: SiteSettingsDocument) =>
      request<SiteSettingsDocument>(`/api/admin/site-settings/${group}`, {
        method: "PUT",
        json: {
          value:
            group === "dictionary"
              ? {
                  entries: (body.value as SiteSettingsGroups["dictionary"]).entries.map((e) => ({
                    ...e,
                    aliases: e.aliases.map((a) => a.trim()).filter(Boolean)
                  }))
                }
              : body.value,
          revision: body.revision
        }
      }),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      setDraft(null);
      setConflict(null);
      refreshSiteSettings();
      void qc.invalidateQueries({ queryKey: ["admin", "privacy-history"] });
      toast("设置已保存");
    },
    onError: async (e: Error) => {
      toast(e.message, "error");
      if (e instanceof ApiError && e.code === "SETTINGS_OUT_OF_DATE") {
        try {
          setConflict(await request<SiteSettingsDocument>(`/api/admin/site-settings/${group}`));
        } catch {
          toast("最新版本读取失败；草稿仍保留，请稍后重新保存以再次检查", "error");
        }
      }
    }
  });
  useUnsavedChanges(Boolean(draft));
  const change = (next: SiteSettingsGroups[SiteSettingsGroup]) => {
    if (q.data && !save.isPending)
      setDraft({ value: next, revision: draft?.revision ?? q.data.revision, saved: q.data.saved });
  };
  const localized = (
    label: string,
    data: LocalizedText,
    onChange: (next: LocalizedText) => void,
    multiline = false,
    suffix = ""
  ) => (
    <Field
      label={label}
      htmlFor={`settings-${group}-${label}-${suffix}`}
      hint="未填写时沿用原站点内容；已填写内容按访客语言回退。"
    >
      {multiline ? (
        <textarea
          id={`settings-${group}-${label}-${suffix}`}
          className="field min-h-64"
          maxLength={20000}
          value={data[lang] ?? ""}
          onChange={(e) => onChange({ ...data, [lang]: e.target.value })}
        />
      ) : (
        <input
          id={`settings-${group}-${label}-${suffix}`}
          className="field"
          maxLength={group === "privacy" ? 160 : 120}
          value={data[lang] ?? ""}
          onChange={(e) => onChange({ ...data, [lang]: e.target.value })}
        />
      )}
    </Field>
  );
  if (q.isPending) return <LoadingSkeleton label="加载网站设置…" variant="form" />;
  if (q.error || !value)
    return (
      <div role="alert">
        <p>{q.error?.message ?? "无法读取设置"}</p>
        <button className="btn-secondary" onClick={() => void q.refetch()}>
          重新读取
        </button>
      </div>
    );
  const identity = value as SiteSettingsGroups["identity"],
    footer = value as SiteSettingsGroups["footer"],
    preferences = value as SiteSettingsGroups["preferences"],
    privacy = value as SiteSettingsGroups["privacy"],
    dictionary = value as SiteSettingsGroups["dictionary"],
    favicon = value as SiteSettingsGroups["favicon"];
  const available = photos.filter(
    (p) => p.visibility === "public" && (group !== "favicon" || p.storage === "local")
  );
  return (
    <>
      <PageHeader
        title={titles[group]}
        description="按页面独立保存，保留未修改的内容。并发冲突不会覆盖草稿。"
      />
      {["identity", "footer", "privacy", "dictionary"].includes(group) ? (
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="编辑语言">
          {LANGS.map((l) => (
            <button
              type="button"
              className={lang === l ? "btn-primary" : "btn-secondary"}
              aria-pressed={lang === l}
              key={l}
              onClick={() => setLang(l)}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      ) : null}
      <fieldset disabled={save.isPending} className="min-w-0 space-y-5">
        {group === "identity" ? (
          <Panel title="姓名与首屏">
            {localized("显示姓名", identity.name, (name) => change({ ...identity, name }))}
            {localized("站点标题", identity.title, (title) => change({ ...identity, title }))}
            <Field
              label="首屏头像"
              htmlFor="settings-avatar"
              hint="可选择公开图库照片；留空沿用现有头像。隐藏或删除照片后回退。"
            >
              <select
                id="settings-avatar"
                className="field"
                value={identity.avatarPhotoId ?? ""}
                onChange={(e) => change({ ...identity, avatarPhotoId: e.target.value || null })}
              >
                <option value="">现有默认头像</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {pickText(p.title, p.id)}
                  </option>
                ))}
              </select>
            </Field>
            {identity.avatarPhotoId && available.find((p) => p.id === identity.avatarPhotoId) ? (
              <img
                className="size-32 rounded-2xl object-cover"
                alt="头像预览"
                src={available.find((p) => p.id === identity.avatarPhotoId)!.src}
              />
            ) : null}
          </Panel>
        ) : null}
        {group === "footer" ? (
          <Panel title="版权信息">
            {localized("版权署名", footer.owner, (owner) => change({ ...footer, owner }))}
            <Field
              label="起始年份"
              htmlFor="settings-year"
              hint="留空只显示当年；填写后自动延续至当年。"
            >
              <input
                className="field"
                id="settings-year"
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={footer.startYear ?? ""}
                onChange={(e) =>
                  change({ ...footer, startYear: e.target.value ? Number(e.target.value) : null })
                }
              />
            </Field>
            <Switch
              id="settings-show-role"
              label="显示身份说明"
              checked={footer.showRole}
              onChange={(showRole) => change({ ...footer, showRole })}
            />
          </Panel>
        ) : null}
        {group === "preferences" ? (
          <Panel title="首次访问的默认值">
            <p className="text-sm text-muted">
              访客自己保存的主题和语言优先。修改默认值不会覆盖访客已有选择。
            </p>
            <Field label="默认主题" htmlFor="settings-theme">
              <select
                className="field"
                id="settings-theme"
                value={preferences.theme}
                onChange={(e) =>
                  change({ ...preferences, theme: e.target.value as typeof preferences.theme })
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
                onChange={(e) =>
                  change({
                    ...preferences,
                    language: e.target.value as typeof preferences.language
                  })
                }
              >
                <option value="auto">自动识别浏览器</option>
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {LANG_LABELS[l]}
                  </option>
                ))}
              </select>
            </Field>
          </Panel>
        ) : null}
        {group === "privacy" ? (
          <>
            <Panel title="隐私说明">
              {localized("隐私标题", privacy.title, (title) => change({ ...privacy, title }))}
              {localized("隐私正文", privacy.body, (body) => change({ ...privacy, body }), true)}
              <p className="text-xs text-muted">
                支持 Markdown；原始 HTML
                不渲染。留空正文保留现有隐私说明，页面继续显示实际采集状态。
              </p>
              <Field label="生效日期" htmlFor="privacy-date">
                <input
                  className="field"
                  id="privacy-date"
                  type="date"
                  value={privacy.effectiveDate ?? ""}
                  onChange={(e) => change({ ...privacy, effectiveDate: e.target.value || null })}
                />
              </Field>
            </Panel>
            <Panel title="最近保存版本">
              {history.data?.history.map((old, i) => (
                <button
                  type="button"
                  key={old.savedAt + i}
                  className="btn-secondary mr-2 mb-2"
                  onClick={() => change(old.value)}
                >
                  载入 {new Date(old.savedAt).toLocaleString("zh-CN")}
                </button>
              ))}
              <p className="text-xs text-muted">保留最近 10 个旧版本。载入后仍需检查并保存。</p>
            </Panel>
          </>
        ) : null}
        {group === "favicon" ? (
          <Panel title="全站 favicon">
            <p className="text-sm text-muted">
              在后台管理，对前台和后台同时生效。使用本站托管的公开图库图片生成 32 / 180 / 192 / 512
              PNG 与 ICO；远程引用图片请先上传图库。
            </p>
            <Field label="图标照片" htmlFor="settings-favicon">
              <select
                className="field"
                id="settings-favicon"
                value={favicon.photoId ?? ""}
                onChange={(e) => change({ photoId: e.target.value || null })}
              >
                <option value="">现有默认图标</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {pickText(p.title, p.id)}
                  </option>
                ))}
              </select>
            </Field>
          </Panel>
        ) : null}
        {group === "dictionary" ? (
          <Panel title="收藏标签词典">
            <p className="text-sm text-muted">
              内容已有对应语言翻译时优先使用；词典补齐缺译。别名用于匹配已有标签，不改写收藏数据。ID
              保存后保持稳定；在用的词条与别名不能直接删除。未命中时沿用内置字典与原标签。
            </p>
            <Field label="查找词条" htmlFor="dictionary-filter">
              <input
                id="dictionary-filter"
                className="field"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </Field>
            <Switch
              id="dictionary-missing"
              label="只看当前语言缺译"
              checked={missingOnly}
              onChange={setMissingOnly}
            />
            <div className="space-y-3">
              {dictionary.entries
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
                      ].some((t) => t?.toLowerCase().includes(filter.toLowerCase())))
                )
                .map(({ entry, index }) => (
                  <fieldset className="rounded-xl border border-line p-4" key={entry.id}>
                    <legend className="px-1 text-xs text-muted">
                      {entry.aliases[0] || "新词条"} ·{" "}
                      {usage.isPending
                        ? "核验引用中"
                        : usage.error
                          ? "引用情况无法核验"
                          : `${usedCount(entry.aliases)} 项内容引用`}
                    </legend>
                    <Field label="匹配别名（每行一个）" htmlFor={`dictionary-alias-${entry.id}`}>
                      <textarea
                        className="field"
                        id={`dictionary-alias-${entry.id}`}
                        rows={2}
                        value={entry.aliases.join("\n")}
                        onChange={(e) =>
                          change({
                            entries: dictionary.entries.map((v, i) =>
                              i === index ? { ...v, aliases: e.target.value.split("\n") } : v
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
                          entries: dictionary.entries.map((v, i) =>
                            i === index ? { ...v, labels } : v
                          )
                        }),
                      false,
                      entry.id
                    )}
                    <button
                      type="button"
                      className="btn-secondary mt-2"
                      disabled={
                        usage.isPending || Boolean(usage.error) || usedCount(entry.aliases) > 0
                      }
                      onClick={() =>
                        change({ entries: dictionary.entries.filter((_, i) => i !== index) })
                      }
                    >
                      移除词条
                    </button>
                  </fieldset>
                ))}
            </div>
            <button
              type="button"
              className="btn-secondary"
              disabled={dictionary.entries.length >= 500}
              onClick={() =>
                change({
                  entries: [
                    ...dictionary.entries,
                    { id: crypto.randomUUID(), aliases: [""], labels: {} }
                  ]
                })
              }
            >
              添加词条
            </button>
          </Panel>
        ) : null}
      </fieldset>
      {conflict && draft ? (
        <section role="alert" className="mt-5 space-y-3 rounded-xl border border-line bg-white p-4">
          <h2 className="font-semibold">其他页面已修改这组设置</h2>
          <p className="text-sm text-muted">
            草稿尚未保存。请比较两份内容，再选择采用最新值，或明确保留草稿覆盖这一组设置。
          </p>
          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            {[
              ["最新已保存值", conflict.value],
              ["当前草稿", draft.value]
            ].map(([label, data]) => (
              <details key={String(label)} className="min-w-0">
                <summary className="cursor-pointer text-sm">{String(label)}</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </details>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                qc.setQueryData(key, conflict);
                setDraft(null);
                setConflict(null);
              }}
            >
              采用最新已保存值
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                qc.setQueryData(key, conflict);
                setDraft({ ...draft, revision: conflict.revision });
                setConflict(null);
              }}
            >
              保留草稿，待再次确认保存
            </button>
          </div>
        </section>
      ) : null}
      <div className="sticky bottom-3 mt-5 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-line bg-white p-3 shadow-card">
        {draft ? <span className="mr-auto text-xs text-status-warn">有未保存的修改</span> : null}
        <button
          className="btn-secondary"
          disabled={!draft || save.isPending}
          onClick={() => {
            setDraft(null);
            setConflict(null);
          }}
        >
          恢复已保存值
        </button>
        <button
          className="btn-primary"
          disabled={!draft || save.isPending || Boolean(conflict)}
          onClick={() => draft && save.mutate(draft)}
        >
          {save.isPending ? "保存中…" : "保存设置"}
        </button>
      </div>
    </>
  );
}
export function RuntimeSettingsPage({ language = false }: { language?: boolean }) {
  const q = useQuery({
    queryKey: ["admin", "settings", "security-status"],
    queryFn: () =>
      request<{
        username: string;
        security: { csrf: boolean; signedSessions: boolean; loginRateLimit: boolean };
      }>("/api/admin/site-settings/security/status")
  });
  return (
    <>
      <PageHeader
        title={language ? "后台语言与格式" : "账号与登录安全"}
        description="运行配置与普通网站内容分开管理。"
      />
      <Panel title={language ? "当前支持语言" : "当前状态"}>
        {language ? (
          <>
            <p className="text-sm">简体中文</p>
            <p className="text-xs text-muted">
              后台完整国际化另行实施；前台默认语言不会改变后台语言。
            </p>
          </>
        ) : (
          <>
            {q.isPending ? <LoadingSkeleton label="读取安全状态…" /> : null}
            {q.error ? <p role="alert">{q.error.message}</p> : null}
            {q.data ? (
              <>
                <p>登录账号：{q.data.username}</p>
                <p className="text-sm text-muted">
                  已启用登录尝试限制、CSRF
                  校验及签名会话。账号、密码与后台路径目前由受保护的运行配置管理。
                </p>
                <p className="text-xs text-muted">
                  在线改密、TOTP 和地址切换将按方案分别评审，保留恢复入口后再开放操作。
                </p>
              </>
            ) : null}
          </>
        )}
      </Panel>
    </>
  );
}
