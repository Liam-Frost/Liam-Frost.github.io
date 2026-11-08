import LoadingSkeleton from "../../../../web/src/components/LoadingSkeleton";
import type { AnalyticsAudience, AnalyticsCount } from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { Card, number, PAGE_NAMES, useRange } from "./common";
import { InfoTip, Tooltip } from "../ui/Tooltip";
import { intlLocale, tr } from "../../lib/messages";

// Presentation thresholds only: collection, aggregation and privacy thresholds are unchanged.
const SMALL_SAMPLE_SESSIONS = 20;
const INITIAL_CATEGORIES = 6;
const GROUPS: Record<string, string> = {
  search: tr("搜索引擎"),
  social: tr("社交平台"),
  code: tr("GitHub 等开发社区"),
  direct: tr("直接访问"),
  other: tr("其他网站")
};
const DEVICES: Record<string, string> = {
  desktop: tr("电脑"),
  mobile: tr("手机"),
  tablet: tr("平板")
};
const BROWSERS: Record<string, string> = {
  chrome: "Chrome",
  safari: "Safari",
  edge: "Edge",
  firefox: "Firefox",
  opera: "Opera",
  samsung: "Samsung Internet",
  other: tr("其他")
};
const LANGS: Record<string, string> = {
  zh: "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
  fr: "Français",
  ja: tr("日本語")
};
const WEEKDAYS = [tr("日"), tr("一"), tr("二"), tr("三"), tr("四"), tr("五"), tr("六")];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const countryNames = new Intl.DisplayNames([intlLocale], { type: "region" });
function country(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  const flag = String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  try {
    return `${flag} ${countryNames.of(code) ?? code}`;
  } catch {
    return code;
  }
}

