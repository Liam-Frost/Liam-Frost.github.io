import type { PublicMediaSummary } from "@liam-frost/shared";
import { Link, type To } from "react-router";

import { pickLocalized, useI18n, type Key } from "../lib/i18n";
import PlayButton from "./PlayButton";
import { imageSrcSet } from "./ProjectCard";

/** Five stars, filled up to the rating; announced as "4 / 5". */
export function Stars({ rating }: { rating: number | null }) {
  const { t } = useI18n();
  if (!rating) return <span className="mediaUnrated">{t("collection.unrated")}</span>;
  return (
    <span className="stars" role="img" aria-label={t("collection.rating", { n: rating })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= rating ? "starOn" : "starOff"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function mediaTitle(item: Pick<PublicMediaSummary, "title" | "originalTitle">, lang: Parameters<typeof pickLocalized>[1]) {
  return pickLocalized(item.title, lang) || item.originalTitle || "";
}

/** Books and comics are read; the rest are watched. */
export const isReadKind = (kind: PublicMediaSummary["kind"]) => kind === "book" || kind === "comic";

export const statusKey = (status: NonNullable<PublicMediaSummary["status"]>, kind: PublicMediaSummary["kind"]) =>
  (kind === "game" ? `collection.play.${status}` : isReadKind(kind) ? `collection.read.${status}` : `collection.status.${status}`) as Key;

function Poster({ item, sizes, priority }: { item: PublicMediaSummary; sizes: string; priority?: boolean }) {
  const { lang } = useI18n();
  if (!item.poster) {
    return (
      <span className="mediaPosterEmpty" aria-hidden="true">
        {mediaTitle(item, lang).slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={item.poster.variants[0].url}
      srcSet={imageSrcSet(item.poster)}
      sizes={sizes}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

/** Poster card for the grid and the home page; songs get a square cover and a play button on it. */
export default function MediaCard({ item, to, state, priority }: { item: PublicMediaSummary; to: To; state?: unknown; priority?: boolean }) {
  const { lang, t } = useI18n();
  const title = mediaTitle(item, lang);
  const isMusic = item.kind === "track";
  const card = (
    <Link className="mediaCard" to={to} state={state} aria-label={t("collection.open", { title })}>
      <div className={isMusic ? "mediaPoster isSquare" : "mediaPoster"}>
        <Poster item={item} sizes="(max-width: 520px) 45vw, 200px" priority={priority} />
        {item.status && item.status !== "done" ? <span className={`mediaBadge mediaBadge-${item.status}`}>{t(statusKey(item.status, item.kind))}</span> : null}
      </div>
      <div className="mediaCardBody">
        <h3 className="mediaCardTitle">{title}</h3>
        <div className="mediaCardMeta">
          <span className="mediaCardSub">{isMusic ? item.credits.join(", ") : (item.year ?? "")}</span>
          {item.rating ? <Stars rating={item.rating} /> : null}
        </div>
      </div>
    </Link>
  );
  // The play button sits next to the link (a button inside a link is not allowed), over the cover.
  return isMusic ? (
    <div className="mediaPlayable">
      {card}
      <PlayButton item={item} className="onCard" />
    </div>
  ) : (
    card
  );
}

/** One row of the list view. */
export function MediaRow({ item, to, state }: { item: PublicMediaSummary; to: To; state?: unknown }) {
  const { lang, t } = useI18n();
  const title = mediaTitle(item, lang);
  const isMusic = item.kind === "track";
  const genres = item.genres
    .slice(0, 3)
    .map((genre) => pickLocalized(genre, lang))
    .filter(Boolean);
  // Songs: artists and album; films, series and anime: year, genres and the first credit.
  const meta = isMusic ? [item.credits.join(", "), item.music?.album, item.year] : [item.year, ...genres, item.credits[0]];
  const row = (
    <Link className="mediaRow" to={to} state={state} aria-label={t("collection.open", { title })}>
      <div className={isMusic ? "mediaRowPoster isSquare" : "mediaRowPoster"}>
        <Poster item={item} sizes="64px" />
      </div>
      <div className="mediaRowMain">
        <h3 className="mediaCardTitle">{title}</h3>
        {item.originalTitle && item.originalTitle !== title ? <p className="mediaRowOriginal">{item.originalTitle}</p> : null}
        <p className="mediaRowMeta">{meta.filter(Boolean).join(" · ")}</p>
      </div>
      <div className="mediaRowSide">
        {item.status ? <span className={`mediaBadge mediaBadge-${item.status}`}>{t(statusKey(item.status, item.kind))}</span> : null}
        <Stars rating={item.rating} />
        {item.watchedOn ? <span className="mediaRowDate">{item.watchedOn}</span> : null}
      </div>
    </Link>
  );
  return isMusic ? (
    <div className="mediaPlayable">
      {row}
      <PlayButton item={item} className="onRow" />
    </div>
  ) : (
    row
  );
}
