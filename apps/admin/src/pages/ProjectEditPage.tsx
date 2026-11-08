import LoadingSkeleton from "../../../web/src/components/LoadingSkeleton";
import type {
  AdminProject,
  AdminStackTechnology,
  AdminProjectUpdate,
  LocalizedText,
  ProjectImage,
  ProjectLinks,
  ProjectStatus
} from "@liam-frost/shared";
import { ArrowLeft, ExternalLink, ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, useId } from "react";
import { Link, useParams } from "react-router";

import { technologyOptions } from "../components/stack/linkOptions";
import { Field, Switch } from "../components/ui/Field";
import { MultiCombobox } from "../components/ui/MultiCombobox";
import { IconButton } from "../components/ui/IconButton";
import { Panel } from "../components/ui/Panel";
import { useToast } from "../components/ui/Toast";
import { useProject, useProjectImages, useUpdateProject } from "../hooks/useProjects";
import { useStack } from "../hooks/useStack";
import { ApiError } from "../lib/api";
import { pickText, STATUS_LABELS, type Lang } from "../lib/i18n";
import { RecentStats } from "../components/analytics/RecentStats";
import { tr } from "../lib/messages";
import { Select } from "../components/ui/Select";
import { LanguageTabPanel, LanguageTabs } from "../components/ui/LanguageTabs";
import { useUnsaved } from "../lib/unsaved";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/tiff";

type Draft = {
  slug: string;
  title: LocalizedText;
  summary: LocalizedText;
  body: LocalizedText;
  technologyIds: string[];
  otherTechnologies: string[];
  links: Required<ProjectLinks>;
  status: ProjectStatus;
  startedAt: string;
  endedAt: string;
  featured: boolean;
  visibility: AdminProject["visibility"];
};

/** Same technology name, ignoring case, spaces, '.', '-' and '_' ("SpringBoot" is "Spring Boot"). */
const techKey = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

