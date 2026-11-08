import LoadingSkeleton from "../../../../web/src/components/LoadingSkeleton";
import {
  ANALYTICS_CONTENT_TYPES,
  type AnalyticsContentItem,
  type AnalyticsContentType
} from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";

import { api } from "../../lib/api";
import { BarList, Card, CONTENT_TYPES, MEDIA_KINDS, number, useRange } from "./common";
import { tr } from "../../lib/messages";

const PLAYERS: Record<string, string> = { site: tr("网站播放器"), spotify: tr("Spotify 播放器") };
const PLAY_SOURCES: Record<string, string> = {
  button: tr("歌曲上的播放按钮"),
  all: tr("播放全部"),
  dock: tr("播放器自己切歌 / 播放")
};
const POSITIONS: Record<string, string> = {
  contact: tr("首页联系方式"),
  project_links: tr("项目链接"),
  project_body: tr("项目正文"),
  media_source: tr("收藏条目的资料来源"),
  listen: tr("收听链接"),
  person_links: tr("人物链接"),
  player: tr("播放器")
};
const FILTER_TABS: Record<string, string> = {
  ...MEDIA_KINDS,
  people: tr("人物"),
  review: tr("回顾"),
  all: tr("全部")
};
const VIEWS: Record<string, string> = {
  grid: tr("封面"),
  list: tr("列表"),
  albums: tr("专辑"),
  artists: tr("艺人"),
  playlists: tr("歌单")
};

export function itemLabel(item: Pick<AnalyticsContentItem, "type" | "kind">) {
  return item.type === "media" && item.kind
    ? (MEDIA_KINDS[item.kind] ?? tr("收藏"))
    : CONTENT_TYPES[item.type];
}

/** Which content was opened and played, and where visitors clicked away. */
export function ContentView() {
  const { range, from, to, ready, query } = useRange();
  const [type, setType] = useState<AnalyticsContentType | "all">("all");
  const { data, error } = useQuery({
    queryKey: ["admin", "analytics-content", range, from, to],
    queryFn: () => api.analyticsContent(range, from, to),
    enabled: ready
  });
  if (error) return <p className="text-[13px] text-status-error">{error.message}</p>;
  if (!data) return <LoadingSkeleton label={tr("加载统计…")} count={3} />;
  const items = data.items.filter((item) => type === "all" || item.type === type);

  return (
    <>
      <div className="mb-4 rounded-xl border border-line bg-surface p-4 text-[13px] leading-relaxed text-muted">
        <strong className="text-brand-dark">{tr("测试访问为什么没有记录？")}</strong>
        <p>
          {tr(
            "已登录管理员的访问、开启 DNT / GPC 的浏览器、自动化浏览器及排除 IP 均不计入访客数据。请使用未登录的独立浏览器进行验证；不要为测试关闭隐私保护。内容排行统计打开详情，不统计仅看见卡片。播放器内置示例曲目不计入收藏内容，Spotify 内嵌页面内部操作也无法完整观测。请同时检查统计开关与日期范围。"
          )}
        </p>
      </div>
      <Card
        title={tr("内容排行")}
        hint={tr(
          "点击播放：本站歌曲按钮请求，播放全部只计首个可播放曲目；不含暂停。播放/载入保留原口径，不代表Spotify实际收听。旧记录无法还原点击次数。"
        )}
        actions={
          <div role="group" aria-label={tr("类型")} className="flex flex-wrap gap-1">
            {(["all", ...ANALYTICS_CONTENT_TYPES] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => setType(value)}
                className={
                  type === value
                    ? "chip chip-lg font-semibold"
                    : "rounded-md px-2.5 py-1.5 text-[11px] text-muted hover:bg-brand-secondary/8"
                }
              >
                {value === "all" ? tr("全部") : CONTENT_TYPES[value]}
              </button>
            ))}
          </div>
        }
      >
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-faint">
                  <th className="pb-2 font-normal">{tr("内容")}</th>
                  <th className="pb-2 font-normal">{tr("类型")}</th>
                  <th className="pb-2 text-right font-normal">{tr("浏览")}</th>
                  <th className="pb-2 text-right font-normal">{tr("访客")}</th>
                  <th className="pb-2 text-right font-normal">{tr("点击播放")}</th>
                  <th className="pb-2 text-right font-normal">{tr("播放 / 载入")}</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 100).map((item) => (
                  <tr key={`${item.type}:${item.id}`} className="border-t border-line-soft">
                    <td className="max-w-[320px] py-2 pr-3">
                      <Link
                        to={`/analytics/content/${item.type}/${encodeURIComponent(item.id)}?${query}`}
                        className="block truncate text-brand hover:underline"
                      >
                        {item.name || item.id}
                      </Link>
                      {item.removed ? (
                        <span className="text-[11px] text-faint">{tr("已隐藏或删除")}</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-muted">{itemLabel(item)}</td>
                    <td className="py-2 text-right tabular-nums">{number.format(item.views)}</td>
                    <td className="py-2 text-right text-muted tabular-nums">
                      {number.format(item.visitors)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {item.type === "media" && item.kind === "track"
                        ? number.format(item.requests ?? 0)
                        : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {item.type === "media" && item.kind === "track"
                        ? number.format(item.plays)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-muted">{tr("这段时间没有打开过这类内容。")}</p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title={tr("播放器")}
          hint={tr(
            "网站播放器在歌曲开始时计一次（暂停后继续不算）；Spotify 统计从本站请求载入曲目，不代表已经实际播放；内嵌页面内部播放无法完整观测。"
          )}
        >
          <BarList
            rows={data.players}
            label={(key) => PLAYERS[key] ?? key}
            empty={tr("没有播放。")}
          />
        </Card>
        <Card title={tr("播放从哪里开始")}>
          <BarList
            rows={data.playSources}
            label={(key) => PLAY_SOURCES[key] ?? key}
            empty={tr("没有播放。")}
          />
        </Card>
        <Card
          title={tr("外链点击")}
          hint={tr("点开指向其他网站的链接（左键和中键）；右键菜单“在新标签页打开”看不到。")}
        >
          <BarList rows={data.outbound} empty={tr("没有外链点击。")} />
        </Card>
        <Card title={tr("外链所在位置")}>
          <BarList
            rows={data.outboundPositions}
            label={(key) => POSITIONS[key] ?? key}
            otherLabel={tr("未标注的位置")}
            empty={tr("没有外链点击。")}
          />
        </Card>
        <Card
          title={tr("收藏页切换")}
          hint={tr("访客主动切换的标签和视图；打开页面时默认的那个不算。")}
        >
          <BarList
            rows={data.filters}
            label={(key) => {
              const [tab, view] = key.split(":");
              return [FILTER_TABS[tab!] ?? tab, view ? (VIEWS[view] ?? view) : null]
                .filter(Boolean)
                .join(" · ");
            }}
            empty={tr("没有切换。")}
          />
        </Card>
      </div>
    </>
  );
}