/** Each distribution uses its own complete set of counts as the percentage denominator. */
function Distribution({
  title,
  rows,
  label = (key) => key,
  other = tr("其他"),
  hint,
  small,
  empty = tr("当前范围没有记录。")
}: {
  title: string;
  rows: AnalyticsCount[];
  label?: (key: string) => string;
  other?: string;
  hint?: string;
  small: boolean;
  empty?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const ranked = rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  const total = ranked.reduce((sum, row) => sum + row.value, 0);
  const maximum = ranked[0]?.value ?? 1;
  const bars = !small && ranked.length > 1;
  return (
    <section className="min-w-0" aria-label={title}>
      <h3 className="mb-3 flex items-center gap-1 text-[12px] font-semibold text-brand-dark">
        {title}
        {hint && <InfoTip text={hint} label={tr("{0}：说明", title)} />}
      </h3>
      {!ranked.length ? (
        <p className="py-1 text-[12.5px] text-faint">{empty}</p>
      ) : (
        <>
          <ul className={bars ? "space-y-3" : "divide-y divide-line-soft"}>
            {(expanded ? ranked : ranked.slice(0, INITIAL_CATEGORIES)).map((row) => {
              const name = row.key ? label(row.key) : other;
              return (
                <li
                  key={row.key}
                  className={bars ? "text-[13px]" : "py-2 text-[13px] first:pt-0 last:pb-0"}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Tooltip content={name} className="min-w-0 flex-1">
                      <span
                        tabIndex={name.length > 30 ? 0 : undefined}
                        className="block truncate text-ink"
                      >
                        {name}
                      </span>
                    </Tooltip>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="font-medium text-brand-dark">
                        {number.format(row.value)}
                      </span>
                      <span className="ml-3 inline-block w-10 text-[11px] text-faint">
                        {Math.round((row.value / total) * 100)}%
                      </span>
                    </span>
                  </div>
                  {bars && (
                    <div aria-hidden="true" className="mt-1.5 h-1 rounded-full bg-line-soft">
                      <div
                        className="h-full rounded-full bg-brand-secondary/65"
                        style={{ width: `${(row.value / maximum) * 100}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {ranked.length > INITIAL_CATEGORIES && (
            <button
              className="mt-3 text-[12px] text-brand underline-offset-4 hover:underline"
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? tr("收起") : tr("显示全部 {0} 项", ranked.length)}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function AudienceView({ countrySource }: { countrySource: string }) {
  const { range, from, to, ready } = useRange();
  const { data, error, refetch } = useQuery({
    queryKey: ["admin", "analytics-audience", range, from, to],
    queryFn: () => api.analyticsAudience(range, from, to),
    enabled: ready
  });
  if (!ready) return <p className="text-[13px] text-muted">{tr("请选择完整的开始和结束日期。")}</p>;
  if (error)
    return (
      <div role="alert" className="card p-4 text-[13px]">
        <p className="text-status-error">{tr("无法加载来源与受众：{0}", error.message)}</p>
        <button className="btn-secondary mt-3" type="button" onClick={() => void refetch()}>
          {tr("重试")}
        </button>
      </div>
    );
  if (!data) return <LoadingSkeleton label={tr("加载来源与受众…")} count={4} />;
  return (
    <AudienceReport key={`${range}:${from}:${to}`} data={data} countrySource={countrySource} />
  );
}

function AudienceReport({
  data,
  countrySource
}: {
  data: AnalyticsAudience;
  countrySource: string;
}) {
  const small = data.sessions < SMALL_SAMPLE_SESSIONS;
  const other = tr("其他（每项少于 {0} 次访问）", data.minGroupSize);
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line pb-4">
        <div>
          <p className="text-[11.5px] text-faint">{tr("当前范围 · {0}", data.range.timezone)}</p>
          <p className="mt-1 text-[13px] text-brand-dark">
            {data.range.from} — {data.range.to}
          </p>
        </div>
        <div>
          <p className="text-[11.5px] text-faint">{tr("访问次数（会话）")}</p>
          <p className="mt-0.5 text-[25px] font-semibold text-brand-dark tabular-nums">
            {number.format(data.sessions)}
          </p>
        </div>
        <p className="max-w-md text-[12px] leading-relaxed text-muted">
          {tr(
            "以下分布按访问次数统计，不等同于浏览量或独立访客数。少于 {0} 次的来源、国家及推广参数合并显示。",
            data.minGroupSize
          )}
        </p>
      </div>
      {!data.sessions ? (
        <div className="card px-5 py-9 text-center">
          <h2 className="text-[15px] font-semibold text-brand-dark">
            {tr("当前时间范围内没有访问记录")}
          </h2>
          <p className="mt-2 text-[13px] text-muted">{tr("可切换时间范围查看已有数据。")}</p>
        </div>
      ) : (
        <>
          {small && (
            <p className="text-[12px] text-muted">
              {tr("当前样本较少，优先显示实际访问次数；百分比仅供参考。")}
            </p>
          )}
          <Card
            title={tr("访问来源")}
            hint={tr("各分布的比例以该分布全部已记录次数为分母；来源网站不包含直接访问。")}
          >
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
              <div className="min-w-0 border-b border-line-soft pb-5 lg:border-r lg:border-b-0 lg:pr-5 lg:pb-0">
                <Distribution
                  title={tr("来源类型")}
                  rows={data.referrerGroups}
                  label={(key) => GROUPS[key] ?? key}
                  small={small}
                />
              </div>
              <div className="grid min-w-0 gap-6 sm:grid-cols-2">
                <Distribution
                  title={tr("来源网站")}
                  rows={data.referrers}
                  other={other}
                  small={small}
                  empty={tr("没有外部来源网站记录，可能为直接访问。")}
                />
                <Distribution
                  title={tr("入口页面")}
                  rows={data.entries}
                  label={(key) => PAGE_NAMES[key] ?? key}
                  small={small}
                />
              </div>
            </div>
            <details className="mt-5 border-t border-line-soft pt-4">
              <summary className="cursor-pointer text-[12.5px] font-medium text-brand">
                {tr("推广参数 · UTM")}
              </summary>
              <p className="mt-2 text-[11.5px] text-faint">
                {tr(
                  "来自链接中的 utm_source、utm_medium 与 utm_campaign；合并项可能包含未填写的参数。"
                )}
              </p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                <Distribution
                  title={tr("UTM 来源")}
                  rows={data.utmSources}
                  other={tr("{0}或没有", other)}
                  small={small}
                />
                <Distribution
                  title={tr("UTM 媒介")}
                  rows={data.utmMediums}
                  other={tr("{0}或没有", other)}
                  small={small}
                />
                <Distribution
                  title={tr("UTM 活动")}
                  rows={data.utmCampaigns}
                  other={tr("{0}或没有", other)}
                  small={small}
                />
              </div>
            </details>
          </Card>
          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
            <Card title={tr("访问受众")}>
              <div className="grid min-w-0 gap-6 sm:grid-cols-2">
                <Distribution
                  title={tr("国家和地区")}
                  rows={data.countries}
                  label={country}
                  small={small}
                  other={
                    countrySource === "none" ? tr("未知（未配置国家来源）") : tr("{0}或未知", other)
                  }
                  hint={
                    countrySource === "none" ? tr("未配置国家来源，全部显示为未知。") : undefined
                  }
                />
                <Distribution
                  title={tr("界面语言")}
                  rows={data.langs}
                  label={(key) => LANGS[key] ?? key}
                  other={tr("未知")}
                  small={small}
                />
              </div>
            </Card>
            <Card title={tr("访问环境")}>
              <div className="grid min-w-0 gap-6 sm:grid-cols-2">
                <Distribution
                  title={tr("设备类型")}
                  rows={data.devices}
                  label={(key) => DEVICES[key] ?? key}
                  small={small}
                />
                <Distribution
                  title={tr("浏览器")}
                  rows={data.browsers}
                  label={(key) => BROWSERS[key] ?? key}
                  small={small}
                />
              </div>
            </Card>
          </div>
          <Card
            title={tr("活跃时段")}
            hint={tr(
              "按星期和小时统计浏览量（{0}）。访客少于 {1} 位的格子隐藏数值。",
              data.range.timezone,
              data.minGroupSize
            )}
          >
            {small ? (
              <details>
                <summary className="cursor-pointer text-[12.5px] text-brand">
                  {tr("样本较少，展开查看按小时的浏览量")}
                </summary>
                <div className="mt-4">
                  <Heatmap data={data} />
                </div>
              </details>
            ) : (
              <Heatmap data={data} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Heatmap({ data }: { data: AnalyticsAudience }) {
  const [active, setActive] = useState(0);
  const table = useRef<HTMLTableElement>(null);
  const maximum = Math.max(1, ...data.heatmap.map((cell) => cell.views ?? 0));
  const hasActivity = data.heatmap.some((cell) => cell.views === null || (cell.views ?? 0) > 0);
  if (!hasActivity)
    return <p className="text-[12.5px] text-faint">{tr("当前时间范围没有活跃时段记录。")}</p>;
  return (
    <>
      <div className="max-w-full overflow-x-auto pb-1">
        <table
          ref={table}
          className="w-full min-w-[660px] table-fixed border-separate border-spacing-[3px] text-[10px]"
          aria-label={tr("每周每小时浏览量，{0}", data.range.timezone)}
        >
          <colgroup>
            <col className="w-10" />
            {Array.from({ length: 24 }, (_, hour) => (
              <col key={hour} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="text-faint">
                {tr("星期")}
              </th>
              {Array.from({ length: 24 }, (_, hour) => (
                <th scope="col" key={hour} className="font-normal text-faint">
                  {hour % 3 === 0 ? (
                    `${String(hour).padStart(2, "0")}:00`
                  ) : (
                    <span className="sr-only">{hour}:00</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_ORDER.map((weekday, row) => (
              <tr key={weekday}>
                <th scope="row" className="text-right font-normal whitespace-nowrap text-faint">
                  {tr("周{0}", WEEKDAYS[weekday])}
                </th>
                {Array.from({ length: 24 }, (_, hour) => {
                  const cell = data.heatmap.find(
                    (value) => value.weekday === weekday && value.hour === hour
                  );
                  const views = cell?.views;
                  const index = row * 24 + hour;
                  const label = tr(
                    "周{0} {1}:00–{2}:00，{3}（{4}）",
                    WEEKDAYS[weekday],
                    hour,
                    hour + 1,
                    views === null ? tr("访客太少，数值已隐藏") : tr("浏览 {0} 次", views ?? 0),
                    data.range.timezone
                  );
                  return (
                    <td key={hour} className="p-0">
                      <Tooltip content={label} describe={false} className="block w-full">
                        <button
                          type="button"
                          data-cell={index}
                          tabIndex={active === index ? 0 : -1}
                          aria-label={label}
                          onFocus={() => setActive(index)}
                          onKeyDown={(event) => {
                            const next = {
                              ArrowLeft: index - 1,
                              ArrowRight: index + 1,
                              ArrowUp: index - 24,
                              ArrowDown: index + 24,
                              Home: row * 24,
                              End: row * 24 + 23
                            }[event.key];
                            if (next === undefined) return;
                            event.preventDefault();
                            const target = Math.max(0, Math.min(167, next));
                            setActive(target);
                            table.current
                              ?.querySelector<HTMLButtonElement>(`[data-cell="${target}"]`)
                              ?.focus();
                          }}
                          className="block h-5 w-full rounded-[3px]"
                          style={{
                            background:
                              views === null
                                ? "repeating-linear-gradient(45deg, var(--color-line-soft) 0 3px, transparent 3px 6px)"
                                : views
                                  ? `color-mix(in srgb, var(--color-brand-secondary) ${15 + Math.round((views / maximum) * 85)}%, white)`
                                  : "var(--color-line-soft)"
                          }}
                        />
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-faint">
        {tr("颜色越深，浏览量越多；斜线表示有访问但人数不足。聚焦格子后可用方向键移动。")}
      </p>
    </>
  );
}
