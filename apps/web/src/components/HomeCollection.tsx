import type { PublicCollection, PublicMediaSummary } from "@liam-frost/shared";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { pickLocalized, useI18n, type Key } from "../lib/i18n";
import { cx } from "../lib/cx";
import MediaCard, { isReadKind, mediaTitle, Stars, statusKey } from "./MediaCard";
import { PlayAllButton } from "./PlayButton";
import { imageSrcSet } from "./ProjectCard";
import Reveal from "./Reveal";

/** Groups of the 最近完成 switch. */
const GROUPS = {
  all: () => true,
  screen: (item: PublicMediaSummary) => ["movie", "tv", "anime"].includes(item.kind),
  read: (item: PublicMediaSummary) => isReadKind(item.kind),
  game: (item: PublicMediaSummary) => item.kind === "game"
} as const;
type Group = keyof typeof GROUPS;

const ONGOING = 4;
/** One row of recent entries, or two when nothing is featured. */
const RECENT = 6;

const itemLink = (item: PublicMediaSummary) => `/collection?kind=${item.kind}&item=${item.id}`;
const finished = (item: PublicMediaSummary) => item.watchedOn ?? item.updatedAt.slice(0, 10);

/** Episodes, a comic's volumes or a book's pages, or a game's hours; null when nothing is known. */
export function progressOf(
  item: PublicMediaSummary
): { key: Key; vars: Record<string, number>; ratio: number | null } | null {
  if (item.kind === "game") {
    const hours = item.game?.playtimeHours;
    return hours ? { key: "collection.playtime", vars: { n: hours }, ratio: null } : null;
  }
  const progress = item.progress;
  if (!progress?.watched) return null;
  const [withTotal, open] =
    item.kind === "comic"
      ? (["collection.progressVolumes", "collection.progressVolumesOpen"] as const)
      : item.kind === "book"
        ? (["collection.progressPages", "collection.progressPagesOpen"] as const)
        : (["collection.progress", "collection.progressOpen"] as const);
  return progress.total
    ? {
        key: withTotal,
        vars: { watched: progress.watched, total: progress.total },
        ratio: Math.min(1, progress.watched / progress.total)
      }
    : { key: open, vars: { watched: progress.watched }, ratio: null };
}

function Cover({ item, sizes }: { item: PublicMediaSummary; sizes: string }) {
  const { lang } = useI18n();
  return item.poster ? (
    <img
      src={item.poster.variants[0].url}
      srcSet={imageSrcSet(item.poster)}
      sizes={sizes}
      alt=""
      loading="lazy"
      decoding="async"
    />
  ) : (
    <span className="mediaPosterEmpty" aria-hidden="true">
      {mediaTitle(item, lang).slice(0, 1)}
    </span>
  );
}

function FeaturedCard({ item, excerpt }: { item: PublicMediaSummary; excerpt: string }) {
  const { lang, t } = useI18n();
  const title = mediaTitle(item, lang);
  return (
    <Link className="homeFeatured" to={itemLink(item)} aria-label={t("collection.open", { title })}>
      <div className={cx("homeFeaturedPoster", item.kind === "track" && "isSquare")}>
        <Cover item={item} sizes="(max-width: 640px) 34vw, 140px" />
      </div>
      <div className="homeFeaturedBody">
        <p className="homeEyebrow">
          {[t(`collection.kind.${item.kind}` as Key), item.year].filter(Boolean).join(" · ")}
        </p>
        <h3 className="homeFeaturedTitle">{title}</h3>
        {item.rating ? <Stars rating={item.rating} /> : null}
        {excerpt ? <p className="homeExcerpt">{excerpt}</p> : null}
      </div>
    </Link>
  );
}

