import { VITAL_THRESHOLDS, type AnalyticsVitalSummary } from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

import { api } from "../../lib/api";
import { Card, number, PAGE_NAMES, useRange } from "./common";

const VITALS: Record<string, { name: string; hint: string }> = {
  lcp: { name: "最大内容绘制 LCP", hint: "页面主要内容显示出来用的时间" },
  inp: { name: "交互响应 INP", hint: "点击、输入后页面有反应用的时间（取最慢的一次）" },
  cls: { name: "布局偏移 CLS", hint: "加载时内容跳动的程度" }
};
const RATINGS: Record<
  AnalyticsVitalSummary["rating"],
  { label: string; className: string; icon: typeof CircleCheck }
> = {
  good: { label: "良好", className: "text-status-ok", icon: CircleCheck },
  "needs-improvement": { label: "待改进", className: "text-status-warn", icon: TriangleAlert },
  poor: { label: "差", className: "text-status-error", icon: CircleAlert }
};
const JOBS: Record<string, string> = {
  "steam-sync": "Steam 游戏库同步",
  "music-playlist-link": "导入歌单链接",
  "music-liked": "导入 Spotify 点赞歌曲",
  "music-playlist": "导入 Spotify 歌单"
};
const SOURCES: Record<string, string> = {
  tmdb: "TMDB",
  bangumi: "Bangumi",
  openlibrary: "Open Library",
  googlebooks: "Google Books",
  anilist: "AniList",
  igdb: "IGDB"
};

const vitalValue = (metric: string, value: number) =>
  metric === "cls" ? (value / 1000).toFixed(2) : `${number.format(value)} ms`;
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString("zh-CN") : "—");

/** Page speed seen by visitors, the public API, import and sync jobs, and external sources. */
export function HealthView() {
  const { range, from, to, ready } = useRange();
  const { data, error } = useQuery({
    queryKey: ["admin", "analytics-health", range, from, to],
    queryFn: () => api.analyticsHealth(range, from, to),
    enabled: ready
  });
  if (error) return <p className="text-[13px] text-status-error">{error.message}</p>;
  if (!data) return <p className="text-[13px] text-subtle">加载中…</p>;

  return (
    <>
      <Card
        title="页面体验（Core Web Vitals）"
        hint="一半的访问会测量落地页的体验，按 75% 分位数评级（Google 的标准）。"
      >
        {data.vitals.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-faint">
                  <th className="pb-2 font-normal">页面</th>
                  <th className="pb-2 font-normal">指标</th>
                  <th className="pb-2 text-right font-normal">75% 分位</th>
                  <th className="pb-2 font-normal">评级</th>
                  <th className="pb-2 text-right font-normal">样本</th>
                </tr>
              </thead>
              <tbody>
                {data.vitals.map((vital) => {
                  const rating = RATINGS[vital.rating];
                  const Icon = rating.icon;
                  const limits = VITAL_THRESHOLDS[vital.metric];
                  return (
                    <tr key={`${vital.path}|${vital.metric}`} className="border-t border-line-soft">
                      <td className="py-2 pr-3">{PAGE_NAMES[vital.path] ?? vital.path}</td>
                      <td className="py-2 pr-3" title={VITALS[vital.metric]?.hint}>
                        {VITALS[vital.metric]?.name ?? vital.metric}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        ≤ {vitalValue(vital.metric, vital.p75)}
                      </td>
                      <td
                        className={`py-2 pl-3 ${rating.className}`}
                        title={`良好 ≤ ${vitalValue(vital.metric, limits.good)}，差 > ${vitalValue(vital.metric, limits.poor)}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Icon aria-hidden="true" className="size-3.5" />
                          {rating.label}
                        </span>
                      </td>
                      <td className="py-2 text-right text-muted tabular-nums">{vital.samples}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-muted">这段时间还没有体验数据。</p>
        )}
      </Card>

      <Card
        title="公开接口"
        hint="网站请求的公开 API（不含后台）：请求数、错误和响应时间；每分钟写入一次。"
      >
        {data.routes.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-faint">
                  <th className="pb-2 font-normal">接口</th>
                  <th className="pb-2 text-right font-normal">请求</th>
                  <th className="pb-2 text-right font-normal">5xx</th>
                  <th className="pb-2 text-right font-normal">4xx</th>
                  <th className="pb-2 text-right font-normal">平均</th>
                  <th className="pb-2 text-right font-normal">95% 分位</th>
                </tr>
              </thead>
              <tbody>
                {data.routes.map((route) => (
                  <tr key={route.route} className="border-t border-line-soft">
                    <td className="py-2 pr-3 font-mono text-[12px]">{route.route}</td>
                    <td className="py-2 text-right tabular-nums">
                      {number.format(route.requests)}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${route.serverErrors ? "font-semibold text-status-error" : "text-muted"}`}
                    >
                      {route.serverErrors}
                    </td>
                    <td className="py-2 text-right text-muted tabular-nums">
                      {route.clientErrors}
                    </td>
                    <td className="py-2 text-right tabular-nums">{route.avgMs} ms</td>
                    <td className="py-2 text-right tabular-nums">
                      ≤ {number.format(route.p95Ms)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-muted">这段时间没有请求记录。</p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="导入与同步任务" hint="最近的任务和结果（最多 50 条）。">
          {data.jobs.length ? (
            <ul className="space-y-2 text-[13px]">
              {data.jobs.map((job, index) => (
                <li key={`${job.at}-${index}`} className="flex gap-2">
                  {job.ok ? (
                    <CircleCheck
                      aria-label="成功"
                      className="mt-0.5 size-4 shrink-0 text-status-ok"
                    />
                  ) : (
                    <CircleAlert
                      aria-label="失败"
                      className="mt-0.5 size-4 shrink-0 text-status-error"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-ink">
                      {JOBS[job.name] ?? job.name}
                      <span className="ml-2 text-[12px] text-faint">{time(job.at)}</span>
                    </p>
                    {job.message ? (
                      <p className={`text-[12px] ${job.ok ? "text-muted" : "text-status-error"}`}>
                        {job.message}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">这段时间没有导入或同步。</p>
          )}
        </Card>
        <Card title="外部数据源" hint="后台搜索、导入时调用的资料库：最近一次成功和失败。">
          {data.sources.length ? (
            <ul className="space-y-2 text-[13px]">
              {data.sources.map((source) => {
                const failing =
                  source.lastError && (!source.lastOk || source.lastError > source.lastOk);
                return (
                  <li key={source.name}>
                    <p className="flex items-center gap-1.5 text-ink">
                      {failing ? (
                        <CircleAlert aria-hidden="true" className="size-4 text-status-error" />
                      ) : (
                        <CircleCheck aria-hidden="true" className="size-4 text-status-ok" />
                      )}
                      {SOURCES[source.name] ?? source.name}
                      <span className="text-[12px] text-faint">
                        {failing ? "最近一次失败" : "正常"}
                      </span>
                    </p>
                    <p className="pl-5.5 text-[12px] text-muted">
                      成功 {time(source.lastOk)}
                      {source.lastError ? ` · 失败 ${time(source.lastError)}` : ""}
                    </p>
                    {failing && source.lastErrorMessage ? (
                      <p className="pl-5.5 text-[12px] text-status-error">
                        {source.lastErrorMessage}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">还没有调用记录。</p>
          )}
        </Card>
      </div>
    </>
  );
}
