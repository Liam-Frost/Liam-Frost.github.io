import type { PublicLink, PublicMediaSummary, PublicPersonSummary } from "@liam-frost/shared";
import { Link, type To } from "react-router";

import { pickLocalized, useI18n, type Key } from "../lib/i18n";
import { mediaTitle } from "./MediaCard";
import { imageSrcSet } from "./ProjectCard";

/** Where entries and people open: the collection page's panel, addressed by its query string. */
export type CollectionLinkTo = { item: (id: string) => To; person: (id: string) => To };

/** "Director", "Opening", ... for a relation's role. */
export function useRoleLabel() {
  const { t } = useI18n();
  return (type: PublicLink["type"], role: string | null) => {
    if (!role) return "";
    return t((type === "credit" ? `collection.role.${role}` : `collection.song.${role}`) as Key);
  };
}

export const personName = (person: Pick<PublicPersonSummary, "name" | "originalName">, lang: Parameters<typeof pickLocalized>[1]) =>
  pickLocalized(person.name, lang) || person.originalName || "";

function Thumb({ image, fallback, round, square }: { image: PublicMediaSummary["poster"]; fallback: string; round?: boolean; square?: boolean }) {
  return (
    <span className={["linkRowThumb", round ? "isRound" : "", square ? "isSquare" : ""].filter(Boolean).join(" ")}>
      {image ? (
        <img src={image.variants[0].url} srcSet={imageSrcSet(image)} sizes="48px" alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="mediaPosterEmpty" aria-hidden="true">
          {fallback.slice(0, 1)}
        </span>
      )}
    </span>
  );
}

/** A linked entry: thumbnail, title, and a line of details (role, note, year). */
export function MediaLinkRow({ item, details, to }: { item: PublicMediaSummary; details: string[]; to: To }) {
  const { lang, t } = useI18n();
  const title = mediaTitle(item, lang);
  return (
    <Link className="linkRow" to={to} state={{ fromList: true }} aria-label={t("collection.open", { title })}>
      <Thumb image={item.poster} fallback={title} square={item.kind === "track"} />
      <span className="linkRowMain">
        <span className="linkRowTitle">{title}</span>
        <span className="linkRowMeta">{details.filter(Boolean).join(" · ")}</span>
      </span>
    </Link>
  );
}

/** A linked person: round photo, name, and their roles in this entry. */
export function PersonLinkRow({ person, details, to }: { person: PublicPersonSummary; details: string[]; to: To }) {
  const { lang, t } = useI18n();
  const name = personName(person, lang);
  return (
    <Link className="linkRow" to={to} state={{ fromList: true }} aria-label={t("collection.open", { title: name })}>
      <Thumb image={person.photo} fallback={name} round />
      <span className="linkRowMain">
        <span className="linkRowTitle">{name}</span>
        <span className="linkRowMeta">{details.filter(Boolean).join(" · ")}</span>
      </span>
    </Link>
  );
}

/** Group order in an entry's panel; each key is `type.direction` ("related" reads the same both ways). */
const GROUPS = ["credit.to", "soundtrack.to", "soundtrack.from", "adaptation.from", "adaptation.to", "sequel.from", "sequel.to", "related"] as const;
const groupOf = (link: PublicLink) => (link.type === "related" ? "related" : `${link.type}.${link.direction}`);

/** An entry's links, grouped: people (roles merged per person), soundtrack, source, adaptations, sequels. */
export function CollectionLinks({ links, linkTo }: { links: PublicLink[]; linkTo: CollectionLinkTo }) {
  const { lang, t } = useI18n();
  const roleLabel = useRoleLabel();
  if (!links.length) return null;

  return (
    <>
      {GROUPS.map((group) => {
        const ofGroup = links.filter((link) => groupOf(link) === group);
        if (!ofGroup.length) return null;
        // One row per person or entry, with every role and note it has in this group.
        const rows = new Map<string, { link: PublicLink; details: string[] }>();
        for (const link of ofGroup) {
          const id = link.other.type === "media" ? link.other.item.id : link.other.person.id;
          const row = rows.get(id) ?? { link, details: [] };
          row.details.push(roleLabel(link.type, link.role), pickLocalized(link.note, lang));
          rows.set(id, row);
        }
        return (
          <section key={group} className="mediaDrawerSection">
            <h3>{t(`collection.link.${group}` as Key)}</h3>
            <div className="linkList">
              {[...rows.values()].map(({ link, details }) =>
                link.other.type === "media" ? (
                  <MediaLinkRow
                    key={link.id}
                    item={link.other.item}
                    details={[...new Set(details)].concat(link.other.item.year ? [String(link.other.item.year)] : [])}
                    to={linkTo.item(link.other.item.id)}
                  />
                ) : (
                  <PersonLinkRow key={link.id} person={link.other.person} details={[...new Set(details)]} to={linkTo.person(link.other.person.id)} />
                )
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
