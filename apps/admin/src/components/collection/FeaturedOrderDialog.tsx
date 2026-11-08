import type { AdminMediaItem } from "@liam-frost/shared";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "../layout/AdminLayout";

import { useCollectionSettings, useSetMediaItem } from "../../hooks/useMedia";
import { api } from "../../lib/api";
import { COLLECTION_KIND_LABELS, pickText } from "../../lib/i18n";
import { Dialog } from "../ui/Dialog";
import { IconButton } from "../ui/IconButton";
import { useToast } from "../ui/Toast";
import { tr } from "../../lib/messages";

/** Fixed order first; entries never ordered after them, newest first (as the site does). */
export function featuredInOrder(items: AdminMediaItem[]) {
  return items
    .filter((item) => item.featured)
    .sort(
      (a, b) =>
        (a.featuredOrder ?? Infinity) - (b.featuredOrder ?? Infinity) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.id.localeCompare(b.id)
    );
}

const kindLabel = (kind: string) =>
  COLLECTION_KIND_LABELS[kind as keyof typeof COLLECTION_KIND_LABELS] ??
  (kind === "album" ? tr("专辑") : kind);

/**
 * The home page's featured entries in the fixed order: drag a row or use the arrows, then save. The
 * order is used when 显示设置 → 首页精选 is 固定顺序; the wall's row budget controls visibility.
 */
export function FeaturedOrderDialog({
  items,
  onClose,
  page = false
}: {
  items: AdminMediaItem[];
  onClose: () => void;
  page?: boolean;
}) {
  const [order, setOrder] = useState(() => featuredInOrder(items));
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState("");
  const { data: settings } = useCollectionSettings();
  const setItem = useSetMediaItem();
  const toast = useToast();
  const manual = settings?.settings.homeFeatured === "fixed";
  const dirty =
    order.map((item) => item.id).join("|") !==
    featuredInOrder(items)
      .map((item) => item.id)
      .join("|");
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const visibleOrder = order
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        (!kind || item.kind === kind) &&
        (!filter.trim() ||
          [pickText(item.title), ...item.credits]
            .join(" ")
            .toLowerCase()
            .includes(filter.trim().toLowerCase()))
    );

  const move = (from: number, to: number) => {
    if (saving || to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setOrder(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { items: saved } = await api.setFeaturedOrder(order.map((item) => item.id));
      saved.forEach(setItem);
      toast(tr("已保存首页精选顺序"));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr("保存失败"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FeaturedFrame
      page={page}
      title={tr("首页精选")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr("取消")}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={saving || !order.length || !dirty}
          >
            {saving ? tr("保存中…") : tr("保存顺序")}
          </button>
        </>
      }
    >
      {dirty && (
        <p className="mb-3 text-xs font-medium text-brand">
          {tr("有未保存的顺序调整，保存后才会更新首页。")}
        </p>
      )}
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
        {tr(
          "{0}拖动或用箭头调整顺序。在条目的编辑页打开“首页精选”可以加入这里。",
          manual
            ? tr("精选墙严格按这里的顺序分行；隐藏的条目会跳过，超出展示行数的条目暂不显示。")
            : tr(
                "现在使用轮换（每天、每次访问或每个浏览会话），会混排音乐与其他收藏。要使用这里的顺序，请在“显示设置”里选择“固定”。"
              )
        )}
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex-1 text-xs text-muted">
          {tr("查找精选")}
          <input
            className="field mt-1"
            placeholder={tr("标题 / 艺人")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted">
          {tr("类型")}
          <select className="field mt-1" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{tr("全部类型")}</option>
            {[...new Set(order.map((i) => i.kind))].map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-muted">
          {tr("共 {0} 项 · 筛选不改变完整排序", order.length)}
        </span>
      </div>
      {visibleOrder.length ? (
        <ol className="space-y-1.5">
          {visibleOrder.map(({ item, index }) => {
            const title = pickText(item.title, item.originalTitle ?? item.id);
            return (
              <li
                key={item.id}
                draggable={!saving}
                onDragStart={(e) => {
                  setDragId(item.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => {
                  if (dragId && dragId !== item.id) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  move(
                    order.findIndex((i) => i.id === dragId),
                    index
                  );
                  setDragId(null);
                }}
                className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 ring-1 ring-line-soft ${
                  dragId === item.id ? "opacity-40" : ""
                }`}
              >
                <GripVertical
                  aria-hidden="true"
                  className="size-4 shrink-0 cursor-grab text-muted"
                />
                <span className="w-5 shrink-0 text-center text-[12px] text-muted tabular-nums">
                  {index + 1}
                </span>
                {item.poster ? (
                  <img
                    src={item.poster.variants[0]?.url}
                    alt=""
                    className="h-10 w-7 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="h-10 w-7 shrink-0 rounded bg-line-soft" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{title}</span>
                  <span className="block text-[11.5px] text-muted">
                    {kindLabel(item.kind)}
                    {item.visibility === "private" ? tr(" · 隐藏") : ""}
                  </span>
                </span>
                <label className="hidden items-center gap-1 text-xs text-muted sm:flex">
                  {tr("移至")}
                  <input
                    aria-label={tr("移动 {0} 到序号", title)}
                    type="number"
                    min={1}
                    max={order.length}
                    key={`${item.id}-${index}`}
                    defaultValue={index + 1}
                    disabled={saving}
                    className="field !w-20"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isInteger(n) && n >= 1 && n <= order.length) move(index, n - 1);
                      else e.target.value = String(index + 1);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn-secondary !px-2"
                  disabled={saving || index === 0}
                  onClick={() => move(index, 0)}
                  aria-label={tr("置顶 {0}", title)}
                >
                  {tr("置顶")}
                </button>
                <IconButton
                  label={tr("上移 {0}", title)}
                  onClick={() => move(index, index - 1)}
                  disabled={saving || index === 0}
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </IconButton>
                <IconButton
                  label={tr("下移 {0}", title)}
                  onClick={() => move(index, index + 1)}
                  disabled={saving || index === order.length - 1}
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </IconButton>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-[13px] text-muted">
          {order.length
            ? tr("没有符合筛选的精选条目。可清空搜索或切回全部类型。")
            : tr("还没有首页精选的条目。")}
        </p>
      )}
    </FeaturedFrame>
  );
}

function FeaturedFrame({
  page,
  title,
  onClose,
  footer,
  children
}: {
  page: boolean;
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  if (!page)
    return (
      <Dialog open size="lg" title={title} onClose={onClose} footer={footer}>
        {children}
      </Dialog>
    );
  return (
    <>
      <PageHeader
        title={title}
        description={tr("直接管理全部精选顺序。搜索、类型过滤、拖动、置顶或输入序号快速定位。")}
      />
      <div className="card p-4 sm:p-5">{children}</div>
      <div className="sticky bottom-3 mt-4 flex justify-end gap-3 rounded-xl border border-line bg-surface p-3 shadow-card">
        {footer}
      </div>
    </>
  );
}
