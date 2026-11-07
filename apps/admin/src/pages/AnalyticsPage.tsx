import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import {
  ANALYTICS_CONTENT_TYPES,
  type AnalyticsClearScope,
  type AnalyticsContentType,
  type AnalyticsExport
} from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { NavLink, useParams } from "react-router";

import { AudienceView } from "../components/analytics/AudienceView";
import { RangePicker, useRange } from "../components/analytics/common";
import { ContentDetailView } from "../components/analytics/ContentDetailView";
import { ContentView } from "../components/analytics/ContentView";
import { HealthView } from "../components/analytics/HealthView";
import { SettingsView } from "../components/analytics/SettingsView";
import { OverviewView, useOverview } from "../components/analytics/OverviewView";
import { PageHeader } from "../components/layout/AdminLayout";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { useToast } from "../components/ui/Toast";
import { api } from "../lib/api";
import { InfoTip } from "../components/ui/Tooltip";

export type AnalyticsView = "overview" | "content" | "detail" | "audience" | "health" | "settings";

const TABS: { view: AnalyticsView; to: string; label: string }[] = [
  { view: "overview", to: "/analytics", label: "总览" },
  { view: "content", to: "/analytics/content", label: "内容" },
  { view: "audience", to: "/analytics/audience", label: "来源与受众" },
  { view: "health", to: "/analytics/health", label: "体验与运行" },
  { view: "settings", to: "/analytics/settings", label: "设置" }
];

const EXPORTS: { dataset: AnalyticsExport; label: string }[] = [
  { dataset: "trend", label: "访问趋势" },
  { dataset: "pages", label: "页面" },
  { dataset: "content", label: "内容排行" },
  { dataset: "referrers", label: "来源网站" },
  { dataset: "countries", label: "国家和地区" },
  { dataset: "health", label: "公开接口" }
];

