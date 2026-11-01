import {
  ANALYTICS_RANGES,
  type AnalyticsContentType,
  type AnalyticsCount,
  type AnalyticsRange
} from "@liam-frost/shared";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

export const number = new Intl.NumberFormat("zh-CN");

export function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
}

/** Percent change, or 新增 / 持平 when there was nothing before. */
export function changeText(current: number, previous: number) {
  if (!previous) return { text: current ? "新增" : "持平", sign: 0 };
  const percent = Math.round(((current - previous) / previous) * 100);
  return { text: `${percent > 0 ? "+" : ""}${percent}%`, sign: Math.sign(percent) };
}

export const PAGE_NAMES: Record<string, string> = {
  "/": "首页",
  "/portfolio": "摄影",
  "/projects": "项目列表",
  "/projects/:slug": "项目详情",
  "/collection": "收藏",
  "/privacy": "隐私说明",
  "*": "不存在的页面"
};

export const CONTENT_TYPES: Record<AnalyticsContentType, string> = {
  project: "项目",
  photo: "照片",
  media: "收藏",
  person: "人物",
  playlist: "歌单"
};

export const MEDIA_KINDS: Record<string, string> = {
  movie: "电影",
  tv: "剧集",
  anime: "动漫",
  book: "图书",
  comic: "漫画",
  game: "游戏",
  track: "歌曲",
  album: "专辑"
};

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  today: "今天",
  "7d": "7 天",
  "30d": "30 天",
  "90d": "90 天",
  custom: "自定义"
};

/** The range in the address (?range=&from=&to=), shared by every view of the 统计 page. */
export function useRange() {
  const [params, setParams] = useSearchParams();
  const range =
    ANALYTICS_RANGES.find((value) => value === params.get("range")) ?? ("7d" as AnalyticsRange);
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const set = (next: Record<string, string | null>) => {
    const value = new URLSearchParams(params);
    for (const [key, v] of Object.entries(next)) {
      if (v) value.set(key, v);
      else value.delete(key);
    }
    setParams(value, { replace: true });
  };
  const query = new URLSearchParams({
    range,
    ...(range === "custom" && from && to ? { from, to } : {})
  }).toString();
  return { range, from, to, set, query, ready: range !== "custom" || Boolean(from && to) };
}

export function RangePicker({ firstDay }: { firstDay: string | null }) {
  const { range, from, to, set } = useRange();
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
              set(
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
            set({ range: "custom", from: draft.from, to: draft.to });
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

export function Card({
  title,
  hint,
  actions,
  children
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-4" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-[14px] font-semibold text-brand-dark" title={hint}>
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/**
 * A ranked list with a bar per row. Rows with key "" are the folded "other" group (`otherLabel`).
 * `label` names a key; `total` makes the bars a share of it.
 */
export function BarList({
  rows,
  label = (key) => key,
  otherLabel = "其他",
  empty = "没有数据。",
  limit = 10,
  unit = ""
}: {
  rows: AnalyticsCount[];
  label?: (key: string) => ReactNode;
  otherLabel?: string;
  empty?: string;
  limit?: number;
  unit?: string;
}) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className="text-[13px] text-muted">{empty}</p>;
  const most = Math.max(1, ...rows.map((row) => row.value));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <>
      <ul className="space-y-1.5 text-[13px]">
        {shown.map((row) => (
          <li key={row.key || "(other)"} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
            <span className="truncate text-ink">{row.key ? label(row.key) : otherLabel}</span>
            <span className="text-right text-muted tabular-nums">
              {number.format(row.value)}
              {unit}
              <span className="ml-1.5 inline-block w-9 text-faint">
                {Math.round((row.value / total) * 100)}%
              </span>
            </span>
            <span className="col-span-2 h-1.5 rounded-full bg-line-soft">
              <span
                className="block h-full rounded-full bg-brand-secondary"
                style={{ width: `${(row.value / most) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
      {rows.length > limit ? (
        <button
          type="button"
          className="mt-2 text-[12px] text-brand hover:underline"
          onClick={() => setAll(!all)}
        >
          {all ? "收起" : `显示全部 ${rows.length} 项`}
        </button>
      ) : null}
    </>
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

export type ChartPoint = { key: string; label: string } & Record<string, number | string>;

/**
 * Columns for one measure at a time (switch with the buttons), a tooltip with every measure of the
 * hovered column, and the numbers as a table.
 */
export function ColumnChart({
  title,
  points,
  metrics
}: {
  title: (metricLabel: string) => string;
  points: ChartPoint[];
  metrics: { key: string; label: string }[];
}) {
  const [metric, setMetric] = useState(metrics[0]!.key);
  const [hover, setHover] = useState<number | null>(null);
  const value = (point: ChartPoint, key: string) => Number(point[key] ?? 0);
  const max = Math.max(1, ...points.map((point) => value(point, metric)));
  const top = niceMax(max);

  const width = 720;
  const height = 220;
  const pad = { left: 36, right: 8, top: 12, bottom: 26 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(28, slot - 2));
  const y = (v: number) => pad.top + plotH - (v / top) * plotH;
  const every = Math.ceil(points.length / 12);
  const metricLabel = metrics.find((m) => m.key === metric)!.label;
  const shown = hover !== null ? points[hover] : null;

  return (
    <Card
      title={title(metricLabel)}
      actions={
        metrics.length > 1 ? (
          <div role="group" aria-label="指标" className="flex gap-1">
            {metrics.map(({ key, label }) => (
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
                {label}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`${metricLabel}，最高 ${max}`}
          onMouseLeave={() => setHover(null)}
        >
          {[0, top / 2, top].map((tick) => (
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
            const v = value(point, metric);
            const h = Math.max(0, y(0) - y(v));
            return (
              <g key={point.key}>
                {h > 0 ? (
                  <path
                    d={roundedTop(x, y(v), barW, h, Math.min(4, barW / 2, h))}
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
                    {point.label}
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
            <p className="font-semibold text-brand-dark">{shown.key}</p>
            {metrics.map(({ key, label }) => (
              <p key={key} className={key === metric ? "text-ink" : "text-muted"}>
                {label} {number.format(value(shown, key))}
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
              <th className="py-1 font-normal">时间</th>
              {metrics.map(({ key, label }) => (
                <th key={key} className="py-1 text-right font-normal">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.key} className="border-t border-line-soft">
                <td className="py-1">{point.key}</td>
                {metrics.map(({ key }) => (
                  <td key={key} className="py-1 text-right tabular-nums">
                    {number.format(value(point, key))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}
