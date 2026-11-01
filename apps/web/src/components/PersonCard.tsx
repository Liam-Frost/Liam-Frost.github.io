import type { PublicPersonSummary } from "@liam-frost/shared";
import { Link, type To } from "react-router";

import { useI18n, type Key } from "../lib/i18n";
import { personName } from "./CollectionLinks";
import { imageSrcSet } from "./ProjectCard";

/** A person in the collection's people tab: round photo, name, main roles and number of entries. */
export default function PersonCard({ person, to }: { person: PublicPersonSummary; to: To }) {
  const { lang, t } = useI18n();
  const name = personName(person, lang);
  return (
    <Link
      className="personCard"
      to={to}
      state={{ fromList: true }}
      aria-label={t("collection.open", { title: name })}
    >
      <span className="personCardPhoto">
        {person.photo ? (
          <img
            src={person.photo.variants[0].url}
            srcSet={imageSrcSet(person.photo)}
            sizes="120px"
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="mediaPosterEmpty" aria-hidden="true">
            {name.slice(0, 1)}
          </span>
        )}
      </span>
      <span className="personCardName">{name}</span>
      <span className="personCardMeta">
        {[
          ...person.roles.slice(0, 2).map((role) => t(`collection.role.${role}` as Key)),
          t("collection.worksCount", { n: person.works })
        ].join(" · ")}
      </span>
    </Link>
  );
}
