import type { AdminUser } from "@liam-frost/shared";
import { Clapperboard, FolderKanban, Images, LayoutDashboard, LogOut, Music } from "lucide-react";
import { NavLink, Outlet } from "react-router";

import { useLogout } from "../../hooks/useSession";
import { useToast } from "../ui/Toast";

const NAV = [
  { to: "/", label: "概览", icon: LayoutDashboard, end: true },
  { to: "/photos", label: "照片", icon: Images, end: false },
  { to: "/projects", label: "项目", icon: FolderKanban, end: false },
  { to: "/collection", label: "收藏", icon: Clapperboard, end: false },
  { to: "/music", label: "播放器", icon: Music, end: false }
];

export function AdminLayout({ user }: { user: AdminUser }) {
  const logout = useLogout();
  const toast = useToast();

  const onLogout = () =>
    logout.mutate(undefined, {
      onError: (error) => toast(error.message, "error")
    });

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="flex items-center gap-3 border-b border-line bg-brand-dark px-4 py-3 text-white md:sticky md:top-0 md:h-dvh md:flex-col md:items-stretch md:gap-6 md:border-r md:border-b-0 md:px-4 md:py-6">
        <div className="flex items-center gap-2.5 md:px-2">
          <img src="./favicon.svg" alt="" className="size-7 rounded-md bg-white/90 p-0.5" />
          <span className="text-[15px] font-semibold">管理后台</span>
        </div>

        <nav aria-label="管理后台" className="flex flex-1 gap-1 overflow-x-auto md:flex-col">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[13px] transition-colors duration-200 ${
                  isActive ? "bg-white text-brand-dark" : "text-white/85 hover:bg-white/12"
                }`
              }
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:flex-col md:items-stretch md:border-t md:border-white/15 md:pt-4">
          <span className="hidden truncate px-2 text-[12px] text-white/70 md:block">已登录：{user.username}</span>
          <button
            type="button"
            onClick={onLogout}
            disabled={logout.isPending}
            aria-label="退出登录"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-white/85 transition-colors hover:bg-white/12 disabled:opacity-50"
          >
            <LogOut aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">{logout.isPending ? "退出中…" : "退出登录"}</span>
          </button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-[1080px] px-4 pt-8 pb-12 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-[22px] font-semibold text-brand-dark">{title}</h1>
      {description ? <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{description}</p> : null}
    </header>
  );
}
