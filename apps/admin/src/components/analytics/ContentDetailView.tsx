import type { AnalyticsContentType } from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import { api } from "../../lib/api";
import { BarList, Card, changeText, ColumnChart, number, useRange } from "./common";
import { itemLabel } from "./ContentView";

/** Where to edit a piece of content, for the types whose editor is addressed by the same id. */
const EDIT: Partial<Record<AnalyticsContentType, (id: string) => string>> = {
  media: (id) => `/collection/${encodeURIComponent(id)}`,
  person: (id) => `/people/${encodeURIComponent(id)}`
};

export function ContentDetailView({ type, id }: { type: AnalyticsContentType; id: string }) {
  const { range, from, to, ready, query } = useRange();
  const { data, error } = useQuery({
    queryKey: ["admin", "analytics-content-detail", type, id, range, from, to],
    queryFn: () => api.analyticsContentDetail(type, id, range, from, to),
    enabled: ready
  });
  const back = (
    <Link
      to={`/analytics/content?${query}`}
      className="inline-flex items-center gap-1 text-[13px] text-brand hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      内容排行
    </Link>
  );
  if (error)
    return (
      <>
        {back}
        <p className="text-[13px] text-muted">这项内容还没有统计数据。</p>
      </>
    );
  if (!data) return <p className="text-[13px] text-subtle">加载中…</p>;
  const { item } = data;
  const isSong = item.type === "media" && item.kind === "track";
  const kpis = [
    { label: "浏览", current: item.views, previous: data.previous.views },
    { label: "访客", current: item.visitors, previous: data.previous.visitors },
    ...(isSong ? [{ label: "播放", current: item.plays, previous: data.previous.plays }] : [])
  ];
  const edit = EDIT[item.type];

  return (
    <>
      {back}
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-[18px] font-semibold text-brand-dark">{item.name || item.id}</h2>
        <span className="chip">{itemLabel(item)}</span>
        {item.removed ? <span className="text-[12px] text-faint">已隐藏或删除</span> : null}
        {edit && !item.removed ? (
          <Link to={edit(item.id)} className="text-[12px] text-brand hover:underline">
            编辑
          </Link>
        ) : null}
      </div>

      <section aria-label="指标" className="grid gap-3 sm:grid-cols-3">
        {kpis.map(({ label, current, previous }) => {
          const delta = changeText(current, previous);
          return (
            <div key={label} className="card p-4">
              <p className="text-[12px] text-muted">{label}</p>
              <p className="mt-1 text-[22px] font-semibold text-brand-dark">
                {number.format(current)}
              </p>
              <p className="mt-1 text-[12px] text-faint">
                {delta.text}（上期 {number.format(previous)}）
              </p>
            </div>
          );
        })}
      </section>

      <ColumnChart
        title={(metric) => `按天的${metric}`}
        // Songs are played rather than opened: start with plays.
        metrics={[
          ...(isSong ? [{ key: "plays", label: "播放" }] : []),
          { key: "views", label: "浏览" },
          { key: "visitors", label: "访客" }
        ]}
        points={data.trend.map((point) => ({ ...point, label: point.key.slice(5) }))}
      />

      <Card
        title="这些访问从哪里来"
        hint="打开过它的访问的来源网站；只算原始记录还在保留期内的日子。"
      >
        <BarList
          rows={data.referrers}
          label={(key) => key}
          otherLabel="直接访问或未知"
          empty="没有来源记录。"
        />
      </Card>
    </>
  );
}
