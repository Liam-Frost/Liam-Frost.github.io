import type { PersonRole, PublicMediaSummary } from "@liam-frost/shared";

import { usePublicPerson } from "../data/useCollection";
import { pickLocalized, useI18n, type Key } from "../lib/i18n";
import { MediaLinkRow, personName, useRoleLabel, type CollectionLinkTo } from "./CollectionLinks";
import DetailDrawer from "./DetailDrawer";
import { imageSrcSet } from "./ProjectCard";

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Side panel with one person: photo, roles, bio, links and their entries in the collection. */
export default function PersonDetail({
  id,
  onClose,
  linkTo
}: {
  id: string;
  onClose: () => void;
  linkTo: CollectionLinkTo;
}) {
  const { lang, t } = useI18n();
  const { person, status } = usePublicPerson(id);
  const roleLabel = useRoleLabel();
  const name = person ? personName(person, lang) : "";
  const bio = person ? pickLocalized(person.bio, lang) : "";
  // One row per work, with every role (and note) the person has in it.
  const works = new Map<string, { item: PublicMediaSummary; details: string[] }>();
  for (const credit of person?.credits ?? []) {
    const work = works.get(credit.item.id) ?? { item: credit.item, details: [] };
    work.details.push(roleLabel("credit", credit.role), pickLocalized(credit.note, lang));
    works.set(credit.item.id, work);
  }

  return (
    <DetailDrawer id={id} labelledBy="person-detail-title" onClose={onClose}>
      {status === "loading" || status === "idle" ? (
        <p className="sectionSubtitle">{t("collection.loading")}</p>
      ) : null}
      {status === "missing" ? (
        <p className="sectionSubtitle">{t("collection.personNotFound")}</p>
      ) : null}

      {person ? (
        <>
          <div className="mediaDrawerHead">
            <div className="mediaDrawerPoster isSquare isRound">
              {person.photo ? (
                <img
                  src={person.photo.variants[person.photo.variants.length - 1].url}
                  srcSet={imageSrcSet(person.photo)}
                  sizes="180px"
                  alt=""
                />
              ) : (
                <span className="mediaPosterEmpty" aria-hidden="true">
                  {name.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="mediaDrawerInfo">
              <h2 className="mediaDrawerTitle" id="person-detail-title">
                {name}
              </h2>
              {person.originalName && person.originalName !== name ? (
                <p className="mediaRowOriginal">{person.originalName}</p>
              ) : null}
              <p className="mediaRowMeta">{t("collection.worksCount", { n: person.works })}</p>
              {person.roles.length ? (
                <div className="tags">
                  {person.roles.map((role: PersonRole) => (
                    <span key={role} className="tag">
                      {t(`collection.role.${role}` as Key)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {bio ? (
            <section className="mediaDrawerSection">
              <h3>{t("collection.bio")}</h3>
              <p className="mediaOverview">{bio}</p>
            </section>
          ) : null}

          <section className="mediaDrawerSection">
            <h3>{t("collection.works")}</h3>
            <div className="linkList">
              {[...works.values()].map(({ item, details }) => (
                <MediaLinkRow
                  key={item.id}
                  item={item}
                  details={[...new Set(details), item.year ? String(item.year) : ""]}
                  to={linkTo.item(item.id)}
                />
              ))}
            </div>
          </section>

          {person.links.length || person.sourceUrl ? (
            <div className="mediaListenLinks">
              {person.links.map((link) => (
                <a
                  key={link}
                  className="btn btnSoft btnSmall"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {hostOf(link)}
                </a>
              ))}
              {person.sourceUrl ? (
                <a
                  className="btn btnSoft btnSmall"
                  href={person.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("collection.source", { source: "TMDB" })}
                </a>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </DetailDrawer>
  );
}
