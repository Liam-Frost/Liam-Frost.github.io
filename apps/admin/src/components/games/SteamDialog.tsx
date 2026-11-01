import type { SteamSyncJob } from "@liam-frost/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { mediaKey } from "../../hooks/useMedia";
import { api } from "../../lib/api";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";

export const steamAccountKey = ["admin", "steam-account"] as const;

/** The admin's Steam account: connect, sync the library (with progress), disconnect. */
export function SteamDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: status, isPending } = useQuery({ queryKey: steamAccountKey, queryFn: api.steamAccount });
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { data: job } = useQuery({
    queryKey: ["admin", "steam-job", jobId],
    queryFn: () => api.steamJob(jobId!).then((r) => r.job),
    enabled: jobId !== null,
    refetchInterval: (q) => (q.state.data?.state === "running" || !q.state.data ? 1000 : false)
  });
  const running = job?.state === "running" || (jobId !== null && !job);

  useEffect(() => {
    if (!job || job.state === "running") return;
    void qc.invalidateQueries({ queryKey: mediaKey });
    void qc.invalidateQueries({ queryKey: steamAccountKey });
  }, [job, qc]);

  const connect = async () => {
    setError("");
    try {
      // Steam sends the browser back to this page, which reports the result.
      const returnTo = new URL(window.location.href);
      returnTo.searchParams.delete("steam");
      returnTo.searchParams.delete("reason");
      window.location.assign((await api.connectSteam(returnTo.toString())).url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法连接");
    }
  };

  const sync = async () => {
    setError("");
    try {
      setJobId((await api.startSteamSync()).job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法开始同步");
    }
  };

  const disconnect = async () => {
    await api.disconnectSteam();
    await qc.invalidateQueries({ queryKey: steamAccountKey });
    toast("已断开 Steam");
  };

  const account = status?.account;
  return (
    <Dialog open title="Steam 游戏库" onClose={onClose}>
      {isPending ? <p className="text-[13px] text-subtle">加载中…</p> : null}
      {status && !status.configured ? (
        <p className="text-[13px] leading-relaxed text-muted">
          还没有配置 Steam。在 <code className="chip">apps/api/.env</code> 中设置 <code className="chip">STEAM_WEB_API_KEY</code> 后重启 API。
        </p>
      ) : null}
      {status?.configured && !account ? (
        <div className="space-y-3 text-[13px] text-muted">
          <p>通过 Steam 登录确认你的账号（Steam 只告诉网站你的 SteamID，不会给出密码或其他权限），之后可以同步游戏库和游玩时长。</p>
          <p className="text-[12px] text-faint">Steam 资料的隐私设置里，“游戏详情”需要是公开的。</p>
          <button type="button" className="btn-primary" onClick={() => void connect()}>
            通过 Steam 登录
          </button>
        </div>
      ) : null}
      {account ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {account.avatar ? <img src={account.avatar} alt="" className="size-10 rounded-full" /> : null}
            <div className="min-w-0 flex-1 text-[13px]">
              <a href={account.profileUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-dark hover:text-brand">
                {account.name}
              </a>
              <p className="text-[12px] text-subtle">{account.lastSyncedAt ? `上次同步：${new Date(account.lastSyncedAt).toLocaleString()}` : "还没有同步过"}</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => void disconnect()} disabled={running}>
              断开
            </button>
          </div>
          <div className="rounded-xl border border-line-soft p-3 text-[12.5px] leading-relaxed text-muted">
            <p>同步会做这些事：</p>
            <ul className="mt-1 list-disc pl-5">
              <li>已在收藏里的游戏：更新游玩时长和最后游玩日期，你的状态、评分和短评不变。</li>
              <li>新游戏：优先用 IGDB 的资料导入，IGDB 没有的用 Steam 商店资料；默认隐藏，需要你挑选后公开。</li>
              <li>新游戏的状态：最近两周玩过为“在玩”，玩过为“玩过”，没玩过为“想玩”。</li>
            </ul>
          </div>
          <button type="button" className="btn-primary" disabled={running} onClick={() => void sync()}>
            {running ? "同步中…" : "同步游戏库"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-status-error">
          {error}
        </p>
      ) : null}
      {job ? <SyncProgress job={job} /> : null}
    </Dialog>
  );
}

function SyncProgress({ job }: { job: SteamSyncJob }) {
  return (
    <div className="mt-4 space-y-2 rounded-xl border border-line-soft p-3 text-[13px]" role="status">
      {job.total ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-line-soft">
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.round((job.processed / job.total) * 100)}%` }} />
          </div>
          <p className="text-muted">
            {job.processed} / {job.total} · 新增 {job.added}（其中 Steam 商店资料 {job.fromStore}）· 更新 {job.updated}
            {job.failed ? ` · 失败 ${job.failed}` : ""}
          </p>
        </>
      ) : (
        <p className="text-muted">读取游戏库…</p>
      )}
      {job.state === "done" ? <p className="text-status-ok">同步完成。新游戏都是隐藏的，可以在游戏标签里“选择”后批量公开。</p> : null}
      {job.state === "failed" ? <p className="text-status-error">同步失败：{job.error}</p> : null}
      {job.errors.length ? (
        <ul className="list-disc pl-5 text-[12px] text-subtle">
          {job.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