function toDraft(project: AdminProject): Draft {
  return {
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    body: project.body,
    technologyIds: project.technologyIds,
    otherTechnologies: project.otherTechnologies,
    links: {
      repo: project.links.repo ?? "",
      demo: project.links.demo ?? "",
      docs: project.links.docs ?? ""
    },
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

  if (isPending) return <LoadingSkeleton label={tr("加载中…")} variant="form" />;
  if (error || !project) {
    return (
      <div className="card p-6 text-[13.5px]">
        <p role="alert" className="mb-3 text-status-error">
          {error instanceof ApiError && error.status === 404
            ? tr("项目不存在")
            : (error?.message ?? tr("无法加载项目"))}
        </p>
        <Link to="/projects" className="btn-secondary">
          {tr("返回项目列表")}
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

  // The project can change elsewhere (its links, from the stack page) and arrive after the editor
  // opened with a cached copy: follow it while nothing is edited here.
  useEffect(() => {
    if (dirty) return;
    const next = toDraft(project);
    setDraft(next);
    setSaved(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the project data changes
  }, [project]);
  const [lang, setLang] = useState<Lang>("zh");
  const languageTabs = useId();
  const [error, setError] = useState("");
  const [techInput, setTechInput] = useState("");
  const update = useUpdateProject(project.id);
  const toast = useToast();

  // Closing or reloading the tab with unsaved texts asks for confirmation.
  useUnsaved(dirty, "page");

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setText = (field: "title" | "summary" | "body", value: string) =>
    setDraft((d) => ({ ...d, [field]: { ...d[field], [lang]: value } }));

  const stack = useStack();
  const technologyChoices = useMemo(() => technologyOptions(stack.data ?? []), [stack.data]);
  // Technologies by name; null when several have it (namesakes in two categories): pick one in the list.
  const stackByKey = useMemo(() => {
    const map = new Map<string, AdminStackTechnology | null>();
    for (const t of (stack.data ?? []).flatMap((c) => c.technologies)) {
      const key = techKey(t.name);
      map.set(key, map.has(key) ? null : t);
    }
    return map;
  }, [stack.data]);

  const addTech = () => {
    const value = techInput.trim();
    if (!value) return;
    // A name the stack has becomes a link instead of a plain name.
    const inStack = stackByKey.get(techKey(value));
    if (inStack === null) {
      setError(tr("技术栈里有多个“{0}”，请在上面的技术栈列表里选择", value));
      return;
    }
    if (inStack) {
      if (!draft.technologyIds.includes(inStack.id))
        set("technologyIds", [...draft.technologyIds, inStack.id]);
    } else if (
      !draft.otherTechnologies.some((t) => t.toLowerCase() === value.toLowerCase()) &&
      draft.otherTechnologies.length < 20
    ) {
      set("otherTechnologies", [...draft.otherTechnologies, value]);
    }
    setTechInput("");
  };

  /** Turns a plain name into a link to the technology of the same name. */
  const linkOther = (name: string, technologyId: string) =>
    setDraft((d) => ({
      ...d,
      otherTechnologies: d.otherTechnologies.filter((t) => t !== name),
      technologyIds: d.technologyIds.includes(technologyId)
        ? d.technologyIds
        : [...d.technologyIds, technologyId]
    }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!Object.values(draft.title).some((t) => t?.trim())) {
      setError(tr("请至少用一种语言填写标题"));
      return;
    }
    if (draft.startedAt && draft.endedAt && draft.endedAt < draft.startedAt) {
      setError(tr("结束月份不能早于开始月份"));
      return;
    }
    setError("");
    const { technologyIds, otherTechnologies, ...fields } = draft;
    const body: AdminProjectUpdate = {
      ...fields,
      startedAt: draft.startedAt || null,
      endedAt: draft.endedAt || null,
      // Links are also edited from the stack page: send them only when changed here, so an
      // unrelated save never writes back an older list.
      ...(sameList(technologyIds, saved.technologyIds) ? {} : { technologyIds }),
      ...(sameList(otherTechnologies, saved.otherTechnologies) ? {} : { otherTechnologies })
    };
    update.mutate(body, {
      onSuccess: ({ project: next }) => {
        // Adopt the server's normalized values (trimmed slug, dropped empty links) as the new baseline.
        const normalized = toDraft(next);
        setDraft(normalized);
        setSaved(normalized);
        toast(tr("已保存"));
      },
      onError: (e) =>
        setError(
          e instanceof ApiError && e.code === "SLUG_TAKEN"
            ? tr("这个网址名已被其它项目使用")
            : e instanceof ApiError && e.code === "UNKNOWN_TECHNOLOGY"
              ? tr("有关联的技术已从技术栈删除，请刷新后重试")
              : e instanceof ApiError && e.code === "TOO_MANY_PROJECTS"
                ? tr("有技术关联的项目已达上限：{0}", e.message)
                : e.message
        )
    });
  };

  const title = pickText(draft.title, project.slug);

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          to="/projects"
          className="rounded-full p-1.5 text-subtle hover:bg-brand-secondary/12 hover:text-brand"
          aria-label={tr("返回项目列表")}
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold text-brand-dark">
          {title}
        </h1>
        <RecentStats type="project" id={project.slug} />
        {project.visibility === "public" ? (
          <a
            href={`/#/projects/${project.slug}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            <ExternalLink aria-hidden="true" className="size-4" /> {tr("查看页面")}
          </a>
        ) : null}
        {dirty ? (
          <span className="text-[12.5px] text-status-warn" role="status">
            {tr("有未保存的修改")}
          </span>
        ) : null}
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? tr("保存中…") : tr("保存")}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-status-error/30 bg-status-error/8 px-4 py-2.5 text-[12.5px] text-status-error"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="card min-w-0 p-5" aria-label={tr("内容")}>
          <LanguageTabs
            id={languageTabs}
            value={lang}
            onChange={setLang}
            isFilled={(l) => Boolean(draft.title[l]?.trim())}
            mark="missing"
            className="mb-3"
          />
          <p className="mb-4 text-[11.5px] text-faint">
            {tr("没填写的语言会在网站上回退到其它语言。标签页名后带 · 表示该语言还没有标题。")}
          </p>

          <LanguageTabPanel id={languageTabs} lang={lang} className="space-y-3.5">
            <Field label={tr("标题")} htmlFor="project-title">
              <input
                id="project-title"
                className="field"
                value={draft.title[lang] ?? ""}
                maxLength={120}
                onChange={(e) => setText("title", e.target.value)}
              />
            </Field>
            <Field
              label={tr("一句话简介")}
              htmlFor="project-summary"
              hint={tr("显示在首页和项目列表的卡片上")}
            >
              <input
                id="project-summary"
                className="field"
                value={draft.summary[lang] ?? ""}
                maxLength={300}
                onChange={(e) => setText("summary", e.target.value)}
              />
            </Field>
            <Field
              label={tr("正文")}
              htmlFor="project-body"
              hint={tr("支持 Markdown：## 小标题、**加粗**、- 列表、[链接](https://…)、```代码```")}
            >
              <textarea
                id="project-body"
                rows={18}
                className="field resize-y font-mono text-[13px] leading-relaxed"
                value={draft.body[lang] ?? ""}
                maxLength={20000}
                onChange={(e) => setText("body", e.target.value)}
              />
            </Field>
          </LanguageTabPanel>
        </section>

        <div className="space-y-5">
          <Panel title={tr("发布")}>
            <div className="flex flex-col items-start gap-2.5">
              <Switch
                id="project-public"
                checked={draft.visibility === "public"}
                onChange={(on) => set("visibility", on ? "public" : "private")}
                label={tr("公开显示")}
              />
              <Switch
                id="project-featured"
                checked={draft.featured}
                onChange={(on) => set("featured", on)}
                label={tr("首页精选")}
              />
            </div>
            <Field
              label={tr("网址名")}
              htmlFor="project-slug"
              hint={`/projects/${draft.slug || "…"}`}
            >
              <input
                id="project-slug"
                className="field"
                value={draft.slug}
                maxLength={80}
                onChange={(e) => set("slug", e.target.value.toLowerCase())}
              />
            </Field>
          </Panel>

          <Panel title={tr("信息")}>
            <Field label={tr("状态")} htmlFor="project-status">
              <Select
                id="project-status"
                value={draft.status}
                onChange={(value) => set("status", value as ProjectStatus)}
                options={[
                  ...(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((status) => ({
                    value: status,
                    label: STATUS_LABELS[status]
                  }))
                ]}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("开始")} htmlFor="project-start">
                <input
                  id="project-start"
                  type="month"
                  className="field"
                  value={draft.startedAt}
                  onChange={(e) => set("startedAt", e.target.value)}
                />
              </Field>
              <Field label={tr("结束")} htmlFor="project-end" hint={tr("进行中可留空")}>
                <input
                  id="project-end"
                  type="month"
                  className="field"
                  value={draft.endedAt}
                  onChange={(e) => set("endedAt", e.target.value)}
                />
              </Field>
            </div>
            <Field
              label={tr("技术栈")}
              htmlFor="project-technologies"
              hint={tr("从首页技术栈中选择；技术栈管理页会同步显示这个项目")}
            >
              {stack.isError ? (
                <p role="alert" className="text-[12.5px] text-status-error">
                  {tr("无法加载技术栈")}
                </p>
              ) : (
                <MultiCombobox
                  id="project-technologies"
                  options={technologyChoices}
                  value={draft.technologyIds}
                  onChange={(ids) => set("technologyIds", ids)}
                  placeholder={stack.isPending ? tr("加载技术栈中…") : tr("搜索技术名称")}
                  listLabel={tr("技术栈中的技术")}
                  emptyText={
                    technologyChoices.length ? tr("技术栈里没有这项技术") : tr("技术栈还是空的")
                  }
                  max={40}
                />
              )}
            </Field>
            <Field
              label={tr("其他技术（不在技术栈中）")}
              htmlFor="project-tech"
              hint={tr("只作为项目的标签显示，回车添加；输入技术栈里已有的名称会自动改为关联")}
            >
              <div className="mb-2 flex flex-wrap gap-1.5">
                {draft.otherTechnologies.map((tech) => {
                  const match = stackByKey.get(techKey(tech));
                  return (
                    <span key={tech} className="chip inline-flex items-center gap-1">
                      {tech}
                      {match ? (
                        <button
                          type="button"
                          onClick={() => linkOther(tech, match.id)}
                          className="rounded-full px-1 text-[11px] text-brand underline-offset-2 hover:underline"
                          title={tr("改为关联技术栈中的 {0}", match.name)}
                        >
                          {tr("关联")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={tr("删除 {0}", tech)}
                        onClick={() =>
                          set(
                            "otherTechnologies",
                            draft.otherTechnologies.filter((t) => t !== tech)
                          )
                        }
                        className="rounded-full hover:text-status-error"
                      >
                        <X aria-hidden="true" className="size-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
              <input
                id="project-tech"
                className="field"
                value={techInput}
                maxLength={30}
                placeholder={tr("例如 Fastify")}
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

          <Panel title={tr("链接")}>
            {(
              [
                ["repo", tr("代码仓库")],
                ["demo", tr("在线演示")],
                ["docs", tr("文档")]
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
        toast(`${file.name}：${e instanceof Error ? e.message : tr("上传失败")}`, "error");
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

  const fileInput = (
    ref: React.RefObject<HTMLInputElement | null>,
    slot: "cover" | "gallery",
    multiple: boolean
  ) => (
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
    <Panel title={tr("图片")}>
      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-brand-dark">{tr("封面")}</p>
        {project.cover ? (
          <div className="relative">
            <img
              src={project.cover.variants[0].url}
              alt=""
              className="w-full rounded-xl border border-line object-cover"
              style={{ aspectRatio: "2 / 1" }}
            />
            <div className="absolute top-2 right-2 rounded-full bg-white/90">
              <IconButton label={tr("删除封面")} onClick={() => removeImage(project.cover!)} danger>
                <Trash2 aria-hidden="true" className="size-4" />
              </IconButton>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="btn-secondary mt-2 w-full"
          disabled={pending !== null}
          onClick={() => coverInput.current?.click()}
        >
          <ImagePlus aria-hidden="true" className="size-4" />
          {pending === "cover" ? tr("上传中…") : project.cover ? tr("更换封面") : tr("上传封面")}
        </button>
        {fileInput(coverInput, "cover", false)}
        {/* The site's cards frame covers at 2:1 (apps/web .projectCover). */}
        <p className="mt-1.5 text-[12px] text-faint">
          {tr("建议 2:1，例如 1280×640（GitHub Social preview 的尺寸），在网站卡片上完整显示。")}
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-brand-dark">
          {tr("截图 {0}", project.gallery.length ? `（${project.gallery.length}）` : "")}
        </p>
        {project.gallery.length ? (
          <ul className="grid grid-cols-2 gap-2">
            {project.gallery.map((image, index) => (
              <li key={image.id} className="overflow-hidden rounded-lg border border-line bg-white">
                <img
                  src={image.variants[0].url}
                  alt=""
                  className="aspect-video w-full object-cover"
                />
                <div className="flex items-center justify-end">
                  <IconButton
                    label={tr("截图 {0} 前移", index + 1)}
                    disabled={index === 0 || update.isPending}
                    onClick={() => moveGallery(index, index - 1)}
                  >
                    <ArrowLeft aria-hidden="true" className="size-3.5" />
                  </IconButton>
                  <IconButton
                    label={tr("删除截图 {0}", index + 1)}
                    onClick={() => removeImage(image)}
                    danger
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          className="btn-secondary mt-2 w-full"
          disabled={pending !== null || project.gallery.length >= 30}
          onClick={() => galleryInput.current?.click()}
        >
          <ImagePlus aria-hidden="true" className="size-4" />
          {pending === "gallery" ? tr("上传中…") : tr("添加截图")}
        </button>
        {fileInput(galleryInput, "gallery", true)}
      </div>
    </Panel>
  );
}
