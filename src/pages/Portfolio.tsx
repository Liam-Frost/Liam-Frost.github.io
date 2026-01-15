import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import PhotoCard from "../components/PhotoCard";
import PhotoModal from "../components/PhotoModal";
import Reveal from "../components/Reveal";
import { photos, type Photo } from "../data/photos";
import { cx } from "../lib/cx";
import { useI18n } from "../lib/i18n";

type SortMode = "new" | "old";

function sortByDate(mode: SortMode, list: Photo[]) {
  const factor = mode === "new" ? -1 : 1;
  return [...list].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (Number.isNaN(da) || Number.isNaN(db)) return 0;
    if (da === db) return a.title.localeCompare(b.title);
    return (da - db) * factor;
  });
}

export default function PortfolioPage() {
  const { t } = useI18n();

  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get("photo");

  const ALL = "__all__";

  const categories = useMemo(() => {
    const set = new Set(photos.map((p) => p.category));
    return [ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, []);

  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState<string>("");
  const [sort, setSort] = useState<SortMode>("new");

  const sortedAll = useMemo(() => sortByDate(sort, photos), [sort]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return sortByDate(
      sort,
        photos.filter((p) => {
        if (category !== ALL && p.category !== category) return false;
        if (!q) return true;

        const haystack = [p.title, p.category, p.location ?? "", p.tags.join(" ")].join(" ").toLowerCase();
        return haystack.includes(q);
      })
    );
  }, [category, query, sort]);

  const openPhoto = useMemo(() => {
    if (!openId) return null;
    return photos.find((p) => p.id === openId) ?? null;
  }, [openId]);

  const navList = useMemo(() => {
    if (!openPhoto) return filtered;
    const inFiltered = filtered.some((p) => p.id === openPhoto.id);
    return inFiltered ? filtered : sortedAll;
  }, [filtered, openPhoto, sortedAll]);

  const currentIndex = useMemo(() => {
    if (!openPhoto) return -1;
    return navList.findIndex((p) => p.id === openPhoto.id);
  }, [navList, openPhoto]);

  const open = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("photo", id);
    setSearchParams(next, { replace: false });
  };

  const close = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("photo");
    setSearchParams(next, { replace: true });
  };

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < navList.length - 1;

  const goPrev = () => {
    if (!hasPrev) return;
    open(navList[currentIndex - 1].id);
  };

  const goNext = () => {
    if (!hasNext) return;
    open(navList[currentIndex + 1].id);
  };

  const reset = () => {
    setCategory(ALL);
    setQuery("");
    setSort("new");
  };

  return (
    <section className="section">
      <div className="container">
        <Reveal>
          <h1 className="sectionTitle">{t("portfolio.title")}</h1>
          <p className="sectionSubtitle">{t("portfolio.subtitle")}</p>
        </Reveal>

        <div className="toolbar" aria-label="Gallery controls">
          <div className="toolbarRow">
            <div className="filters" aria-label="Categories">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cx("btn", c === category ? "btnSoft" : "btnGhost")}
                  onClick={() => setCategory(c)}
                >
                  {c === ALL ? t("skills.filterAll") : c}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("portfolio.search")}
                aria-label={t("portfolio.search")}
              />

              <select
                className="select"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                aria-label="Sort"
              >
                <option value="new">{t("portfolio.sort.new")}</option>
                <option value="old">{t("portfolio.sort.old")}</option>
              </select>
            </div>
          </div>

          <div className="toolbarRow">
            <span className="hint">{t("portfolio.count", { count: filtered.length })}</span>
            <button className="btn btnGhost btnSmall" type="button" onClick={reset}>
              {t("common.reset")}
            </button>
          </div>
        </div>

        <div className="masonry" aria-label="Photo gallery">
          {filtered.map((p, idx) => (
            <div key={p.id} className="masonryItem">
              <Reveal delayMs={(idx % 8) * 35}>
                <PhotoCard photo={p} onOpen={open} />
              </Reveal>
            </div>
          ))}
        </div>

        {openPhoto ? (
          <PhotoModal
            photo={openPhoto}
            onClose={close}
            onPrev={hasPrev ? goPrev : undefined}
            onNext={hasNext ? goNext : undefined}
            hasPrev={hasPrev}
            hasNext={hasNext}
          />
        ) : null}
      </div>
    </section>
  );
}
