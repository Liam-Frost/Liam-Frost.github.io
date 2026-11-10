import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import type { AdminPhoto, AdminPhotoImport, PhotoSourceType } from "@liam-frost/shared";
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  Star,
  Trash2
} from "lucide-react";
import { useState, type DragEvent } from "react";

import { PageHeader } from "../components/layout/AdminLayout";
import {
  ImageSourcePicker,
  SOURCE_LABELS,
  sourceLabel
} from "../components/photos/ImageSourcePicker";
import { PhotoEditor } from "../components/photos/PhotoEditor";
import { UploadQueue } from "../components/photos/UploadQueue";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { Dialog } from "../components/ui/Dialog";
import { IconButton } from "../components/ui/IconButton";
import { useToast } from "../components/ui/Toast";
import { useArrivalParams } from "../hooks/useArrivalParams";
import { useDeletePhoto, usePhotos, useReorderPhotos, useSetPhoto } from "../hooks/usePhotos";
import { useUploadQueue } from "../hooks/useUploadQueue";
import { api, uploadPhoto } from "../lib/api";
import { pickText } from "../lib/i18n";
import { tr } from "../lib/messages";
import { Select } from "../components/ui/Select";

type Filter = "all" | "public" | "private";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: tr("全部") },
  { value: "public", label: tr("公开") },
  { value: "private", label: tr("隐藏") }
];

/**
 * Card metadata: status badges (hidden, featured, referenced) and the source tag. Same size, never
 * wrapping inside; weaker than the action buttons (no hover, smaller type).
 */
const BADGE =
  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] leading-4";
const STATUS_BADGE = `${BADGE} bg-brand-secondary/10 text-brand`;
const SOURCE_TAG = `${BADGE} text-subtle ring-1 ring-line ring-inset`;

type SourceFilter = "all" | PhotoSourceType | "unknown";

/** Quick filters for the overview's tasks; the same rules as the tasks. */
const SHOWS = [
  {
    value: "referenced",
    label: tr("只看引用"),
    test: (p: AdminPhoto) => p.storage === "remote-url"
  },
  {
    value: "missing-en",
    label: tr("公开但缺英文标题"),
    test: (p: AdminPhoto) => p.visibility === "public" && !p.title.en?.trim()
  }
] as const;
type Show = (typeof SHOWS)[number]["value"];

