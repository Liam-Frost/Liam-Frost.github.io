import type { AnalyticsAudience } from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../lib/api";
import { BarList, Card, PAGE_NAMES, useRange } from "./common";

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

const countryNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });
/** A two-letter code as a flag emoji and its Chinese name. */
function country(code: string) {
  const flag = String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  let name = code;
  try {
    name = countryNames.of(code) ?? code;
  } catch {
    // Not a known region code.
  }
  return `${flag} ${name}`;
}

/** Where visitors came from and who they are, in groups large enough not to single anyone out. */
export function AudienceView({ countrySource }: { countrySource: string }) {
  const { range, from, to, ready } = useRange();
  const { data, error } = useQuery({
    queryKey: ["admin", "analytics-audience", range, from, to],
    queryFn: () => api.analyticsAudience(range, from, to),
    enabled: ready
  });
  if (error) return <p className="text-[13px] text-status-error">{error.message}</p>;
  if (!data) return <p className="text-[13px] text-subtle">加载中…</p>;
  const other = `其他（每项少于 ${data.minGroupSize} 次访问）`;

  return (
    <>
      <p className="text-[12px] text-faint">
        以下按访问计，共 {data.sessions} 次。少于 {data.minGroupSize}{" "}
        次访问的来源、国家和推广参数合并为“其他”，避免认出个别访客。
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="来源类型">
          <BarList rows={data.referrerGroups} label={(key) => GROUPS[key] ?? key} />
        </Card>
        <Card title="来源网站" hint="只保留域名；从本站内部跳转和直接打开的不算来源网站。">
          <BarList
            rows={data.referrers}
            label={(key) => key}
            otherLabel={other}
            empty="这段时间都是直接访问。"
          />
        </Card>
        <Card
          title="国家和地区"
          hint={countrySource === "none" ? "未配置国家来源，全部显示为“其他”。" : undefined}
        >
          <BarList
            rows={data.countries}
            label={country}
            otherLabel={countrySource === "none" ? "未知（未配置国家来源）" : `${other}或未知`}
          />
        </Card>
        <Card
          title="推广参数（utm_source）"
          hint="链接里带 utm_source / utm_medium / utm_campaign 时记录。"
        >
          <BarList rows={data.utmSources} otherLabel={`${other}或没有`} />
          {data.utmCampaigns.some((row) => row.key) ? (
            <div className="mt-3">
              <p className="mb-1 text-[12px] text-faint">utm_campaign</p>
              <BarList rows={data.utmCampaigns} otherLabel={`${other}或没有`} />
            </div>
          ) : null}
        </Card>
        <Card title="入口页面">
          <BarList rows={data.entries} label={(key) => PAGE_NAMES[key] ?? key} />
        </Card>
        <Card title="界面语言">
          <BarList rows={data.langs} label={(key) => LANGS[key] ?? key} otherLabel="未知" />
        </Card>
        <Card title="设备">
          <BarList rows={data.devices} label={(key) => DEVICES[key] ?? key} />
        </Card>
        <Card title="浏览器">
          <BarList rows={data.browsers} label={(key) => BROWSERS[key] ?? key} />
        </Card>
      </div>
      <Heatmap data={data} />
    </>
  );
}

function Heatmap({ data }: { data: AnalyticsAudience }) {
  const most = Math.max(1, ...data.heatmap.map((cell) => cell.views ?? 0));
  const cell = (weekday: number, hour: number) =>
    data.heatmap.find((c) => c.weekday === weekday && c.hour === hour);
  return (
    <Card
      title="活跃时段"
      hint={`按星期和小时的浏览量（统计时区）。访客少于 ${data.minGroupSize} 位的格子不显示数字。`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-separate border-spacing-[2px] text-[10px]">
          <thead>
            <tr>
              <th />
              {Array.from({ length: 24 }, (_, hour) => (
                <th key={hour} className="font-normal text-faint">
                  {hour % 3 === 0 ? hour : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 0].map((weekday) => (
              <tr key={weekday}>
                <th className="pr-1 text-right font-normal text-faint">周{WEEKDAYS[weekday]}</th>
                {Array.from({ length: 24 }, (_, hour) => {
                  const c = cell(weekday, hour);
                  const views = c?.views;
                  const label =
                    views === null
                      ? `周${WEEKDAYS[weekday]} ${hour}:00 访客太少`
                      : `周${WEEKDAYS[weekday]} ${hour}:00 浏览 ${views ?? 0}`;
                  return (
                    <td
                      key={hour}
                      title={label}
                      aria-label={label}
                      className="h-5 rounded-[3px]"
                      style={{
                        background:
                          views === null
                            ? "repeating-linear-gradient(45deg, var(--color-line-soft) 0 3px, transparent 3px 6px)"
                            : views
                              ? `color-mix(in srgb, var(--color-brand-secondary) ${15 + Math.round((views / most) * 85)}%, white)`
                              : "var(--color-line-soft)"
                      }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-faint">颜色越深浏览越多；斜线格子有访问但人数太少。</p>
    </Card>
  );
}
