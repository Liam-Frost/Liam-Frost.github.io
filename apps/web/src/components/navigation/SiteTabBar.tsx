import type { SiteSettingsGroups } from "@liam-frost/shared";
import { Code2, Heart, House, Images, type LucideIcon } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent
} from "react";
import { Link, useLocation } from "react-router";

import { useI18n } from "../../lib/i18n";
import { scrollToTop } from "../../lib/smoothScroll";
import { useScrollAdaptive } from "./useScrollAdaptive";
import { isPlainClick, leaveMissingPage } from "./goHome";
import { TabBar, TabBarList, TabBarTrigger } from "../../vendor/cupertinocn/tab-bar";

/** The site's four top-level routes, as in the header. */
const TABS: {
  to: string;
  label: "nav.home" | "nav.projects" | "nav.collection" | "nav.portfolio";
  Icon: LucideIcon;
}[] = [
  { to: "/", label: "nav.home", Icon: House },
  { to: "/projects", label: "nav.projects", Icon: Code2 },
  { to: "/collection", label: "nav.collection", Icon: Heart },
  { to: "/portfolio", label: "nav.portfolio", Icon: Images }
];

function activeTab(pathname: string) {
  if (pathname === "/") return "/";
  return TABS.find((tab) => tab.to !== "/" && pathname.startsWith(tab.to))?.to ?? null;
}

const noop = () => {};
const RESIZE_MS = 420;
const LENS_MOVE_MS = 440;
/** Forgives a pointer that slips off the edge of the bar for a moment. */
const HOVER_LEAVE_MS = 140;

export default function SiteTabBar({ settings }: { settings: SiteSettingsGroups["navigation"] }) {
  const { t } = useI18n();
  const { refraction } = settings;
  const { pathname } = useLocation();
  const active = activeTab(pathname);
  const adaptive = useScrollAdaptive(settings.tabBarMode === "adaptive", pathname);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  const shrunk =
    settings.tabBarMode === "adaptive"
      ? adaptive
      : settings.tabBarMode === "hover"
        ? !hovered
        : false;
  const collapsed = shrunk && !keyboardFocus;
  const root = useRef<HTMLElement>(null);

  // A short stretch and settle whenever the selection moves, on top of the lens' spring.
  const previous = useRef(active);
  useLayoutEffect(() => {
    if (previous.current === active) return;
    previous.current = active;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const list = root.current?.querySelector("[data-slot=tab-bar-list]");
    // While it travels the lens is bare glass over the real icons, which stay where they are.
    list?.setAttribute("data-lens-moving", "");
    const timer = window.setTimeout(() => list?.removeAttribute("data-lens-moving"), LENS_MOVE_MS);
    list?.querySelector(":scope > .cupertino-tab-indicator")?.animate(
      [
        { "--lens-stretch": "0px", "--lens-squash": "0px" },
        { "--lens-stretch": "15px", "--lens-squash": "3px", offset: 0.34 },
        { "--lens-stretch": "-3px", "--lens-squash": "-1px", offset: 0.72 },
        { "--lens-stretch": "0px", "--lens-squash": "0px" }
      ],
      { duration: LENS_MOVE_MS, easing: "ease-out" }
    );
    return () => window.clearTimeout(timer);
  }, [active]);

  // While the bar changes size the lens tracks it directly instead of re-springing every frame.
  const showLabels = settings.showLabels && !collapsed;
  const shape = `${collapsed}:${showLabels}`;
  const lastShape = useRef(shape);
  // Before paint: the first frame of the resize must already follow the bar directly.
  useLayoutEffect(() => {
    if (lastShape.current === shape) return;
    lastShape.current = shape;
    const element = root.current;
    element?.setAttribute("data-resizing", "");
    const timer = window.setTimeout(() => element?.removeAttribute("data-resizing"), RESIZE_MS);
    return () => window.clearTimeout(timer);
  }, [shape]);

  // Mouse only: a touch has no hover, so on touch screens Hover mode stays compact.
  const onPointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(hoverTimer.current);
    setHovered(true);
  };
  const onPointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHovered(false), HOVER_LEAVE_MS);
  };

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    // The drag gesture focuses the chosen tab from script; only real keyboard focus counts.
    if (event.target.matches(":focus-visible") && !event.target.closest("[data-pointer-focus]"))
      setKeyboardFocus(true);
  };
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocus(false);
  };

  // Tapping the current page goes back to its top; the scroll manager ignores a same-URL navigation.
  const onTabClick = (event: MouseEvent, to: string) => {
    if (to === "/" && leaveMissingPage(event)) return;
    if (to === pathname && isPlainClick(event)) scrollToTop(true);
  };

  const items = TABS.map(({ to, label, Icon }) => (
    <TabBarTrigger
      key={to}
      value={to}
      nativeButton={false}
      render={<Link to={to} draggable={false} />}
      role={undefined}
      aria-selected={undefined}
      aria-current={active === to ? "page" : undefined}
      tabIndex={0}
      onClick={(event) => onTabClick(event, to)}
    >
      <Icon aria-hidden="true" />
      <span className="siteTabLabel">{t(label)}</span>
    </TabBarTrigger>
  ));

  return (
    <nav
      ref={root}
      className="siteTabDock"
      aria-label="Primary"
      data-collapsed={collapsed || undefined}
      data-labels={showLabels ? undefined : "off"}
      style={{ "--tabbar-index": TABS.findIndex((tab) => tab.to === active) } as CSSProperties}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <TabBar value={active} onValueChange={noop} className="siteTabBar">
        <TabBarList
          className="siteTabGlass"
          variant={settings.glass}
          strength={refraction}
          lensStrength={0.9 * refraction}
          lensRim={Math.min(0.6, 0.3 + Math.max(0, refraction - 1) * 0.25)}
        >
          {items}
        </TabBarList>
      </TabBar>
    </nav>
  );
}
