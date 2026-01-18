import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEventHandler } from "react";
import { createPortal } from "react-dom";

import { buildFlickrStaticUrl, longestEdgeBySuffix, parseFlickrStaticUrl, type FlickrSizeSuffix } from "../images/flickr";

type Props = {
  baseUrl: string;
  originalWidth: number;
  originalHeight: number;
  alt: string;
  onClose: () => void;
};

type Point = { x: number; y: number };

type ActivePointer = {
  id: number;
  startClient: Point;
  client: Point;
};

const suffixOrder: FlickrSizeSuffix[] = ["4k", "3k", "k", "h", "b", "c", "z", "n"];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function dist(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export default function FullscreenImageViewer({ baseUrl, originalWidth, originalHeight, alt, onClose }: Props) {
  const parsed = useMemo(() => parseFlickrStaticUrl(baseUrl), [baseUrl]);
  const isFlickr = Boolean(parsed);
  const originalLongest = Math.max(1, Math.max(originalWidth, originalHeight));

  const isCoarsePointer =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;

  const tapZoomScale = isCoarsePointer ? 2.6 : 2.0;
  const moveThreshold = isCoarsePointer ? 10 : 6;

  const controlStyle: CSSProperties = {
    padding: isCoarsePointer ? "8px 10px" : "6px 10px",
    borderRadius: 11,
    fontSize: 12,
    minHeight: isCoarsePointer ? 36 : 32
  };

  const availableSuffixes = useMemo(() => {
    if (!isFlickr) return [] as FlickrSizeSuffix[];
    return suffixOrder.filter((s) => longestEdgeBySuffix[s] <= originalLongest);
  }, [isFlickr, originalLongest]);

  const bestSuffix = useMemo<FlickrSizeSuffix | null>(() => {
    if (!isFlickr) return null;
    return availableSuffixes[0] ?? "b";
  }, [isFlickr, availableSuffixes]);

  const [fallbackIndex, setFallbackIndex] = useState(0);

  useEffect(() => {
    setFallbackIndex(0);
  }, [baseUrl, bestSuffix]);

  const activeSuffix = useMemo(() => {
    if (!isFlickr) return null;
    const s = availableSuffixes[Math.min(fallbackIndex, availableSuffixes.length - 1)] ?? bestSuffix;
    return s ?? "b";
  }, [isFlickr, availableSuffixes, fallbackIndex, bestSuffix]);

  const src = useMemo(() => {
    if (!isFlickr || !activeSuffix) return baseUrl;
    return buildFlickrStaticUrl(baseUrl, activeSuffix);
  }, [isFlickr, baseUrl, activeSuffix]);

  // --- zoom/pan state ---
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const [naturalSize, setNaturalSize] = useState(() => ({ w: 0, h: 0 }));

  const pointersRef = useRef<Map<number, ActivePointer>>(new Map());
  const gestureRef = useRef<{
    mode: "none" | "drag" | "pinch";
    startScale: number;
    startTx: number;
    startTy: number;
    startMid: Point;
    startDist: number;
    startClient: Point;
    moved: boolean;
  }>({
    mode: "none",
    startScale: 1,
    startTx: 0,
    startTy: 0,
    startMid: { x: 0, y: 0 },
    startDist: 0,
    startClient: { x: 0, y: 0 },
    moved: false
  });

  const clampPan = (nextTx: number, nextTy: number, nextScale: number) => {
    const stage = stageRef.current;
    if (!stage || naturalSize.w <= 0 || naturalSize.h <= 0) return { tx: nextTx, ty: nextTy };

    const stageW = stage.clientWidth;
    const stageH = stage.clientHeight;

    // Base rendered size with contain-fit.
    const baseScale = Math.min(stageW / naturalSize.w, stageH / naturalSize.h);
    const baseW = naturalSize.w * baseScale;
    const baseH = naturalSize.h * baseScale;

    const scaledW = baseW * nextScale;
    const scaledH = baseH * nextScale;

    const maxTx = Math.max(0, (scaledW - stageW) / 2);
    const maxTy = Math.max(0, (scaledH - stageH) / 2);

    return {
      tx: clamp(nextTx, -maxTx, maxTx),
      ty: clamp(nextTy, -maxTy, maxTy)
    };
  };

  const applyZoomAtPoint = (anchor: Point, nextScale: number) => {
    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = anchor.x - cx;
    const dy = anchor.y - cy;

    const ratio = nextScale / scale;

    const rawTx = tx - dx * (ratio - 1);
    const rawTy = ty - dy * (ratio - 1);

    const clamped = clampPan(rawTx, rawTy, nextScale);
    setScale(nextScale);
    setTx(clamped.tx);
    setTy(clamped.ty);
  };

  // Keyboard close.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Reset pan when scale snaps back to 1.
  useEffect(() => {
    if (scale <= 1.001) {
      setScale(1);
      setTx(0);
      setTy(0);
    }
  }, [scale]);

  // Prevent body scroll while open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const [uiVisible, setUiVisible] = useState(true);
  const hideUiTimerRef = useRef<number | null>(null);

  const scheduleUiHide = () => {
    if (hideUiTimerRef.current) window.clearTimeout(hideUiTimerRef.current);
    hideUiTimerRef.current = window.setTimeout(() => setUiVisible(false), 3000);
  };

  useEffect(() => {
    if (!uiVisible) return;
    scheduleUiHide();
    return () => {
      if (hideUiTimerRef.current) window.clearTimeout(hideUiTimerRef.current);
      hideUiTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiVisible]);

  const onUserActivity = () => {
    if (!uiVisible) setUiVisible(true);
    else scheduleUiHide();
  };

  const overlay = (
    <div
      role="dialog"
      aria-label="Fullscreen image viewer"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.86)",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        color: "rgba(255,255,255,0.92)"
      }}
      onMouseMove={onUserActivity}
      onPointerMove={onUserActivity}
      onKeyDown={onUserActivity as unknown as KeyboardEventHandler<HTMLDivElement>}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          paddingLeft: 10,
          paddingRight: 10,
          paddingBottom: 8,
          paddingTop: "calc(8px + env(safe-area-inset-top))",
          opacity: uiVisible ? 1 : 0,
          transform: uiVisible ? "translateY(0)" : "translateY(-6px)",
          transition: "opacity 160ms ease, transform 160ms ease",
          pointerEvents: uiVisible ? "auto" : "none"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ opacity: 0.75, fontSize: 12, display: isCoarsePointer ? "none" : "block" }}>
          {activeSuffix ? `Quality: ${activeSuffix}` : ""}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <a className="btn btnGhost" href={src} target="_blank" rel="noreferrer" style={controlStyle}>
            {isCoarsePointer ? "原图" : "在新标签打开原图"}
          </a>

          <button
            className="btn btnGhost"
            style={{ ...controlStyle, minWidth: isCoarsePointer ? 44 : undefined }}
            type="button"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        style={{
          position: "relative",
          overflow: "hidden",
          touchAction: "none",
          cursor: scale > 1.001 ? "grab" : "zoom-in"
        }}
        onWheel={(e) => {
          e.preventDefault();
          onUserActivity();

          const delta = -e.deltaY;
          const factor = delta > 0 ? 1.12 : 1 / 1.12;
          const next = clamp(scale * factor, 1, 8);
          applyZoomAtPoint({ x: e.clientX, y: e.clientY }, next);
        }}
        onPointerDown={(e) => {
          onUserActivity();

          // Don’t start gestures on links/buttons.
          const el = e.target as HTMLElement | null;
          if (el && (el.closest("a") || el.closest("button"))) return;

          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

          pointersRef.current.set(e.pointerId, {
            id: e.pointerId,
            startClient: { x: e.clientX, y: e.clientY },
            client: { x: e.clientX, y: e.clientY }
          });

          const pointers = Array.from(pointersRef.current.values());
          const g = gestureRef.current;

          g.moved = false;
          g.startClient = { x: e.clientX, y: e.clientY };

          if (pointers.length === 1) {
            g.mode = "drag";
            g.startScale = scale;
            g.startTx = tx;
            g.startTy = ty;
          } else if (pointers.length === 2) {
            g.mode = "pinch";
            g.startScale = scale;
            g.startTx = tx;
            g.startTy = ty;
            g.startDist = dist(pointers[0].client, pointers[1].client);
            g.startMid = midpoint(pointers[0].client, pointers[1].client);
          }
        }}
        onPointerMove={(e) => {
          const p = pointersRef.current.get(e.pointerId);
          if (!p) return;

          p.client = { x: e.clientX, y: e.clientY };
          pointersRef.current.set(e.pointerId, p);

          const pointers = Array.from(pointersRef.current.values());
          const g = gestureRef.current;

          const movedDist = dist(g.startClient, { x: e.clientX, y: e.clientY });
          if (movedDist > moveThreshold) g.moved = true;

          if (g.mode === "drag" && pointers.length === 1) {
            if (scale <= 1.001) return;

            const dx = pointers[0].client.x - pointers[0].startClient.x;
            const dy = pointers[0].client.y - pointers[0].startClient.y;

            const rawTx = g.startTx + dx;
            const rawTy = g.startTy + dy;
            const clamped = clampPan(rawTx, rawTy, scale);
            setTx(clamped.tx);
            setTy(clamped.ty);
            return;
          }

          if (g.mode === "pinch" && pointers.length === 2) {
            const d = dist(pointers[0].client, pointers[1].client);
            const mid = midpoint(pointers[0].client, pointers[1].client);

            const nextScale = clamp((g.startScale * d) / Math.max(1, g.startDist), 1, 8);

            // Recompute using the same formula as wheel.
            const rect = stageRef.current?.getBoundingClientRect();
            if (!rect) return;

            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;

            const dx = mid.x - cx;
            const dy = mid.y - cy;

            const ratio = nextScale / Math.max(1e-6, scale);
            const rawTx = g.startTx - dx * (ratio - 1);
            const rawTy = g.startTy - dy * (ratio - 1);

            const clamped = clampPan(rawTx, rawTy, nextScale);
            setScale(nextScale);
            setTx(clamped.tx);
            setTy(clamped.ty);
          }
        }}
        onPointerUp={(e) => {
          onUserActivity();

          pointersRef.current.delete(e.pointerId);
          const pointers = Array.from(pointersRef.current.values());
          const g = gestureRef.current;

          const isTap = g.mode === "drag" && pointers.length === 0 && !g.moved;

          if (isTap) {
            if (scale <= 1.001) {
              applyZoomAtPoint({ x: e.clientX, y: e.clientY }, tapZoomScale);
            } else {
              setScale(1);
              setTx(0);
              setTy(0);
            }
          }

          if (pointers.length === 0) {
            g.mode = "none";
          } else if (pointers.length === 1) {
            g.mode = "drag";
            g.startTx = tx;
            g.startTy = ty;
            g.startScale = scale;
            g.startMid = pointers[0].client;
            g.startDist = 0;

            // Reset the start point for clean dragging.
            pointers[0].startClient = pointers[0].client;
            pointersRef.current.set(pointers[0].id, pointers[0]);
          }
        }}
        onPointerCancel={(e) => {
          onUserActivity();
          pointersRef.current.delete(e.pointerId);
          if (pointersRef.current.size === 0) gestureRef.current.mode = "none";
        }}
        onDoubleClick={(e) => {
          // Avoid double-tap conflicts with single-tap zoom toggle.
          e.preventDefault();
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          decoding="async"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            maxWidth: "100%",
            maxHeight: "100%",
            transform: `translate(-50%, -50%) translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
            transformOrigin: "center center",
            willChange: "transform",
            userSelect: "none",
            pointerEvents: "none"
          }}
          onLoad={(e) => {
            setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
            setUiVisible(true);
          }}
          onError={() => {
            // Fallback chain should not affect global tier.
            setFallbackIndex((i) => Math.min(i + 1, Math.max(0, availableSuffixes.length - 1)));
          }}
        />

        <div
          aria-hidden
          style={{
            position: "absolute",
            right: "calc(12px + env(safe-area-inset-right))",
            bottom: "calc(12px + env(safe-area-inset-bottom))",
            padding: isCoarsePointer ? "7px 10px" : "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(0,0,0,0.42)",
            fontSize: 12,
            letterSpacing: "0.02em",
            minWidth: 58,
            textAlign: "center",
            opacity: uiVisible ? 1 : 0,
            transform: uiVisible ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 160ms ease, transform 160ms ease",
            pointerEvents: "none"
          }}
        >
          {Math.round(scale * 100)}%
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
