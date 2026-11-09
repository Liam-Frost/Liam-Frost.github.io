import { useId, type ReactNode } from "react";
import {
  FOOTER_PAGES,
  type PresentationSettings,
  type SiteSettingsGroups
} from "@liam-frost/shared";
import { Check } from "lucide-react";
import { PageHeader } from "../layout/AdminLayout";
import { LANG_LABELS, type Lang } from "../../lib/i18n";
import type { SettingsConflict as Conflict } from "./useSettingsDocument";
import { copyrightPageLabels, settingsCopy as copy } from "./copy";
import { tr } from "../../lib/messages";

export function SettingsPage({
  title,
  description,
  children,
  actions
}: {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      <div className="settings-body">{children}</div>
    </>
  );
}
/**
 * How settings content is arranged, against the width it actually has: "equal" is two columns of at least
 * 260px, "aside" a main column with a 260px companion (a preview). Both fall back to one column.
 */
export function SettingsGrid({
  variant,
  className = "",
  children
}: {
  variant: "equal" | "aside";
  className?: string;
  children: ReactNode;
}) {
  return <div className={`settings-grid settings-grid-${variant} ${className}`}>{children}</div>;
}
function SectionHeader({
  id,
  title,
  description,
  actions
}: {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="surface-header">
      <div className="min-w-0">
        <h2 id={id} className="surface-title">
          {title}
        </h2>
        {description ? <p className="surface-description">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

/**
 * One white surface for settings that belong together, holding `SettingsGroup`s separated by hairlines.
 * The columns only apply when the surface is wide enough; below that the groups stack.
 */
export function SettingsSurface({
  columns = "stack",
  children
}: {
  columns?: "stack" | "equal" | "primary" | "aside";
  children: ReactNode;
}) {
  return (
    <div className="settings-surface">
      <div className={`settings-groups settings-groups-${columns}`}>{children}</div>
    </div>
  );
}

/** A titled part of a `SettingsSurface`. */
export function SettingsGroup({
  title,
  description,
  children,
  actions
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const id = useId();
  return (
    <section className="settings-group" aria-labelledby={id}>
      <SectionHeader id={id} title={title} description={description} actions={actions} />
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function SettingsSection({
  title,
  description,
  children,
  actions
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const id = useId();
  return (
    <section className="settings-section" aria-labelledby={id}>
      <SectionHeader id={id} title={title} description={description} actions={actions} />
      <div className="space-y-4">{children}</div>
    </section>
  );
}
export function SettingsActions({
  dirty,
  pending,
  error,
  onSave,
  onDiscard,
  blocked = false,
  saved = false,
  label = copy.save,
  scope
}: {
  dirty: boolean;
  pending: boolean;
  error?: string;
  onSave: () => void;
  onDiscard: () => void;
  blocked?: boolean;
  saved?: boolean;
  label?: string;
  /** What this save covers, when a page also has things that take effect at once. */
  scope?: string;
}) {
  if (!dirty)
    return (
      <p className="flex items-center gap-1.5 text-[11.5px] text-faint" role="status">
        <Check aria-hidden="true" className="size-3" />
        {saved ? copy.saved : copy.clean}
      </p>
    );
  return (
    <div className="settings-actions" role="region" aria-label={tr("保存操作")}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-brand">{copy.unsaved}</p>
        {scope ? <p className="mt-0.5 text-[11.5px] text-faint">{scope}</p> : null}
        {error ? (
          <p role="alert" className="mt-1 break-words text-xs text-status-error">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" className="btn-secondary" disabled={pending} onClick={onDiscard}>
          {copy.discard}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={pending || blocked}
          onClick={onSave}
        >
          {pending ? copy.saving : label}
        </button>
      </div>
    </div>
  );
}
/** Marks a control whose result is live as soon as it succeeds, unlike the fields around it. */
export function ImmediateBadge() {
  return <span className="chip ml-1.5 align-middle font-normal">{tr("立即生效")}</span>;
}
export function SettingsState({
  error,
  empty,
  onRetry,
  children
}: {
  error?: string;
  empty?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border border-dashed border-line bg-white p-5 text-center text-sm text-muted"
      role={error ? "alert" : "status"}
    >
      <p className="break-words">{error ?? empty}</p>
      {onRetry ? (
        <button type="button" className="btn-secondary mt-3" onClick={onRetry}>
          {copy.retry}
        </button>
      ) : null}
      {children}
    </div>
  );
}
export function SettingsPreview({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="surface-media" role="region" aria-label={title}>
      <p className="mb-3 text-[11px] font-medium text-muted">{title}</p>
      {children}
    </div>
  );
}
/** A setting's value in words, for choosing between two versions of it. */
function describeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return tr("未设置");
  if (typeof value === "boolean") return value ? tr("开启") : tr("关闭");
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return tr("{0} 项", value.length);
  const record = value as Record<string, unknown>;
  if ("mode" in record) {
    const background = record as PresentationSettings["loginBackground"];
    if (!background.photoIds.length) return tr("纯色背景");
    const mode = {
      fixed: tr("固定"),
      daily: tr("每天"),
      visit: tr("每次访问"),
      session: tr("每个浏览会话")
    }[background.mode];
    return tr("{0} · {1} 张", mode, background.photoIds.length);
  }
  if ("portfolio" in record)
    return FOOTER_PAGES.map((page) => {
      const owner = (record as SiteSettingsGroups["footer"]["copyright"])[page].owner;
      const name = Object.values(owner).find((text) => text?.trim());
      return `${copyrightPageLabels[page]}：${name ?? tr("沿用站点署名")}`;
    }).join("\n");
  if ("text" in record) return String(record.text || tr("默认 Logo"));
  const values = Object.values(record);
  if (values.length && values.every((item) => typeof item === "boolean"))
    return tr("开启 {0} / {1} 项", values.filter(Boolean).length, values.length);
  const languages = Object.entries(record).filter(([, text]) => text);
  if (!languages.length) return tr("未设置");
  return languages
    .map(([lang, text]) => `${LANG_LABELS[lang as Lang] ?? lang}：${String(text)}`)
    .join("\n");
}

export function SettingsConflict({
  conflict,
  labels,
  onUseLatest,
  onKeepMine
}: {
  conflict: Conflict;
  labels: Record<string, string>;
  onUseLatest: () => void;
  onKeepMine: () => void;
}) {
  return (
    <section
      role="alert"
      className="settings-conflict"
      ref={(element) => element?.scrollIntoView({ block: "nearest" })}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <h2 className="text-[13.5px] font-semibold text-status-warn">
            {tr("有设置已在别处被修改")}
          </h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            {tr("下面的内容在你编辑时被保存过。选择要保留的版本，其它修改不受影响。")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={onUseLatest}>
            {tr("使用已保存的版本")}
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={onKeepMine}>
            {tr("保留我的修改")}
          </button>
        </div>
      </div>
      <dl className="mt-2.5 divide-y divide-status-warn/20 border-t border-status-warn/20">
        {conflict.fields.map(({ field, current, draft }) => (
          <div className="settings-conflict-row" key={field}>
            <dt className="text-[12.5px] font-medium text-brand-dark">{labels[field] ?? field}</dt>
            {[
              [tr("已保存的版本"), current],
              [tr("你的修改"), draft]
            ].map(([title, value]) => (
              <dd className="min-w-0" key={String(title)}>
                <span className="block text-[11px] text-muted">{String(title)}</span>
                <span className="block max-h-20 overflow-y-auto text-[12.5px] break-words whitespace-pre-wrap text-ink">
                  {describeValue(value)}
                </span>
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </section>
  );
}
