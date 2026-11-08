import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import {
  STACK_PROVIDER_LABELS,
  type AdminStackCategory,
  type AdminStackTechnology
} from "@liam-frost/shared";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  Star,
  Trash2
} from "lucide-react";
import { useState, type DragEvent } from "react";

import { PageHeader } from "../components/layout/AdminLayout";
import { CategoryDialog, DeleteCategoryDialog } from "../components/stack/CategoryDialogs";
import { TechIcon } from "../components/stack/TechIcon";
import { TechnologyDialog } from "../components/stack/TechnologyDialog";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { Dialog } from "../components/ui/Dialog";
import { IconButton } from "../components/ui/IconButton";
import { Menu } from "../components/ui/Menu";
import { useToast } from "../components/ui/Toast";
import { useReorderStack, useStack, useStackMutation } from "../hooks/useStack";
import { api } from "../lib/api";
import { pickText } from "../lib/i18n";
import { tr } from "../lib/messages";

type Drag = { kind: "category"; id: string } | { kind: "technology"; id: string };

type Editing =
  | { kind: "category"; category?: AdminStackCategory }
  | { kind: "technology"; technology?: AdminStackTechnology; categoryId?: string }
  | null;

const BADGE =
  "inline-flex items-center gap-1 rounded-full bg-brand-secondary/10 px-2 py-0.5 text-[11px] whitespace-nowrap text-brand";

