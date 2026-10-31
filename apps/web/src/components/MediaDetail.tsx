import { useEffect, useRef } from "react";

import { useCollectionItem } from "../data/useCollection";
import { pickLocalized, useI18n } from "../lib/i18n";
import { useScrollLock } from "../lib/useScrollLock";
import { mediaTitle, Stars, statusKey } from "./MediaCard";
import { imageSrcSet } from "./ProjectCard";

const SOURCE_NAMES: Record<string, string> = { tmdb: "TMDB", bangumi: "Bangumi" };

/** Side panel with one entry's details; Esc, the backdrop and the close button call onClose. */
export default function MediaDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { lang, t } = useI18n();
  const { item, status } = useCollectionItem(id);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useScrollLock(true);

  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      // Keep Tab inside the panel: the page behind is covered and scroll-locked.
      if (event.key === "Tab" && panelRef.current) {
        const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const title = item ? mediaTitle(item, lang) : "";
  const review = item ? pickLocalized(item.review, lang) : "";
  const overview = item ? pickLocalized(item.overview, lang) : "";
  const genres = item ? item.genres.map((genre) => pickLocalized(genre, lang)).filter(Boolean) : [];
  const progress = item?.progress;

  return (
    <div className="backdrop mediaDrawerBackdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside ref={panelRef} className="card mediaDrawer" role="dialog" aria-modal="true" aria-labelledby="media-detail-title">
        <div className="mediaDrawerTop">
          <button ref={closeRef} className="btn btnGhost btnSmall" type="button" onClick={onClose}>
            {t("collection.close")}
          </button>
        </div>

        {status === "loading" || status === "idle" ? <p className="sectionSubtitle">{t("collection.loading")}</p> : null}
        {status === "missing" ? <p className="sectionSubtitle">{t("collection.notFound")}</p> : null}

        {item ? (
          <>
            <div className="mediaDrawerHead">
              <div className="mediaDrawerPoster">
                {item.poster ? (
                  <img src={item.poster.variants[item.poster.variants.length - 1].url} srcSet={imageSrcSet(item.poster)} sizes="180px" alt="" />
                ) : (
                  <span className="mediaPosterEmpty" aria-hidden="true">
                    {title.slice(0, 1)}
                  </span>
                )}
              </div>
              <div className="mediaDrawerInfo">
                <h2 className="mediaDrawerTitle" id="media-detail-title">
                  {title}
                </h2>
                {item.originalTitle && item.originalTitle !== title ? <p className="mediaRowOriginal">{item.originalTitle}</p> : null}
                <p className="mediaRowMeta">{[t(`collection.kind.${item.kind as "movie" | "tv" | "anime"}`), item.year].filter(Boolean).join(" · ")}</p>
                <div className="mediaDrawerFacts">
                  {item.status ? <span className={`mediaBadge mediaBadge-${item.status}`}>{t(statusKey(item.status))}</span> : null}
                  <Stars rating={item.rating} />
                </div>
                <ul className="mediaDrawerList">
                  {item.watchedOn ? <li>{t("collection.watchedOn", { date: item.watchedOn })}</li> : null}
                  {progress && (item.status === "watching" || item.status === "dropped") ? (
                    <li>{progress.total ? t("collection.progress", { watched: progress.watched, total: progress.total }) : t("collection.progressOpen", { watched: progress.watched })}</li>
                  ) : null}
                  {item.rewatchCount ? <li>{t("collection.rewatch", { n: item.rewatchCount })}</li> : null}
                </ul>
              </div>
            </div>

            {genres.length ? (
              <div className="tags">
                {genres.map((genre) => (
                  <span key={genre} className="tag">
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}

            {review ? (
              <section className="mediaDrawerSection">
                <h3>{t("collection.review")}</h3>
                <p className="mediaReview">{review}</p>
              </section>
            ) : null}

            {item.credits.length ? (
              <section className="mediaDrawerSection">
                <h3>{t("collection.credits")}</h3>
                <p>{item.credits.join(" · ")}</p>
              </section>
            ) : null}

            {overview ? (
              <section className="mediaDrawerSection">
                <h3>{t("collection.overview")}</h3>
                <p className="mediaOverview">{overview}</p>
              </section>
            ) : null}

            {item.sourceUrl && SOURCE_NAMES[item.source] ? (
              <a className="btn btnSoft btnSmall mediaSourceLink" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                {t("collection.source", { source: SOURCE_NAMES[item.source] })}
              </a>
            ) : null}
          </>
        ) : null}
      </aside>
    </div>
  );
}
