import type {
  AdminPhoto,
  AdminPhotoImport,
  AdminPhotoUpdate,
  LocalizedText
} from "@liam-frost/shared";
import { CloudDownload, ExternalLink, Plus, Replace, X } from "lucide-react";
import { useState, type FormEvent, useId } from "react";

import { useSetPhoto, useUpdatePhoto } from "../../hooks/usePhotos";
import { api, uploadPhotoImage } from "../../lib/api";
import { type Lang } from "../../lib/i18n";
import { Dialog } from "../ui/Dialog";
import { Field, Switch } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { RecentStats } from "../analytics/RecentStats";
import { Tooltip } from "../ui/Tooltip";
import { ImageSourcePicker, sourceLabel } from "./ImageSourcePicker";
import { tr } from "../../lib/messages";
import { LanguageTabPanel, LanguageTabs } from "../ui/LanguageTabs";

type Draft = {
  title: LocalizedText;
  category: LocalizedText;
  location: LocalizedText;
  description: LocalizedText;
  alt: LocalizedText;
  tags: LocalizedText[];
  date: string;
  camera: string;
  lens: string;
  settings: string;
  visibility: AdminPhoto["visibility"];
  featured: boolean;
};

type TextField = "title" | "category" | "location" | "description" | "alt";

function toDraft(photo: AdminPhoto): Draft {
  return {
    title: photo.title,
    category: photo.category,
    location: photo.location ?? {},
    description: photo.description ?? {},
    alt: photo.alt,
    tags: photo.tags,
    date: photo.date,
    camera: photo.camera ?? "",
    lens: photo.lens ?? "",
    settings: photo.settings ?? "",
    visibility: photo.visibility,
    featured: photo.featured
  };
}

function hasText(value: LocalizedText) {
  return Object.values(value).some((text) => text?.trim());
}

