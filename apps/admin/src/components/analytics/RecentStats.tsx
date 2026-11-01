import type { AnalyticsContentType } from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { ChartColumn } from "lucide-react";
import { Link } from "react-router";

import { api } from "../../lib/api";
import { number } from "./common";

/** Views and plays of one type in the last 30 days, shared by every editor and list of that type. */
export function useRecentCounts(type: AnalyticsContentType) {
  return useQuery({
    queryKey: ["admin", "analytics-counts", type],
    queryFn: () => api.analyticsCounts(type),
    staleTime: 5 * 60 * 1000,
    // Without a database or with analytics off this simply shows nothing.
    retry: false
  });
}

/** "近 30 天 12 次浏览", linking to the item's statistics; nothing when analytics is unavailable. */
export function RecentStats({
  type,
  id,
  plays = false
}: {
  type: AnalyticsContentType;
  id: string;
  /** Songs also show plays. */
  plays?: boolean;
}) {
  const { data } = useRecentCounts(type);
  if (!data) return null;
  const counts = data[id] ?? { views: 0, plays: 0 };
  return (
    <Link
      to={`/analytics/content/${type}/${encodeURIComponent(id)}?range=30d`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12px] text-muted hover:bg-brand-secondary/12 hover:text-brand"
      title="近 30 天的统计"
    >
      <ChartColumn aria-hidden="true" className="size-3.5" />近 30 天 {number.format(counts.views)}{" "}
      次浏览
      {plays ? ` · ${number.format(counts.plays)} 次播放` : ""}
    </Link>
  );
}