export function PhotosPage() {
  const { data: photos, isPending, error } = usePhotos();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<AdminPhoto | null>(null);
  const [deleting, setDeleting] = useState<AdminPhoto | null>(null);
  const { items: uploads, queue } = useUploadQueue();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  // 概览 links here to add a photo (?open=add) or to a task's photos (?show=referenced | missing-en).
  const arrival = useArrivalParams("open", "show");
  const [adding, setAdding] = useState(arrival.open === "add");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [show, setShow] = useState<Show | null>(
    SHOWS.find((s) => s.value === arrival.show)?.value ?? null
  );

  const setPhoto = useSetPhoto();
  const reorder = useReorderPhotos();
  const remove = useDeletePhoto();
  const toast = useToast();

  /** A few at a time; each can be retried or, until the server has it, cancelled. */
  const uploadFiles = (files: File[]) =>
    queue.add(
      files.map((file) => ({
        name: file.name,
        kind: "upload" as const,
        run: async ({ onProgress, signal }) => {
          const { photo } = await uploadPhoto(file, onProgress, signal);
          setPhoto(photo, { prepend: true });
        }
      }))
    );

  /** Links, gallery photos and server files, through the same queue as uploads. */
  const importItems = (imports: AdminPhotoImport[]) =>
    queue.add(
      imports.map((body) => ({
        name: body.from.type === "server" ? body.from.path : body.from.url,
        kind: "import" as const,
        run: async () => {
          const { photo } = await api.importPhoto(body);
          setPhoto(photo, { prepend: true });
        }
      }))
    );

  const onDropFiles = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDropActive(false);
    const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
    if (files.length) uploadFiles(files);
  };

  const move = (ids: string[], from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorder.mutate(next, { onError: (e) => toast(e.message, "error") });
  };

  if (isPending) return <LoadingSkeleton label={tr("加载中…")} variant="rows" />;
  if (error) {
    return (
      <>
        <PageHeader title={tr("照片")} />
        <DatabaseNotice error={error} subject={tr("照片管理")} />
      </>
    );
  }

  const all = photos ?? [];
  const ids = all.map((p) => p.id);
  const visible = all.filter(
    (p) =>
      (filter === "all" || p.visibility === filter) &&
      (sourceFilter === "all" || (p.source?.type ?? "unknown") === sourceFilter) &&
      (!show || SHOWS.find((s) => s.value === show)!.test(p))
  );
  const filtered = filter !== "all" || sourceFilter !== "all" || show !== null;
  const canReorder = !filtered && !reorder.isPending;
  const counts = {
    all: all.length,
    public: all.filter((p) => p.visibility === "public").length,
    private: all.filter((p) => p.visibility === "private").length
  };

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDropActive(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropActive(false);
      }}
      onDrop={onDropFiles}
      className={`rounded-[var(--radius-feature)] transition-shadow ${dropActive ? "ring-2 ring-brand-secondary ring-offset-4 ring-offset-canvas" : ""}`}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={tr("照片")}
          description={tr(
            "从本机、服务器文件夹、图库或图片链接添加；新照片默认隐藏，编辑好信息再设为公开。也可以把图片直接拖到页面上上传。"
          )}
        />
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" className="size-4" /> {tr("添加照片")}
        </button>
      </div>

      <Dialog open={adding} title={tr("添加照片")} onClose={() => setAdding(false)}>
        <ImageSourcePicker
          multiple
          action={tr("添加")}
          onFiles={(files) => {
            setAdding(false);
            uploadFiles(files);
          }}
          onImports={(items) => {
            setAdding(false);
            importItems(items);
          }}
        />
      </Dialog>

      <UploadQueue
        items={uploads}
        onRetry={(key) => queue.retry(key)}
        onRetryFailed={() => queue.retryFailed()}
        onCancel={(key) => queue.cancel(key)}
        onCancelAll={() => queue.cancelAll()}
        onClear={() => queue.clear()}
      />

      <div
        role="tablist"
        aria-label={tr("筛选")}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors ${
              filter === value
                ? "bg-brand text-white"
                : "bg-surface text-brand ring-1 ring-line hover:bg-brand-secondary/10"
            }`}
          >
            {label} <span className="opacity-70">{counts[value]}</span>
          </button>
        ))}
        <Select
          aria-label={tr("来源")}
          value={sourceFilter}
          onChange={(value) => setSourceFilter(value as SourceFilter)}
          size="sm"
          className="w-auto"
          options={[
            { value: "all", label: tr("全部来源") },
            ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({
              value: value,
              label: label
            })),
            { value: "unknown", label: tr("未记录来源") }
          ]}
        />
        {SHOWS.map(({ value, label, test }) => {
          const count = all.filter(test).length;
          if (!count && show !== value) return null;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={show === value}
              onClick={() => setShow(show === value ? null : value)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors ${
                show === value
                  ? "bg-brand text-white"
                  : "bg-surface text-brand ring-1 ring-line hover:bg-brand-secondary/10"
              }`}
            >
              {label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
        {filtered ? (
          <span className="text-[12px] text-faint">{tr("在“全部”且不筛选时可以调整顺序")}</span>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="card p-10 text-center text-[13.5px] text-muted">
          {all.length ? tr("没有符合条件的照片") : tr("还没有照片，点击“添加照片”或把图片拖到这里")}
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {visible.map((photo) => {
            const index = ids.indexOf(photo.id);
            const title = pickText(photo.title, photo.id);
            return (
              <li
                key={photo.id}
                draggable={canReorder}
                onDragStart={(e) => {
                  setDragId(photo.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => {
                  if (dragId && dragId !== photo.id) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.stopPropagation();
                  move(ids, ids.indexOf(dragId), index);
                  setDragId(null);
                }}
                className={`card group flex flex-col overflow-hidden ${dragId === photo.id ? "opacity-40" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setEditing(photo)}
                  className="block w-full"
                  aria-label={tr("编辑 {0}", title)}
                >
                  <img
                    src={photo.thumbnail}
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] w-full bg-line-soft object-cover"
                  />
                </button>
                <div className="flex flex-1 flex-col p-3">
                  <div className="flex items-start gap-1.5">
                    {canReorder ? (
                      <GripVertical
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 cursor-grab text-faint"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[13.5px] font-semibold text-brand-dark">
                        {title}
                      </h3>
                      <p className="truncate text-[12px] text-subtle">
                        {photo.date}
                        {pickText(photo.category) ? ` · ${pickText(photo.category)}` : ""}
                      </p>
                    </div>
                  </div>
                  {/* Metadata: status badges and the source, on as many lines as they need. */}
                  {photo.visibility === "private" ||
                  photo.featured ||
                  photo.source ||
                  photo.storage === "remote-url" ? (
                    <ul aria-label={tr("状态和来源")} className="mt-2 flex flex-wrap gap-1">
                      {photo.visibility === "private" ? (
                        <li className={STATUS_BADGE}>
                          <EyeOff aria-hidden="true" className="size-3 shrink-0" /> {tr("隐藏")}
                        </li>
                      ) : null}
                      {photo.featured ? (
                        <li className={STATUS_BADGE}>
                          <Star aria-hidden="true" className="size-3 shrink-0" /> {tr("精选")}
                        </li>
                      ) : null}
                      {photo.storage === "remote-url" ? (
                        <li className={STATUS_BADGE}>
                          <Link2 aria-hidden="true" className="size-3 shrink-0" /> {tr("引用")}
                        </li>
                      ) : null}
                      {photo.source ? (
                        <li className={SOURCE_TAG}>{sourceLabel(photo.source)}</li>
                      ) : null}
                    </ul>
                  ) : null}
                  {/* Grows so the action rows of one grid row line up, whatever the tags above. */}
                  <div aria-hidden="true" className="min-h-2 flex-1" />
                  {/* Actions: their own row, so badges never squeeze them. */}
                  <div className="flex items-center justify-between gap-1 border-t border-line-soft pt-2">
                    <div className="flex items-center gap-0.5">
                      {canReorder ? (
                        <>
                          <IconButton
                            label={tr("上移 {0}", title)}
                            disabled={index === 0}
                            onClick={() => move(ids, index, index - 1)}
                          >
                            <ArrowUp aria-hidden="true" className="size-3.5" />
                          </IconButton>
                          <IconButton
                            label={tr("下移 {0}", title)}
                            disabled={index === ids.length - 1}
                            onClick={() => move(ids, index, index + 1)}
                          >
                            <ArrowDown aria-hidden="true" className="size-3.5" />
                          </IconButton>
                        </>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <IconButton label={tr("编辑 {0}", title)} onClick={() => setEditing(photo)}>
                        <Pencil aria-hidden="true" className="size-3.5" />
                      </IconButton>
                      <IconButton
                        label={tr("删除 {0}", title)}
                        onClick={() => setDeleting(photo)}
                        danger
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <PhotoEditor key={editing.id} photo={editing} onClose={() => setEditing(null)} />
      ) : null}

      <Dialog
        open={Boolean(deleting)}
        size="sm"
        title={tr("删除照片")}
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>
              {tr("取消")}
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={remove.isPending}
              onClick={() =>
                deleting &&
                remove.mutate(deleting.id, {
                  onSuccess: () => {
                    toast(tr("已删除"));
                    setDeleting(null);
                  },
                  onError: (e) => toast(e.message, "error")
                })
              }
            >
              {remove.isPending ? tr("删除中…") : tr("删除")}
            </button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-muted">
          {tr(
            "确定删除“{0}”吗？{1}此操作无法撤销。",
            deleting ? pickText(deleting.title, deleting.id) : "",
            deleting?.storage === "local" ? tr("服务器上的图片文件也会一起删除，") : ""
          )}
        </p>
      </Dialog>
    </div>
  );
}
