import { homeCollectionContentIds } from "@liam-frost/shared";
import { orderHomeWall, type PublicCollection, type PublicMediaSummary } from "@liam-frost/shared";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";

import { useI18n } from "../lib/i18n";
import { cx } from "../lib/cx";
import { compareCompleted } from "../lib/completed-order";
import { rotationTurn } from "../lib/rotation";
import MediaCard, { isReadKind } from "./MediaCard";
import FeaturedQuiltWall from "./FeaturedQuiltWall";
import Reveal from "./Reveal";

/** Groups of the 最近完成 switch. */
const GROUPS = {
  all: () => true,
  screen: (item: PublicMediaSummary) => ["movie", "tv", "anime"].includes(item.kind),
  read: (item: PublicMediaSummary) => isReadKind(item.kind),
  game: (item: PublicMediaSummary) => item.kind === "game"
} as const;
type Group = keyof typeof GROUPS;

/** One row of recent entries, or two when nothing is featured. */
const RECENT = 6;

const itemLink = (item: PublicMediaSummary) => `/collection?kind=${item.kind}&item=${item.id}`;

/**
 * The home page's collection: featured entries first (in the admin's order, rotating daily, or per
 * visit or session, drawn here), then recently finished entries. Each entry shows once; empty parts
 * are left out.
 */
export default function HomeCollection({ collection }: { collection: PublicCollection }) {
  const { t } = useI18n();
  const [group, setGroup] = useState<Group>("all");
  const { items, home } = collection;
  const [visibleFeatured, setVisibleFeatured] = useState<string[] | null>(null);
  const onVisibleItems = useCallback(
    (ids: string[]) =>
      setVisibleFeatured((old) => (old?.join("\n") === ids.join("\n") ? old : ids)),
    []
  );
  const featured = useMemo(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    const candidates = (home.wall?.items ?? home.featured)
      .map((pick) => byId.get(pick.id))
      .filter((item): item is PublicMediaSummary => Boolean(item));
    // Rotating per visit or session: the server sends the base order and the turn is drawn here.
    const rotate = home.wall?.rotate;
    return rotate
      ? orderHomeWall(
          candidates,
          rotationTurn(
            candidates.map((item) => item.id),
            rotate,
            "featured"
          )
        )
      : candidates;
  }, [items, home]);

  const parts = useMemo(() => {
    // Exclude only covers actually visible in the wall, not every candidate beyond its row limit.
    const shown = new Set(
      visibleFeatured ??
        (home.wall?.rotate
          ? featured.slice(0, home.featured.length).map((item) => item.id)
          : home.featured.map((pick) => pick.id))
    );
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

    return { featured, done, year, stats };
  }, [items, home, featured, visibleFeatured]);

  const groups = (Object.keys(GROUPS) as Group[]).filter(
    (key) => key === "all" || parts.done.some(GROUPS[key])
  );
  const limit = parts.featured.length ? RECENT : RECENT * 2;
  const recent = parts.done.filter(GROUPS[group]).slice(0, limit);

  if (!homeCollectionContentIds(collection).length) return null;

  return (
    <section className="section" id="watching">
      <div className="container">
        <Reveal intensity="subtle">
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
          <Reveal after className="homeBlock">
            <h3 className="homeBlockTitle">{t("collection.home.featured")}</h3>
            <FeaturedQuiltWall
              items={parts.featured}
              settings={home.wall?.settings}
              onVisibleItems={onVisibleItems}
            />
          </Reveal>
        ) : null}

        {parts.done.length ? (
          <Reveal after className="homeBlock">
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
          </Reveal>
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
