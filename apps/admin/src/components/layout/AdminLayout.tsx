import { useSettingsDraftCount } from "../settings/drafts";
import { useIntegrationDrafts } from "../integrations/drafts";
import { hasDraft } from "../integrations/IntegrationItem";
import { hasUnsaved, useUnsaved } from "../../lib/unsaved";
import { NavigationGuard } from "./NavigationGuard";
import { useConfirm } from "../ui/Confirm";
import type { AdminUser } from "@liam-frost/shared";
import {
  ChartColumn,
  ShieldCheck,
  Clapperboard,
  FolderKanban,
  Images,
  LayoutDashboard,
  LogOut,
  Music,
  Mail,
  Layers,
  Menu as MenuIcon,
  Quote,
  X
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { useAdminTitle } from "../../hooks/useAdminTitle";
import { useLogout } from "../../hooks/useSession";
import { useToast } from "../ui/Toast";
import SiteMark from "../../../../web/src/components/SiteMark";
import { Settings2 } from "lucide-react";
import { LanguageSwitch } from "../ui/LanguageSwitch";
import { tr } from "../../lib/messages";

const NAV = [
  { to: "/", label: tr("概览"), icon: LayoutDashboard, end: true },
  { to: "/about", label: tr("关于"), icon: Quote, end: false },
  { to: "/stack", label: tr("技术栈"), icon: Layers, end: false },
  { to: "/projects", label: tr("项目"), icon: FolderKanban, end: false },
  { to: "/collection", label: tr("收藏"), icon: Clapperboard, end: false },
  { to: "/photos", label: tr("照片"), icon: Images, end: false },
  { to: "/contact", label: tr("联系我"), icon: Mail, end: false },
  { to: "/music", label: tr("播放器"), icon: Music, end: false },
  { to: "/analytics", label: tr("统计"), icon: ChartColumn, end: false },
  { to: "/audit", label: tr("审计日志"), icon: ShieldCheck, end: false },
  { to: "/settings", label: tr("网站设置"), icon: Settings2, end: false }
];

export function AdminLayout({ user }: { user: AdminUser }) {
  const { pathname } = useLocation();
  const isSettings = pathname.startsWith("/settings");
  useUnsaved(useSettingsDraftCount() > 0, "session");
  useUnsaved(Object.values(useIntegrationDrafts().drafts).some(hasDraft), "session");
  const adminTitle = useAdminTitle();
  const drawer = useRef<HTMLDialogElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const current = NAV.find(({ to, end }) =>
    end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
  );

  useEffect(() => {
    const dialog = drawer.current;
    if (!dialog) return;
    if (drawerOpen && !dialog.open) dialog.showModal();
    if (!drawerOpen && dialog.open) dialog.close();
  }, [drawerOpen]);
  // Closes after a route change, including back and forward.
  useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <NavigationGuard />
      <header className="sticky top-0 z-30 flex items-center gap-2.5 bg-brand-dark px-3 py-2 text-white md:hidden">
        <button
          type="button"
          aria-label={tr("打开导航")}
          aria-expanded={drawerOpen}
          aria-haspopup="dialog"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-white/12"
        >
          <MenuIcon aria-hidden="true" className="size-5" />
        </button>
        <SiteMark admin />
        <span className="min-w-0 truncate text-[15px] font-semibold">
          {current?.label ?? adminTitle}
        </span>
      </header>

      <dialog
        ref={drawer}
        aria-label={tr("管理后台")}
        className="admin-drawer"
        onCancel={(event) => {
          event.preventDefault();
          setDrawerOpen(false);
        }}
        onClick={(event) => {
          if (event.target === drawer.current) setDrawerOpen(false);
        }}
      >
        {drawerOpen ? (
          <div className="flex h-full flex-col gap-5 px-4 py-4 text-white">
            <div className="flex justify-end">
              <button
                type="button"
                aria-label={tr("关闭导航")}
                onClick={() => setDrawerOpen(false)}
                className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-white/12"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <SidebarContent
              user={user}
              title={adminTitle}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        ) : null}
      </dialog>

      <aside className="hidden border-line bg-brand-dark text-white md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:items-stretch md:gap-6 md:border-r md:px-4 md:py-6">
        <SidebarContent user={user} title={adminTitle} />
      </aside>

      <main
        className={`mx-auto min-w-0 w-full px-4 pt-8 pb-12 sm:px-6 ${isSettings ? "max-w-[1480px]" : "max-w-[1080px]"}`}
      >
        <Outlet />
      </main>
    </div>
  );
}

/** The navigation itself, shared by the desktop sidebar and the phone drawer. */
function SidebarContent({
  user,
  title,
  onNavigate
}: {
  user: AdminUser;
  title: string;
  onNavigate?: () => void;
}) {
  const logout = useLogout();
  const toast = useToast();
  const confirm = useConfirm();
  const onLogout = async () => {
    if (
      hasUnsaved() &&
      !(await confirm({
        title: tr("退出登录？"),
        message: tr("退出后，未保存的修改不会保留。"),
        confirmLabel: tr("退出登录"),
        cancelLabel: tr("继续编辑")
      }))
    )
      return;
    logout.mutate(undefined, { onError: (error) => toast(error.message, "error") });
  };
  return (
    <>
      <div className="flex items-center gap-2.5 px-2">
        <SiteMark admin />
        <span className="truncate text-[15px] font-semibold">{title}</span>
      </div>

      <nav
        aria-label={tr("管理后台")}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
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

      <div className="flex flex-col items-stretch gap-2 border-t border-white/15 pt-4">
        <span className="truncate px-2 text-[12px] text-white/70">
          {tr("已登录：{0}", user.username)}
        </span>
        <div className="px-2">
          <LanguageSwitch surface="dark" />
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={logout.isPending}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-white/85 transition-colors hover:bg-white/12 disabled:opacity-50"
        >
          <LogOut aria-hidden="true" className="size-4" />
          {logout.isPending ? tr("退出中…") : tr("退出登录")}
        </button>
      </div>
    </>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className = ""
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-6 flex flex-wrap items-start gap-3 ${className}`}>
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] font-semibold text-brand-dark">{title}</h1>
        {description ? (
          <p className="mt-1 text-[13.5px] leading-relaxed text-brand-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
