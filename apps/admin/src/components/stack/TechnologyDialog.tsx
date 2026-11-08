import {
  STACK_PROVIDER_LABELS,
  stackInitials,
  type AdminStackCategory,
  type AdminStackResponse,
  type AdminStackTechnology,
  type AdminStackTechnologyUpdate,
  type StackIconProvider,
  type StackProminence
} from "@liam-frost/shared";
import { useQueryClient } from "@tanstack/react-query";
import { ImageUp, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { projectsKey, useProjects } from "../../hooks/useProjects";
import { stackKey } from "../../hooks/useStack";
import { api, ApiError } from "../../lib/api";
import { pickText } from "../../lib/i18n";
import { createIconPreview } from "../../lib/icon-preview";
import { Dialog } from "../ui/Dialog";
import { Field, Switch } from "../ui/Field";
import { MultiCombobox } from "../ui/MultiCombobox";
import { useToast } from "../ui/Toast";
import { DiscardBar } from "./DiscardBar";
import { IconCombobox } from "./IconCombobox";
import { projectOptions } from "./linkOptions";
import { TechIcon } from "./TechIcon";
import { tr } from "../../lib/messages";

type IconDraft = { provider: StackIconProvider; key: string | null; url: string | null };

type Draft = {
  name: string;
  categoryId: string;
  icon: IconDraft;
  websiteUrl: string;
  prominence: StackProminence;
  visible: boolean;
  projectIds: string[];
};

const ICON_TYPES = ["image/svg+xml", "image/png", "image/webp"];
const MAX_ICON_BYTES = 2 * 1024 * 1024;

/** Same ids, in any order. */
const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "UNKNOWN_PROJECT") return tr("有关联的项目已被删除，请刷新后重试");
    if (error.code === "TOO_MANY_TECHNOLOGIES")
      return tr("有项目已关联 40 项技术，不能再添加：{0}", error.message);
    if (error.code === "NAME_TAKEN") return tr("这个分类里已经有同名的技术");
    if (error.code === "UNKNOWN_ICON") return tr("图标库里找不到这个图标，请重新选择");
    if (error.code === "INVALID_IMAGE" || error.code === "FILE_TOO_LARGE") return error.message;
    return error.message;
  }
  return error instanceof Error ? error.message : tr("保存失败");
}

/**
 * Adds a technology (searching the icon libraries by name) or edits one. A chosen file is uploaded as
 * the logo after the technology is saved.
 */
