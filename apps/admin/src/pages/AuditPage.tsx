import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import { PageHeader } from "../components/layout/AdminLayout";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
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
  login: "登录",
  logout: "退出登录",
  write: "后台写操作",
  access: "访问验证"
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
        title="审计日志"
        description="后台登录、退出、写操作及访问验证的只读记录。不包含密码、会话凭据或请求正文。"
      />
      <div className="card p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-muted">
            操作类型
            <select
              className="field mt-1 min-w-36"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(0);
              }}
            >
              <option value="">全部操作</option>
              {Object.entries(names).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-muted">
            执行结果
            <select
              className="field mt-1 min-w-32"
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                setPage(0);
              }}
            >
              <option value="">全部结果</option>
              <option value="success">成功</option>
              <option value="failure">失败或拒绝</option>
            </select>
          </label>
          <span className="ml-auto text-[12px] text-faint">每页50条 · 只读</span>
        </div>
        {error ? (
          <p role="alert" className="text-status-error">
            无法读取审计记录：{error.message}
          </p>
        ) : isPending ? (
          <LoadingSkeleton label="加载审计记录…" variant="rows" />
        ) : !data?.items.length ? (
          <div className="py-12 text-center text-[13px] text-muted">
            当前筛选没有审计记录。日志从此版本上线后开始记录。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="text-[12px] text-faint">
                <tr>
                  {["时间", "操作 / 资源", "操作人", "来源 IP", "结果"].map((x) => (
                    <th key={x} className="pb-3 pr-4 font-normal">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="border-t border-line-soft">
                    <td className="py-3 pr-4 whitespace-nowrap tabular-nums">
                      {new Date(row.createdAt).toLocaleString("zh-CN", { hour12: false })}
                    </td>
                    <td className="py-3 pr-4">
                      <strong className="font-medium text-brand-dark">
                        {names[row.action] ?? row.action}
                      </strong>
                      <p className="mt-1 font-mono text-[11px] text-muted">
                        {row.method} {row.resource}
                      </p>
                    </td>
                    <td className="py-3 pr-4">{row.actor ?? "未认证"}</td>
                    <td className="py-3 pr-4 font-mono text-[12px]">{row.ip}</td>
                    <td className="py-3">
                      <span
                        className={row.status < 400 ? "text-status-success" : "text-status-error"}
                      >
                        {row.status < 400 ? "成功" : "失败 / 拒绝"}
                      </span>
                      <span className="ml-2 text-[11px] text-faint">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5 flex items-center justify-between border-t border-line-soft pt-4">
          <p className="text-[12px] text-muted">
            第 {page + 1} 页{data && !data.persistent ? " · 本地开发暂存（重启后清空）" : ""}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              disabled={page === 0 || isPending}
              onClick={() => setPage((p) => p - 1)}
            >
              上一页
            </button>
            <button
              className="btn-secondary"
              disabled={!data?.hasMore || isPending}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
