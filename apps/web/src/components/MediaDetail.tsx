import { useCollectionItem } from "../data/useCollection";
import { pickLocalized, useI18n } from "../lib/i18n";
import { CollectionLinks, type CollectionLinkTo } from "./CollectionLinks";
import DetailDrawer from "./DetailDrawer";
import { isReadKind, mediaTitle, Stars, statusKey } from "./MediaCard";
import { imageSrcSet } from "./ProjectCard";

const SOURCE_NAMES: Record<string, string> = { tmdb: "TMDB", bangumi: "Bangumi", openlibrary: "Open Library", anilist: "AniList" };

/** Side panel with one entry's details and links; Esc, the backdrop and the close button call onClose. */
export default function MediaDetail({ id, onClose, linkTo }: { id: string; onClose: () => void; linkTo: CollectionLinkTo }) {
  const { lang, t } = useI18n();
  const { item, status } = useCollectionItem(id);

  const title = item ? mediaTitle(item, lang) : "";
  const review = item ? pickLocalized(item.review, lang) : "";
  const overview = item ? pickLocalized(item.overview, lang) : "";
  const genres = item ? item.genres.map((genre) => pickLocalized(genre, lang)).filter(Boolean) : [];
  const progress = item?.progress;
  const isMusic = item?.kind === "track";
  const isRead = item ? isReadKind(item.kind) : false;
  const publication = item?.publication;
  // Progress counts episodes, a comic's volumes or a book's pages.
  const progressKeys =
    item?.kind === "comic"
      ? (["collection.progressVolumes", "collection.progressVolumesOpen"] as const)
      : item?.kind === "book"
        ? (["collection.progressPages", "collection.progressPagesOpen"] as const)
        : (["collection.progress", "collection.progressOpen"] as const);

  return (
    <DetailDrawer id={id} labelledBy="media-detail-title" onClose={onClose}>
      {status === "loading" || status === "idle" ? <p className="sectionSubtitle">{t("collection.loading")}</p> : null}
      {status === "missing" ? <p className="sectionSubtitle">{t("collection.notFound")}</p> : null}

      {item ? (
        <>
          <div className="mediaDrawerHead">
            <div className={isMusic ? "mediaDrawerPoster isSquare" : "mediaDrawerPoster"}>
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
              <p className="mediaRowMeta">{[t(`collection.kind.${item.kind as "movie" | "tv" | "anime" | "book" | "comic" | "track"}`), item.year].filter(Boolean).join(" · ")}</p>
              {item.music?.album ? <p className="mediaRowMeta">{t("collection.album", { album: item.music.album })}</p> : null}
              <div className="mediaDrawerFacts">
                {item.status ? <span className={`mediaBadge mediaBadge-${item.status}`}>{t(statusKey(item.status, item.kind))}</span> : null}
                <Stars rating={item.rating} />
              </div>
              <ul className="mediaDrawerList">
                {item.watchedOn ? <li>{t(isRead ? "collection.readOn" : "collection.watchedOn", { date: item.watchedOn })}</li> : null}
                {progress && (item.status === "watching" || item.status === "dropped") ? (
                  <li>{progress.total ? t(progressKeys[0], { watched: progress.watched, total: progress.total }) : t(progressKeys[1], { watched: progress.watched })}</li>
                ) : null}
                {item.rewatchCount ? <li>{t(isRead ? "collection.reread" : "collection.rewatch", { n: item.rewatchCount })}</li> : null}
                {publication?.publisher ? <li>{t("collection.publisher", { publisher: publication.publisher })}</li> : null}
                {publication && (publication.pages || publication.volumes || publication.ongoing !== null) ? (
                  <li>
                    {[
                      publication.pages ? t("collection.pages", { n: publication.pages }) : "",
                      publication.volumes ? t("collection.volumes", { n: publication.volumes }) : "",
                      publication.ongoing === null ? "" : t(publication.ongoing ? "collection.ongoing" : "collection.finished")
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </li>
                ) : null}
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

          {/* Linked people replace the plain credits from the source. */}
          {item.credits.length && !item.links.some((link) => link.type === "credit" && link.direction === "to") ? (
            <section className="mediaDrawerSection">
              <h3>{t(isMusic ? "collection.artists" : isRead ? "collection.authors" : "collection.credits")}</h3>
              <p>{item.credits.join(" · ")}</p>
            </section>
          ) : null}

          <CollectionLinks links={item.links} linkTo={linkTo} />

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
          {item.music?.spotifyUrl || item.music?.appleUrl ? (
            <div className="mediaListenLinks">
              {item.music.spotifyUrl ? (
                <a className="btn btnSoft btnSmall" href={item.music.spotifyUrl} target="_blank" rel="noopener noreferrer">
                  Spotify
                </a>
              ) : null}
              {item.music.appleUrl ? (
                <a className="btn btnSoft btnSmall" href={item.music.appleUrl} target="_blank" rel="noopener noreferrer">
                  Apple Music
                </a>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </DetailDrawer>
  );
}
