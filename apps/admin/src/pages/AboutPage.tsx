import {
  ABOUT_LIMITS,
  MANIFESTO_ROTATION_MODES,
  type AboutContent,
  type AboutGearCategory,
  type AboutManifesto,
  type AdminAboutResponse,
  type ManifestoRotationMode
} from "@liam-frost/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { PageHeader } from "../components/layout/AdminLayout";
import { Emphasis, GearCategoryDialog, ManifestoDialog } from "../components/about/dialogs";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { IconButton } from "../components/ui/IconButton";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { api } from "../lib/api";
import { LANGS, pickText } from "../lib/i18n";

const aboutKey = ["admin", "about"] as const;

const MODE_LABELS: Record<ManifestoRotationMode, { label: string; hint: string }> = {
  fixed: { label: "固定", hint: "一直显示选定的一条" },
  daily: { label: "每天", hint: "按温哥华时间每天换一条，同一天所有访客看到同一条" },
  visit: { label: "每次访问", hint: "每次打开首页换一条，不会连续两次相同" },
  session: { label: "每个浏览会话", hint: "同一个标签页里保持不变，下次打开网站换一条" }
};

const BADGE =
  "inline-flex items-center gap-1 rounded-full bg-brand-secondary/10 px-2 py-0.5 text-[11px] whitespace-nowrap text-brand";

function moved<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The first problem that would make the server refuse the content, in words for this page. */
function problemOf(about: AboutContent) {
  for (const category of about.gear) {
    const title = pickText(category.name, "未命名分类");
    if (category.items.some((item) => !item.name.trim())) return `“${title}”里有设备没有名称`;
    const clash = category.items.find((item, i) =>
      category.items.some((other, j) => j < i && sameName(other.name, item.name))
    );
    if (clash) return `“${title}”里有两个“${clash.name.trim()}”`;
  }
  return "";
}

type Editing =
  | { kind: "manifesto"; manifesto?: AboutManifesto }
  | { kind: "category"; category?: AboutGearCategory }
  | null;

/**
 * The home page's about section: manifestos and how they rotate, and the gear list. Changes are
 * made on a draft and saved together, so a half-finished edit never shows on the site.
 */
