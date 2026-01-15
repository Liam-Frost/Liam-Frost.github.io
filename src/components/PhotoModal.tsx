import { useEffect, useMemo, useRef } from "react";

import type { Photo } from "../data/photos";
import { useScrollLock } from "../lib/useScrollLock";
import { cx } from "../lib/cx";
import { useI18n } from "../lib/i18n";

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
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modalMedia">
          <img className="modalImg" src={photo.src} alt={photo.alt} />
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
