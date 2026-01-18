import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { Photo } from "../data/photos";
import { useScrollLock } from "../lib/useScrollLock";
import { cx } from "../lib/cx";
import { useI18n } from "../lib/i18n";
import { useQuality } from "../perf/useQuality";
import ResponsiveFlickrImage from "./ResponsiveFlickrImage";

const CROP_RATIO_THRESHOLD = 2;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type MediaLayout = {
  aspect: number; // container width / height
  shouldCrop: boolean;
  orientation: "landscape" | "portrait" | "square";
};

function computeMediaLayout(naturalWidth: number, naturalHeight: number): MediaLayout {
  if (!naturalWidth || !naturalHeight) return { aspect: 1, shouldCrop: false, orientation: "square" };

  const longEdge = Math.max(naturalWidth, naturalHeight);
  const shortEdge = Math.min(naturalWidth, naturalHeight);
  const aspectRatio = longEdge / shortEdge;

  const ratio = naturalWidth / naturalHeight;
  const orientation = ratio > 1 ? "landscape" : ratio < 1 ? "portrait" : "square";

  const shouldCrop = aspectRatio > CROP_RATIO_THRESHOLD;
  const aspect = shouldCrop ? clamp(ratio, 1 / CROP_RATIO_THRESHOLD, CROP_RATIO_THRESHOLD) : ratio;

  return { aspect, shouldCrop, orientation };
}

type Size = { w: number; h: number };

function fitBox(maxW: number, maxH: number, aspect: number): Size {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;

  let w = maxW;
  let h = w / safeAspect;

  if (h > maxH) {
    h = maxH;
    w = h * safeAspect;
  }

  return {
    w: Math.max(0, Math.floor(w)),
    h: Math.max(0, Math.floor(h))
  };
}

type Props = {
  photo: Photo;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
};

export default function PhotoModal({
  photo,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false
}: Props) {
  const { t } = useI18n();
  const { config } = useQuality();

  const [viewport, setViewport] = useState(() => ({
    w: typeof window === "undefined" ? 0 : window.innerWidth,
    h: typeof window === "undefined" ? 0 : window.innerHeight
  }));

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [layout, setLayout] = useState<MediaLayout>(() => computeMediaLayout(photo.width, photo.height));

  useEffect(() => {
    setLayout(computeMediaLayout(photo.width, photo.height));
  }, [photo.id, photo.width, photo.height]);

  const onNaturalSize = (naturalWidth: number, naturalHeight: number) => {
    setLayout(computeMediaLayout(naturalWidth, naturalHeight));
  };

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useMemo(() => `photo-title-${photo.id}`, [photo.id]);

  useScrollLock(true);


  useEffect(() => {
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "ArrowLeft" && hasPrev && onPrev) {
        e.preventDefault();
        onPrev();
      }
      if (e.key === "ArrowRight" && hasNext && onNext) {
        e.preventDefault();
        onNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasNext, hasPrev, onClose, onNext, onPrev]);

  const meta = [
    photo.location ? { k: t("photo.meta.location"), v: photo.location } : null,
    photo.date ? { k: t("photo.meta.date"), v: photo.date } : null,
    photo.camera ? { k: t("photo.meta.camera"), v: photo.camera } : null,
    photo.lens ? { k: t("photo.meta.lens"), v: photo.lens } : null,
    photo.settings ? { k: t("photo.meta.settings"), v: photo.settings } : null
  ].filter(Boolean) as Array<{ k: string; v: string }>;

  const isStacked = viewport.w <= 980;
  const sideW = isStacked ? 0 : viewport.w <= 1180 ? 360 : 420;

  const maxModalW = viewport.w * 0.92;
  const maxModalH = viewport.h * 0.92;

  const minStackSideH = 220;

  const maxMediaW = isStacked ? maxModalW : Math.max(0, maxModalW - sideW);
  const maxMediaH = isStacked ? Math.max(0, maxModalH - minStackSideH) : maxModalH;

  const mediaSize = fitBox(maxMediaW, maxMediaH, layout.aspect);
  const modalW = isStacked ? mediaSize.w : mediaSize.w + sideW;
  const modalH = isStacked ? Math.min(maxModalH, mediaSize.h + minStackSideH) : mediaSize.h;
  const sideH = isStacked ? Math.max(0, modalH - mediaSize.h) : modalH;

  const modalStyle = {
    "--modal-w": `${modalW}px`,
    "--modal-h": `${modalH}px`,
    "--media-w": `${mediaSize.w}px`,
    "--media-h": `${mediaSize.h}px`,
    "--side-w": `${sideW}px`,
    "--side-h": `${sideH}px`
  } as CSSProperties;

  return (
    <div
      className="backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cx("card", "modal")}
        style={modalStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={cx("modalMedia", layout.orientation, layout.shouldCrop && "isCrop")}>
          <ResponsiveFlickrImage
            className="modalImg"
            baseUrl={photo.src}
            originalWidth={photo.width}
            originalHeight={photo.height}
            variant="lightbox"
            alt={photo.alt}
            priority
            fit={layout.shouldCrop ? "cover" : "contain"}
            onLoadNaturalSize={onNaturalSize}
          />
        </div>

        <div className="modalSide">
          <div className="modalTop">
            <h2 className="modalTitle" id={titleId}>
              {photo.title}
            </h2>

            <button ref={closeBtnRef} className="btn btnGhost btnSmall" type="button" onClick={onClose}>
              {t("photo.close")}
            </button>
          </div>

          {photo.description ? <p className="sectionSubtitle">{photo.description}</p> : null}

          {photo.tags?.length ? (
            <div className="tags" aria-label="Tags">
              {photo.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          {meta.length ? (
            <div className="metaList" aria-label="Metadata">
              {meta.map((m) => (
                <div key={m.k} className="metaItem">
                  <div className="metaKey">{m.k}</div>
                  <div className="metaVal">{m.v}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="modalNav">
            <button
              className={cx("btn", "btnSoft")}
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
            >
              {t("photo.prev")}
            </button>
            <button
              className={cx("btn", "btnSoft")}
              type="button"
              onClick={onNext}
              disabled={!hasNext}
            >
              {t("photo.next")}
            </button>
          </div>

          <p className="hint">{t("photo.hint")}</p>
        </div>
      </div>
    </div>
  );
}
