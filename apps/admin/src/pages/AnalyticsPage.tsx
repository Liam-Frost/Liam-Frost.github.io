import {
  ANALYTICS_RANGES,
  type AnalyticsKpis,
  type AnalyticsOverview,
  type AnalyticsRange,
  type AnalyticsTrendPoint
} from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { PageHeader } from "../components/layout/AdminLayout";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { api } from "../lib/api";

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  today: "今天",
  "7d": "7 天",
  "30d": "30 天",
  "90d": "90 天",
  custom: "自定义"
};

export const PAGE_NAMES: Record<string, string> = {
  "/": "首页",
  "/portfolio": "摄影",
  "/projects": "项目列表",
  "/projects/:slug": "项目详情",
  "/collection": "收藏",
  "/privacy": "隐私说明",
  "*": "不存在的页面"
};

type KpiKey = keyof AnalyticsKpis;
const KPIS: { key: KpiKey; label: string; hint: string }[] = [
  {
    key: "views",
    label: "浏览量",
    hint: "页面打开次数：首次加载和站内切换页面各算一次；同一页面里打开条目、切换标签不算。"
  },
  {
    key: "visitors",
    label: "访客",
    hint: "每天按“IP + 浏览器 + 当天的随机值”去重，多天的访客是每天人数之和：同一个人来了两天算两位。"
  },
  {
    key: "sessions",
    label: "访问",
    hint: "一次访问在 30 分钟无活动后结束；关闭标签页后再来也是新的访问。"
  },
  {
    key: "avgEngagedSeconds",
    label: "平均停留",
    hint: "每次访问中页面实际可见的时间（切到其他标签页时不计）。"
  },
  {
    key: "bounceRate",
    label: "跳出率",
    hint: "只看了一个页面、而且停留不到 10 秒的访问所占的比例。越低越好。"
  }
];

const TREND_METRICS: { key: "views" | "visitors" | "sessions"; label: string }[] = [
  { key: "views", label: "浏览量" },
  { key: "visitors", label: "访客" },
  { key: "sessions", label: "访问" }
];

const number = new Intl.NumberFormat("zh-CN");

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
}

function formatKpi(key: KpiKey, value: number) {
  if (key === "avgEngagedSeconds") return formatSeconds(value);
  if (key === "bounceRate") return `${Math.round(value * 100)}%`;
  return number.format(value);
}

/** Change against the previous period: percent for counts, percentage points for the bounce rate. */
function change(key: KpiKey, current: number, previous: number) {
  if (key === "bounceRate") {
    const points = Math.round((current - previous) * 100);
    return { text: `${points > 0 ? "+" : ""}${points} 个百分点`, sign: Math.sign(points) };
  }
  if (!previous) return { text: current ? "新增" : "持平", sign: 0 };
  const percent = Math.round(((current - previous) / previous) * 100);
  return { text: `${percent > 0 ? "+" : ""}${percent}%`, sign: Math.sign(percent) };
}

