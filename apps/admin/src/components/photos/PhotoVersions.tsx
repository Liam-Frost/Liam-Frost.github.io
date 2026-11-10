import type { AdminPhoto, AdminPhotoVersion, AdminPhotoVersionsResponse } from "@liam-frost/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useState } from "react";

import { api } from "../../lib/api";
import { tr } from "../../lib/messages";
import { useConfirm } from "../ui/Confirm";
import { useToast } from "../ui/Toast";
import { sourceLabel } from "./ImageSourcePicker";

export const versionsKey = (photoId: string) => ["admin", "photos", photoId, "versions"] as const;

const megabytes = (bytes: number) =>
  bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

/** "6000 × 4000 · PNG · 24.1 MB", or that the image is only referenced. */
function details(version: AdminPhotoVersion) {
  const parts = [`${version.width} × ${version.height}`];
  if (version.storage === "remote-url") parts.push(tr("只引用原链接"));
  else {
    if (version.format) parts.push(version.format.toUpperCase());
    if (version.bytes) parts.push(megabytes(version.bytes));
  }
  return parts.join(" · ");
}

/**
 * The images a photo has: which one it shows, switching to another, naming and deleting them. Changes
 * apply at once (they are not part of the editor's draft); `onPhoto` receives the photo as it now is.
 */
export function PhotoVersions({
  photoId,
  onPhoto
}: {
  photoId: string;
  onPhoto: (photo: AdminPhoto) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const { data, error } = useQuery({
    queryKey: versionsKey(photoId),
    queryFn: () => api.photoVersions(photoId)
  });

  const run = async (work: () => Promise<AdminPhotoVersionsResponse>, message?: string) => {
    setBusy(true);
    try {
      const next = await work();
      qc.setQueryData(versionsKey(photoId), next);
      onPhoto(next.photo);
      if (message) toast(message);
    } catch (e) {
      toast(e instanceof Error ? e.message : tr("操作失败"), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (version: AdminPhotoVersion) => {
    const sure = await confirm({
      title: tr("删除版本"),
      message: tr("这个版本会移到回收站，保留期内可以恢复。"),
      confirmLabel: tr("删除"),
      danger: true
    });
    if (!sure) return;
    await run(() => api.deletePhotoVersion(photoId, version.id), tr("版本已移到回收站"));
    void qc.invalidateQueries({ queryKey: ["admin", "trash"] });
  };

  if (error) return <p className="text-status-error">{error.message}</p>;
  if (!data) return <p className="text-faint">{tr("加载中…")}</p>;

  return (
    <div className="space-y-2">
      <p className="flex items-center justify-between text-muted">
        <span>{tr("版本")}</span>
        <span className="text-faint">
          {data.versions.length} / {data.limit}
        </span>
      </p>
      <ul className="space-y-2">
        {data.versions.map((version, index) => (
          <li
            key={version.id}
            className={`rounded-lg border p-2 ${version.current ? "border-brand-secondary/50 bg-brand-secondary/5" : "border-line-soft"}`}
          >
            <div className="flex gap-2">
              <img
                src={version.thumbnail}
                alt=""
                className="size-12 shrink-0 rounded-md bg-line-soft object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[12px] text-ink hover:border-line focus:border-line"
                  aria-label={tr("版本 {0} 的名称", index + 1)}
                  placeholder={tr("版本 {0}", index + 1)}
                  defaultValue={version.label}
                  maxLength={60}
                  disabled={busy}
                  onBlur={(event) => {
                    const label = event.target.value.trim();
                    if (label !== version.label)
                      void run(() => api.labelPhotoVersion(photoId, version.id, label));
                  }}
                  onKeyDown={(event) => {
                    // Enter would submit the photo form around this list.
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                />
                <p className="px-1 text-[11px] leading-snug text-faint">
                  {details(version)}
                  <br />
                  {version.source ? sourceLabel(version.source) : tr("未记录")}
                  {" · "}
                  {version.createdAt.slice(0, 10)}
                </p>
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              {version.current ? (
                <span className="inline-flex items-center gap-1 px-1 text-[11.5px] font-medium text-brand">
                  <Check aria-hidden="true" className="size-3.5" />
                  {tr("当前显示")}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() =>
                      void run(() => api.showPhotoVersion(photoId, version.id), tr("已切换版本"))
                    }
                  >
                    {tr("设为当前")}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] text-subtle hover:text-status-error"
                    disabled={busy}
                    aria-label={tr("删除版本 {0}", index + 1)}
                    onClick={() => void remove(version)}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                    {tr("删除")}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
