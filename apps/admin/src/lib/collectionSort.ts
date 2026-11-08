import type { AdminMediaItem } from "@liam-frost/shared";
import { pickText } from "./i18n";

export const COLLECTION_SORTS = {
  updated: "最近修改",
  newest: "添加时间 · 新到旧",
  oldest: "添加时间 · 旧到新",
  title: "标题/拼音 · A → Z",
  "title-desc": "标题/拼音 · Z → A",
  year: "发行年份 · 新到旧",
  rating: "评分 · 高到低"
} as const;
export type CollectionSort = keyof typeof COLLECTION_SORTS;
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
/** Stable, non-mutating management ordering; missing ratings/years always sort last. */
export function sortCollection(items: AdminMediaItem[], sort: CollectionSort) {
  return [...items].sort((a, b) => {
    let result: number;
    switch (sort) {
      case "title":
      case "title-desc":
        result =
          collator.compare(
            pickText(a.title, a.originalTitle ?? ""),
            pickText(b.title, b.originalTitle ?? "")
          ) * (sort === "title-desc" ? -1 : 1);
        break;
      case "oldest":
        result = a.createdAt.localeCompare(b.createdAt);
        break;
      case "newest":
        result = b.createdAt.localeCompare(a.createdAt);
        break;
      case "year":
        result = (b.year ?? -Infinity) - (a.year ?? -Infinity);
        break;
      case "rating":
        result = (b.rating ?? -Infinity) - (a.rating ?? -Infinity);
        break;
      default:
        result = b.updatedAt.localeCompare(a.updatedAt);
    }
    return (Number.isNaN(result) ? 0 : result) || a.id.localeCompare(b.id);
  });
}
