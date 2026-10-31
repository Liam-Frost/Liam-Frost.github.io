import type { MediaKind, MediaStatus, PublicMediaSummary } from "@liam-frost/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import MediaCard, { MediaRow } from "../components/MediaCard";
import MediaDetail from "../components/MediaDetail";
import Reveal from "../components/Reveal";
import { useCollection } from "../data/useCollection";
import { cx } from "../lib/cx";
import { pickLocalized, useI18n, type Key } from "../lib/i18n";

const STATUSES: MediaStatus[] = ["watching", "done", "want", "dropped"];
const VIEW_KEY = "collectionView";

type View = "grid" | "list";

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/** Genre identity across languages: the first name it has. */
const genreId = (genre: PublicMediaSummary["genres"][number]) => genre.zh || genre.en || Object.values(genre).find(Boolean) || "";

export default function CollectionPage() {
  const { lang, t } = useI18n();
  const { kinds, items, status: loadStatus } = useCollection();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<View>(readView);
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState("");
  const [minRating, setMinRating] = useState(0);

  const kind = (kinds.find((k) => k === params.get("kind")) ?? kinds[0]) as MediaKind | undefined;
  const status = STATUSES.find((s) => s === params.get("status")) ?? null;
  const openId = params.get("item");

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  const ofKind = useMemo(() => items.filter((item) => item.kind === kind), [items, kind]);

  const genres = useMemo(() => {
    const byId = new Map<string, string>();
    for (const item of ofKind) for (const g of item.genres) byId.set(genreId(g), pickLocalized(g, lang));
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ofKind, lang]);
  const years = useMemo(() => [...new Set(ofKind.map((item) => item.year).filter((y): y is number => y !== null))].sort((a, b) => b - a), [ofKind]);

  const visible = ofKind.filter(
    (item) =>
      (!status || item.status === status) &&
      (!genre || item.genres.some((g) => genreId(g) === genre)) &&
      (!year || String(item.year) === year) &&
      (!minRating || (item.rating ?? 0) >= minRating)
  );

  const select = (next: Record<string, string | null>) => {
    const value = new URLSearchParams(params);
    for (const [key, v] of Object.entries(next)) {
      if (v) value.set(key, v);
      else value.delete(key);
    }
    setParams(value, { replace: true });
  };

  const switchKind = (next: MediaKind) => {
    setGenre("");
    setYear("");
    select({ kind: next, status: null });
  };

  // Entries open in a side panel addressed by ?item=, so links can be shared and Back closes it.
  const itemLink = (id: string) => {
    const value = new URLSearchParams(params);
    value.set("item", id);
    if (kind) value.set("kind", kind);
    return { search: `?${value}` };
  };
  const close = useCallback(() => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) {
      navigate(-1);
      return;
    }
    const value = new URLSearchParams(params);
    value.delete("item");
    setParams(value, { replace: true });
  }, [location.state, navigate, params, setParams]);

  return (
    <section className="section">
      <div className="container">
        <Reveal>
          <h1 className="sectionTitle">{t("collection.title")}</h1>
          <p className="sectionSubtitle">{t("collection.subtitle")}</p>
        </Reveal>

        {loadStatus === "loading" ? (
          <p className="sectionSubtitle">{t("collection.loading")}</p>
        ) : !kind || !items.length ? (
          <p className="sectionSubtitle">{t("collection.empty")}</p>
        ) : (
          <>
            {kinds.length > 1 ? (
              <div className="filters collectionTabs" role="tablist" aria-label={t("collection.title")}>
                {kinds.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={k === kind}
                    className={cx("btn", "btnSmall", k === kind ? "btnSoft" : "btnGhost")}
                    onClick={() => switchKind(k)}
                  >
                    {t(`collection.kind.${k}` as Key)} <span className="collectionCount">{items.filter((item) => item.kind === k).length}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="filters collectionFilters">
              {[null, ...STATUSES.filter((s) => ofKind.some((item) => item.status === s))].map((s) => (
                <button
                  key={s ?? "all"}
                  type="button"
                  aria-pressed={status === s}
                  className={cx("btn", "btnSmall", status === s ? "btnSoft" : "btnGhost")}
                  onClick={() => select({ status: s })}
                >
                  {s ? t(`collection.status.${s}` as Key) : t("collection.filter.all")}
                </button>
              ))}

              <div className="collectionSelects">
                {genres.length ? (
                  <select className="select selectSmall" aria-label={t("collection.filter.genre")} value={genre} onChange={(e) => setGenre(e.target.value)}>
                    <option value="">{t("collection.filter.anyGenre")}</option>
                    {genres.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {years.length > 1 ? (
                  <select className="select selectSmall" aria-label={t("collection.filter.year")} value={year} onChange={(e) => setYear(e.target.value)}>
                    <option value="">{t("collection.filter.anyYear")}</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                ) : null}
                <select className="select selectSmall" aria-label={t("collection.filter.rating")} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
                  <option value={0}>{t("collection.filter.anyRating")}</option>
                  {[5, 4, 3].map((n) => (
                    <option key={n} value={n}>
                      {t("collection.filter.minRating", { n })}
                    </option>
                  ))}
                </select>
                <div className="collectionView" role="group" aria-label={t("collection.view.label")}>
                  {(["grid", "list"] as const).map((v) => (
                    <button key={v} type="button" aria-pressed={view === v} className={cx("btn", "btnSmall", view === v ? "btnSoft" : "btnGhost")} onClick={() => setView(v)}>
                      {t(`collection.view.${v}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="sectionSubtitle">{t("collection.noMatch")}</p>
            ) : view === "grid" ? (
              <div className="mediaGrid">
                {visible.map((item, index) => (
                  <MediaCard key={item.id} item={item} to={itemLink(item.id)} state={{ fromList: true }} priority={index < 6} />
                ))}
              </div>
            ) : (
              <div className="mediaList">
                {visible.map((item) => (
                  <MediaRow key={item.id} item={item} to={itemLink(item.id)} state={{ fromList: true }} />
                ))}
              </div>
            )}

            <p className="collectionAttribution">{t("collection.attribution")}</p>
          </>
        )}
      </div>

      {openId ? <MediaDetail id={openId} onClose={close} /> : null}
    </section>
  );
}
