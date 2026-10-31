import type { AdminProject } from "@liam-frost/shared";
import { ArrowDown, ArrowUp, EyeOff, FolderKanban, Plus, Star, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { PageHeader } from "../components/layout/AdminLayout";
import { Dialog } from "../components/ui/Dialog";
import { Field } from "../components/ui/Field";
import { useToast } from "../components/ui/Toast";
import { useCreateProject, useDeleteProject, useProjects, useReorderProjects } from "../hooks/useProjects";
import { ApiError } from "../lib/api";
import { pickText, STATUS_LABELS, suggestSlug } from "../lib/i18n";

export function ProjectsPage() {
  const { data: projects, isPending, error } = useProjects();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminProject | null>(null);
  const reorder = useReorderProjects();
  const remove = useDeleteProject();
  const toast = useToast();

  if (isPending) return <p className="py-10 text-center text-[13px] text-subtle">加载中…</p>;
  if (error) {
    const noDatabase = error instanceof ApiError && error.code === "DATABASE_NOT_CONFIGURED";
    return (
      <>
        <PageHeader title="项目" />
        <div className="card p-6 text-[13.5px] leading-relaxed text-muted">
          {noDatabase ? (
            <>
              项目管理需要数据库。请在 <code className="chip">apps/api/.env</code> 中设置 <code className="chip">DATABASE_URL</code>，运行{" "}
              <code className="chip">npm run db:migrate</code> 后重启 API（见 <code className="chip">docs/database.md</code>）。
            </>
          ) : (
            <span role="alert" className="text-status-error">
              {error.message}
            </span>
          )}
        </div>
      </>
    );
  }

  const list = projects ?? [];
  const ids = list.map((p) => p.id);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorder.mutate(next, { onError: (e) => toast(e.message, "error") });
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="项目" description="新建的项目默认隐藏，填好内容、上传封面后再设为公开。开启“首页精选”的项目会显示在首页。" />
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" className="size-4" /> 新建项目
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-[13.5px] text-muted">还没有项目，点击“新建项目”开始</div>
      ) : (
        <ul className="space-y-3">
          {list.map((project, index) => {
            const title = pickText(project.title, project.slug);
            return (
              <li key={project.id} className="card flex items-center gap-4 p-3">
                <Link to={`/projects/${project.id}`} className="shrink-0" aria-label={`编辑 ${title}`}>
                  {project.cover ? (
                    <img src={project.cover.variants[0].url} alt="" className="h-16 w-24 rounded-lg bg-line-soft object-cover" />
                  ) : (
                    <span className="flex h-16 w-24 items-center justify-center rounded-lg bg-line-soft text-faint">
                      <FolderKanban aria-hidden="true" className="size-5" />
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/projects/${project.id}`} className="block truncate text-[14px] font-semibold text-brand-dark hover:text-brand">
                    {title}
                  </Link>
                  <p className="truncate text-[12px] text-subtle">/projects/{project.slug}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="chip">{STATUS_LABELS[project.status]}</span>
                    {project.visibility === "private" ? (
                      <span className="chip inline-flex items-center gap-1">
                        <EyeOff aria-hidden="true" className="size-3" /> 隐藏
                      </span>
                    ) : null}
                    {project.featured ? (
                      <span className="chip inline-flex items-center gap-1">
                        <Star aria-hidden="true" className="size-3" /> 精选
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <IconButton label={`上移 ${title}`} disabled={index === 0 || reorder.isPending} onClick={() => move(index, index - 1)}>
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </IconButton>
                  <IconButton label={`下移 ${title}`} disabled={index === list.length - 1 || reorder.isPending} onClick={() => move(index, index + 1)}>
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </IconButton>
                  <IconButton label={`删除 ${title}`} onClick={() => setDeleting(project)} danger>
                    <Trash2 aria-hidden="true" className="size-4" />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {creating ? <CreateProjectDialog onClose={() => setCreating(false)} /> : null}

      <Dialog
        open={Boolean(deleting)}
        size="sm"
        title="删除项目"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>
              取消
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={remove.isPending}
              onClick={() =>
                deleting &&
                remove.mutate(deleting.id, {
                  onSuccess: () => {
                    toast("已删除");
                    setDeleting(null);
                  },
                  onError: (e) => toast(e.message, "error")
                })
              }
            >
              {remove.isPending ? "删除中…" : "删除"}
            </button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-muted">
          确定删除“{deleting ? pickText(deleting.title, deleting.slug) : ""}”吗？封面和截图文件也会一起删除，此操作无法撤销。
        </p>
      </Dialog>
    </>
  );
}

function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const create = useCreateProject();
  const navigate = useNavigate();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !slug.trim()) {
      setError("请填写标题和网址名");
      return;
    }
    create.mutate(
      { title: { zh: title.trim() }, slug: slug.trim() },
      {
        onSuccess: ({ project }) => navigate(`/projects/${project.id}`),
        onError: (e) => setError(e instanceof ApiError && e.code === "SLUG_TAKEN" ? "这个网址名已被其它项目使用" : e.message)
      }
    );
  };

  return (
    <Dialog
      open
      size="sm"
      title="新建项目"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" form="create-project" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? "创建中…" : "创建并编辑"}
          </button>
        </>
      }
    >
      <form id="create-project" onSubmit={submit} noValidate className="space-y-3.5">
        <Field label="标题（简体中文）" htmlFor="new-project-title" hint="其它语言可以在编辑页填写">
          <input
            id="new-project-title"
            className="field"
            value={title}
            maxLength={120}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(suggestSlug(e.target.value));
            }}
          />
        </Field>
        <Field label="网址名" htmlFor="new-project-slug" hint="显示在网址中：/projects/网址名。只能用小写字母、数字和短横线">
          <input
            id="new-project-slug"
            className="field"
            value={slug}
            maxLength={80}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-[12.5px] text-status-error">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full p-1.5 text-faint transition-colors disabled:opacity-30 ${danger ? "hover:bg-status-error/10 hover:text-status-error" : "hover:bg-brand-secondary/12 hover:text-brand"}`}
    >
      {children}
    </button>
  );
}
