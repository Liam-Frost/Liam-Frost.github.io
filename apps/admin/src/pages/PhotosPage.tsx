import type { AdminPhoto } from "@liam-frost/shared";
import { ArrowDown, ArrowUp, EyeOff, GripVertical, Pencil, Star, Trash2, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { PageHeader } from "../components/layout/AdminLayout";
import { PhotoEditor } from "../components/photos/PhotoEditor";
import { UploadQueue, type UploadItem } from "../components/photos/UploadQueue";
import { Dialog } from "../components/ui/Dialog";
import { IconButton } from "../components/ui/IconButton";
import { useToast } from "../components/ui/Toast";
import { useDeletePhoto, usePhotos, useReorderPhotos, useSetPhoto } from "../hooks/usePhotos";
import { ApiError, uploadPhoto } from "../lib/api";
import { pickText } from "../lib/i18n";

type Filter = "all" | "public" | "private";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "public", label: "公开" },
  { value: "private", label: "隐藏" }
];

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/tiff";

export function PhotosPage() {
  const { data: photos, isPending, error } = usePhotos();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<AdminPhoto | null>(null);
  const [deleting, setDeleting] = useState<AdminPhoto | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const setPhoto = useSetPhoto();
  const reorder = useReorderPhotos();
  const remove = useDeletePhoto();
  const toast = useToast();

  const patchUpload = (key: string, patch: Partial<UploadItem>) =>
    setUploads((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  /** One at a time: image processing is CPU-heavy on the server. */
  const uploadFiles = async (files: File[]) => {
    const items = files.map((file, i) => ({ file, item: { key: `${Date.now()}-${i}-${file.name}`, name: file.name, progress: 0, status: "uploading" as const } }));
    setUploads((list) => [...items.map((x) => x.item), ...list]);
    for (const { file, item } of items) {
      try {
        const { photo } = await uploadPhoto(file, (progress) =>
          patchUpload(item.key, progress >= 1 ? { progress, status: "processing" } : { progress })
        );
        setPhoto(photo, { prepend: true });
        patchUpload(item.key, { status: "done", progress: 1 });
      } catch (e) {
        patchUpload(item.key, { status: "error", error: e instanceof Error ? e.message : "上传失败" });
      }
    }
  };

  const onDropFiles = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDropActive(false);
    const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
    if (files.length) void uploadFiles(files);
  };

  const move = (ids: string[], from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorder.mutate(next, { onError: (e) => toast(e.message, "error") });
  };

  if (isPending) return <p className="py-10 text-center text-[13px] text-subtle">加载中…</p>;
  if (error) {
    const noDatabase = error instanceof ApiError && error.code === "DATABASE_NOT_CONFIGURED";
    return (
      <>
        <PageHeader title="照片" />
        <div className="card p-6 text-[13.5px] leading-relaxed text-muted">
          {noDatabase ? (
            <>
              照片管理需要数据库。请在 <code className="chip">apps/api/.env</code> 中设置 <code className="chip">DATABASE_URL</code>，运行{" "}
              <code className="chip">npm run db:migrate</code> 后重启 API（见 <code className="chip">docs/database.md</code>）。
            </>
          ) : (
            <span role="alert" className="text-status-error">
              {error.message}
            </span>
          )}
        </div>
      </>
    );
  }

  const all = photos ?? [];
  const ids = all.map((p) => p.id);
  const visible = filter === "all" ? all : all.filter((p) => p.visibility === filter);
  const canReorder = filter === "all" && !reorder.isPending;
  const counts = { all: all.length, public: all.filter((p) => p.visibility === "public").length, private: all.filter((p) => p.visibility === "private").length };

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
        <PageHeader title="照片" description="上传后照片默认隐藏，编辑好信息再设为公开。可以把图片直接拖到页面上上传。" />
        <button type="button" className="btn-primary" onClick={() => fileInput.current?.click()}>
          <Upload aria-hidden="true" className="size-4" /> 上传照片
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) void uploadFiles(files);
          }}
        />
      </div>

      <UploadQueue items={uploads} onClear={() => setUploads([])} />

      <div role="tablist" aria-label="筛选" className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors ${
              filter === value ? "bg-brand text-white" : "bg-surface text-brand ring-1 ring-line hover:bg-brand-secondary/10"
            }`}
          >
            {label} <span className="opacity-70">{counts[value]}</span>
          </button>
        ))}
        {filter !== "all" ? <span className="text-[12px] text-faint">在“全部”中可以调整顺序</span> : null}
      </div>

      {visible.length === 0 ? (
        <div className="card p-10 text-center text-[13.5px] text-muted">{all.length ? "没有符合条件的照片" : "还没有照片，点击“上传照片”或把图片拖到这里"}</div>
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
                className={`card group overflow-hidden ${dragId === photo.id ? "opacity-40" : ""}`}
              >
                <button type="button" onClick={() => setEditing(photo)} className="block w-full" aria-label={`编辑 ${title}`}>
                  <img src={photo.thumbnail} alt="" loading="lazy" className="aspect-[4/3] w-full bg-line-soft object-cover" />
                </button>
                <div className="p-3">
                  <div className="flex items-start gap-1.5">
                    {canReorder ? <GripVertical aria-hidden="true" className="mt-0.5 size-4 shrink-0 cursor-grab text-faint" /> : null}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[13.5px] font-semibold text-brand-dark">{title}</h3>
                      <p className="truncate text-[12px] text-subtle">
                        {photo.date}
                        {pickText(photo.category) ? ` · ${pickText(photo.category)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {photo.visibility === "private" ? (
                      <span className="chip inline-flex items-center gap-1">
                        <EyeOff aria-hidden="true" className="size-3" /> 隐藏
                      </span>
                    ) : null}
                    {photo.featured ? (
                      <span className="chip inline-flex items-center gap-1">
                        <Star aria-hidden="true" className="size-3" /> 精选
                      </span>
                    ) : null}
                    <span className="flex-1" />
                    {canReorder ? (
                      <>
                        <IconButton label={`上移 ${title}`} disabled={index === 0} onClick={() => move(ids, index, index - 1)}>
                          <ArrowUp aria-hidden="true" className="size-3.5" />
                        </IconButton>
                        <IconButton label={`下移 ${title}`} disabled={index === ids.length - 1} onClick={() => move(ids, index, index + 1)}>
                          <ArrowDown aria-hidden="true" className="size-3.5" />
                        </IconButton>
                      </>
                    ) : null}
                    <IconButton label={`编辑 ${title}`} onClick={() => setEditing(photo)}>
                      <Pencil aria-hidden="true" className="size-3.5" />
                    </IconButton>
                    <IconButton label={`删除 ${title}`} onClick={() => setDeleting(photo)} danger>
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </IconButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? <PhotoEditor key={editing.id} photo={editing} onClose={() => setEditing(null)} /> : null}

      <Dialog
        open={Boolean(deleting)}
        size="sm"
        title="删除照片"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>
              取消
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={remove.isPending}
              onClick={() =>
                deleting &&
                remove.mutate(deleting.id, {
                  onSuccess: () => {
                    toast("已删除");
                    setDeleting(null);
                  },
                  onError: (e) => toast(e.message, "error")
                })
              }
            >
              {remove.isPending ? "删除中…" : "删除"}
            </button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-muted">
          确定删除“{deleting ? pickText(deleting.title, deleting.id) : ""}”吗？
          {deleting?.storage === "local" ? "服务器上的图片文件也会一起删除，" : ""}此操作无法撤销。
        </p>
      </Dialog>
    </div>
  );
}
