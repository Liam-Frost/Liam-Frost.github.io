import type { Photo } from "@liam-frost/content";
import type { PublicCollection, PublicProjectSummary } from "@liam-frost/shared";
import { Link } from "react-router";

import { useI18n } from "../lib/i18n";

type Props = {
  projects: PublicProjectSummary[];
  photos: Photo[];
  collection: PublicCollection;
};

/**
 * The hero's numbers: projects, photos and collection entries, counted from the site's own data and
 * each leading to its page. A part with nothing in it is left out.
 */
export default function HeroStats({ projects, photos, collection }: Props) {
  const { t } = useI18n();
  const stats = [
    { to: "/projects", n: projects.length, label: t("home.stats.projects") },
    { to: "/portfolio", n: photos.length, label: t("home.stats.photos") },
    {
      to: "/collection",
      n: collection.items.filter((item) => item.kind !== "track").length,
      label: t("home.stats.collection")
    }
  ].filter((stat) => stat.n > 0);
  if (!stats.length) return null;

  return (
    <ul className="heroStats">
      {stats.map((stat) => (
        <li key={stat.to}>
          <Link className="heroStat" to={stat.to}>
            <strong>{stat.n}</strong>
            <span>{stat.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
