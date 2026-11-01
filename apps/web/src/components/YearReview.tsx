import type { MediaKind, PublicMediaSummary } from "@liam-frost/shared";
import { useMemo, useState } from "react";
import type { To } from "react-router";

import { pickLocalized, useI18n, type Key } from "../lib/i18n";
import MediaCard from "./MediaCard";

/** Kinds in the order the summary names them. */
const KINDS: MediaKind[] = ["movie", "tv", "anime", "book", "comic", "game"];

/** Entries finished in a year: done, with the date they were finished in that year. */
const finishedIn = (items: PublicMediaSummary[], year: string) =>
  items.filter((item) => item.status === "done" && item.watchedOn?.startsWith(year));

/** Years with something finished, newest first. */
export function reviewYears(items: PublicMediaSummary[]) {
  return [
    ...new Set(
      items
        .filter((item) => item.status === "done" && item.watchedOn)
        .map((item) => item.watchedOn!.slice(0, 4))
    )
  ]
    .sort()
    .reverse();
}

/**
 * A year in the collection: how many films, series, anime, books, comics and games were finished, the
 * ratings, the most common genres, a month-by-month count and the five-star ones. Built from the
 * public collection on the page.
 */
export default function YearReview({
  items,
  linkTo
}: {
  items: PublicMediaSummary[];
  linkTo: (id: string) => To;
}) {
  const { lang, t } = useI18n();
  const years = useMemo(() => reviewYears(items), [items]);
  const [picked, setPicked] = useState<string | null>(null);
  const year = picked && years.includes(picked) ? picked : years[0];
  const done = useMemo(() => (year ? finishedIn(items, year) : []), [items, year]);

  const stats = useMemo(() => {
    const byKind = KINDS.map(
      (kind) => [kind, done.filter((item) => item.kind === kind).length] as const
    ).filter(([, n]) => n > 0);
    const rated = done.filter((item) => item.rating);
    const average = rated.length
      ? rated.reduce((sum, item) => sum + item.rating!, 0) / rated.length
      : null;
    const ratings = [5, 4, 3, 2, 1].map(
      (stars) => [stars, rated.filter((item) => item.rating === stars).length] as const
    );
    const genres = new Map<string, { name: string; count: number }>();
    for (const item of done) {
      for (const genre of item.genres) {
        const id = genre.zh || genre.en || Object.values(genre).find(Boolean) || "";
        const entry = genres.get(id) ?? { name: pickLocalized(genre, lang), count: 0 };
        entry.count += 1;
        genres.set(id, entry);
      }
    }
    const months = Array.from(
      { length: 12 },
      (_, month) => done.filter((item) => Number(item.watchedOn!.slice(5, 7)) === month + 1).length
    );
    const favorites = done
      .filter((item) => item.rating === 5)
      .sort((a, b) => b.watchedOn!.localeCompare(a.watchedOn!));
    return {
      byKind,
      average,
      ratings,
      genres: [...genres.values()].sort((a, b) => b.count - a.count).slice(0, 8),
      months,
      favorites,
      rated: rated.length
    };
  }, [done, lang]);

  if (!year) return <p className="sectionSubtitle">{t("review.empty")}</p>;
  const monthName = new Intl.DateTimeFormat(lang, { month: "short" });
  const busiest = Math.max(1, ...stats.months);
  const mostRatings = Math.max(1, ...stats.ratings.map(([, n]) => n));

  return (
    <div className="review">
      <div className="reviewHead">
        <h2 className="groupTitle">{t("review.title", { year })}</h2>
        {years.length > 1 ? (
          <select
            className="select selectSmall"
            aria-label={t("review.year")}
            value={year}
            onChange={(e) => setPicked(e.target.value)}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <p className="reviewSummary">
        {stats.byKind
          .map(([kind, n]) => t(`review.kind.${kind}` as Key, { n }))
          .join(t("review.separator"))}
      </p>

      <div className="reviewGrid">
        <section className="card reviewCard">
          <h3>{t("review.months")}</h3>
          <div
            className="reviewMonths"
            role="img"
            aria-label={stats.months
              .map((n, m) => `${monthName.format(new Date(2000, m, 1))} ${n}`)
              .join(", ")}
          >
            {stats.months.map((n, m) => (
              <div key={m} className="reviewMonth">
                <span className="reviewBar" style={{ height: `${(n / busiest) * 100}%` }} />
                <span className="reviewMonthCount">{n || ""}</span>
                <span className="reviewMonthName">{monthName.format(new Date(2000, m, 1))}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card reviewCard">
          <h3>{t("review.ratings")}</h3>
          {stats.average !== null ? (
            <p className="reviewBig">{t("review.average", { n: stats.average.toFixed(1) })}</p>
          ) : (
            <p className="mediaRowMeta">{t("collection.unrated")}</p>
          )}
          <ul className="reviewRatings">
            {stats.ratings.map(([stars, n]) => (
              <li key={stars}>
                <span className="reviewStars">{"★".repeat(stars)}</span>
                <span className="reviewRatingBar">
                  <span style={{ width: `${(n / mostRatings) * 100}%` }} />
                </span>
                <span className="reviewRatingCount">{n}</span>
              </li>
            ))}
          </ul>
        </section>

        {stats.genres.length ? (
          <section className="card reviewCard">
            <h3>{t("review.genres")}</h3>
            <div className="tags">
              {stats.genres.map((genre) => (
                <span key={genre.name} className="tag">
                  {genre.name} · {genre.count}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {stats.favorites.length ? (
        <section className="reviewFavorites">
          <h3 className="reviewSectionTitle">{t("review.favorites")}</h3>
          <div className="mediaGrid">
            {stats.favorites.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                to={linkTo(item.id)}
                state={{ fromList: true }}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
