import type { AdminProject, AdminProjectUpdate, LocalizedText, ProjectImage, ProjectLinks, ProjectStatus } from "@liam-frost/shared";
import { ArrowLeft, ExternalLink, ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router";

import { Field, Switch } from "../components/ui/Field";
import { IconButton } from "../components/ui/IconButton";
import { useToast } from "../components/ui/Toast";
import { useProject, useProjectImages, useUpdateProject } from "../hooks/useProjects";
import { ApiError } from "../lib/api";
import { LANG_LABELS, LANGS, pickText, STATUS_LABELS, type Lang } from "../lib/i18n";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/tiff";

type Draft = {
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  body: LocalizedText;
  techStack: string[];
  links: Required<ProjectLinks>;
  status: ProjectStatus;
  startedAt: string;
  endedAt: string;
  featured: boolean;
  visibility: AdminProject["visibility"];
};

function toDraft(project: AdminProject): Draft {
  return {
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    body: project.body,
    techStack: project.techStack,
    links: { repo: project.links.repo ?? "", demo: project.links.demo ?? "", docs: project.links.docs ?? "" },
    status: project.status,
    startedAt: project.startedAt ?? "",
    endedAt: project.endedAt ?? "",
    featured: project.featured,
    visibility: project.visibility
  };
}

export function ProjectEditPage() {
  const { id = "" } = useParams();
  const { data: project, isPending, error } = useProject(id);

  if (isPending) return <p className="py-10 text-center text-[13px] text-subtle">加载中…</p>;
  if (error || !project) {
    return (
      <div className="card p-6 text-[13.5px]">
        <p role="alert" className="mb-3 text-status-error">
          {error instanceof ApiError && error.status === 404 ? "项目不存在" : (error?.message ?? "无法加载项目")}
        </p>
        <Link to="/projects" className="btn-secondary">
          返回项目列表
        </Link>
      </div>
    );
  }
  // Keyed so a different project (or a reload after save) starts from fresh draft state.
  return <ProjectEditor key={`${project.id}`} project={project} />;
}

function ProjectEditor({ project }: { project: AdminProject }) {
  const [draft, setDraft] = useState(() => toDraft(project));
  // Last saved state; texts are saved explicitly, so unsaved edits are tracked against it.
  const [saved, setSaved] = useState(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const [lang, setLang] = useState<Lang>("zh");
  const [error, setError] = useState("");
  const [techInput, setTechInput] = useState("");
  const update = useUpdateProject(project.id);
  const toast = useToast();

  // Closing or reloading the tab with unsaved texts asks for confirmation.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setText = (field: "title" | "summary" | "body", value: string) => setDraft((d) => ({ ...d, [field]: { ...d[field], [lang]: value } }));

  const addTech = () => {
    const value = techInput.trim();
    if (!value) return;
    if (!draft.techStack.some((t) => t.toLowerCase() === value.toLowerCase()) && draft.techStack.length < 20) {
      set("techStack", [...draft.techStack, value]);
    }
    setTechInput("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!Object.values(draft.title).some((t) => t?.trim())) {
      setError("请至少用一种语言填写标题");
      return;
    }
    if (draft.startedAt && draft.endedAt && draft.endedAt < draft.startedAt) {
      setError("结束月份不能早于开始月份");
      return;
    }
    setError("");
    const body: AdminProjectUpdate = {
      ...draft,
      startedAt: draft.startedAt || null,
      endedAt: draft.endedAt || null
    };
    update.mutate(body, {
      onSuccess: ({ project: next }) => {
        // Adopt the server's normalized values (trimmed slug, dropped empty links) as the new baseline.
        const normalized = toDraft(next);
        setDraft(normalized);
        setSaved(normalized);
        toast("已保存");
      },
      onError: (e) => setError(e instanceof ApiError && e.code === "SLUG_TAKEN" ? "这个网址名已被其它项目使用" : e.message)
    });
  };

  const title = pickText(draft.title, project.slug);

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          to="/projects"
          className="rounded-full p-1.5 text-subtle hover:bg-brand-secondary/12 hover:text-brand"
          aria-label="返回项目列表"
          onClick={(e) => {
            if (dirty && !window.confirm("有未保存的修改，确定离开吗？")) e.preventDefault();
          }}
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold text-brand-dark">{title}</h1>
        {project.visibility === "public" ? (
          <a href={`/#/projects/${project.slug}`} target="_blank" rel="noreferrer" className="btn-secondary">
            <ExternalLink aria-hidden="true" className="size-4" /> 查看页面
          </a>
        ) : null}
        {dirty ? (
          <span className="text-[12.5px] text-status-warn" role="status">
            有未保存的修改
          </span>
        ) : null}
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? "保存中…" : "保存"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl border border-status-error/30 bg-status-error/8 px-4 py-2.5 text-[12.5px] text-status-error">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="card min-w-0 p-5" aria-label="内容">
          <div role="tablist" aria-label="语言" className="mb-3 flex flex-wrap gap-1.5">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lang === l}
                onClick={() => setLang(l)}
                className={`rounded-full px-3 py-1.5 text-[12.5px] transition-colors ${
                  lang === l ? "bg-brand text-white" : "bg-brand-secondary/10 text-brand hover:bg-brand-secondary/18"
                }`}
              >
                {LANG_LABELS[l]}
                {draft.title[l]?.trim() ? "" : " ·"}
              </button>
            ))}
          </div>
          <p className="mb-4 text-[11.5px] text-faint">没填写的语言会在网站上回退到其它语言。标签页名后带 · 表示该语言还没有标题。</p>

          <div className="space-y-3.5">
            <Field label="标题" htmlFor="project-title">
              <input id="project-title" className="field" value={draft.title[lang] ?? ""} maxLength={120} onChange={(e) => setText("title", e.target.value)} />
            </Field>
            <Field label="一句话简介" htmlFor="project-summary" hint="显示在首页和项目列表的卡片上">
              <input id="project-summary" className="field" value={draft.summary[lang] ?? ""} maxLength={300} onChange={(e) => setText("summary", e.target.value)} />
            </Field>
            <Field label="正文" htmlFor="project-body" hint="支持 Markdown：## 小标题、**加粗**、- 列表、[链接](https://…)、```代码```">
              <textarea
                id="project-body"
                rows={18}
                className="field resize-y font-mono text-[13px] leading-relaxed"
                value={draft.body[lang] ?? ""}
                maxLength={20000}
                onChange={(e) => setText("body", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <div className="space-y-5">
          <Panel title="发布">
            <div className="flex flex-col items-start gap-2.5">
              <Switch id="project-public" checked={draft.visibility === "public"} onChange={(on) => set("visibility", on ? "public" : "private")} label="公开显示" />
              <Switch id="project-featured" checked={draft.featured} onChange={(on) => set("featured", on)} label="首页精选" />
            </div>
            <Field label="网址名" htmlFor="project-slug" hint={`/projects/${draft.slug || "…"}`}>
              <input id="project-slug" className="field" value={draft.slug} maxLength={80} onChange={(e) => set("slug", e.target.value.toLowerCase())} />
            </Field>
          </Panel>

          <Panel title="信息">
            <Field label="状态" htmlFor="project-status">
              <select id="project-status" className="field" value={draft.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
                {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="开始" htmlFor="project-start">
                <input id="project-start" type="month" className="field" value={draft.startedAt} onChange={(e) => set("startedAt", e.target.value)} />
              </Field>
              <Field label="结束" htmlFor="project-end" hint="进行中可留空">
                <input id="project-end" type="month" className="field" value={draft.endedAt} onChange={(e) => set("endedAt", e.target.value)} />
              </Field>
            </div>
            <Field label="技术栈" htmlFor="project-tech" hint="回车添加">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {draft.techStack.map((tech) => (
                  <span key={tech} className="chip inline-flex items-center gap-1">
                    {tech}
                    <button
                      type="button"
                      aria-label={`删除 ${tech}`}
                      onClick={() => set("techStack", draft.techStack.filter((t) => t !== tech))}
                      className="rounded-full hover:text-status-error"
                    >
                      <X aria-hidden="true" className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                id="project-tech"
                className="field"
                value={techInput}
                maxLength={30}
                placeholder="例如 React"
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTech();
                  }
                }}
                onBlur={addTech}
              />
            </Field>
          </Panel>

          <Panel title="链接">
            {(
              [
                ["repo", "代码仓库"],
                ["demo", "在线演示"],
                ["docs", "文档"]
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label} htmlFor={`project-link-${key}`}>
                <input
                  id={`project-link-${key}`}
                  type="url"
                  className="field"
                  placeholder="https://"
                  value={draft.links[key]}
                  onChange={(e) => set("links", { ...draft.links, [key]: e.target.value })}
                />
              </Field>
            ))}
          </Panel>

          <ImagesPanel project={project} />
        </div>
      </div>
    </form>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-3.5 p-4" aria-label={title}>
      <h2 className="text-[11px] font-bold tracking-[1px] text-brand-secondary">{title}</h2>
      {children}
    </section>
  );
}

/** Images are saved immediately on upload, independent of the text form. */
function ImagesPanel({ project }: { project: AdminProject }) {
  const { upload, remove } = useProjectImages(project.id);
  const update = useUpdateProject(project.id);
  const toast = useToast();
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"cover" | "gallery" | null>(null);

  const uploadFiles = async (slot: "cover" | "gallery", files: File[]) => {
    setPending(slot);
    for (const file of files) {
      try {
        await upload.mutateAsync({ slot, file });
      } catch (e) {
        toast(`${file.name}：${e instanceof Error ? e.message : "上传失败"}`, "error");
      }
    }
    setPending(null);
  };

  const removeImage = (image: ProjectImage) =>
    remove.mutate(image.id, { onError: (e) => toast(e.message, "error") });

  const moveGallery = (index: number, to: number) => {
    const ids = project.gallery.map((g) => g.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(to, 0, moved);
    update.mutate({ gallery: ids }, { onError: (e) => toast(e.message, "error") });
  };

  const fileInput = (ref: React.RefObject<HTMLInputElement | null>, slot: "cover" | "gallery", multiple: boolean) => (
    <input
      ref={ref}
      type="file"
      accept={ACCEPT}
      multiple={multiple}
      hidden
      onChange={(e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = "";
        if (files.length) void uploadFiles(slot, files);
      }}
    />
  );

  return (
    <Panel title="图片">
      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-brand-dark">封面</p>
        {project.cover ? (
          <div className="relative">
            <img src={project.cover.variants[0].url} alt="" className="w-full rounded-xl border border-line object-cover" style={{ aspectRatio: "16 / 9" }} />
            <div className="absolute top-2 right-2 rounded-full bg-white/90">
              <IconButton label="删除封面" onClick={() => removeImage(project.cover!)} danger>
                <Trash2 aria-hidden="true" className="size-4" />
              </IconButton>
            </div>
          </div>
        ) : null}
        <button type="button" className="btn-secondary mt-2 w-full" disabled={pending !== null} onClick={() => coverInput.current?.click()}>
          <ImagePlus aria-hidden="true" className="size-4" />
          {pending === "cover" ? "上传中…" : project.cover ? "更换封面" : "上传封面"}
        </button>
        {fileInput(coverInput, "cover", false)}
      </div>

      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-brand-dark">截图 {project.gallery.length ? `（${project.gallery.length}）` : ""}</p>
        {project.gallery.length ? (
          <ul className="grid grid-cols-2 gap-2">
            {project.gallery.map((image, index) => (
              <li key={image.id} className="overflow-hidden rounded-lg border border-line bg-white">
                <img src={image.variants[0].url} alt="" className="aspect-video w-full object-cover" />
                <div className="flex items-center justify-end">
                  <IconButton label={`截图 ${index + 1} 前移`} disabled={index === 0 || update.isPending} onClick={() => moveGallery(index, index - 1)}>
                    <ArrowLeft aria-hidden="true" className="size-3.5" />
                  </IconButton>
                  <IconButton label={`删除截图 ${index + 1}`} onClick={() => removeImage(image)} danger>
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <button type="button" className="btn-secondary mt-2 w-full" disabled={pending !== null || project.gallery.length >= 30} onClick={() => galleryInput.current?.click()}>
          <ImagePlus aria-hidden="true" className="size-4" />
          {pending === "gallery" ? "上传中…" : "添加截图"}
        </button>
        {fileInput(galleryInput, "gallery", true)}
      </div>
    </Panel>
  );
}
