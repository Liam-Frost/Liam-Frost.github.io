import type { MusicArtistIdentity } from "@liam-frost/shared";
import type { MediaRow } from "../media/types";
import type { PersonRow } from "./types";

const key = (name: string) => name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
export const personNames = (person: PersonRow) =>
  new Set(
    [...Object.values(person.name), person.originalName, ...(person.aliases ?? [])]
      .filter((v): v is string => Boolean(v))
      .map(key)
  );
export function artistIdentities(item: MediaRow): MusicArtistIdentity[] {
  const music = item.extra.music as { artistIdentities?: unknown } | undefined;
  return Array.isArray(music?.artistIdentities)
    ? music.artistIdentities.filter(
        (v): v is MusicArtistIdentity =>
          v &&
          typeof v.provider === "string" &&
          typeof v.externalId === "string" &&
          typeof v.name === "string"
      )
    : [];
}
/** Identity equality is evidence; name equality is only a suggestion. */
export function musicMatch(person: PersonRow, item: MediaRow, everyone: PersonRow[]) {
  if (item.kind !== "track" && item.kind !== "album") return null;
  const artists = artistIdentities(item);
  if (
    artists.some((a) =>
      person.identities?.some(
        (i) => i.confirmed && i.provider === a.provider && i.externalId === a.externalId
      )
    )
  )
    return { reason: "identity" as const, ambiguous: false };
  const names = personNames(person);
  const matches = item.credits.filter((n) => names.has(key(n)));
  if (!matches.length) return null;
  // A known, different artist ID must never be silently reinterpreted as a name match.
  const conflict = artists.some(
    (a) =>
      names.has(key(a.name)) &&
      person.identities?.some(
        (i) => i.confirmed && i.provider === a.provider && i.externalId !== a.externalId
      )
  );
  return {
    reason: conflict ? ("conflict" as const) : ("name" as const),
    ambiguous:
      conflict || matches.some((n) => everyone.filter((p) => personNames(p).has(key(n))).length > 1)
  };
}
