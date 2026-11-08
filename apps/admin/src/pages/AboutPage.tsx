import { useArrivalParams } from "../hooks/useArrivalParams";
import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
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
import { useState, type FormEvent } from "react";

import { PageHeader } from "../components/layout/AdminLayout";
import { Emphasis, GearCategoryDialog, ManifestoDialog } from "../components/about/dialogs";
import { DatabaseNotice } from "../components/ui/DatabaseNotice";
import { IconButton } from "../components/ui/IconButton";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { api } from "../lib/api";
import { LANGS, pickText } from "../lib/i18n";
import { tr } from "../lib/messages";
import { Select } from "../components/ui/Select";
import { useUnsaved } from "../lib/unsaved";

const aboutKey = ["admin", "about"] as const;

const MODE_LABELS: Record<ManifestoRotationMode, { label: string; hint: string }> = {
  fixed: { label: tr("固定"), hint: tr("一直显示选定的一条") },
  daily: { label: tr("每天"), hint: tr("按温哥华日期加权选择，同一天所有访客一致") },
  visit: { label: tr("每次访问"), hint: tr("每次打开首页按权重抽取，允许连续出现同一条") },
  session: {
    label: tr("每个浏览会话"),
    hint: tr("按权重选择，同一标签页保持不变；权重调整后重新选择")
  }
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
    const title = pickText(category.name, tr("未命名分类"));
    if (category.items.some((item) => !item.name.trim())) return tr("“{0}”里有设备没有名称", title);
    const clash = category.items.find((item, i) =>
      category.items.some((other, j) => j < i && sameName(other.name, item.name))
    );
    if (clash) return tr("“{0}”里有两个“{1}”", title, clash.name.trim());
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
  // The draft keeps the revision it was started from, so a save after someone else's (seen by a
  // refetch meanwhile) is still refused instead of overwriting their changes.
  const [draft, setDraft] = useState<{ about: AboutContent; revision: string } | null>(null);
  const arrival = useArrivalParams("open").open;
  const [editing, setEditing] = useState<Editing>(
    arrival === "manifesto"
      ? { kind: "manifesto" }
      : arrival === "gear"
        ? { kind: "category" }
        : null
  );
  const [newItem, setNewItem] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: api.saveAbout,
    onSuccess: (response: AdminAboutResponse, saved) => {
      qc.setQueryData(aboutKey, response);
      // Edits made while the save was pending stay as a draft on top of what was just saved.
      setDraft((current) =>
        !current || JSON.stringify(current.about) === JSON.stringify(saved.about)
          ? null
          : { ...current, revision: response.revision }
      );
      toast(tr("已保存，网站上马上生效"));
    },
    onError: (e: Error) => toast(e.message, "error")
  });

  const about = draft?.about ?? data?.about ?? null;
  const dirty = draft !== null && JSON.stringify(draft.about) !== JSON.stringify(data?.about);

  useUnsaved(dirty, "page");

  if (isPending) return <LoadingSkeleton label={tr("加载中…")} variant="form" />;
  if (error || !data || !about) {
    return (
      <>
        <PageHeader title={tr("关于")} />
        <DatabaseNotice error={error ?? new Error(tr("无法加载"))} subject={tr("“关于我”管理")} />
      </>
    );
  }

  const change = (update: (about: AboutContent) => AboutContent) =>
    setDraft({ about: update(about), revision: draft?.revision ?? data.revision });
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
      return toast(tr("“{0}”已经在这个分类里", name), "error");
    setCategory(category.id, (c) => ({
      ...c,
      items: [...c.items, { id: crypto.randomUUID(), name, visible: true }]
    }));
    setNewItem((n) => ({ ...n, [category.id]: "" }));
  };

  return (
    <div className="max-w-[920px] pb-24">
      <PageHeader
        title={tr("关于")}
        description={tr(
          "首页“关于我”的宣言和设备。修改先保存在本页，点“保存”后一起生效；隐藏的宣言、设备和没有可见设备的分类不会出现在网站上。"
        )}
        actions={
          <a href="/#/#about" target="_blank" rel="noreferrer" className="btn-secondary">
            <ExternalLink aria-hidden="true" className="size-4" /> {tr("预览网站")}
          </a>
        }
      />
      {!data.saved ? (
        <p className="mb-4 rounded-xl bg-brand-secondary/8 px-4 py-3 text-[12.5px] text-muted">
          {tr("还没有保存过：网站现在显示的是这里的默认内容，第一次保存后改由这里管理。")}
        </p>
      ) : null}

      <div className="space-y-5">
        <Panel title={tr("轮换方式")}>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">{tr("宣言的轮换方式")}</legend>
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
              {tr("固定显示")}
              <Select
                value={about.rotation.fixedId ?? ""}
                onChange={(value) =>
                  change((a) => ({
                    ...a,
                    rotation: { ...a.rotation, fixedId: value || null }
                  }))
                }
                className="mt-1.5"
                options={[
                  { value: "", label: tr("第一条可见的宣言") },
                  ...about.manifestos.map((m) => ({
                    value: m.id,
                    label: `${pickText(m.text).replaceAll("*", "")}${m.visible ? "" : tr("（已隐藏）")}`
                  }))
                ]}
              />
            </label>
          ) : null}
          {fixed && !fixed.visible && about.rotation.mode === "fixed" ? (
            <p className="text-[12px] text-status-warn">
              {tr("选定的宣言已隐藏，网站会改为显示第一条可见的宣言。")}
            </p>
          ) : null}
          {visibleManifestos.length === 0 ? (
            <p className="text-[12px] text-status-warn">
              {tr("没有可见的宣言，网站上不显示宣言。")}
            </p>
          ) : null}
        </Panel>

        <Panel title={tr("宣言（{0}/{1}）", about.manifestos.length, ABOUT_LIMITS.manifestos)}>
          {about.manifestos.length ? (
            <ol className="divide-y divide-line-soft" aria-label={tr("宣言")}>
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
                          <span className={BADGE}>{tr("固定显示")}</span>
                        ) : null}
                        {about.rotation.mode !== "fixed" ? (
                          <span className={BADGE}>
                            {tr(
                              "权重 {0} · {1}%",
                              m.weight ?? 1,
                              m.visible &&
                                visibleManifestos.reduce((sum, v) => sum + (v.weight ?? 1), 0) > 0
                                ? (
                                    ((m.weight ?? 1) /
                                      visibleManifestos.reduce(
                                        (sum, v) => sum + (v.weight ?? 1),
                                        0
                                      )) *
                                    100
                                  ).toFixed(1)
                                : "0"
                            )}
                          </span>
                        ) : null}
                        {m.visible ? null : <span className={BADGE}>{tr("已隐藏")}</span>}
                        {missing.length ? (
                          <span className={BADGE}>{tr("缺 {0} 种语言", missing.length)}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <IconButton
                        label={tr("上移")}
                        disabled={index === 0}
                        onClick={() => setManifestos(moved(about.manifestos, index, index - 1))}
                      >
                        <ArrowUp className="size-4" />
                      </IconButton>
                      <IconButton
                        label={tr("下移")}
                        disabled={index === about.manifestos.length - 1}
                        onClick={() => setManifestos(moved(about.manifestos, index, index + 1))}
                      >
                        <ArrowDown className="size-4" />
                      </IconButton>
                      <IconButton
                        label={m.visible ? tr("隐藏") : tr("显示")}
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
                        label={tr("编辑")}
                        onClick={() => setEditing({ kind: "manifesto", manifesto: m })}
                      >
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton
                        label={tr("删除")}
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
            <p className="text-[13px] text-muted">{tr("还没有宣言")}</p>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={about.manifestos.length >= ABOUT_LIMITS.manifestos}
            onClick={() => setEditing({ kind: "manifesto" })}
          >
            <Plus aria-hidden="true" className="size-4" /> {tr("添加宣言")}
          </button>
        </Panel>

        <Panel title={tr("设备")}>
          {about.gear.length ? (
            <ol className="space-y-3" aria-label={tr("设备分类")}>
              {about.gear.map((category, index) => {
                const title = pickText(category.name, tr("未命名分类"));
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
                        {category.visible ? null : (
                          <span className={`${BADGE} ml-2`}>{tr("已隐藏")}</span>
                        )}
                      </h3>
                      <IconButton
                        label={tr("上移分类")}
                        disabled={index === 0}
                        onClick={() => setGear(moved(about.gear, index, index - 1))}
                      >
                        <ArrowUp className="size-4" />
                      </IconButton>
                      <IconButton
                        label={tr("下移分类")}
                        disabled={index === about.gear.length - 1}
                        onClick={() => setGear(moved(about.gear, index, index + 1))}
                      >
                        <ArrowDown className="size-4" />
                      </IconButton>
                      <IconButton
                        label={category.visible ? tr("隐藏分类") : tr("显示分类")}
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
                        label={tr("重命名分类")}
                        onClick={() => setEditing({ kind: "category", category })}
                      >
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton
                        label={tr("删除分类及其设备")}
                        danger
                        onClick={() => setGear(about.gear.filter((c) => c.id !== category.id))}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>

                    <ol className="mt-2 space-y-1.5" aria-label={tr("{0}的设备", title)}>
                      {category.items.map((item, i) => (
                        <li key={item.id} className="flex items-center gap-1.5">
                          <input
                            className={`field flex-1 ${item.visible ? "" : "opacity-55"}`}
                            aria-label={tr("设备名称")}
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
                            label={tr("上移")}
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
                            label={tr("下移")}
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
                            label={item.visible ? tr("隐藏") : tr("显示")}
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
                            label={tr("删除")}
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
                        aria-label={tr("添加到{0}", title)}
                        placeholder={tr("输入设备名称，回车添加")}
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
                        <Plus aria-hidden="true" className="size-4" /> {tr("添加")}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-[13px] text-muted">{tr("还没有设备分类，网站上不显示设备")}</p>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={about.gear.length >= ABOUT_LIMITS.gearCategories}
            onClick={() => setEditing({ kind: "category" })}
          >
            <Plus aria-hidden="true" className="size-4" /> {tr("添加分类")}
          </button>
        </Panel>
      </div>

      {dirty ? (
        <div
          role="region"
          aria-label={tr("未保存的修改")}
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:left-[220px]"
        >
          <div className="mx-auto flex max-w-[920px] flex-wrap items-center justify-end gap-2">
            <span
              className={`mr-auto text-[12.5px] ${problem ? "text-status-error" : "text-status-warn"}`}
            >
              {problem || tr("有未保存的修改")}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={save.isPending}
              onClick={() => setDraft(null)}
            >
              {tr("放弃修改")}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={save.isPending || !!problem}
              onClick={() => save.mutate({ about, revision: draft?.revision ?? data.revision })}
            >
              {save.isPending ? tr("保存中…") : tr("保存")}
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
