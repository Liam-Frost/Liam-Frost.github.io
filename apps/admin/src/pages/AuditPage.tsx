import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import { PageHeader } from "../components/layout/AdminLayout";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import { intlLocale, tr } from "../lib/messages";
import { Select } from "../components/ui/Select";
type Entry = {
  id: string;
  createdAt: string;
  actor: string | null;
  action: string;
  method: string;
  resource: string;
  status: number;
  ip: string;
};
const names: Record<string, string> = {
  login: tr("登录"),
  logout: tr("退出登录"),
  write: tr("后台写操作"),
  access: tr("访问验证")
};
export function AuditPage() {
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [page, setPage] = useState(0);
  const { data, error, isPending } = useQuery({
    queryKey: ["admin", "audit", action, outcome, page],
    queryFn: () =>
      request<{ items: Entry[]; page: number; hasMore: boolean; persistent: boolean }>(
        `/api/admin/audit?${new URLSearchParams({ action, outcome, page: String(page) })}`
      )
  });
  return (
    <>
      <PageHeader
        title={tr("审计日志")}
        description={tr(
          "后台登录、退出、写操作及访问验证的只读记录。不包含密码、会话凭据或请求正文。"
        )}
      />
      <div className="card p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-muted">
            {tr("操作类型")}
            <Select
              value={action}
              onChange={(value) => {
                setAction(value);
                setPage(0);
              }}
              className="mt-1 min-w-36"
              options={[
                { value: "", label: tr("全部操作") },
                ...Object.entries(names).map(([key, name]) => ({ value: key, label: name }))
              ]}
            />
          </label>
          <label className="text-[12px] text-muted">
            {tr("执行结果")}
            <Select
              value={outcome}
              onChange={(value) => {
                setOutcome(value);
                setPage(0);
              }}
              className="mt-1 min-w-32"
              options={[
                { value: "", label: tr("全部结果") },
                { value: "success", label: tr("成功") },
                { value: "failure", label: tr("失败或拒绝") }
              ]}
            />
          </label>
          <span className="ml-auto text-[12px] text-muted">{tr("每页50条 · 只读")}</span>
        </div>
        {error ? (
          <p role="alert" className="text-status-error">
            {tr("无法读取审计记录：{0}", error.message)}
          </p>
        ) : isPending ? (
          <LoadingSkeleton label={tr("加载审计记录…")} variant="rows" />
        ) : !data?.items.length ? (
          <div className="py-12 text-center text-[13px] text-muted">
            {tr("当前筛选没有审计记录。日志从此版本上线后开始记录。")}
          </div>
        ) : (
          <div
            className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-brand-secondary"
            tabIndex={0}
            role="region"
            aria-label={tr("审计记录，可横向滚动")}
          >
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="text-[12px] text-muted">
                <tr>
                  {[tr("时间"), tr("操作 / 资源"), tr("操作人"), tr("来源 IP"), tr("结果")].map(
                    (x) => (
                      <th key={x} className="pb-3 pr-4 font-normal">
                        {x}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="border-t border-line-soft">
                    <td className="py-3 pr-4 whitespace-nowrap tabular-nums">
                      {new Date(row.createdAt).toLocaleString(intlLocale, { hour12: false })}
                    </td>
                    <td className="py-3 pr-4">
                      <strong className="font-medium text-brand-dark">
                        {names[row.action] ?? row.action}
                      </strong>
                      <p className="mt-1 font-mono text-[11px] text-muted">
                        {row.method} {row.resource}
                      </p>
                    </td>
                    <td className="py-3 pr-4">{row.actor ?? tr("未认证")}</td>
                    <td className="py-3 pr-4 font-mono text-[12px]">{row.ip}</td>
                    <td className="py-3">
                      <span
                        className={row.status < 400 ? "text-brand-secondary" : "text-status-error"}
                      >
                        {row.status < 400 ? tr("成功") : tr("失败 / 拒绝")}
                      </span>
                      <span className="ml-2 text-[11px] text-muted">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5 flex items-center justify-between border-t border-line-soft pt-4">
          <p className="text-[12px] text-muted">
            {tr(
              "第 {0} 页{1}",
              page + 1,
              data && !data.persistent ? tr(" · 本地开发暂存（重启后清空）") : ""
            )}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              disabled={page === 0 || isPending}
              onClick={() => setPage((p) => p - 1)}
            >
              {tr("上一页")}
            </button>
            <button
              className="btn-secondary"
              disabled={!data?.hasMore || isPending}
              onClick={() => setPage((p) => p + 1)}
            >
              {tr("下一页")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
