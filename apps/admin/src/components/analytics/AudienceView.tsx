import type { AnalyticsAudience, AnalyticsCount } from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { Card, number, PAGE_NAMES, useRange } from "./common";
import { InfoTip, Tooltip } from "../ui/Tooltip";

// Presentation thresholds only: collection, aggregation and privacy thresholds are unchanged.
const SMALL_SAMPLE_SESSIONS = 20;
const INITIAL_CATEGORIES = 6;
const GROUPS: Record<string, string> = {
  search: "搜索引擎",
  social: "社交平台",
  code: "GitHub 等开发社区",
  direct: "直接访问",
  other: "其他网站"
};
const DEVICES: Record<string, string> = { desktop: "电脑", mobile: "手机", tablet: "平板" };
const BROWSERS: Record<string, string> = {
  chrome: "Chrome",
  safari: "Safari",
  edge: "Edge",
  firefox: "Firefox",
  opera: "Opera",
  samsung: "Samsung Internet",
  other: "其他"
};
const LANGS: Record<string, string> = {
  zh: "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
  fr: "Français",
  ja: "日本語"
};
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const countryNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });
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
  other = "其他",
  hint,
  small,
  empty = "当前范围没有记录。"
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
        {hint && <InfoTip text={hint} label={`${title}：说明`} />}
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
              {expanded ? "收起" : `显示全部 ${ranked.length} 项`}
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
  if (!ready) return <p className="text-[13px] text-muted">请选择完整的开始和结束日期。</p>;
  if (error)
    return (
      <div role="alert" className="card p-4 text-[13px]">
        <p className="text-status-error">无法加载来源与受众：{error.message}</p>
        <button className="btn-secondary mt-3" type="button" onClick={() => void refetch()}>
          重试
        </button>
      </div>
    );
  if (!data)
    return (
      <p className="py-8 text-center text-[13px] text-subtle" role="status">
        加载来源与受众…
      </p>
    );
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
  const other = `其他（每项少于 ${data.minGroupSize} 次访问）`;
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line pb-4">
        <div>
          <p className="text-[11.5px] text-faint">当前范围 · {data.range.timezone}</p>
          <p className="mt-1 text-[13px] text-brand-dark">
            {data.range.from} — {data.range.to}
          </p>
        </div>
        <div>
          <p className="text-[11.5px] text-faint">访问次数（会话）</p>
          <p className="mt-0.5 text-[25px] font-semibold text-brand-dark tabular-nums">
            {number.format(data.sessions)}
          </p>
        </div>
        <p className="max-w-md text-[12px] leading-relaxed text-muted">
          以下分布按访问次数统计，不等同于浏览量或独立访客数。少于 {data.minGroupSize}{" "}
          次的来源、国家及推广参数合并显示。
        </p>
      </div>
      {!data.sessions ? (
        <div className="card px-5 py-9 text-center">
          <h2 className="text-[15px] font-semibold text-brand-dark">当前时间范围内没有访问记录</h2>
          <p className="mt-2 text-[13px] text-muted">可切换时间范围查看已有数据。</p>
        </div>
      ) : (
        <>
          {small && (
            <p className="text-[12px] text-muted">
              当前样本较少，优先显示实际访问次数；百分比仅供参考。
            </p>
          )}
          <Card
            title="访问来源"
            hint="各分布的比例以该分布全部已记录次数为分母；来源网站不包含直接访问。"
          >
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
              <div className="min-w-0 border-b border-line-soft pb-5 lg:border-r lg:border-b-0 lg:pr-5 lg:pb-0">
                <Distribution
                  title="来源类型"
                  rows={data.referrerGroups}
                  label={(key) => GROUPS[key] ?? key}
                  small={small}
                />
              </div>
              <div className="grid min-w-0 gap-6 sm:grid-cols-2">
                <Distribution
                  title="来源网站"
                  rows={data.referrers}
                  other={other}
                  small={small}
                  empty="没有外部来源网站记录，可能为直接访问。"
                />
                <Distribution
                  title="入口页面"
                  rows={data.entries}
                  label={(key) => PAGE_NAMES[key] ?? key}
                  small={small}
                />
              </div>
            </div>
            <details className="mt-5 border-t border-line-soft pt-4">
              <summary className="cursor-pointer text-[12.5px] font-medium text-brand">
                推广参数 · UTM
              </summary>
              <p className="mt-2 text-[11.5px] text-faint">
                来自链接中的 utm_source、utm_medium 与 utm_campaign；合并项可能包含未填写的参数。
              </p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                <Distribution
                  title="UTM 来源"
                  rows={data.utmSources}
                  other={`${other}或没有`}
                  small={small}
                />
                <Distribution
                  title="UTM 媒介"
                  rows={data.utmMediums}
                  other={`${other}或没有`}
                  small={small}
                />
                <Distribution
                  title="UTM 活动"
                  rows={data.utmCampaigns}
                  other={`${other}或没有`}
                  small={small}
                />
              </div>
            </details>
          </Card>
          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
            <Card title="访问受众">
              <div className="grid min-w-0 gap-6 sm:grid-cols-2">
                <Distribution
                  title="国家和地区"
                  rows={data.countries}
                  label={country}
                  small={small}
                  other={countrySource === "none" ? "未知（未配置国家来源）" : `${other}或未知`}
                  hint={countrySource === "none" ? "未配置国家来源，全部显示为未知。" : undefined}
                />
                <Distribution
                  title="界面语言"
                  rows={data.langs}
                  label={(key) => LANGS[key] ?? key}
                  other="未知"
                  small={small}
                />
              </div>
            </Card>
            <Card title="访问环境">
              <div className="grid min-w-0 gap-6 sm:grid-cols-2">
                <Distribution
                  title="设备类型"
                  rows={data.devices}
                  label={(key) => DEVICES[key] ?? key}
                  small={small}
                />
                <Distribution
                  title="浏览器"
                  rows={data.browsers}
                  label={(key) => BROWSERS[key] ?? key}
                  small={small}
                />
              </div>
            </Card>
          </div>
          <Card
            title="活跃时段"
            hint={`按星期和小时统计浏览量（${data.range.timezone}）。访客少于 ${data.minGroupSize} 位的格子隐藏数值。`}
          >
            {small ? (
              <details>
                <summary className="cursor-pointer text-[12.5px] text-brand">
                  样本较少，展开查看按小时的浏览量
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
    return <p className="text-[12.5px] text-faint">当前时间范围没有活跃时段记录。</p>;
  return (
    <>
      <div className="max-w-full overflow-x-auto pb-1">
        <table
          ref={table}
          className="w-full min-w-[660px] table-fixed border-separate border-spacing-[3px] text-[10px]"
          aria-label={`每周每小时浏览量，${data.range.timezone}`}
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
                星期
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
                  周{WEEKDAYS[weekday]}
                </th>
                {Array.from({ length: 24 }, (_, hour) => {
                  const cell = data.heatmap.find(
                    (value) => value.weekday === weekday && value.hour === hour
                  );
                  const views = cell?.views;
                  const index = row * 24 + hour;
                  const label = `周${WEEKDAYS[weekday]} ${hour}:00–${hour + 1}:00，${views === null ? "访客太少，数值已隐藏" : `浏览 ${views ?? 0} 次`}（${data.range.timezone}）`;
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
        颜色越深，浏览量越多；斜线表示有访问但人数不足。聚焦格子后可用方向键移动。
      </p>
    </>
  );
}