export function AnalyticsPage({ view }: { view: AnalyticsView }) {
  const { query } = useRange();
  const params = useParams();
  const meta = useQuery({ queryKey: ["admin", "analytics-meta"], queryFn: api.analyticsMeta });
  const overview = useOverview();
  const client = useQueryClient();
  const toggle = useMutation({
    mutationFn: api.updateAnalyticsSettings,
    onSuccess: async (data) => {
      client.setQueryData(["admin", "analytics-meta"], data);
      await client.invalidateQueries({ queryKey: ["admin"] });
    }
  });

  if (meta.error) {
    return (
      <>
        <PageHeader title="统计" />
        <DatabaseNotice error={meta.error} subject="统计" />
      </>
    );
  }

  const detailType = ANALYTICS_CONTENT_TYPES.find((type) => type === params.type);
  const empty = meta.data && !meta.data.firstDay;
  return (
    <>
      <PageHeader
        className={view === "audience" ? "max-sm:flex-col max-sm:items-stretch" : ""}
        title="统计"
        description="个人主页的访问情况。不使用 Cookie、不保存 IP；只统计网站，不统计后台和登录后的你自己。"
        actions={
          <>
            {meta.data ? (
              <button
                type="button"
                role="switch"
                aria-label="访问统计总开关"
                aria-checked={meta.data.enabled}
                disabled={toggle.isPending}
                className="inline-flex items-center gap-2 self-center rounded-lg px-1 py-2 text-[12px] text-muted disabled:opacity-50"
                onClick={() => toggle.mutate(!meta.data!.enabled)}
              >
                <span
                  aria-hidden="true"
                  className={`relative h-5 w-8 rounded-full ${meta.data.enabled ? "bg-brand" : "bg-line-strong"}`}
                >
                  <span
                    className={`absolute top-1 size-3 rounded-full bg-white ${meta.data.enabled ? "left-4" : "left-1"}`}
                  />
                </span>
                {toggle.isPending ? "正在保存…" : meta.data.enabled ? "统计已开启" : "统计已关闭"}
              </button>
            ) : null}
            {overview.data ? (
              <span className="inline-flex items-center gap-1.5 self-center text-[12px] text-muted">
                <span aria-hidden="true" className="size-2 rounded-full bg-status-ok" />
                当前在线 {overview.data.online}
              </span>
            ) : null}
            <ExportMenu query={query} />
          </>
        }
      />

      <div className="space-y-5">
        {toggle.error ? (
          <p role="alert" className="text-status-warn">
            保存失败，请重试。{toggle.error.message}
          </p>
        ) : null}
        {meta.data?.demo ? (
          <p role="status" className="card border-status-warn/40 p-3 text-[13px] text-status-warn">
            这是演示数据（由 <code className="chip">npm run db:seed:analytics-demo</code>{" "}
            生成），不是真实访问。
          </p>
        ) : null}
        {meta.data && !meta.data.enabled ? (
          <p className="card p-4 text-[13px] text-muted">
            统计已关闭，不再记录新的访问、接口指标或运行事件。已有统计仍可查看，开启后立即生效。
          </p>
        ) : null}

        <nav aria-label="统计视图" className="flex flex-wrap gap-1 border-b border-line">
          {TABS.map((tab) => (
            <NavLink
              key={tab.view}
              to={`${tab.to}?${query}`}
              end={tab.view === "overview"}
              className={() => {
                const active = view === tab.view || (view === "detail" && tab.view === "content");
                return `-mb-px border-b-2 px-3 py-2 text-[13px] ${
                  active
                    ? "border-brand font-semibold text-brand-dark"
                    : "border-transparent text-muted hover:text-brand"
                }`;
              }}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        {view !== "settings" ? <RangePicker firstDay={meta.data?.firstDay ?? null} /> : null}

        {view === "settings" ? (
          <SettingsView />
        ) : empty && view !== "health" ? (
          <p className="card p-6 text-[13.5px] leading-relaxed text-muted">
            还没有统计数据。网站有人访问后，这里会显示浏览量、访客、内容和来源。
          </p>
        ) : view === "overview" ? (
          overview.data ? (
            <OverviewView data={overview.data} />
          ) : overview.error ? (
            <p className="text-[13px] text-status-error">{overview.error.message}</p>
          ) : (
            <LoadingSkeleton label="加载统计…" count={4} />
          )
        ) : view === "content" ? (
          <ContentView />
        ) : view === "detail" && detailType && params.id ? (
          <ContentDetailView type={detailType as AnalyticsContentType} id={params.id} />
        ) : view === "audience" ? (
          <AudienceView countrySource={meta.data?.countrySource ?? "none"} />
        ) : view === "health" ? (
          <HealthView />
        ) : null}

        {meta.data ? (
          <p className="text-[12px] leading-relaxed text-faint">
            统计时区 {meta.data.timezone}；原始记录保留 {meta.data.retentionDays}{" "}
            天，之后只保留按天汇总的数字。国家来源：
            {meta.data.countrySource === "header"
              ? "代理请求头"
              : meta.data.countrySource === "geoip"
                ? "GeoLite2 数据库"
                : "未配置（可在统计设置中配置）"}
            。
          </p>
        ) : null}

        <ClearData />
      </div>
    </>
  );
}

/** Downloads a report for the range on screen. */
function ExportMenu({ query }: { query: string }) {
  const [open, setOpen] = useState(false);
  const href = (dataset: AnalyticsExport, format: "csv" | "json") =>
    `/api/admin/analytics/export?${new URLSearchParams({ dataset, format })}&${query}`;
  return (
    <div className="relative">
      <button
        type="button"
        className="btn-secondary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Download aria-hidden="true" className="size-4" />
        导出报表
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-line bg-surface p-2 shadow-card-hover">
          <p className="px-2 pb-1 text-[11px] text-faint">
            当前时间范围；CSV 可以直接用 Excel 打开。
          </p>
          {EXPORTS.map(({ dataset, label }) => (
            <div
              key={dataset}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-canvas"
            >
              <span>{label}</span>
              <span className="flex gap-2 text-[12px]">
                <a
                  onClick={() => setOpen(false)}
                  className="text-brand hover:underline"
                  href={href(dataset, "csv")}
                  download
                >
                  CSV
                </a>
                <a
                  onClick={() => setOpen(false)}
                  className="text-brand hover:underline"
                  href={href(dataset, "json")}
                  download
                >
                  JSON
                </a>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const SCOPES: { scope: AnalyticsClearScope; label: string; hint: string }[] = [
  { scope: "events", label: "访问统计", hint: "浏览、访客、内容、来源等全部访问数据" },
  { scope: "health", label: "运行记录", hint: "公开接口统计、任务记录、数据源状态" },
  { scope: "all", label: "全部", hint: "以上两项" }
];

/** Deletes statistics after typing 清除; content and settings are not touched. */
function ClearData() {
  const qc = useQueryClient();
  const toast = useToast();
  const [scope, setScope] = useState<AnalyticsClearScope>("events");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const clear = async () => {
    setBusy(true);
    try {
      await api.clearAnalytics(scope);
      setConfirm("");
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast("已清除统计数据");
    } catch (error) {
      toast(error instanceof Error ? error.message : "清除失败", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="card p-4 text-[13px]">
      <summary className="cursor-pointer font-semibold text-brand-dark">清除统计数据</summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted">不可恢复。照片、项目、收藏等内容和设置不受影响。</p>
        <div role="radiogroup" aria-label="清除范围" className="flex flex-wrap gap-3">
          {SCOPES.map((option) => (
            <label key={option.scope} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="analytics-clear"
                checked={scope === option.scope}
                onChange={() => setScope(option.scope)}
              />
              {option.label}
              <InfoTip text={option.hint} label={`${option.label}：包含什么`} />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field !w-40"
            aria-label="输入“清除”确认"
            placeholder="输入“清除”确认"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            type="button"
            className="btn-danger"
            disabled={confirm.trim() !== "清除" || busy}
            onClick={() => void clear()}
          >
            {busy ? "清除中…" : "清除"}
          </button>
        </div>
      </div>
    </details>
  );
}