export function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const range =
    ANALYTICS_RANGES.find((value) => value === params.get("range")) ?? ("7d" as AnalyticsRange);
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const meta = useQuery({ queryKey: ["admin", "analytics-meta"], queryFn: api.analyticsMeta });
  const overview = useQuery({
    queryKey: ["admin", "analytics-overview", range, from, to],
    queryFn: () => api.analyticsOverview(range, from, to),
    enabled: range !== "custom" || Boolean(from && to),
    refetchInterval: range === "today" ? 60_000 : false
  });

  const choose = (next: Record<string, string | null>) => {
    const value = new URLSearchParams(params);
    for (const [key, v] of Object.entries(next)) {
      if (v) value.set(key, v);
      else value.delete(key);
    }
    setParams(value, { replace: true });
  };

  const error = meta.error ?? overview.error;
  return (
    <>
      <PageHeader
        title="统计"
        description="个人主页的访问情况。不使用 Cookie、不保存 IP；只统计网站，不统计后台和登录后的你自己。"
        actions={
          overview.data ? (
            <span className="chip inline-flex items-center gap-1.5 self-center !text-[12px]">
              <span aria-hidden="true" className="size-2 rounded-full bg-status-ok" />
              当前在线 {overview.data.online}
            </span>
          ) : null
        }
      />

      {error ? (
        <DatabaseNotice error={error} subject="统计" />
      ) : (
        <div className="space-y-5">
          <RangePicker
            range={range}
            from={from}
            to={to}
            firstDay={meta.data?.firstDay ?? null}
            onChange={choose}
          />
          {meta.data && !meta.data.enabled ? (
            <p className="card p-4 text-[13px] text-muted">
              统计已关闭（<code className="chip">ANALYTICS_ENABLED=false</code>
              ），不再记录新的访问。
            </p>
          ) : null}
          {meta.data && !meta.data.firstDay ? (
            <p className="card p-6 text-[13.5px] leading-relaxed text-muted">
              还没有统计数据。网站有人访问后，这里会显示浏览量、访客和热门页面。
            </p>
          ) : overview.data ? (
            <Overview data={overview.data} />
          ) : range === "custom" && !(from && to) ? (
            <p className="text-[13px] text-muted">选择开始和结束日期。</p>
          ) : (
            <p className="text-[13px] text-subtle">加载中…</p>
          )}
          {meta.data ? (
            <p className="text-[12px] leading-relaxed text-faint">
              统计时区 {meta.data.timezone}；原始记录保留 {meta.data.retentionDays}{" "}
              天，之后只保留按天汇总的数字。国家来源：
              {meta.data.countrySource === "header"
                ? "代理请求头"
                : meta.data.countrySource === "geoip"
                  ? "GeoLite2 数据库"
                  : "未配置（ANALYTICS_COUNTRY_HEADER 或 ANALYTICS_GEOIP_DB）"}
              。
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}

function RangePicker({
  range,
  from,
  to,
  firstDay,
  onChange
}: {
  range: AnalyticsRange;
  from: string;
  to: string;
  firstDay: string | null;
  onChange: (next: Record<string, string | null>) => void;
}) {
  const today = new Date().toLocaleDateString("sv-SE");
  const [draft, setDraft] = useState({ from: from || firstDay || today, to: to || today });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="时间范围" className="flex flex-wrap gap-1">
        {ANALYTICS_RANGES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            className={
              range === value
                ? "rounded-full bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
                : "rounded-full px-3.5 py-1.5 text-[12.5px] text-brand hover:bg-brand-secondary/12"
            }
            onClick={() =>
              onChange(
                value === "custom"
                  ? { range: value, from: draft.from, to: draft.to }
                  : { range: value === "7d" ? null : value, from: null, to: null }
              )
            }
          >
            {RANGE_LABELS[value]}
          </button>
        ))}
      </div>
      {range === "custom" ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onChange({ range: "custom", from: draft.from, to: draft.to });
          }}
        >
          <input
            type="date"
            aria-label="开始日期"
            className="field !w-auto !py-1.5"
            value={draft.from}
            max={draft.to}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          />
          <span className="text-muted">至</span>
          <input
            type="date"
            aria-label="结束日期"
            className="field !w-auto !py-1.5"
            value={draft.to}
            min={draft.from}
            max={today}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          />
          <button type="submit" className="btn-secondary !py-1.5">
            应用
          </button>
        </form>
      ) : null}
    </div>
  );
}

function Overview({ data }: { data: AnalyticsOverview }) {
  const { range } = data;
  const period = range.from === range.to ? range.from : `${range.from} 至 ${range.to}`;
  const previous =
    range.previousFrom === range.previousTo
      ? range.previousFrom
      : `${range.previousFrom} 至 ${range.previousTo}`;
  return (
    <>
      <section aria-label="核心指标" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {KPIS.map(({ key, label, hint }) => {
          const delta = change(key, data.current[key], data.previous[key]);
          // A higher bounce rate is worse; everything else is better higher.
          const good = key === "bounceRate" ? -delta.sign : delta.sign;
          return (
            <div key={key} className="card p-4" title={hint}>
              <p className="text-[12px] text-muted">{label}</p>
              <p className="mt-1 text-[22px] font-semibold text-brand-dark">
                {formatKpi(key, data.current[key])}
              </p>
              <p
                className={`mt-1 text-[12px] ${good > 0 ? "text-status-ok" : good < 0 ? "text-status-error" : "text-faint"}`}
              >
                {delta.sign > 0 ? "▲ " : delta.sign < 0 ? "▼ " : ""}
                {delta.text}
                <span className="text-faint">（上期 {formatKpi(key, data.previous[key])}）</span>
              </p>
            </div>
          );
        })}
      </section>
      <p className="text-[12px] text-faint">
        {period}，与上期 {previous}
        {range.range === "today" ? " 的同一时段" : ""}比较。把鼠标停在指标上可以看口径。
      </p>

      <Trend data={data} />
      <TopPages pages={data.topPages} />
    </>
  );
}

