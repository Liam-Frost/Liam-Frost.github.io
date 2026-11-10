import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import type { AdminTrashItem, AdminTrashResponse } from "@liam-frost/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImageOff, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "../components/layout/AdminLayout";
import { useConfirm } from "../components/ui/Confirm";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { Time } from "../components/ui/Time";
import { useToast } from "../components/ui/Toast";
import { photosKey } from "../hooks/usePhotos";
import { api } from "../lib/api";
import { pickText } from "../lib/i18n";
import { tr } from "../lib/messages";

export const trashKey = ["admin", "trash"] as const;

export const fileSize = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : bytes >= 1024 ** 2
      ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
      : `${Math.ceil(bytes / 1024)} KB`;

const daysLeft = (iso: string) =>
  Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));

function itemName(item: AdminTrashItem) {
  const title = pickText(item.title, item.photoId);
  return item.kind === "photo"
    ? title
    : tr("{0} 的版本{1}", title, item.label ? `“${item.label}”` : "");
}

/** Deleted photos and versions: restore them, or remove them for good before their time is up. */
export function TrashPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const { data, isPending, error } = useQuery({ queryKey: trashKey, queryFn: api.trash });

  const run = async (work: () => Promise<AdminTrashResponse>, message: string) => {
    setBusy(true);
    try {
      qc.setQueryData(trashKey, await work());
      // A restored photo is back in the list; its versions may have changed too.
      void qc.invalidateQueries({ queryKey: photosKey });
      toast(message);
    } catch (e) {
      toast(e instanceof Error ? e.message : tr("操作失败"), "error");
    } finally {
      setBusy(false);
    }
  };

  const purge = async (item: AdminTrashItem) => {
    const sure = await confirm({
      title: tr("彻底删除"),
      message: tr("“{0}”和它在服务器上的图片文件会被彻底删除，无法恢复。", itemName(item)),
      confirmLabel: tr("彻底删除"),
      danger: true
    });
    if (sure) await run(() => api.purgeTrashItem(item.kind, item.id), tr("已彻底删除"));
  };

  const empty = async () => {
    const sure = await confirm({
      title: tr("清空回收站"),
      message: tr("回收站里的 {0} 项和它们的图片文件会被彻底删除，无法恢复。", data?.items.length),
      confirmLabel: tr("清空回收站"),
      danger: true
    });
    if (!sure) return;
    await run(async () => {
      const next = await api.emptyTrash();
      if (next.items.length)
        throw new Error(
          tr("有 {0} 项的文件没能删除，仍在回收站里，稍后会自动重试。", next.items.length)
        );
      return next;
    }, tr("回收站已清空"));
    void qc.invalidateQueries({ queryKey: trashKey });
  };

  const back = (
    <Link to="/photos" className="btn-secondary">
      <ArrowLeft aria-hidden="true" className="size-4" /> {tr("返回照片")}
    </Link>
  );

  if (isPending) return <LoadingSkeleton label={tr("加载中…")} variant="rows" />;
  if (error) {
    return (
      <>
        <PageHeader title={tr("回收站")} actions={back} />
        <DatabaseNotice error={error} subject={tr("回收站")} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={tr("回收站")}
        description={tr(
          "删除的照片和版本在这里保留 {0} 天，之后连同图片文件一起彻底删除。保留天数可以在网站设置的“图片管理”里调整。",
          data.retentionDays
        )}
        actions={
          <>
            {back}
            {data.items.length ? (
              <button
                type="button"
                className="btn-danger"
                disabled={busy}
                onClick={() => void empty()}
              >
                <Trash2 aria-hidden="true" className="size-4" /> {tr("清空回收站")}
              </button>
            ) : null}
          </>
        }
      />
      {data.items.length ? (
        <>
          <p className="mb-3 text-[12.5px] text-subtle">
            {tr("共 {0} 项，占用 {1}", data.items.length, fileSize(data.totalBytes))}
          </p>
          <ul className="space-y-2">
            {data.items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="card flex items-center gap-3 p-3">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    loading="lazy"
                    className="size-16 shrink-0 rounded-lg bg-line-soft object-cover"
                  />
                ) : (
                  <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-line-soft text-faint">
                    <ImageOff aria-hidden="true" className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed">
                  <p className="truncate text-[13.5px] font-medium text-ink">{itemName(item)}</p>
                  <p className="text-subtle">
                    {item.kind === "photo"
                      ? tr("照片 · {0} 个版本", item.versions)
                      : tr("单个版本")}
                    {" · "}
                    {item.width} × {item.height}
                    {item.bytes ? ` · ${fileSize(item.bytes)}` : ""}
                  </p>
                  <p className="text-faint">
                    {tr("删除于")} <Time iso={item.deletedAt} />
                    {" · "}
                    {tr("{0} 天后彻底删除", daysLeft(item.expiresAt))}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={busy}
                    aria-label={tr("恢复 {0}", itemName(item))}
                    onClick={() =>
                      void run(() => api.restoreTrashItem(item.kind, item.id), tr("已恢复"))
                    }
                  >
                    <RotateCcw aria-hidden="true" className="size-3.5" /> {tr("恢复")}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={busy}
                    aria-label={tr("彻底删除 {0}", itemName(item))}
                    onClick={() => void purge(item)}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" /> {tr("彻底删除")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="card p-8 text-center text-[13.5px] text-subtle">{tr("回收站是空的。")}</p>
      )}
    </>
  );
}
