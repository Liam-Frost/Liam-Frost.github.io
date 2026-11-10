import { useEffect, useRef } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  Navigate,
  useNavigate,
  useNavigationType
} from "react-router";
import { settingsCopy as copy } from "./copy";
import { useSettingsDraftCount } from "./drafts";
import { tr } from "../../lib/messages";
import { Select } from "../ui/Select";

export const SETTINGS_NAV: {
  title: string;
  items: [string, string, "compact" | "standard" | "wide"][];
}[] = [
  {
    title: copy.groups.brand,
    items: [
      ["site/identity", tr("基本资料"), "standard"],
      ["site/branding", tr("Logo、图标与标题"), "standard"],
      ["site/footer", tr("页脚与版权"), "compact"]
    ]
  },
  {
    title: copy.groups.experience,
    items: [
      ["experience/home", tr("首页模块"), "wide"],
      ["experience/preferences", tr("默认显示与语言"), "compact"],
      ["experience/navigation", tr("导航外观"), "compact"],
      ["experience/dictionary", tr("标签词典"), "wide"]
    ]
  },
  {
    title: copy.groups.privacy,
    items: [
      ["privacy/content", tr("隐私说明"), "standard"],
      ["privacy/integrations", tr("集成与 API"), "standard"]
    ]
  },
  {
    title: copy.groups.admin,
    items: [
      ["admin/login", tr("登录外观"), "wide"],
      ["admin/images", tr("图片管理"), "compact"],
      ["admin/security", tr("账号与安全"), "compact"]
    ]
  }
];
export function SettingsLayout() {
  const location = useLocation(),
    navigate = useNavigate(),
    navigation = useNavigationType(),
    draftCount = useSettingsDraftCount();
  const pages = SETTINGS_NAV.flatMap((group) => group.items),
    current = pages.find(([path]) => location.pathname === `/settings/${path}`) ?? pages[0]!;
  const positions = useRef(new Map<string, number>()),
    previous = useRef(location.key),
    heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = previous.current;
    previous.current = location.key;
    if (old !== location.key) {
      window.scrollTo({
        top: navigation === "POP" ? (positions.current.get(location.key) ?? 0) : 0,
        behavior: "instant"
      });
      if (navigation !== "POP") heading.current?.focus({ preventScroll: true });
    }
    const save = () => positions.current.set(location.key, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [location.key, navigation]);
  return (
    <div className="settings-layout">
      <nav className="settings-navigation" aria-label={copy.navigation}>
        <p className="mb-4 text-sm font-semibold text-brand-dark">{tr("网站设置")}</p>
        {SETTINGS_NAV.map((group) => (
          <div className="mb-5 last:mb-0" key={group.title}>
            <h2 className="mb-1.5 px-2 text-[11px] font-medium text-muted">{group.title}</h2>
            <ul className="space-y-0.5">
              {group.items.map(([path, label]) => (
                <li key={path}>
                  <NavLink
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2 text-[13px] ${isActive ? "bg-brand text-white" : "text-muted hover:bg-white"}`
                    }
                    to={`/settings/${path}`}
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {draftCount ? (
          <p className="mt-4 border-t border-line pt-3 text-xs text-status-warn" role="status">
            {tr("{0} 组未保存草稿", draftCount)}
          </p>
        ) : null}
      </nav>
      <div className="min-w-0">
        <div className="mb-5 xl:hidden">
          <label className="mb-1.5 block text-xs text-muted" htmlFor="settings-page-selector">
            {copy.choosePage}
          </label>
          <Select
            id="settings-page-selector"
            value={current[0]}
            onChange={(value) => navigate(`/settings/${value}`)}
            options={SETTINGS_NAV.map((group) => ({
              label: group.title,
              options: group.items.map(([value, label]) => ({ value, label }))
            }))}
          />
          {draftCount ? (
            <p className="mt-2 text-xs text-status-warn">
              {tr("{0} 组草稿保留在本次登录中；刷新前请保存。", draftCount)}
            </p>
          ) : null}
        </div>
        <div
          ref={heading}
          tabIndex={-1}
          className={`settings-content settings-content-${current[2]}`}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
export function SettingsRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate replace to={to + location.search + location.hash} />;
}
