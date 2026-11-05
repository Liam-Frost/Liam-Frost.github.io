import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useI18n } from "../../lib/i18n";
import { scrollToElement } from "../../lib/smoothScroll";
import { useQuality } from "../../perf/useQuality";
import { clamp, sectionAt, SEGMENTS } from "./model";
import { useSections } from "./useSections";
import { useWaveMotion } from "./useWaveMotion";
import "../../styles/waveform-navigator.css";

const labels = {
  zh: { nav: "页面区块导航", hint: "点击跳转", home: "主页" },
  "zh-Hant": { nav: "頁面區塊導覽", hint: "點擊跳轉", home: "首頁" },
  en: { nav: "Page section navigation", hint: "Jump to section", home: "Home" },
  fr: { nav: "Navigation par section", hint: "Aller à la section", home: "Accueil" },
  ja: { nav: "ページ内ナビゲーション", hint: "セクションへ移動", home: "ホーム" }
};

export default function WaveformNavigator() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const { config } = useQuality();
  const copy = labels[lang];
  const [available, setAvailable] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const trackBounds = useRef<DOMRect | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const enabled = available && location.pathname === "/";
  const { sections, geometry, maxScroll } = useSections(enabled, copy.home);
  const { pointer, wake } = useWaveMotion(
    svg,
    maxScroll,
    enabled && sections.length > 1,
    config.enableDecorativeAnimations
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px) and (hover: hover) and (pointer: fine)");
    const update = () => setAvailable(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const current =
        window.scrollY >= maxScroll.current - 2
          ? geometry.current.length - 1
          : sectionAt(geometry.current, window.scrollY + window.innerHeight * 0.3);
      setActive((old) => (old === current ? old : current));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [enabled, geometry, sections, maxScroll]);
  if (!enabled || sections.length < 2) return null;

  const move = (clientY: number) => {
    const bounds = trackBounds.current;
    if (!bounds) return;
    const fraction = clamp((clientY - bounds.top) / bounds.height);
    pointer.current = fraction * (SEGMENTS - 1);
    setPreview(sectionAt(geometry.current, fraction * (maxScroll.current + window.innerHeight)));
    wake.current();
  };
  const leave = () => {
    pointer.current = null;
    setPreview(null);
    wake.current();
  };
  const go = (id: string) => {
    if (location.hash === `#${id}`) {
      const element = document.getElementById(id);
      if (element) scrollToElement(element);
    } else navigate({ pathname: "/", hash: `#${id}` });
  };
  return (
    <nav className="waveNavigator" aria-label={copy.nav}>
      <div
        className="waveTrack"
        ref={track}
        onPointerEnter={(event) => {
          trackBounds.current = track.current?.getBoundingClientRect() ?? null;
          move(event.clientY);
        }}
        onPointerMove={(event) => move(event.clientY)}
        onPointerLeave={leave}
      >
        <svg
          ref={svg}
          viewBox="0 0 64 256"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <line key={i} x1="1.5" x2="13.5" y1={4 + i * 8} y2={4 + i * 8} />
          ))}
        </svg>
        {sections.map((section, index) => {
          const documentHeight = Math.max(1, maxScroll.current + window.innerHeight);
          const start = index === 0 ? 0 : clamp(section.top / documentHeight);
          const end =
            index === sections.length - 1 ? 1 : clamp(sections[index + 1]!.top / documentHeight);
          return (
            <button
              key={section.id}
              type="button"
              className="waveTarget"
              style={{ top: `${start * 100}%`, height: `${Math.max(0, end - start) * 100}%` }}
              aria-label={section.title}
              aria-current={active === index ? "location" : undefined}
              onFocus={() => {
                setPreview(index);
                pointer.current = ((start + end) / 2) * (SEGMENTS - 1);
                wake.current();
              }}
              onBlur={leave}
              onClick={(event) => {
                const bounds = track.current?.getBoundingClientRect();
                const chosen =
                  event.detail > 0 && bounds
                    ? sectionAt(
                        geometry.current,
                        clamp((event.clientY - bounds.top) / bounds.height) * documentHeight
                      )
                    : index;
                go(sections[Math.max(0, chosen)]!.id);
              }}
            />
          );
        })}
      </div>
      <div
        className={`wavePreview ${preview !== null && sections[preview] ? "isVisible" : ""}`}
        aria-hidden="true"
      >
        {preview !== null && sections[preview] ? (
          <>
            <span>
              {String(preview + 1).padStart(2, "0")} / {String(sections.length).padStart(2, "0")}
            </span>
            <strong>{sections[preview]!.title}</strong>
            {sections[preview]!.summary && <p>{sections[preview]!.summary}</p>}
            <small>{copy.hint} ↗</small>
          </>
        ) : null}
      </div>
    </nav>
  );
}
