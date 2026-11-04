import { Link, Outlet, useLocation } from "react-router";

/** People belong to the collection, alongside its works. */
export function CollectionLayout() {
  const people = useLocation().pathname.startsWith("/collection/people");
  return (
    <>
      <nav aria-label="收藏分类" className="mb-6 flex gap-2 border-b border-line pb-3">
        {[
          { to: "/collection", label: "作品", active: !people },
          { to: "/collection/people", label: "人物", active: people }
        ].map(({ to, label, active }) => (
          <Link
            key={to}
            to={to}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-[13px] ${active ? "bg-brand text-white" : "text-muted hover:bg-brand-secondary/10"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
