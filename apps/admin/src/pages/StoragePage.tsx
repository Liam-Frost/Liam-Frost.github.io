import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import type {
  AdminStorageIssue,
  AdminStorageOrphan,
  AdminStorageOverview
} from "@liam-frost/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, RefreshCw, ScanSearch, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
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
import { fileSize } from "./TrashPage";

export const storageKey = ["admin", "storage"] as const;

const OWNERS: Record<string, string> = {
  photo: tr("照片"),
  project: tr("项目"),
  media: tr("收藏"),
  person: tr("人物"),
  branding: tr("品牌图"),
  stack: tr("技术栈")
};

function Stat({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-[12px] text-subtle">{label}</p>
      <p className="mt-1 text-[20px] font-semibold text-brand-dark">{value}</p>
      {note ? <p className="mt-1 text-[12px] leading-relaxed text-faint">{note}</p> : null}
    </div>
  );
}

function Section({
  title,
  count,
  children
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="card p-4">
      <h3 className="mb-2 text-[13.5px] font-semibold text-brand-dark">
        {title} <span className="font-normal text-subtle">{count}</span>
      </h3>
      {children}
    </section>
  );
}

/**
 * 文件管理: how much space the images take, and a scan that compares the files on the server with the
 * database. The scan only reports; deleting, adopting and regenerating are done here on request.
 */