function OngoingCard({ item }: { item: PublicMediaSummary }) {
  const { lang, t } = useI18n();
  const title = mediaTitle(item, lang);
  const progress = progressOf(item);
  return (
    <Link className="homeOngoing" to={itemLink(item)} aria-label={t("collection.open", { title })}>
      <div className="homeOngoingPoster">
        <Cover item={item} sizes="56px" />
      </div>
      <div className="homeOngoingBody">
        <h3 className="homeOngoingTitle">{title}</h3>
        <p className="homeOngoingMeta">
          <span className="mediaBadge mediaBadge-watching">
            {t(statusKey("watching", item.kind))}
          </span>
          {progress ? <span>{t(progress.key, progress.vars)}</span> : null}
        </p>
        {progress?.ratio != null ? (
          <span className="homeProgress" aria-hidden="true">
            <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * The home page's collection: featured entries first (chosen by the server: rotating daily or in the
 * admin's order), then what is in progress, recently finished entries and a playlist. Each entry shows
 * once; empty parts are left out.
 */
export default function HomeCollection({ collection }: { collection: PublicCollection }) {
  const { lang, t } = useI18n();
  const [group, setGroup] = useState<Group>("all");
  const { items, playlists, home } = collection;

  const parts = useMemo(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    const featured = home.featured
      .map((pick) => ({ item: byId.get(pick.id), excerpt: pick.excerpt }))
      .filter((pick): pick is { item: PublicMediaSummary; excerpt: typeof pick.excerpt } =>
        Boolean(pick.item)
      );
    const shown = new Set(featured.map(({ item }) => item.id));
    const ongoing = items
      .filter(
        (item) =>
          item.status === "watching" &&
          item.kind !== "track" &&
          item.kind !== "album" &&
          !shown.has(item.id)
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, ONGOING);
    ongoing.forEach((item) => shown.add(item.id));
    const done = items
      .filter((item) => item.status === "done" && item.kind !== "track" && !shown.has(item.id))
      .sort(
        (a, b) => finished(b).localeCompare(finished(a)) || b.updatedAt.localeCompare(a.updatedAt)
      );

    const year = String(new Date().getFullYear());
    const thisYear = items.filter(
      (item) => item.status === "done" && item.watchedOn?.startsWith(year)
    );
    const stats = (
      [
        ["collection.home.watched", thisYear.filter(GROUPS.screen).length],
        ["collection.home.read", thisYear.filter(GROUPS.read).length],
        ["collection.home.played", thisYear.filter(GROUPS.game).length]
      ] as const
    ).filter(([, n]) => n > 0);

    // The first playlist, or else the latest songs.
    const playlist = playlists[0];
    const songs = playlist
      ? playlist.trackIds.map((id) => byId.get(id)).filter((item) => item !== undefined)
      : items
          .filter((item) => item.kind === "track")
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 12);

    return { featured, ongoing, done, year, stats, playlist, songs };
  }, [items, playlists, home]);

  const groups = (Object.keys(GROUPS) as Group[]).filter(
    (key) => key === "all" || parts.done.some(GROUPS[key])
  );
  const limit = parts.featured.length ? RECENT : RECENT * 2;
  const recent = parts.done.filter(GROUPS[group]).slice(0, limit);

  if (!parts.featured.length && !parts.ongoing.length && !parts.done.length) return null;

  return (
    <section className="section" id="watching">
      <div className="container">
        <Reveal>
          <h2 className="sectionTitle">{t("collection.home.title")}</h2>
          {parts.stats.length ? (
            <p className="sectionSubtitle">
              <Link className="homeStats" to="/collection?kind=review">
                {t("collection.home.year", { year: parts.year })}
                {parts.stats.map(([key, n]) => t(key, { n })).join(t("collection.home.separator"))}
              </Link>
            </p>
          ) : (
            <p className="sectionSubtitle">{t("collection.home.subtitle")}</p>
          )}
        </Reveal>

        {parts.featured.length ? (
          <div className="homeBlock">
            <h3 className="homeBlockTitle">{t("collection.home.featured")}</h3>
            <div className={cx("homeFeaturedRow", `count-${parts.featured.length}`)}>
              {parts.featured.map(({ item, excerpt }, idx) => (
                <Reveal key={item.id} delayMs={idx * 60}>
                  <FeaturedCard item={item} excerpt={pickLocalized(excerpt, lang)} />
                </Reveal>
              ))}
            </div>
          </div>
        ) : null}

        {parts.ongoing.length ? (
          <div className="homeBlock">
            <h3 className="homeBlockTitle">{t("collection.home.ongoing")}</h3>
            <div className="homeOngoingRow">
              {parts.ongoing.map((item, idx) => (
                <Reveal key={item.id} delayMs={idx * 50}>
                  <OngoingCard item={item} />
                </Reveal>
              ))}
            </div>
          </div>
        ) : null}

        {parts.done.length ? (
          <div className="homeBlock">
            <div className="homeBlockHead">
              <h3 className="homeBlockTitle">{t("collection.home.recent")}</h3>
              {groups.length > 2 ? (
                <div className="filters" role="group" aria-label={t("collection.home.recent")}>
                  {groups.map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={group === key}
                      className={cx("btn", "btnSmall", group === key ? "btnSoft" : "btnGhost")}
                      onClick={() => setGroup(key)}
                    >
                      {t(`collection.home.group.${key}`)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className={cx("mediaGrid", "mediaGridHome", !parts.featured.length && "isTall")}>
              {recent.map((item) => (
                <MediaCard key={item.id} item={item} to={itemLink(item)} />
              ))}
            </div>
          </div>
        ) : null}

        {parts.songs.length ? (
          <div className="homeListening">
            <div className="homeListeningCovers" aria-hidden="true">
              {parts.songs.slice(0, 4).map((song) => (
                <span key={song.id}>
                  <Cover item={song} sizes="40px" />
                </span>
              ))}
            </div>
            <div className="homeListeningText">
              <p className="homeEyebrow">{t("collection.home.listening")}</p>
              <Link
                className="homeListeningName"
                to={
                  parts.playlist
                    ? `/collection?kind=track&music=playlists&in=${parts.playlist.id}`
                    : "/collection?kind=track"
                }
              >
                {parts.playlist
                  ? pickLocalized(parts.playlist.name, lang)
                  : t("collection.home.latestSongs")}
              </Link>
              <span className="homeListeningCount">
                {t("collection.music.songs", { n: parts.songs.length })}
              </span>
            </div>
            <PlayAllButton items={parts.songs} spotifyUrl={parts.playlist?.sourceUrl ?? null} />
          </div>
        ) : null}

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="btn btnPrimary" to="/collection">
            {t("collection.cta.all")}
          </Link>
        </div>
      </div>
    </section>
  );
}
