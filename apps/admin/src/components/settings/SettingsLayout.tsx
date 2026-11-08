import { NavLink, Outlet, useLocation, Navigate } from "react-router";
const sections = [
  {
    title: "前台设置",
    items: [
      ["frontend/identity", "基本资料"],
      ["frontend/appearance", "Logo 与首页板块"],
      ["frontend/footer", "页脚版权"],
      ["frontend/preferences", "默认显示"],
      ["frontend/privacy", "隐私说明"],
      ["frontend/dictionary", "标签词典"]
    ]
  },
  {
    title: "后台设置",
    items: [
      ["backend/appearance", "Logo 与登录背景"],
      ["backend/favicon", "网站图标"],
      ["backend/integrations", "集成与 API"],
      ["backend/security", "账号与安全"],
      ["backend/language", "语言与格式"],
      ["backend/statistics", "统计设置"],
      ["backend/audit", "审计日志"]
    ]
  }
];
export function SettingsLayout() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[190px_minmax(0,1fr)]">
      <nav
        className="card grid gap-4 p-4 sm:grid-cols-2 xl:sticky xl:top-5 xl:grid-cols-1"
        aria-label="网站设置分类"
      >
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="mb-2 text-xs font-semibold text-brand-dark">{section.title}</h2>
            <ul className="flex flex-wrap gap-1 xl:block">
              {section.items.map(([path, label]) => (
                <li key={path}>
                  <NavLink
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2 text-[13px] ${isActive ? "bg-brand text-white" : "text-muted hover:bg-canvas"}`
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
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
export function SettingsRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate replace to={to + location.search + location.hash} />;
}
