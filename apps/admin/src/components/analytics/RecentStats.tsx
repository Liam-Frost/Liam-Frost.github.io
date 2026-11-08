import type { AnalyticsContentType } from "@liam-frost/shared";
import { useQuery } from "@tanstack/react-query";
import { ChartColumn } from "lucide-react";
import { Link } from "react-router";

import { api } from "../../lib/api";
import { number } from "./common";
import { Tooltip } from "../ui/Tooltip";
import { tr } from "../../lib/messages";

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
    <Tooltip content={tr("查看近 30 天的统计")} describe={false}>
      <Link
        to={`/analytics/content/${type}/${encodeURIComponent(id)}?range=30d`}
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12px] text-muted hover:bg-brand-secondary/12 hover:text-brand"
      >
        <ChartColumn aria-hidden="true" className="size-3.5" />
        {tr(
          "近 30 天 {0} 次浏览{1}",
          number.format(counts.views),
          plays ? tr(" · {0} 次播放", number.format(counts.plays)) : ""
        )}
      </Link>
    </Tooltip>
  );
}
