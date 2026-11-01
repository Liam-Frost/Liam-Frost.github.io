import type { AdminPhoto, AdminPhotoUpdate, LocalizedText } from "@liam-frost/shared";
import { Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useUpdatePhoto } from "../../hooks/usePhotos";
import { LANG_LABELS, LANGS, type Lang } from "../../lib/i18n";
import { Dialog } from "../ui/Dialog";
import { Field, Switch } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { RecentStats } from "../analytics/RecentStats";

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
export function PhotoEditor({ photo, onClose }: { photo: AdminPhoto; onClose: () => void }) {
  const [draft, setDraft] = useState(() => toDraft(photo));
  const [lang, setLang] = useState<Lang>("zh");
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
      setError("请至少用一种语言填写标题");
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
          toast("已保存");
          onClose();
        },
        onError: (e) => setError(e.message)
      }
    );
  };

  const formId = `photo-editor-${photo.id}`;

  return (
    <Dialog
      open
      title="编辑照片"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" form={formId} className="btn-primary" disabled={update.isPending}>
            {update.isPending ? "保存中…" : "保存"}
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
          <div className="flex flex-col items-start gap-2.5">
            <Switch
              id="photo-public"
              checked={draft.visibility === "public"}
              onChange={(on) => setDraft((d) => ({ ...d, visibility: on ? "public" : "private" }))}
              label="公开显示"
            />
            <Switch
              id="photo-featured"
              checked={draft.featured}
              onChange={(on) => setDraft((d) => ({ ...d, featured: on }))}
              label="首页精选"
            />
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <div role="tablist" aria-label="语言" className="mb-3 flex flex-wrap gap-1.5">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={lang === l}
                  onClick={() => setLang(l)}
                  className={`rounded-full px-3 py-1.5 text-[12.5px] transition-colors ${
                    lang === l
                      ? "bg-brand text-white"
                      : "bg-brand-secondary/10 text-brand hover:bg-brand-secondary/18"
                  }`}
                >
                  {LANG_LABELS[l]}
                  {draft.title[l]?.trim() ? "" : " ·"}
                </button>
              ))}
            </div>
            <p className="mb-3 text-[11.5px] text-faint">
              没填写的语言会在网站上回退到其它语言。标签页名后带 · 表示该语言还没有标题。
            </p>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="标题" htmlFor="photo-title">
                <input
                  id="photo-title"
                  className="field"
                  value={draft.title[lang] ?? ""}
                  onChange={(e) => setText("title", e.target.value)}
                  maxLength={120}
                />
              </Field>
              <Field label="分类" htmlFor="photo-category" hint="例如：城市、街头、建筑">
                <input
                  id="photo-category"
                  className="field"
                  value={draft.category[lang] ?? ""}
                  onChange={(e) => setText("category", e.target.value)}
                  maxLength={40}
                />
              </Field>
              <Field label="地点" htmlFor="photo-location" className="sm:col-span-2">
                <input
                  id="photo-location"
                  className="field"
                  value={draft.location[lang] ?? ""}
                  onChange={(e) => setText("location", e.target.value)}
                  maxLength={120}
                />
              </Field>
              <Field label="描述" htmlFor="photo-description" className="sm:col-span-2">
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
                label="替代文本"
                htmlFor="photo-alt"
                hint="给读屏软件和图片加载失败时使用，描述画面内容"
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
            </div>

            <fieldset className="mt-3.5">
              <legend className="mb-1.5 text-[12.5px] font-medium text-brand-dark">标签</legend>
              <div className="flex flex-wrap gap-2">
                {draft.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 rounded-xl border border-line bg-white py-1 pr-1 pl-2"
                  >
                    <input
                      aria-label={`标签 ${index + 1}`}
                      className="w-24 bg-transparent text-[13px] outline-none"
                      value={tag[lang] ?? ""}
                      placeholder={Object.values(tag).find(Boolean) ?? ""}
                      onChange={(e) => setTag(index, e.target.value)}
                      maxLength={40}
                    />
                    <button
                      type="button"
                      aria-label={`删除标签 ${index + 1}`}
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
                    <Plus aria-hidden="true" className="size-3.5" /> 添加标签
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-[11.5px] text-faint">
                每个标签在各语言下分别填写，占位文字是其它语言的内容。
              </p>
            </fieldset>
          </div>

          <div className="grid gap-3.5 border-t border-line-soft pt-4 sm:grid-cols-2">
            <Field label="拍摄日期" htmlFor="photo-date">
              <input
                id="photo-date"
                type="date"
                className="field"
                value={draft.date}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                required
              />
            </Field>
            <Field label="相机" htmlFor="photo-camera">
              <input
                id="photo-camera"
                className="field"
                value={draft.camera}
                onChange={(e) => setDraft((d) => ({ ...d, camera: e.target.value }))}
                maxLength={120}
              />
            </Field>
            <Field label="镜头" htmlFor="photo-lens">
              <input
                id="photo-lens"
                className="field"
                value={draft.lens}
                onChange={(e) => setDraft((d) => ({ ...d, lens: e.target.value }))}
                maxLength={120}
              />
            </Field>
            <Field label="拍摄参数" htmlFor="photo-settings" hint="例如：1/100 · f/4 · ISO 800">
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
    </Dialog>
  );
}