export function AboutPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isPending, error } = useQuery({ queryKey: aboutKey, queryFn: api.about });
  const [draft, setDraft] = useState<AboutContent | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [newItem, setNewItem] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: api.saveAbout,
    onSuccess: (response: AdminAboutResponse) => {
      qc.setQueryData(aboutKey, response);
      setDraft(null);
      toast("已保存，网站上马上生效");
    },
    onError: (e: Error) => toast(e.message, "error")
  });

  const about = draft ?? data?.about ?? null;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(data?.about);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (isPending) return <p className="py-10 text-center text-[13px] text-subtle">加载中…</p>;
  if (error || !data || !about) {
    return (
      <>
        <PageHeader title="关于" />
        <DatabaseNotice error={error ?? new Error("无法加载")} subject="“关于我”管理" />
      </>
    );
  }

  const change = (update: (about: AboutContent) => AboutContent) => setDraft(update(about));
  const setManifestos = (manifestos: AboutManifesto[]) =>
    change((a) => ({
      ...a,
      manifestos,
      // A deleted fixed manifesto leaves the choice to the site (the first visible one).
      rotation: manifestos.some((m) => m.id === a.rotation.fixedId)
        ? a.rotation
        : { ...a.rotation, fixedId: null }
    }));
  const setGear = (gear: AboutGearCategory[]) => change((a) => ({ ...a, gear }));
  const setCategory = (id: string, update: (c: AboutGearCategory) => AboutGearCategory) =>
    setGear(about.gear.map((c) => (c.id === id ? update(c) : c)));

  const problem = problemOf(about);
  const visibleManifestos = about.manifestos.filter((m) => m.visible);
  const fixed = about.manifestos.find((m) => m.id === about.rotation.fixedId);

  const addItem = (category: AboutGearCategory) => (event: FormEvent) => {
    event.preventDefault();
    const name = (newItem[category.id] ?? "").trim();
    if (!name) return;
    if (category.items.some((item) => sameName(item.name, name)))
      return toast(`“${name}”已经在这个分类里`, "error");
    setCategory(category.id, (c) => ({
      ...c,
      items: [...c.items, { id: crypto.randomUUID(), name, visible: true }]
    }));
    setNewItem((n) => ({ ...n, [category.id]: "" }));
  };

  return (
    <div className="max-w-[920px] pb-24">
      <PageHeader
        title="关于"
        description="首页“关于我”的宣言和设备。修改先保存在本页，点“保存”后一起生效；隐藏的宣言、设备和没有可见设备的分类不会出现在网站上。"
        actions={
          <a href="/#/#about" target="_blank" rel="noreferrer" className="btn-secondary">
            <ExternalLink aria-hidden="true" className="size-4" /> 预览网站
          </a>
        }
      />
      {!data.saved ? (
        <p className="mb-4 rounded-xl bg-brand-secondary/8 px-4 py-3 text-[12.5px] text-muted">
          还没有保存过：网站现在显示的是这里的默认内容，第一次保存后改由这里管理。
        </p>
      ) : null}

      <div className="space-y-5">
        <Panel title="轮换方式">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">宣言的轮换方式</legend>
            {MANIFESTO_ROTATION_MODES.map((mode) => (
              <label
                key={mode}
                className={`flex cursor-pointer gap-2.5 rounded-xl border p-3 text-[13px] transition-colors ${
                  about.rotation.mode === mode
                    ? "border-brand bg-brand-secondary/8"
                    : "border-line-soft hover:border-line"
                }`}
              >
                <input
                  type="radio"
                  name="rotation"
                  className="mt-0.5 accent-[var(--color-brand)]"
                  checked={about.rotation.mode === mode}
                  onChange={() => change((a) => ({ ...a, rotation: { ...a.rotation, mode } }))}
                />
                <span>
                  <span className="block font-medium text-brand-dark">
                    {MODE_LABELS[mode].label}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-faint">
                    {MODE_LABELS[mode].hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {about.rotation.mode === "fixed" ? (
            <label className="block text-[12.5px] font-medium text-brand-dark">
              固定显示
              <select
                className="field mt-1.5"
                value={about.rotation.fixedId ?? ""}
                onChange={(e) =>
                  change((a) => ({
                    ...a,
                    rotation: { ...a.rotation, fixedId: e.target.value || null }
                  }))
                }
              >
                <option value="">第一条可见的宣言</option>
                {about.manifestos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {pickText(m.text).replaceAll("*", "")}
                    {m.visible ? "" : "（已隐藏）"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {fixed && !fixed.visible && about.rotation.mode === "fixed" ? (
            <p className="text-[12px] text-status-warn">
              选定的宣言已隐藏，网站会改为显示第一条可见的宣言。
            </p>
          ) : null}
          {visibleManifestos.length === 0 ? (
            <p className="text-[12px] text-status-warn">没有可见的宣言，网站上不显示宣言。</p>
          ) : null}
        </Panel>

        <Panel title={`宣言（${about.manifestos.length}/${ABOUT_LIMITS.manifestos}）`}>
          {about.manifestos.length ? (
            <ol className="divide-y divide-line-soft" aria-label="宣言">
              {about.manifestos.map((m, index) => {
                const missing = LANGS.filter((l) => !m.text[l]);
                return (
                  <li key={m.id} className="flex items-start gap-3 py-3">
                    <span className="w-6 pt-0.5 text-[12px] text-faint tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className={`min-w-0 flex-1 ${m.visible ? "" : "opacity-55"}`}>
                      <p className="text-[15px] leading-snug font-semibold text-brand-dark">
                        <Emphasis text={pickText(m.text)} />
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                        {pickText(m.attribution) ? <span>— {pickText(m.attribution)}</span> : null}
                        {about.rotation.mode === "fixed" && m.id === about.rotation.fixedId ? (
                          <span className={BADGE}>固定显示</span>
                        ) : null}
                        {m.visible ? null : <span className={BADGE}>已隐藏</span>}
                        {missing.length ? (
                          <span className={BADGE}>缺 {missing.length} 种语言</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <IconButton
                        label="上移"
                        disabled={index === 0}
                        onClick={() => setManifestos(moved(about.manifestos, index, index - 1))}
                      >
                        <ArrowUp className="size-4" />
                      </IconButton>
                      <IconButton
                        label="下移"
                        disabled={index === about.manifestos.length - 1}
                        onClick={() => setManifestos(moved(about.manifestos, index, index + 1))}
                      >
                        <ArrowDown className="size-4" />
                      </IconButton>
                      <IconButton
                        label={m.visible ? "隐藏" : "显示"}
                        onClick={() =>
                          setManifestos(
                            about.manifestos.map((x) =>
                              x.id === m.id ? { ...x, visible: !x.visible } : x
                            )
                          )
                        }
                      >
                        {m.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </IconButton>
                      <IconButton
                        label="编辑"
                        onClick={() => setEditing({ kind: "manifesto", manifesto: m })}
                      >
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton
                        label="删除"
                        danger
                        onClick={() => setManifestos(about.manifestos.filter((x) => x.id !== m.id))}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-[13px] text-muted">还没有宣言</p>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={about.manifestos.length >= ABOUT_LIMITS.manifestos}
            onClick={() => setEditing({ kind: "manifesto" })}
          >
            <Plus aria-hidden="true" className="size-4" /> 添加宣言
          </button>
        </Panel>

        <Panel title="设备">
          {about.gear.length ? (
            <ol className="space-y-3" aria-label="设备分类">
              {about.gear.map((category, index) => {
                const title = pickText(category.name, "未命名分类");
                return (
                  <li key={category.id} className="rounded-xl border border-line-soft p-3">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`min-w-0 flex-1 truncate text-[14px] font-semibold text-brand-dark ${
                          category.visible ? "" : "opacity-55"
                        }`}
                      >
                        {title}
                        <span className="ml-2 text-[12px] font-normal text-faint">
                          {category.items.length}/{ABOUT_LIMITS.gearItems}
                        </span>
                        {category.visible ? null : <span className={`${BADGE} ml-2`}>已隐藏</span>}
                      </h3>
                      <IconButton
                        label="上移分类"
                        disabled={index === 0}
                        onClick={() => setGear(moved(about.gear, index, index - 1))}
                      >
                        <ArrowUp className="size-4" />
                      </IconButton>
                      <IconButton
                        label="下移分类"
                        disabled={index === about.gear.length - 1}
                        onClick={() => setGear(moved(about.gear, index, index + 1))}
                      >
                        <ArrowDown className="size-4" />
                      </IconButton>
                      <IconButton
                        label={category.visible ? "隐藏分类" : "显示分类"}
                        onClick={() =>
                          setCategory(category.id, (c) => ({ ...c, visible: !c.visible }))
                        }
                      >
                        {category.visible ? (
                          <Eye className="size-4" />
                        ) : (
                          <EyeOff className="size-4" />
                        )}
                      </IconButton>
                      <IconButton
                        label="重命名分类"
                        onClick={() => setEditing({ kind: "category", category })}
                      >
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton
                        label="删除分类及其设备"
                        danger
                        onClick={() => setGear(about.gear.filter((c) => c.id !== category.id))}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>

                    <ol className="mt-2 space-y-1.5" aria-label={`${title}的设备`}>
                      {category.items.map((item, i) => (
                        <li key={item.id} className="flex items-center gap-1.5">
                          <input
                            className={`field flex-1 ${item.visible ? "" : "opacity-55"}`}
                            aria-label="设备名称"
                            value={item.name}
                            maxLength={ABOUT_LIMITS.gearItemName}
                            onChange={(e) =>
                              setCategory(category.id, (c) => ({
                                ...c,
                                items: c.items.map((x) =>
                                  x.id === item.id ? { ...x, name: e.target.value } : x
                                )
                              }))
                            }
                          />
                          <IconButton
                            label="上移"
                            disabled={i === 0}
                            onClick={() =>
                              setCategory(category.id, (c) => ({
                                ...c,
                                items: moved(c.items, i, i - 1)
                              }))
                            }
                          >
                            <ArrowUp className="size-4" />
                          </IconButton>
                          <IconButton
                            label="下移"
                            disabled={i === category.items.length - 1}
                            onClick={() =>
                              setCategory(category.id, (c) => ({
                                ...c,
                                items: moved(c.items, i, i + 1)
                              }))
                            }
                          >
                            <ArrowDown className="size-4" />
                          </IconButton>
                          <IconButton
                            label={item.visible ? "隐藏" : "显示"}
                            onClick={() =>
                              setCategory(category.id, (c) => ({
                                ...c,
                                items: c.items.map((x) =>
                                  x.id === item.id ? { ...x, visible: !x.visible } : x
                                )
                              }))
                            }
                          >
                            {item.visible ? (
                              <Eye className="size-4" />
                            ) : (
                              <EyeOff className="size-4" />
                            )}
                          </IconButton>
                          <IconButton
                            label="删除"
                            danger
                            onClick={() =>
                              setCategory(category.id, (c) => ({
                                ...c,
                                items: c.items.filter((x) => x.id !== item.id)
                              }))
                            }
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        </li>
                      ))}
                    </ol>
                    <form onSubmit={addItem(category)} className="mt-2 flex gap-1.5">
                      <input
                        className="field flex-1"
                        aria-label={`添加到${title}`}
                        placeholder="输入设备名称，回车添加"
                        maxLength={ABOUT_LIMITS.gearItemName}
                        value={newItem[category.id] ?? ""}
                        onChange={(e) =>
                          setNewItem((n) => ({ ...n, [category.id]: e.target.value }))
                        }
                      />
                      <button
                        type="submit"
                        className="btn-secondary"
                        disabled={
                          !(newItem[category.id] ?? "").trim() ||
                          category.items.length >= ABOUT_LIMITS.gearItems
                        }
                      >
                        <Plus aria-hidden="true" className="size-4" /> 添加
                      </button>
                    </form>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-[13px] text-muted">还没有设备分类，网站上不显示设备</p>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={about.gear.length >= ABOUT_LIMITS.gearCategories}
            onClick={() => setEditing({ kind: "category" })}
          >
            <Plus aria-hidden="true" className="size-4" /> 添加分类
          </button>
        </Panel>
      </div>

      {dirty ? (
        <div
          role="region"
          aria-label="未保存的修改"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:left-[220px]"
        >
          <div className="mx-auto flex max-w-[920px] flex-wrap items-center justify-end gap-2">
            <span
              className={`mr-auto text-[12.5px] ${problem ? "text-status-error" : "text-status-warn"}`}
            >
              {problem || "有未保存的修改"}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={save.isPending}
              onClick={() => setDraft(null)}
            >
              放弃修改
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={save.isPending || !!problem}
              onClick={() => save.mutate({ about, revision: data.revision })}
            >
              {save.isPending ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      ) : null}

      {editing?.kind === "manifesto" ? (
        <ManifestoDialog
          manifesto={editing.manifesto}
          onClose={() => setEditing(null)}
          onSave={(manifesto) => {
            setManifestos(
              editing.manifesto
                ? about.manifestos.map((m) => (m.id === manifesto.id ? manifesto : m))
                : [...about.manifestos, manifesto]
            );
            setEditing(null);
          }}
        />
      ) : null}
      {editing?.kind === "category" ? (
        <GearCategoryDialog
          category={editing.category}
          onClose={() => setEditing(null)}
          onSave={(name) => {
            const existing = editing.category;
            setGear(
              existing
                ? about.gear.map((c) => (c.id === existing.id ? { ...c, name } : c))
                : [...about.gear, { id: crypto.randomUUID(), name, visible: true, items: [] }]
            );
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
