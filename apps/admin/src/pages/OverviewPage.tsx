import { FolderKanban, Images } from "lucide-react";
import { Link } from "react-router";

import { PageHeader } from "../components/layout/AdminLayout";

const SECTIONS = [
  { to: "/photos", title: "照片", description: "上传照片、编辑多语言信息、排序与隐藏。", icon: Images },
  { to: "/projects", title: "项目", description: "创建项目、上传封面、管理链接与技术栈。", icon: FolderKanban }
];

export function OverviewPage() {
  return (
    <>
      <PageHeader title="概览" description="管理个人主页的照片与项目内容。" />
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ to, title, description, icon: Icon }) => (
          <Link key={to} to={to} className="card group p-5 transition-shadow duration-200 hover:shadow-card-hover">
            <Icon aria-hidden="true" className="mb-3 size-5 text-brand-secondary" />
            <h2 className="text-[15px] font-semibold text-brand-dark group-hover:text-brand">{title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

/** Sections that arrive in later stages (photos: Stage 7, projects: Stage 8). */
export function ComingSoonPage({ title, stage }: { title: string; stage: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="card p-8 text-center text-[13.5px] text-muted">该功能将在 {stage} 提供。</div>
    </>
  );
}

/** Unknown route inside the signed-in admin. */
export function SectionNotFound() {
  return (
    <>
      <PageHeader title="页面不存在" />
      <Link to="/" className="btn-secondary">
        返回概览
      </Link>
    </>
  );
}

/** Shown when the page was not served as the admin app; reveals nothing about the admin. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-[40px] font-semibold text-brand-dark">404</h1>
      <p className="text-[13.5px] text-muted">页面不存在</p>
    </div>
  );
}
