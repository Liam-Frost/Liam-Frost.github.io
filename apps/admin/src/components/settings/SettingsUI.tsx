import { useId, useState, type ReactNode } from "react";
import { Check, Image } from "lucide-react";
import { Link } from "react-router";
import type { AdminPhoto } from "@liam-frost/shared";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { PageHeader } from "../layout/AdminLayout";
import { LANGS, LANG_LABELS, pickText, type Lang } from "../../lib/i18n";
import LoadingSkeleton from "../../../../web/src/components/LoadingSkeleton";
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
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-[15px] font-semibold text-brand-dark">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{description}</p>
          ) : null}
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
  inline = false,
  saved = false,
  label = copy.save
}: {
  dirty: boolean;
  pending: boolean;
  error?: string;
  onSave: () => void;
  onDiscard: () => void;
  blocked?: boolean;
  inline?: boolean;
  saved?: boolean;
  label?: string;
}) {
  if (!dirty)
    return (
      <p className="flex items-center gap-1.5 py-3 text-xs text-muted" role="status">
        <Check aria-hidden="true" className="size-3.5" />
        {saved ? copy.saved : copy.clean}
      </p>
    );
  return (
    <div
      className={`settings-actions ${inline ? "settings-actions-inline" : ""}`}
      aria-label={tr("保存操作")}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-brand">{copy.unsaved}</p>
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
export function SettingsLanguages({
  value,
  onChange
}: {
  value: Lang;
  onChange: (value: Lang) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={tr("编辑语言")}>
      {LANGS.map((lang) => (
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-xs font-medium ${lang === value ? "bg-brand text-white" : "text-muted hover:bg-white"}`}
          aria-pressed={lang === value}
          key={lang}
          onClick={() => onChange(lang)}
        >
          {LANG_LABELS[lang]}
        </button>
      ))}
    </div>
  );
}
export function SettingsPreview({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="min-w-0 rounded-xl border border-line-soft bg-canvas p-4"
      role="region"
      aria-label={title}
    >
      <p className="mb-3 text-[11px] font-medium text-muted">{title}</p>
      {children}
    </div>
  );
}
export function AssetPreview({
  src,
  label,
  fallback
}: {
  src?: string;
  label: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div
      className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-canvas"
      role="img"
      aria-label={label}
    >
      {src && failed !== src ? (
        <img className="size-full object-contain" alt="" src={src} onError={() => setFailed(src)} />
      ) : (
        (fallback ?? <Image aria-hidden="true" className="size-7 text-brand-secondary" />)
      )}
    </div>
  );
}
export function SettingsBrandPreview({
  src,
  text,
  alt,
  defaultSrc
}: {
  src?: string;
  text: string;
  alt?: string;
  defaultSrc: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const image =
    src && !failed.includes(src) ? src : !text && !failed.includes(defaultSrc) ? defaultSrc : null;
  return image ? (
    <img
      alt={alt || tr("Logo 预览")}
      className="size-9 object-contain"
      src={image}
      onError={() => setFailed((value) => [...value, image])}
    />
  ) : (
    <span
      className="max-w-36 truncate text-sm font-bold"
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      {text || "LF"}
    </span>
  );
}
export function SettingsAssetPicker({
  label,
  photos,
  selected,
  onChange,
  defaultLabel = copy.defaultAsset,
  loading,
  error,
  onRetry
}: {
  label: string;
  photos: AdminPhoto[];
  selected: string | null;
  onChange: (id: string | null) => void;
  defaultLabel?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const current = photos.find((photo) => photo.id === selected),
    filtered = photos.filter((photo) =>
      pickText(photo.title, photo.id).toLocaleLowerCase().includes(search.toLocaleLowerCase())
    );
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <AssetPreview
          src={current?.variants[0]?.url ?? current?.src}
          label={tr("{0}预览", label)}
        />
        <div className="min-w-0 flex-1 basis-48 space-y-2">
          <Field label={label} htmlFor={id} className="max-w-sm">
            <select
              className="field"
              id={id}
              disabled={loading || Boolean(error)}
              value={selected ?? ""}
              onChange={(event) => onChange(event.target.value || null)}
            >
              <option value="">{defaultLabel}</option>
              {selected && !current ? (
                <option value={selected}>{copy.unavailableAsset}</option>
              ) : null}
              {photos.map((photo) => (
                <option key={photo.id} value={photo.id}>
                  {pickText(photo.title, photo.id)}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || Boolean(error)}
            onClick={() => setOpen(true)}
          >
            {copy.gallery}
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingSkeleton label={tr("读取图库…")} variant="rows" count={1} />
      ) : error ? (
        <SettingsState error={error} onRetry={onRetry} />
      ) : !photos.length ? (
        <p className="mt-2 text-xs text-muted">{copy.galleryEmpty}</p>
      ) : null}
      <Dialog open={open} onClose={() => setOpen(false)} title={tr("选择{0}", label)}>
        <p className="mb-3 text-xs text-muted">
          {copy.galleryHelp}{" "}
          <Link className="text-brand underline" to="/photos">
            {tr("照片管理")}
          </Link>
        </p>
        <Field label={copy.gallerySearch} htmlFor={`${id}-search`}>
          <input
            data-autofocus
            id={`${id}-search`}
            className="field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((photo) => (
            <button
              type="button"
              key={photo.id}
              aria-pressed={photo.id === selected}
              className={`overflow-hidden rounded-xl border p-2 text-left ${photo.id === selected ? "border-brand bg-brand/5" : "border-line"}`}
              onClick={() => {
                onChange(photo.id);
                setOpen(false);
              }}
            >
              <img
                loading="lazy"
                className="h-28 w-full object-contain"
                alt=""
                src={photo.variants[0]?.url ?? photo.src}
              />
              <span className="mt-2 flex items-center gap-1 break-all text-xs">
                {photo.id === selected ? (
                  <Check aria-hidden="true" className="size-3 shrink-0" />
                ) : null}
                {pickText(photo.title, photo.id)}
              </span>
            </button>
          ))}
        </div>
        {!filtered.length ? (
          <SettingsState empty={photos.length ? copy.noMatches : copy.galleryEmpty} />
        ) : null}
      </Dialog>
    </div>
  );
}
export function SettingsConflict({
  current,
  draft,
  onUseCurrent,
  onKeepDraft
}: {
  current: unknown;
  draft: unknown;
  onUseCurrent: () => void;
  onKeepDraft: () => void;
}) {
  return (
    <section role="alert" className="settings-section">
      <h2 className="text-sm font-semibold text-brand-dark">{tr("其他页面已修改这组设置")}</h2>
      <p className="my-2 text-xs text-muted">
        {tr("草稿尚未保存。比较后选择最新值，或保留草稿并再次确认保存。")}
      </p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {[
          [tr("最新已保存值"), current],
          [tr("当前草稿"), draft]
        ].map(([label, value]) => (
          <details className="min-w-0" key={String(label)}>
            <summary className="cursor-pointer text-xs text-brand">{String(label)}</summary>
            <pre className="my-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(value, null, 2)}
            </pre>
          </details>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={onUseCurrent}>
          {tr("采用最新已保存值")}
        </button>
        <button type="button" className="btn-secondary" onClick={onKeepDraft}>
          {tr("保留草稿，待再次确认保存")}
        </button>
      </div>
    </section>
  );
}
