import type { AdminMediaItem } from "@liam-frost/shared";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useState } from "react";

import { useCollectionSettings, useSetMediaItem } from "../../hooks/useMedia";
import { api } from "../../lib/api";
import { COLLECTION_KIND_LABELS, pickText } from "../../lib/i18n";
import { Dialog } from "../ui/Dialog";
import { IconButton } from "../ui/IconButton";
import { useToast } from "../ui/Toast";

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
  (kind === "album" ? "专辑" : kind);

/**
 * The home page's featured entries in the fixed order: drag a row or use the arrows, then save. The
 * order is used when 显示设置 → 首页精选 is 固定顺序; the first three show.
 */
export function FeaturedOrderDialog({
  items,
  onClose
}: {
  items: AdminMediaItem[];
  onClose: () => void;
}) {
  const [order, setOrder] = useState(() => featuredInOrder(items));
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: settings } = useCollectionSettings();
  const setItem = useSetMediaItem();
  const toast = useToast();
  const manual = settings?.settings.homeFeatured === "manual";

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
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
      toast("已保存首页精选顺序");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      size="sm"
      title="首页精选"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={saving || !order.length}
          >
            {saving ? "保存中…" : "保存顺序"}
          </button>
        </>
      }
    >
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
        {manual
          ? "精选墙严格按这里的顺序分行；隐藏的条目会跳过，超出展示行数的条目暂不显示。"
          : "现在使用自动轮换：每天稳定轮换并混排音乐与其他收藏。要使用这里的顺序，请在“显示设置”里选择固定顺序。"}
        拖动或用箭头调整顺序。在条目的编辑页打开“首页精选”可以加入这里。
      </p>
      {order.length ? (
        <ol className="space-y-1.5">
          {order.map((item, index) => {
            const title = pickText(item.title, item.originalTitle ?? item.id);
            return (
              <li
                key={item.id}
                draggable
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
                } ${manual && index < 3 ? "bg-brand-secondary/6" : ""}`}
              >
                <GripVertical
                  aria-hidden="true"
                  className="size-4 shrink-0 cursor-grab text-faint"
                />
                <span className="w-5 shrink-0 text-center text-[12px] text-faint tabular-nums">
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
                  <span className="block text-[11.5px] text-faint">
                    {kindLabel(item.kind)}
                    {item.visibility === "private" ? " · 隐藏" : ""}
                  </span>
                </span>
                <IconButton
                  label={`上移 ${title}`}
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </IconButton>
                <IconButton
                  label={`下移 ${title}`}
                  onClick={() => move(index, index + 1)}
                  disabled={index === order.length - 1}
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </IconButton>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-[13px] text-muted">还没有首页精选的条目。</p>
      )}
    </Dialog>
  );
}