/** Moves an item within a list (from and to are indexes in that list). */
function moved<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** The layout with one technology taken out and put into a category at a position (end by default). */
function placeTechnology(
  categories: AdminStackCategory[],
  id: string,
  categoryId: string,
  index?: number
) {
  const technology = categories.flatMap((c) => c.technologies).find((t) => t.id === id);
  if (!technology) return categories;
  const without = categories.map((c) => ({
    ...c,
    technologies: c.technologies.filter((t) => t.id !== id)
  }));
  return without.map((c) => {
    if (c.id !== categoryId) return c;
    const list = [...c.technologies];
    list.splice(index ?? list.length, 0, { ...technology, categoryId });
    return { ...c, technologies: list };
  });
}

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export function StackPage() {
  const { data: categories, isPending, error } = useStack();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [deletingCategory, setDeletingCategory] = useState<AdminStackCategory | null>(null);
  const [deletingTechnology, setDeletingTechnology] = useState<AdminStackTechnology | null>(null);
  const reorder = useReorderStack();
  const update = useStackMutation(
    ({ id, body }: { id: string; body: Parameters<typeof api.updateStackTechnology>[1] }) =>
      api.updateStackTechnology(id, body)
  );
  const updateCategory = useStackMutation(({ id, visible }: { id: string; visible: boolean }) =>
    api.updateStackCategory(id, { visible })
  );
  const removeTechnology = useStackMutation((id: string) => api.deleteStackTechnology(id));
  const toast = useToast();

  if (isPending) return <LoadingSkeleton label={tr("加载中…")} variant="rows" />;
  if (error) {
    return (
      <>
        <PageHeader title={tr("技术栈")} />
        <DatabaseNotice error={error} subject={tr("技术栈管理")} />
      </>
    );
  }

  const all = categories ?? [];
  const save = (next: AdminStackCategory[]) =>
    reorder.mutate(next, { onError: (e) => toast(tr("排序未保存：{0}", e.message), "error") });
  const failed = (e: Error) => toast(e.message, "error");

  const moveCategory = (index: number, to: number) => {
    if (to < 0 || to >= all.length) return;
    save(moved(all, index, to));
  };
  const moveTechnology = (category: AdminStackCategory, index: number, to: number) => {
    if (to < 0 || to >= category.technologies.length) return;
    save(
      all.map((c) =>
        c.id === category.id ? { ...c, technologies: moved(c.technologies, index, to) } : c
      )
    );
  };

  const endDrag = () => {
    setDrag(null);
    setOver(null);
  };
  /** Drop targets accept only what they can take: categories on categories, technologies on rows or lists. */
  const allow = (kind: Drag["kind"], target: string) => (event: DragEvent) => {
    if (!drag || drag.kind !== kind || drag.id === target) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOver(target);
  };
  const dropCategory = (targetIndex: number) => (event: DragEvent) => {
    if (drag?.kind !== "category") return;
    event.preventDefault();
    const from = all.findIndex((c) => c.id === drag.id);
    if (from !== targetIndex) save(moved(all, from, targetIndex));
    endDrag();
  };
  const dropTechnology = (categoryId: string, index?: number) => (event: DragEvent) => {
    if (drag?.kind !== "technology") return;
    event.preventDefault();
    event.stopPropagation();
    // Dropped on a row it takes that row's place; on the list, it goes last.
    save(placeTechnology(all, drag.id, categoryId, index));
    endDrag();
  };

  const toggle = (id: string) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <PageHeader
        title={tr("技术栈")}
        description={tr(
          "首页“技术栈”的分类和技术。拖动或用箭头调整顺序，网站按这里的顺序显示；隐藏的分类和技术不会出现在网站上，没有可见技术的分类也不显示。"
        )}
        actions={
          <>
            <a href="/#/#skills" target="_blank" rel="noreferrer" className="btn-secondary">
              <ExternalLink aria-hidden="true" className="size-4" /> {tr("预览网站")}
            </a>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditing({ kind: "category" })}
            >
              <Layers aria-hidden="true" className="size-4" /> {tr("添加分类")}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!all.length}
              onClick={() => setEditing({ kind: "technology" })}
            >
              <Plus aria-hidden="true" className="size-4" /> {tr("添加技术")}
            </button>
          </>
        }
      />

      {all.length === 0 ? (
        <div className="card p-10 text-center text-[13.5px] text-muted">
          {tr("还没有分类，点击“添加分类”开始")}
        </div>
      ) : (
        <ol className="space-y-3" aria-label={tr("技术栈分类")}>
          {all.map((category, index) => {
            const title = pickText(category.name, tr("未命名分类"));
            const open = !collapsed.has(category.id);
            const bodyId = `stack-category-${category.id}`;
            return (
              <li
                key={category.id}
                onDragOver={allow("category", category.id)}
                onDragLeave={() => setOver((o) => (o === category.id ? null : o))}
                onDrop={dropCategory(index)}
                className={`card overflow-visible transition-shadow ${
                  drag?.id === category.id ? "opacity-40" : ""
                } ${over === category.id && drag?.kind === "category" ? "ring-2 ring-brand-secondary" : ""}`}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDrag({ kind: "category", id: category.id });
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", title);
                    }}
                    onDragEnd={endDrag}
                    className="hidden cursor-grab text-faint sm:inline-flex"
                    aria-hidden="true"
                  >
                    <GripVertical className="size-4" />
                  </span>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={() => toggle(category.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-0.5 text-left"
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className={`size-4 shrink-0 text-faint transition-transform ${open ? "" : "-rotate-90"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[15px] font-semibold break-words text-brand-dark">
                          {title}
                        </span>
                        <span className={BADGE}>{tr("{0} 项", category.technologies.length)}</span>
                        {!category.visible ? (
                          <span className={BADGE}>
                            <EyeOff aria-hidden="true" className="size-3" /> {tr("隐藏")}
                          </span>
                        ) : null}
                      </span>
                      {pickText(category.description) ? (
                        <span className="mt-0.5 block truncate text-[12px] text-subtle">
                          {pickText(category.description)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center">
                    <IconButton
                      label={tr("上移分类 {0}", title)}
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => moveCategory(index, index - 1)}
                    >
                      <ArrowUp aria-hidden="true" className="size-4" />
                    </IconButton>
                    <IconButton
                      label={tr("下移分类 {0}", title)}
                      disabled={index === all.length - 1 || reorder.isPending}
                      onClick={() => moveCategory(index, index + 1)}
                    >
                      <ArrowDown aria-hidden="true" className="size-4" />
                    </IconButton>
                    <Menu
                      label={tr("{0} 的更多操作", title)}
                      items={[
                        {
                          label: tr("添加技术到此分类"),
                          icon: <Plus aria-hidden="true" className="size-4" />,
                          onSelect: () =>
                            setEditing({ kind: "technology", categoryId: category.id })
                        },
                        {
                          label: tr("编辑分类"),
                          icon: <Pencil aria-hidden="true" className="size-4" />,
                          onSelect: () => setEditing({ kind: "category", category })
                        },
                        {
                          label: category.visible ? tr("在网站上隐藏") : tr("在网站上显示"),
                          icon: category.visible ? (
                            <EyeOff aria-hidden="true" className="size-4" />
                          ) : (
                            <Eye aria-hidden="true" className="size-4" />
                          ),
                          onSelect: () =>
                            updateCategory.mutate(
                              { id: category.id, visible: !category.visible },
                              { onError: failed }
                            )
                        },
                        {
                          label: tr("删除分类"),
                          icon: <Trash2 aria-hidden="true" className="size-4" />,
                          danger: true,
                          onSelect: () => setDeletingCategory(category)
                        }
                      ]}
                    />
                  </div>
                </div>

                {open ? (
                  <div
                    id={bodyId}
                    onDragOver={allow("technology", `list-${category.id}`)}
                    onDrop={dropTechnology(category.id)}
                    className={`border-t border-line-soft px-2 py-2 sm:px-3 ${
                      over === `list-${category.id}` ? "bg-brand-secondary/6" : ""
                    }`}
                  >
                    {category.technologies.length ? (
                      <ol className="space-y-1" aria-label={tr("{0} 的技术", title)}>
                        {category.technologies.map((technology, position) => (
                          <TechnologyRow
                            key={technology.id}
                            technology={technology}
                            first={position === 0}
                            last={position === category.technologies.length - 1}
                            busy={reorder.isPending}
                            dragging={drag?.id === technology.id}
                            dropTarget={over === technology.id && drag?.kind === "technology"}
                            onDragStart={(e) => {
                              setDrag({ kind: "technology", id: technology.id });
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", technology.name);
                            }}
                            onDragEnd={endDrag}
                            onDragOver={allow("technology", technology.id)}
                            onDrop={dropTechnology(category.id, position)}
                            onMove={(to) => moveTechnology(category, position, to)}
                            position={position}
                            onEdit={() => setEditing({ kind: "technology", technology })}
                            onDelete={() => setDeletingTechnology(technology)}
                            onPatch={(body) =>
                              update.mutate({ id: technology.id, body }, { onError: failed })
                            }
                          />
                        ))}
                      </ol>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditing({ kind: "technology", categoryId: category.id })}
                        className="w-full rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-faint hover:border-brand-secondary hover:text-brand"
                      >
                        {tr("还没有技术。点击添加，或把其它分类的技术拖到这里")}
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {editing?.kind === "category" ? (
        <CategoryDialog category={editing.category} onClose={() => setEditing(null)} />
      ) : null}
      {editing?.kind === "technology" ? (
        <TechnologyDialog
          categories={all}
          technology={editing.technology}
          defaultCategoryId={editing.categoryId}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deletingCategory ? (
        <DeleteCategoryDialog
          category={deletingCategory}
          categories={all}
          onClose={() => setDeletingCategory(null)}
        />
      ) : null}
      <Dialog
        open={Boolean(deletingTechnology)}
        size="sm"
        title={tr("删除技术")}
        onClose={() => setDeletingTechnology(null)}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDeletingTechnology(null)}
            >
              {tr("取消")}
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={removeTechnology.isPending}
              onClick={() =>
                deletingTechnology &&
                removeTechnology.mutate(deletingTechnology.id, {
                  onSuccess: () => {
                    toast(tr("已删除 {0}", deletingTechnology.name));
                    setDeletingTechnology(null);
                  },
                  onError: failed
                })
              }
            >
              {removeTechnology.isPending ? tr("删除中…") : tr("删除")}
            </button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-muted">
          {tr(
            "确定删除“{0}”吗？{1}此操作无法撤销。只想暂时不在网站上显示，可以改为隐藏。",
            deletingTechnology?.name,
            deletingTechnology?.iconProvider === "custom" ? tr("上传的图标也会一起删除，") : ""
          )}
        </p>
      </Dialog>
    </>
  );
}

function TechnologyRow({
  technology,
  first,
  last,
  busy,
  dragging,
  dropTarget,
  position,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMove,
  onEdit,
  onDelete,
  onPatch
}: {
  technology: AdminStackTechnology;
  first: boolean;
  last: boolean;
  busy: boolean;
  dragging: boolean;
  dropTarget: boolean;
  position: number;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onMove: (to: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPatch: (body: { visible?: boolean; prominence?: "primary" | "standard" }) => void;
}) {
  const source =
    technology.iconProvider === "none"
      ? tr("无图标")
      : tr(STACK_PROVIDER_LABELS[technology.iconProvider]);
  return (
    <li
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition-colors sm:gap-2.5 sm:px-2 ${
        dragging ? "opacity-40" : ""
      } ${dropTarget ? "bg-brand-secondary/10 ring-1 ring-brand-secondary/50" : "hover:bg-canvas"}`}
    >
      <span
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        aria-hidden="true"
        className="hidden cursor-grab text-faint sm:inline-flex"
      >
        <GripVertical className="size-4" />
      </span>
      <TechIcon name={technology.name} url={technology.iconUrl} />
      <button
        type="button"
        onClick={onEdit}
        aria-label={tr("编辑 {0}", technology.name)}
        className="min-w-0 flex-1 text-left"
      >
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span
            className={`truncate text-[13.5px] text-ink ${technology.visible ? "" : "text-faint line-through decoration-faint/60"}`}
          >
            {technology.name}
          </span>
          {technology.prominence === "primary" ? (
            <span className={BADGE}>
              <Star aria-hidden="true" className="size-3" /> Primary
            </span>
          ) : null}
          {!technology.visible ? (
            <span className={BADGE}>
              <EyeOff aria-hidden="true" className="size-3" /> {tr("隐藏")}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[11.5px] text-faint">
          {source}
          {technology.websiteUrl ? ` · ${host(technology.websiteUrl)}` : ""}
          {technology.projectIds.length ? tr(" · {0} 个项目", technology.projectIds.length) : ""}
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        <IconButton
          label={tr("上移 {0}", technology.name)}
          disabled={first || busy}
          onClick={() => onMove(position - 1)}
        >
          <ArrowUp aria-hidden="true" className="size-4" />
        </IconButton>
        <IconButton
          label={tr("下移 {0}", technology.name)}
          disabled={last || busy}
          onClick={() => onMove(position + 1)}
        >
          <ArrowDown aria-hidden="true" className="size-4" />
        </IconButton>
        <span className="hidden sm:inline-flex">
          <IconButton label={tr("编辑 {0}", technology.name)} onClick={onEdit}>
            <Pencil aria-hidden="true" className="size-4" />
          </IconButton>
        </span>
        <Menu
          label={tr("{0} 的更多操作", technology.name)}
          items={[
            {
              label: tr("编辑（名称、图标、分类、官网）"),
              icon: <Pencil aria-hidden="true" className="size-4" />,
              onSelect: onEdit
            },
            {
              label: technology.visible ? tr("在网站上隐藏") : tr("在网站上显示"),
              icon: technology.visible ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              ),
              onSelect: () => onPatch({ visible: !technology.visible })
            },
            {
              label: technology.prominence === "primary" ? tr("设为 Standard") : tr("设为 Primary"),
              icon: <Star aria-hidden="true" className="size-4" />,
              onSelect: () =>
                onPatch({
                  prominence: technology.prominence === "primary" ? "standard" : "primary"
                })
            },
            {
              label: tr("删除"),
              icon: <Trash2 aria-hidden="true" className="size-4" />,
              danger: true,
              onSelect: onDelete
            }
          ]}
        />
      </div>
    </li>
  );
}