export function TechnologyDialog({
  categories,
  technology,
  defaultCategoryId,
  onClose
}: {
  categories: AdminStackCategory[];
  /** Editing this one; adding when absent. */
  technology?: AdminStackTechnology;
  defaultCategoryId?: string;
  onClose: () => void;
}) {
  const initial = useMemo<Draft>(
    () => ({
      name: technology?.name ?? "",
      categoryId: technology?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
      icon: technology
        ? { provider: technology.iconProvider, key: technology.iconKey, url: technology.iconUrl }
        : { provider: "none", key: null, url: null },
      websiteUrl: technology?.websiteUrl ?? "",
      prominence: technology?.prominence ?? "standard",
      visible: technology?.visible ?? true,
      projectIds: technology?.projectIds ?? []
    }),
    [technology, defaultCategoryId, categories]
  );
  const [draft, setDraft] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const projects = useProjects();
  const options = useMemo(() => projectOptions(projects.data ?? []), [projects.data]);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setPreview(null);
    setPreviewFailed(false);
    if (file)
      void createIconPreview(file).then(
        (result) => {
          if (cancelled) return URL.revokeObjectURL(result);
          url = result;
          setPreview(result);
        },
        () => {
          if (!cancelled) setPreviewFailed(true);
        }
      );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  const iconChanged =
    file !== null ||
    draft.icon.provider !== initial.icon.provider ||
    draft.icon.key !== initial.icon.key;
  const dirty =
    iconChanged ||
    draft.name.trim() !== initial.name ||
    draft.categoryId !== initial.categoryId ||
    draft.websiteUrl.trim() !== initial.websiteUrl ||
    draft.prominence !== initial.prominence ||
    draft.visible !== initial.visible ||
    !sameIds(draft.projectIds, initial.projectIds);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const requestClose = () => (dirty && !saving ? setConfirmDiscard(true) : onClose());

  const pickFile = (chosen: File | undefined) => {
    if (!chosen) return;
    if (!ICON_TYPES.includes(chosen.type)) return setError(tr("图标请使用 SVG、PNG 或 WebP 文件"));
    if (chosen.size > MAX_ICON_BYTES) return setError(tr("图标不能超过 2 MB"));
    setError("");
    setFile(chosen);
    set("icon", { provider: "custom", key: null, url: null });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return setError(tr("请填写技术名称"));
    if (!draft.categoryId) return setError(tr("请先添加一个分类"));
    const website = draft.websiteUrl.trim();
    if (website && !/^https?:\/\//i.test(website))
      return setError(tr("官方网站请填写以 https:// 开头的链接"));
    setError("");
    setSaving(true);
    // A library icon or none goes with the save; an uploaded file follows it.
    const icon =
      draft.icon.provider === "devicon" || draft.icon.provider === "simpleicons"
        ? { provider: draft.icon.provider, key: draft.icon.key! }
        : draft.icon.provider === "none"
          ? { provider: "none" as const }
          : undefined;
    try {
      let result: AdminStackResponse;
      let id = technology?.id;
      if (technology) {
        const update: AdminStackTechnologyUpdate = {};
        if (name !== initial.name) update.name = name;
        if (draft.categoryId !== initial.categoryId) update.categoryId = draft.categoryId;
        if (website !== initial.websiteUrl) update.websiteUrl = website || null;
        if (draft.prominence !== initial.prominence) update.prominence = draft.prominence;
        if (draft.visible !== initial.visible) update.visible = draft.visible;
        if (!sameIds(draft.projectIds, initial.projectIds)) update.projectIds = draft.projectIds;
        if (
          icon &&
          (draft.icon.provider !== initial.icon.provider || draft.icon.key !== initial.icon.key)
        )
          update.icon = icon;
        result = Object.keys(update).length
          ? await api.updateStackTechnology(technology.id, update)
          : { categories: qc.getQueryData<AdminStackResponse>(stackKey)?.categories ?? [] };
      } else {
        result = await api.createStackTechnology({
          categoryId: draft.categoryId,
          name,
          icon: icon ?? { provider: "none" },
          websiteUrl: website || null,
          prominence: draft.prominence,
          visible: draft.visible,
          ...(draft.projectIds.length ? { projectIds: draft.projectIds } : {})
        });
        id = result.categories
          .find((c) => c.id === draft.categoryId)
          ?.technologies.find((t) => t.name === name)?.id;
      }
      qc.setQueryData(stackKey, result);
      // Projects show their technologies: refresh them when the links changed.
      if (!sameIds(draft.projectIds, initial.projectIds))
        void qc.invalidateQueries({ queryKey: projectsKey });
      if (file && id) {
        try {
          qc.setQueryData(stackKey, await api.uploadStackIcon(id, file));
        } catch (uploadError) {
          // The technology is saved; only the logo failed. Keep the dialog open on the saved entry.
          setSaving(false);
          setError(tr("已保存，但图标上传失败：{0}", errorText(uploadError)));
          if (!technology) {
            toast(tr("技术已添加，图标未上传"), "info");
            onClose();
          }
          return;
        }
      }
      toast(technology ? tr("已保存") : tr("已添加 {0}", name));
      onClose();
    } catch (saveError) {
      setSaving(false);
      setError(errorText(saveError));
    }
  };

  const shownIcon = preview ?? draft.icon.url;
  const iconLabel =
    draft.icon.provider === "custom"
      ? file
        ? tr("将上传：{0}", file.name)
        : tr("已上传的自定义图标")
      : draft.icon.provider === "none"
        ? tr("无图标，网站上显示首字母“{0}”", stackInitials(draft.name || "?"))
        : `${tr(STACK_PROVIDER_LABELS[draft.icon.provider])} · ${draft.icon.key}`;

  return (
    <Dialog
      open
      size="sm"
      title={technology ? tr("编辑 {0}", technology.name) : tr("添加技术")}
      onClose={requestClose}
      footer={
        confirmDiscard ? (
          <DiscardBar onDiscard={onClose} onKeep={() => setConfirmDiscard(false)} />
        ) : (
          <>
            <button type="button" className="btn-secondary" onClick={requestClose}>
              {tr("取消")}
            </button>
            <button type="submit" form="stack-technology" className="btn-primary" disabled={saving}>
              {saving ? tr("保存中…") : technology ? tr("保存") : tr("添加")}
            </button>
          </>
        )
      }
    >
      <form id="stack-technology" onSubmit={submit} noValidate className="space-y-4">
        <Field
          label={tr("名称")}
          htmlFor="tech-name"
          hint={
            technology
              ? undefined
              : tr("输入名称搜索图标库，选中后自动填入名称和图标；找不到时可以作为自定义技术添加")
          }
        >
          {technology ? (
            <input
              id="tech-name"
              className="field"
              value={draft.name}
              maxLength={60}
              data-autofocus
              onChange={(e) => set("name", e.target.value)}
            />
          ) : (
            <IconCombobox
              id="tech-name"
              value={draft.name}
              autoFocus
              placeholder={tr("例如 React、Docker、Figma")}
              onChange={(text) => set("name", text)}
              onPick={(picked) => {
                setFile(null);
                setDraft((d) => ({
                  ...d,
                  name: picked.title,
                  icon: { provider: picked.provider, key: picked.key, url: picked.url }
                }));
              }}
              onCreate={(text) => {
                setFile(null);
                setDraft((d) => ({
                  ...d,
                  name: text,
                  icon: { provider: "none", key: null, url: null }
                }));
              }}
            />
          )}
        </Field>

        <Field label={tr("分类")} htmlFor="tech-category">
          <select
            id="tech-category"
            className="field"
            value={draft.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {pickText(c.name, tr("未命名分类"))}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-brand-dark">{tr("图标")}</p>
          <div className="flex items-center gap-3 rounded-xl p-2.5 ring-1 ring-line-soft">
            <TechIcon name={draft.name || "?"} url={shownIcon} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] break-words text-muted">{iconLabel}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="btn-secondary !px-2.5 !py-1 !text-[12px]"
                  onClick={() => fileInput.current?.click()}
                >
                  <ImageUp aria-hidden="true" className="size-3.5" />
                  {draft.icon.provider === "custom" ? tr("更换图标") : tr("上传图标")}
                </button>
                {draft.icon.provider !== "none" ? (
                  <button
                    type="button"
                    className="btn-secondary !px-2.5 !py-1 !text-[12px]"
                    onClick={() => {
                      setFile(null);
                      set("icon", { provider: "none", key: null, url: null });
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" /> {tr("移除图标")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
            className="hidden"
            aria-label={tr("上传图标文件")}
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
            {tr("上传 SVG、PNG 或 WebP（最大 2 MB）。SVG 会被安全地转成图片保存，保持原比例。")}
          </p>
          {previewFailed ? (
            <p className="mt-1 text-[11.5px] leading-relaxed text-faint" role="status">
              {tr("浏览器无法生成此文件的本地预览；保存后将显示服务端处理的图标。")}
            </p>
          ) : null}
          {technology ? (
            <div className="mt-2.5">
              <label htmlFor="tech-icon-search" className="mb-1 block text-[12px] text-muted">
                {tr("从图标库换一个")}
              </label>
              <IconCombobox
                id="tech-icon-search"
                value={iconSearch}
                placeholder={tr("搜索图标库")}
                onChange={setIconSearch}
                onPick={(picked) => {
                  setFile(null);
                  setIconSearch("");
                  set("icon", { provider: picked.provider, key: picked.key, url: picked.url });
                }}
              />
            </div>
          ) : null}
        </div>

        <Field
          label={tr("官方网站（可选）")}
          htmlFor="tech-website"
          hint={tr("网站上的技术详情里会给出官网链接；没有关联项目时，点击这项技术直接打开官网")}
        >
          <input
            id="tech-website"
            className="field"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={draft.websiteUrl}
            maxLength={2048}
            onChange={(e) => set("websiteUrl", e.target.value)}
          />
        </Field>

        <Field
          label={tr("关联项目（Related Projects）")}
          htmlFor="tech-projects"
          hint={tr("网站上点击这项技术时列出这些项目；未公开的项目只在后台可见")}
        >
          {projects.isError ? (
            <p role="alert" className="text-[12.5px] text-status-error">
              {tr("无法加载项目列表")}
            </p>
          ) : (
            <MultiCombobox
              id="tech-projects"
              options={options}
              value={draft.projectIds}
              onChange={(ids) => set("projectIds", ids)}
              placeholder={projects.isPending ? tr("加载项目中…") : tr("搜索项目名称")}
              listLabel={tr("项目")}
              emptyText={options.length ? tr("没有匹配的项目") : tr("还没有项目")}
            />
          )}
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-[12.5px] font-medium text-brand-dark">
            {tr("展示优先级")}
          </legend>
          <div className="inline-flex rounded-full bg-brand-secondary/10 p-0.5">
            {(
              [
                ["primary", "Primary"],
                ["standard", "Standard"]
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-full px-3.5 py-1 text-[12.5px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-secondary ${
                  draft.prominence === value ? "bg-brand text-white" : "text-brand"
                }`}
              >
                <input
                  type="radio"
                  name="tech-prominence"
                  value={value}
                  checked={draft.prominence === value}
                  onChange={() => set("prominence", value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
            {tr(
              "Primary 在网站上名称略微加粗，表示常用的主力技术；不是熟练度评分。顺序以列表排序为准。"
            )}
          </p>
        </fieldset>

        <Switch
          id="tech-visible"
          checked={draft.visible}
          onChange={(value) => set("visible", value)}
          label={tr("在网站上显示")}
        />

        {error ? (
          <p role="alert" className="text-[12.5px] text-status-error">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
