import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";
import { PageHeader } from "../layout/AdminLayout";
import { LANG_LABELS, type Lang } from "../../lib/i18n";
import type { SettingsConflict as Conflict } from "./useSettingsDocument";
import { settingsCopy as copy } from "./copy";
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
      <header className="surface-header">
        <div className="min-w-0">
          <h2 id={id} className="surface-title">
            {title}
          </h2>
          {description ? <p className="surface-description">{description}</p> : null}
        </div>
        {actions}
      </header>
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
    const background = record as { mode: string; photoIds: string[]; intervalSeconds: number };
    if (background.mode === "none") return tr("纯色背景");
    return background.mode === "fixed"
      ? tr("固定照片")
      : tr("轮换 {0} 张，每 {1} 秒", background.photoIds.length, background.intervalSeconds);
  }
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
    <section role="alert" className="settings-section">
      <header className="surface-header">
        <div>
          <h2 className="surface-title">{tr("有设置已在别处被修改")}</h2>
          <p className="surface-description">
            {tr("下面的内容在你编辑时被保存过。选择要保留的版本，其它修改不受影响。")}
          </p>
        </div>
      </header>
      <div className="space-y-4">
        {conflict.fields.map(({ field, current, draft }) => (
          <div key={field}>
            <p className="mb-1.5 text-[12.5px] font-medium text-brand-dark">
              {labels[field] ?? field}
            </p>
            <div className="settings-grid settings-grid-equal !gap-2">
              {[
                [tr("已保存的版本"), current],
                [tr("你的修改"), draft]
              ].map(([title, value]) => (
                <div className="surface-media" key={String(title)}>
                  <p className="mb-1 text-[11px] font-medium text-muted">{String(title)}</p>
                  <p className="max-h-32 overflow-y-auto text-[13px] break-words whitespace-pre-wrap text-ink">
                    {describeValue(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={onUseLatest}>
          {tr("使用已保存的版本")}
        </button>
        <button type="button" className="btn-secondary" onClick={onKeepMine}>
          {tr("保留我的修改")}
        </button>
      </div>
    </section>
  );
}
