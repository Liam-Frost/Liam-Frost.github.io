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

const PLAYERS: Record<string, string> = { site: "网站播放器", spotify: "Spotify 播放器" };
const PLAY_SOURCES: Record<string, string> = {
  button: "歌曲上的播放按钮",
  all: "播放全部",
  dock: "播放器自己切歌 / 播放"
};
const POSITIONS: Record<string, string> = {
  contact: "首页联系方式",
  project_links: "项目链接",
  project_body: "项目正文",
  media_source: "收藏条目的资料来源",
  listen: "收听链接",
  person_links: "人物链接",
  player: "播放器"
};
const FILTER_TABS: Record<string, string> = {
  ...MEDIA_KINDS,
  people: "人物",
  review: "回顾",
  all: "全部"
};
const VIEWS: Record<string, string> = {
  grid: "封面",
  list: "列表",
  albums: "专辑",
  artists: "艺人",
  playlists: "歌单"
};

export function itemLabel(item: Pick<AnalyticsContentItem, "type" | "kind">) {
  return item.type === "media" && item.kind
    ? (MEDIA_KINDS[item.kind] ?? "收藏")
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
  if (!data) return <p className="text-[13px] text-subtle">加载中…</p>;
  const items = data.items.filter((item) => type === "all" || item.type === type);

  return (
    <>
      <Card
        title="内容排行"
        hint="浏览：打开项目、照片、收藏条目、人物、歌单的次数；访客是每天人数之和；播放只对歌曲。"
        actions={
          <div role="group" aria-label="类型" className="flex flex-wrap gap-1">
            {(["all", ...ANALYTICS_CONTENT_TYPES] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => setType(value)}
                className={
                  type === value
                    ? "chip !px-2.5 !py-1.5 font-semibold"
                    : "rounded-md px-2.5 py-1.5 text-[11px] text-muted hover:bg-brand-secondary/8"
                }
              >
                {value === "all" ? "全部" : CONTENT_TYPES[value]}
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
                  <th className="pb-2 font-normal">内容</th>
                  <th className="pb-2 font-normal">类型</th>
                  <th className="pb-2 text-right font-normal">浏览</th>
                  <th className="pb-2 text-right font-normal">访客</th>
                  <th className="pb-2 text-right font-normal">播放</th>
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
                        <span className="text-[11px] text-faint">已隐藏或删除</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-muted">{itemLabel(item)}</td>
                    <td className="py-2 text-right tabular-nums">{number.format(item.views)}</td>
                    <td className="py-2 text-right text-muted tabular-nums">
                      {number.format(item.visitors)}
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
          <p className="text-[13px] text-muted">这段时间没有打开过这类内容。</p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title="播放器"
          hint="网站播放器在歌曲开始时计一次（暂停后继续不算）；Spotify 播放器在歌曲载入时计一次。"
        >
          <BarList rows={data.players} label={(key) => PLAYERS[key] ?? key} empty="没有播放。" />
        </Card>
        <Card title="播放从哪里开始">
          <BarList
            rows={data.playSources}
            label={(key) => PLAY_SOURCES[key] ?? key}
            empty="没有播放。"
          />
        </Card>
        <Card
          title="外链点击"
          hint="点开指向其他网站的链接（左键和中键）；右键菜单“在新标签页打开”看不到。"
        >
          <BarList rows={data.outbound} empty="没有外链点击。" />
        </Card>
        <Card title="外链所在位置">
          <BarList
            rows={data.outboundPositions}
            label={(key) => POSITIONS[key] ?? key}
            otherLabel="未标注的位置"
            empty="没有外链点击。"
          />
        </Card>
        <Card title="收藏页切换" hint="访客主动切换的标签和视图；打开页面时默认的那个不算。">
          <BarList
            rows={data.filters}
            label={(key) => {
              const [tab, view] = key.split(":");
              return [FILTER_TABS[tab!] ?? tab, view ? (VIEWS[view] ?? view) : null]
                .filter(Boolean)
                .join(" · ");
            }}
            empty="没有切换。"
          />
        </Card>
      </div>
    </>
  );
}
