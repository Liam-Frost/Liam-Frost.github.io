import type { AnalyticsKpis, AnalyticsOverview } from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../lib/api";
import {
  Card,
  changeText,
  ColumnChart,
  formatSeconds,
  number,
  PAGE_NAMES,
  useRange
} from "./common";
import { InfoTip } from "../ui/Tooltip";

type KpiKey = keyof AnalyticsKpis;
export const KPIS: { key: KpiKey; label: string; hint: string }[] = [
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

function formatKpi(key: KpiKey, value: number) {
  if (key === "avgEngagedSeconds") return formatSeconds(value);
  if (key === "bounceRate") return `${Math.round(value * 100)}%`;
  return number.format(value);
}

/** Change against the previous period: percent for counts, percentage points for the bounce rate. */
function change(key: KpiKey, current: number, previous: number) {
  if (key !== "bounceRate") return changeText(current, previous);
  const points = Math.round((current - previous) * 100);
  return { text: `${points > 0 ? "+" : ""}${points} 个百分点`, sign: Math.sign(points) };
}

export function useOverview() {
  const { range, from, to, ready } = useRange();
  return useQuery({
    queryKey: ["admin", "analytics-overview", range, from, to],
    queryFn: () => api.analyticsOverview(range, from, to),
    enabled: ready,
    refetchInterval: range === "today" ? 60_000 : false
  });
}

export function OverviewView({ data }: { data: AnalyticsOverview }) {
  const { range } = data;
  const span = (a: string, b: string) => (a === b ? a : `${a} 至 ${b}`);
  const hourly = data.trend.bucket === "hour";
  return (
    <>
      <section aria-label="核心指标" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {KPIS.map(({ key, label, hint }) => {
          const delta = change(key, data.current[key], data.previous[key]);
          // A higher bounce rate is worse; everything else is better higher.
          const good = key === "bounceRate" ? -delta.sign : delta.sign;
          return (
            <div key={key} className="card p-4">
              <p className="flex items-center gap-1 text-[12px] text-muted">
                {label}
                <InfoTip text={hint} label={`${label}：口径`} />
              </p>
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
        {span(range.from, range.to)}，与上期 {span(range.previousFrom, range.previousTo)}
        {range.range === "today" ? " 的同一时段" : ""}比较。把鼠标停在指标上可以看口径。
      </p>

      <ColumnChart
        title={(metric) => `${hourly ? "按小时" : "按天"}的${metric}`}
        metrics={[
          { key: "views", label: "浏览量" },
          { key: "visitors", label: "访客" },
          { key: "sessions", label: "访问" }
        ]}
        points={data.trend.points.map((point) => ({
          ...point,
          key: hourly ? `${point.key}:00` : point.key,
          label: hourly ? `${point.key}:00` : point.key.slice(5)
        }))}
      />

      <Card title="热门页面">
        {data.topPages.length ? (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[12px] text-faint">
                <th className="pb-2 font-normal">页面</th>
                <th className="pb-2 text-right font-normal">浏览量</th>
                <th className="hidden pb-2 text-right font-normal sm:table-cell">平均停留</th>
              </tr>
            </thead>
            <tbody>
              {data.topPages.map((page) => (
                <tr key={page.path} className="border-t border-line-soft">
                  <td className="py-2 pr-3">{PAGE_NAMES[page.path] ?? page.path}</td>
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
      </Card>
      <Card
        title="不存在的页面 · 实际路径"
        hint="仅记录路径，不保存查询参数；历史汇总无法还原路径。最多显示前100项。"
      >
        {data.missingPages?.length ? (
          <table className="w-full table-fixed text-left text-[13px]">
            <thead>
              <tr>
                <th className="py-2">请求路径</th>
                <th className="w-20 text-right">浏览量</th>
              </tr>
            </thead>
            <tbody>
              {data.missingPages.map((page) => (
                <tr key={page.path} className="border-t border-line-soft">
                  <td className="break-all py-2 pr-3 font-mono">{page.path}</td>
                  <td className="text-right tabular-nums">{number.format(page.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] text-muted">当前范围没有具体的不存在页面路径记录。</p>
        )}
      </Card>
    </>
  );
}