function Trend({ data }: { data: AnalyticsOverview }) {
  const [metric, setMetric] = useState<(typeof TREND_METRICS)[number]["key"]>("views");
  const [hover, setHover] = useState<number | null>(null);
  const points = data.trend.points;
  const hourly = data.trend.bucket === "hour";
  const label = (point: AnalyticsTrendPoint) => (hourly ? `${point.key}:00` : point.key.slice(5));
  const max = Math.max(1, ...points.map((point) => point[metric]));
  const top = niceMax(max);

  const width = 720;
  const height = 220;
  const pad = { left: 36, right: 8, top: 12, bottom: 26 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / points.length;
  const barW = Math.max(2, Math.min(28, slot - 2));
  const y = (value: number) => pad.top + plotH - (value / top) * plotH;
  const ticks = [0, top / 2, top];
  const every = Math.ceil(points.length / 12);
  const metricLabel = TREND_METRICS.find((m) => m.key === metric)!.label;
  const shown = hover !== null ? points[hover] : null;

  return (
    <section className="card p-4" aria-label="访问趋势">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-[14px] font-semibold text-brand-dark">
          {hourly ? "按小时" : "按天"}的{metricLabel}
        </h2>
        <div role="group" aria-label="指标" className="flex gap-1">
          {TREND_METRICS.map(({ key, label: text }) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
              className={
                metric === key
                  ? "chip !px-2.5 !py-1.5 font-semibold"
                  : "rounded-md px-2.5 py-1.5 text-[11px] text-muted hover:bg-brand-secondary/8"
              }
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`${metricLabel}趋势，最高 ${max}`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-line-soft)"
              />
              <text
                x={pad.left - 6}
                y={y(tick) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--color-faint)"
              >
                {number.format(tick)}
              </text>
            </g>
          ))}
          {points.map((point, index) => {
            const x = pad.left + index * slot + (slot - barW) / 2;
            const value = point[metric];
            const h = Math.max(0, y(0) - y(value));
            return (
              <g key={point.key}>
                {h > 0 ? (
                  <path
                    d={roundedTop(x, y(value), barW, h, Math.min(4, barW / 2, h))}
                    fill={
                      hover === null || hover === index
                        ? "var(--color-brand-secondary)"
                        : "color-mix(in srgb, var(--color-brand-secondary) 45%, white)"
                    }
                  />
                ) : null}
                {index % every === 0 ? (
                  <text
                    x={pad.left + index * slot + slot / 2}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--color-faint)"
                  >
                    {label(point)}
                  </text>
                ) : null}
                {/* Hit area: the whole column, wider than the bar. */}
                <rect
                  x={pad.left + index * slot}
                  y={pad.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(index)}
                />
              </g>
            );
          })}
        </svg>
        {shown ? (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-card"
            style={{
              left: `${((pad.left + hover! * slot + slot / 2) / width) * 100}%`,
              transform: hover! > points.length / 2 ? "translateX(-105%)" : "translateX(5%)"
            }}
          >
            <p className="font-semibold text-brand-dark">
              {hourly ? `${shown.key}:00` : shown.key}
            </p>
            {TREND_METRICS.map(({ key, label: text }) => (
              <p key={key} className={key === metric ? "text-ink" : "text-muted"}>
                {text} {number.format(shown[key])}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <details className="mt-2 text-[12.5px] text-muted">
        <summary className="cursor-pointer text-faint">数据表</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-faint">
              <th className="py-1 font-normal">{hourly ? "小时" : "日期"}</th>
              {TREND_METRICS.map(({ key, label: text }) => (
                <th key={key} className="py-1 text-right font-normal">
                  {text}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.key} className="border-t border-line-soft">
                <td className="py-1">{hourly ? `${point.key}:00` : point.key}</td>
                {TREND_METRICS.map(({ key }) => (
                  <td key={key} className="py-1 text-right tabular-nums">
                    {number.format(point[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function TopPages({ pages }: { pages: AnalyticsOverview["topPages"] }) {
  const most = Math.max(1, ...pages.map((page) => page.views));
  return (
    <section className="card p-4" aria-label="热门页面">
      <h2 className="mb-3 text-[14px] font-semibold text-brand-dark">热门页面</h2>
      {pages.length ? (
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[12px] text-faint">
              <th className="pb-2 font-normal">页面</th>
              <th className="pb-2 text-right font-normal">浏览量</th>
              <th className="hidden pb-2 text-right font-normal sm:table-cell">平均停留</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.path} className="border-t border-line-soft">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-[88px] text-ink">
                      {PAGE_NAMES[page.path] ?? page.path}
                    </span>
                    <span className="hidden h-1.5 flex-1 rounded-full bg-line-soft sm:block">
                      <span
                        className="block h-full rounded-full bg-brand-secondary"
                        style={{ width: `${(page.views / most) * 100}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td className="py-2 text-right tabular-nums">{number.format(page.views)}</td>
                <td className="hidden py-2 text-right text-muted tabular-nums sm:table-cell">
                  {formatSeconds(page.avgEngagedSeconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-[13px] text-muted">这段时间没有页面浏览。</p>
      )}
    </section>
  );
}

/** A round number at or above the maximum, so the axis reads 0 / half / top. */
function niceMax(max: number) {
  if (max <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= max)!;
  return step * magnitude;
}

/** A bar with rounded top corners, anchored flat on the baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
