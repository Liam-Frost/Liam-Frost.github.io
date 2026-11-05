import type { PublicCollection, PublicMediaSummary } from "@liam-frost/shared";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";

import { pickLocalized, useI18n, type Key } from "../lib/i18n";
import { cx } from "../lib/cx";
import { compareCompleted } from "../lib/completed-order";
import MediaCard, { isReadKind, mediaTitle, statusKey } from "./MediaCard";
import FeaturedQuiltWall from "./FeaturedQuiltWall";
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
  const [visibleFeatured, setVisibleFeatured] = useState<string[] | null>(null);
  const onVisibleItems = useCallback(
    (ids: string[]) =>
      setVisibleFeatured((old) => (old?.join("\n") === ids.join("\n") ? old : ids)),
    []
  );
  const featured = useMemo(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    return (home.wall?.items ?? home.featured)
      .map((pick) => byId.get(pick.id))
      .filter((item): item is PublicMediaSummary => Boolean(item));
  }, [items, home]);

  const parts = useMemo(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    // Exclude only covers actually visible in the wall, not every candidate beyond its row limit.
    const shown = new Set(visibleFeatured ?? home.featured.map((pick) => pick.id));
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
      .sort(compareCompleted);

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
  }, [items, playlists, home, featured, visibleFeatured]);

  const groups = (Object.keys(GROUPS) as Group[]).filter(
    (key) => key === "all" || parts.done.some(GROUPS[key])
  );
  const limit = parts.featured.length ? RECENT : RECENT * 2;
  const recent = parts.done.filter(GROUPS[group]).slice(0, limit);

  // Songs alone are enough: the listening bar can be the only part.
  if (!parts.featured.length && !parts.ongoing.length && !parts.done.length && !parts.songs.length)
    return null;

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
            <FeaturedQuiltWall
              items={parts.featured}
              settings={home.wall?.settings}
              onVisibleItems={onVisibleItems}
            />
          </div>
        ) : null}

        {parts.ongoing.length ? (
          <div className="homeBlock">
            <h3 className="homeBlockTitle">{t("collection.home.ongoing")}</h3>
            <div className="homeOngoingRow">
              {parts.ongoing.map((item) => (
                <Reveal key={item.id} stagger>
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