/** Edit form for one photo: per-language texts in tabs, shared fields below. */
export function PhotoEditor({
  photo: initial,
  onClose
}: {
  photo: AdminPhoto;
  onClose: () => void;
}) {
  // The image can change while editing (替换图片 / 转为本站托管); the details stay in the draft.
  const [photo, setCurrent] = useState(initial);
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [replacing, setReplacing] = useState(false);
  const [useExif, setUseExif] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const setPhoto = useSetPhoto();
  const [lang, setLang] = useState<Lang>("zh");
  const languageTabs = useId();
  const [error, setError] = useState("");
  const update = useUpdatePhoto();
  const toast = useToast();

  const setText = (field: TextField, value: string) =>
    setDraft((d) => ({ ...d, [field]: { ...d[field], [lang]: value } }));
  const setTag = (index: number, value: string) =>
    setDraft((d) => ({
      ...d,
      tags: d.tags.map((tag, i) => (i === index ? { ...tag, [lang]: value } : tag))
    }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!hasText(draft.title)) {
      setError(tr("请至少用一种语言填写标题"));
      return;
    }
    setError("");
    const body: AdminPhotoUpdate = {
      ...draft,
      location: hasText(draft.location) ? draft.location : null,
      description: hasText(draft.description) ? draft.description : null,
      tags: draft.tags.filter(hasText),
      camera: draft.camera || null,
      lens: draft.lens || null,
      settings: draft.settings || null
    };
    update.mutate(
      { id: photo.id, update: body },
      {
        onSuccess: () => {
          toast(tr("已保存"));
          onClose();
        },
        onError: (e) => setError(e.message)
      }
    );
  };

  /** A new image on the photo: shown here, written into the list, and (with EXIF) into the draft. */
  const applyImage = (next: AdminPhoto, message: string) => {
    setCurrent(next);
    setPhoto(next);
    if (useExif)
      setDraft((d) => ({
        ...d,
        date: next.date,
        camera: next.camera ?? "",
        lens: next.lens ?? "",
        settings: next.settings ?? ""
      }));
    setReplacing(false);
    toast(message);
  };

  const runImage = async (work: () => Promise<{ photo: AdminPhoto }>, message: string) => {
    setImageBusy(true);
    setImageError("");
    try {
      applyImage((await work()).photo, message);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : tr("操作失败"));
    } finally {
      setImageBusy(false);
    }
  };

  const replaceWithFile = (files: File[]) =>
    runImage(() => uploadPhotoImage(photo.id, files[0]!, useExif), tr("已替换图片"));
  const replaceWithImport = (items: AdminPhotoImport[]) =>
    runImage(() => api.replacePhotoImage(photo.id, { ...items[0]!, useExif }), tr("已替换图片"));
  const host = () => runImage(() => api.hostPhoto(photo.id), tr("已转为本站托管"));

  const formId = `photo-editor-${photo.id}`;
  const source = photo.source;

  return (
    <Dialog
      open
      title={tr("编辑照片")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr("取消")}
          </button>
          <button type="submit" form={formId} className="btn-primary" disabled={update.isPending}>
            {update.isPending ? tr("保存中…") : tr("保存")}
          </button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={submit}
        noValidate
        className="grid gap-5 md:grid-cols-[220px_1fr]"
      >
        <div className="space-y-3">
          <RecentStats type="photo" id={photo.id} />
          <img
            src={photo.thumbnail}
            alt=""
            className="w-full rounded-xl border border-line bg-line-soft object-cover"
            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
          />
          <p className="text-[11.5px] leading-relaxed text-faint">
            {photo.width} × {photo.height}
            <br />
            ID：{photo.id}
          </p>
          <section
            aria-label={tr("图片")}
            className="space-y-2 rounded-xl border border-line-soft p-3 text-[12px]"
          >
            <p className="text-muted">
              {tr("来源：")}
              <span className="text-ink">{source ? sourceLabel(source) : tr("未记录")}</span>
              {source?.importedAt ? (
                <span className="text-faint"> · {source.importedAt.slice(0, 10)}</span>
              ) : null}
            </p>
            {source?.ref ? (
              <Tooltip content={source.ref} describe={false} className="block min-w-0">
                <p className="truncate font-mono text-[11px] text-faint">{source.ref}</p>
              </Tooltip>
            ) : null}
            <p className="text-muted">
              {tr("存放：")}
              {photo.storage === "local" ? (
                <span className="text-ink">{tr("本站托管")}</span>
              ) : (
                <a
                  href={photo.src}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  {tr("只引用原链接")} <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={imageBusy}
                onClick={() => {
                  setImageError("");
                  setReplacing(true);
                }}
              >
                <Replace aria-hidden="true" className="size-3.5" />
                {tr("替换图片")}
              </button>
              {photo.storage === "remote-url" ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={imageBusy}
                  onClick={() => void host()}
                >
                  <CloudDownload aria-hidden="true" className="size-3.5" />
                  {imageBusy ? tr("处理中…") : tr("转为本站托管")}
                </button>
              ) : null}
            </div>
            {imageError && !replacing ? (
              <p role="alert" className="text-status-error">
                {imageError}
              </p>
            ) : null}
          </section>
          <div className="flex flex-col items-start gap-2.5">
            <Switch
              id="photo-public"
              checked={draft.visibility === "public"}
              onChange={(on) => setDraft((d) => ({ ...d, visibility: on ? "public" : "private" }))}
              label={tr("公开显示")}
            />
            <Switch
              id="photo-featured"
              checked={draft.featured}
              onChange={(on) => setDraft((d) => ({ ...d, featured: on }))}
              label={tr("首页精选")}
            />
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <LanguageTabs
              id={languageTabs}
              value={lang}
              onChange={setLang}
              isFilled={(l) => Boolean(draft.title[l]?.trim())}
              mark="missing"
              className="mb-3"
            />
            <p className="mb-3 text-[11.5px] text-faint">
              {tr("没填写的语言会在网站上回退到其它语言。标签页名后带 · 表示该语言还没有标题。")}
            </p>

            <LanguageTabPanel id={languageTabs} lang={lang} className="grid gap-3.5 sm:grid-cols-2">
              <Field label={tr("标题")} htmlFor="photo-title">
                <input
                  id="photo-title"
                  className="field"
                  value={draft.title[lang] ?? ""}
                  onChange={(e) => setText("title", e.target.value)}
                  maxLength={120}
                />
              </Field>
              <Field
                label={tr("分类")}
                htmlFor="photo-category"
                hint={tr("例如：城市、街头、建筑")}
              >
                <input
                  id="photo-category"
                  className="field"
                  value={draft.category[lang] ?? ""}
                  onChange={(e) => setText("category", e.target.value)}
                  maxLength={40}
                />
              </Field>
              <Field label={tr("地点")} htmlFor="photo-location" className="sm:col-span-2">
                <input
                  id="photo-location"
                  className="field"
                  value={draft.location[lang] ?? ""}
                  onChange={(e) => setText("location", e.target.value)}
                  maxLength={120}
                />
              </Field>
              <Field label={tr("描述")} htmlFor="photo-description" className="sm:col-span-2">
                <textarea
                  id="photo-description"
                  rows={3}
                  className="field resize-y"
                  value={draft.description[lang] ?? ""}
                  onChange={(e) => setText("description", e.target.value)}
                  maxLength={1000}
                />
              </Field>
              <Field
                label={tr("替代文本")}
                htmlFor="photo-alt"
                hint={tr("给读屏软件和图片加载失败时使用，描述画面内容")}
                className="sm:col-span-2"
              >
                <input
                  id="photo-alt"
                  className="field"
                  value={draft.alt[lang] ?? ""}
                  onChange={(e) => setText("alt", e.target.value)}
                  maxLength={300}
                />
              </Field>
            </LanguageTabPanel>

            <fieldset className="mt-3.5">
              <legend className="mb-1.5 text-[12.5px] font-medium text-brand-dark">
                {tr("标签")}
              </legend>
              <div className="flex flex-wrap gap-2">
                {draft.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 rounded-xl border border-line bg-white py-1 pr-1 pl-2"
                  >
                    <input
                      aria-label={tr("标签 {0}", index + 1)}
                      className="w-24 bg-transparent text-[13px] outline-none"
                      value={tag[lang] ?? ""}
                      placeholder={Object.values(tag).find(Boolean) ?? ""}
                      onChange={(e) => setTag(index, e.target.value)}
                      maxLength={40}
                    />
                    <button
                      type="button"
                      aria-label={tr("删除标签 {0}", index + 1)}
                      onClick={() =>
                        setDraft((d) => ({ ...d, tags: d.tags.filter((_, i) => i !== index) }))
                      }
                      className="rounded-full p-1 text-faint hover:bg-brand-secondary/12 hover:text-brand"
                    >
                      <X aria-hidden="true" className="size-3" />
                    </button>
                  </span>
                ))}
                {draft.tags.length < 20 ? (
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1.5"
                    onClick={() => setDraft((d) => ({ ...d, tags: [...d.tags, {}] }))}
                  >
                    <Plus aria-hidden="true" className="size-3.5" /> {tr("添加标签")}
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-[11.5px] text-faint">
                {tr("每个标签在各语言下分别填写，占位文字是其它语言的内容。")}
              </p>
            </fieldset>
          </div>

          <div className="grid gap-3.5 border-t border-line-soft pt-4 sm:grid-cols-2">
            <Field label={tr("拍摄日期")} htmlFor="photo-date">
              <input
                id="photo-date"
                type="date"
                className="field"
                value={draft.date}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                required
              />
            </Field>
            <Field label={tr("相机")} htmlFor="photo-camera">
              <input
                id="photo-camera"
                className="field"
                value={draft.camera}
                onChange={(e) => setDraft((d) => ({ ...d, camera: e.target.value }))}
                maxLength={120}
              />
            </Field>
            <Field label={tr("镜头")} htmlFor="photo-lens">
              <input
                id="photo-lens"
                className="field"
                value={draft.lens}
                onChange={(e) => setDraft((d) => ({ ...d, lens: e.target.value }))}
                maxLength={120}
              />
            </Field>
            <Field
              label={tr("拍摄参数")}
              htmlFor="photo-settings"
              hint={tr("例如：1/100 · f/4 · ISO 800")}
            >
              <input
                id="photo-settings"
                className="field"
                value={draft.settings}
                onChange={(e) => setDraft((d) => ({ ...d, settings: e.target.value }))}
                maxLength={120}
              />
            </Field>
          </div>

          {error ? (
            <p role="alert" className="text-[12.5px] text-status-error">
              {error}
            </p>
          ) : null}
        </div>
      </form>
      <Dialog
        open={replacing}
        title={tr("替换图片")}
        onClose={() => !imageBusy && setReplacing(false)}
      >
        <div className="space-y-4">
          <p className="text-[13px] text-muted">
            {tr("标题、说明、排序和公开状态都保留；原来由本站托管的图片文件会删除。")}
          </p>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={useExif}
              onChange={(e) => setUseExif(e.target.checked)}
            />
            {tr("用新图片的 EXIF 覆盖拍摄日期和相机信息")}
          </label>
          <ImageSourcePicker
            multiple={false}
            busy={imageBusy}
            action={imageBusy ? tr("处理中…") : tr("替换")}
            onFiles={(files) => void replaceWithFile(files)}
            onImports={(items) => void replaceWithImport(items)}
          />
          {imageError ? (
            <p role="alert" className="text-[12.5px] text-status-error">
              {imageError}
            </p>
          ) : null}
        </div>
      </Dialog>
    </Dialog>
  );
}