export function StoragePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const { data, isPending, error } = useQuery({ queryKey: storageKey, queryFn: api.storage });

  const run = async (work: () => Promise<AdminStorageOverview | void>, message: string) => {
    setBusy(true);
    try {
      const next = await work();
      if (next) qc.setQueryData(storageKey, next);
      else void qc.invalidateQueries({ queryKey: storageKey });
      toast(message);
    } catch (e) {
      toast(e instanceof Error ? e.message : tr("操作失败"), "error");
    } finally {
      setBusy(false);
    }
  };

  const removeOrphan = async (orphan: AdminStorageOrphan) => {
    const sure = await confirm({
      title: tr("删除文件夹"),
      message: tr("“{0}”里的 {1} 个文件会从服务器彻底删除，无法恢复。", orphan.key, orphan.files),
      confirmLabel: tr("删除"),
      danger: true
    });
    if (sure) await run(() => api.deleteOrphan(orphan.key), tr("已删除文件夹"));
  };

  const adopt = (orphan: AdminStorageOrphan) =>
    run(async () => {
      await api.adoptOrphan(orphan.key);
      void qc.invalidateQueries({ queryKey: photosKey });
    }, tr("已作为隐藏照片添加"));

  const back = (
    <Link to="/photos" className="btn-secondary">
      <ArrowLeft aria-hidden="true" className="size-4" /> {tr("返回照片")}
    </Link>
  );

  if (isPending) return <LoadingSkeleton label={tr("加载中…")} variant="rows" />;
  if (error) {
    return (
      <>
        <PageHeader title={tr("文件管理")} actions={back} />
        <DatabaseNotice error={error} subject={tr("文件管理")} />
      </>
    );
  }

  const { scan, disk } = data;
  const lowDisk = disk !== null && disk.freeBytes < Math.max(1024 ** 3, disk.totalBytes * 0.05);
  const issueRow = (issue: AdminStorageIssue, action?: ReactNode) => (
    <li key={issue.key} className="flex items-center gap-3 py-2 text-[12.5px]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-ink">{pickText(issue.title, issue.photoId)}</p>
        <p className="truncate font-mono text-[11px] text-faint">{issue.key}</p>
        {issue.missing.length ? (
          <p className="text-subtle">
            {tr(
              "缺少：{0}",
              issue.missing.map((name) => (name === "original" ? tr("原图") : name)).join("、")
            )}
          </p>
        ) : null}
      </div>
      {action}
    </li>
  );

  return (
    <>
      <PageHeader
        title={tr("文件管理")}
        description={tr("查看图片占用的空间，并检查服务器上的文件和数据库记录是否一致。")}
        actions={back}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={tr("使用中的图片")}
          value={fileSize(data.totalBytes)}
          note={tr(
            "{0} 份图片 · 原图 {1} · 生成尺寸 {2}",
            data.images,
            fileSize(data.originalBytes),
            fileSize(data.totalBytes - data.originalBytes)
          )}
        />
        <Stat
          label={tr("回收站")}
          value={fileSize(data.trash.bytes)}
          note={
            <Link to="/photos/trash" className="text-brand hover:underline">
              {tr("{0} 份图片，查看回收站", data.trash.images)}
            </Link>
          }
        />
        <Stat
          label={tr("磁盘剩余空间")}
          value={disk ? fileSize(disk.freeBytes) : tr("未知")}
          note={
            disk ? (
              <span className={lowDisk ? "text-status-error" : ""}>
                {lowDisk
                  ? tr("空间不足，上传可能失败。共 {0}", fileSize(disk.totalBytes))
                  : tr("共 {0}", fileSize(disk.totalBytes))}
              </span>
            ) : undefined
          }
        />
        <Stat
          label={tr("按模块")}
          value={String(data.byOwner.length)}
          note={
            data.byOwner.length
              ? data.byOwner
                  .map(
                    (owner) =>
                      `${OWNERS[owner.ownerType] ?? owner.ownerType} ${fileSize(owner.bytes)}`
                  )
                  .join(" · ")
              : tr("还没有登记的图片")
          }
        />
      </div>

      {data.largest.length ? (
        <section aria-label={tr("占用最多的图片")} className="card mb-5 p-4">
          <h2 className="mb-2 text-[14px] font-semibold text-brand-dark">{tr("占用最多的图片")}</h2>
          <ol className="divide-y divide-line-soft text-[12.5px]">
            {data.largest.map((asset) => (
              <li key={asset.key} className="flex items-center gap-3 py-1.5">
                <span className="min-w-0 flex-1 truncate">
                  {asset.title ? pickText(asset.title, asset.ownerId) : asset.ownerId}
                  <span className="ml-2 font-mono text-[11px] text-faint">{asset.key}</span>
                </span>
                <span className="shrink-0 text-subtle">
                  {asset.format.toUpperCase()} · {fileSize(asset.bytes)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-brand-dark">{tr("一致性检查")}</h2>
          <p className="text-[12.5px] text-subtle">
            {scan ? (
              <>
                {tr("上次扫描：")}
                <Time iso={scan.scannedAt} />
              </>
            ) : (
              tr("服务器启动后还没有扫描过。扫描只报告问题，不会改动任何文件。")
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => void run(() => api.scanStorage(), tr("扫描完成"))}
        >
          <ScanSearch aria-hidden="true" className="size-4" />
          {busy ? tr("处理中…") : tr("扫描文件")}
        </button>
      </div>

      {scan ? (
        scan.orphans.length + scan.missing.length + scan.incomplete.length === 0 ? (
          <p className="card p-6 text-center text-[13.5px] text-subtle">
            {tr("没有发现问题：服务器上的文件和数据库记录一致。")}
          </p>
        ) : (
          <div className="space-y-3">
            {scan.orphans.length ? (
              <Section title={tr("孤儿文件夹")} count={scan.orphans.length}>
                <p className="mb-1 text-[12px] text-subtle">
                  {tr(
                    "服务器上有这些文件夹，但没有任何照片在使用。可以删除，或把里面的原图作为一张新的隐藏照片。"
                  )}
                </p>
                <ul className="divide-y divide-line-soft">
                  {scan.orphans.map((orphan) => (
                    <li key={orphan.key} className="flex items-center gap-3 py-2 text-[12.5px]">
                      <img
                        src={api.orphanPreviewUrl(orphan.key)}
                        alt=""
                        loading="lazy"
                        className="size-14 shrink-0 rounded-lg bg-line-soft object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11.5px] text-ink">{orphan.key}</p>
                        <p className="text-subtle">
                          {tr("{0} 个文件 · {1}", orphan.files, fileSize(orphan.bytes))}
                          {" · "}
                          <Time iso={orphan.modifiedAt} />
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        {orphan.adoptable ? (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            disabled={busy}
                            aria-label={tr("把 {0} 作为照片添加", orphan.key)}
                            onClick={() => void adopt(orphan)}
                          >
                            <ImagePlus aria-hidden="true" className="size-3.5" />{" "}
                            {tr("作为照片添加")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          disabled={busy}
                          aria-label={tr("删除文件夹 {0}", orphan.key)}
                          onClick={() => void removeOrphan(orphan)}
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" /> {tr("删除")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
            {scan.incomplete.length ? (
              <Section title={tr("文件不完整")} count={scan.incomplete.length}>
                <p className="mb-1 text-[12px] text-subtle">
                  {tr("这些图片缺少部分文件。原图还在的可以重新生成各个尺寸。")}
                </p>
                <ul className="divide-y divide-line-soft">
                  {scan.incomplete.map((issue) =>
                    issueRow(
                      issue,
                      issue.repairable ? (
                        <button
                          type="button"
                          className="btn-secondary btn-sm shrink-0"
                          disabled={busy}
                          aria-label={tr("重新生成 {0}", pickText(issue.title, issue.photoId))}
                          onClick={() =>
                            void run(() => api.regenerateImage(issue.key), tr("已重新生成"))
                          }
                        >
                          <RefreshCw aria-hidden="true" className="size-3.5" /> {tr("重新生成")}
                        </button>
                      ) : (
                        <span className="shrink-0 text-status-error">
                          {tr("原图丢失，无法修复")}
                        </span>
                      )
                    )
                  )}
                </ul>
              </Section>
            ) : null}
            {scan.missing.length ? (
              <Section title={tr("文件丢失")} count={scan.missing.length}>
                <p className="mb-1 text-[12px] text-subtle">
                  {tr(
                    "数据库里有这些图片，但服务器上找不到文件。需要从备份恢复，或给照片添加一个新版本。"
                  )}
                </p>
                <ul className="divide-y divide-line-soft">
                  {scan.missing.map((issue) => issueRow(issue))}
                </ul>
              </Section>
            ) : null}
          </div>
        )
      ) : null}
    </>
  );
}
