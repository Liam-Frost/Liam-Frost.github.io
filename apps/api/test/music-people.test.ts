import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createMusicBrainz } from "../src/people/musicbrainz";
import {
  AutomaticRelations,
  withAutomaticMedia,
  withAutomaticPeople
} from "../src/people/automatic-relations";
import { musicMatch } from "../src/people/music-matching";
import { buildTestServer, csrf, login, offlineMediaSources } from "./helpers";
import { MemoryMediaRepository } from "./memory-media-repository";
import { MemoryPersonRepository, MemoryRelationRepository } from "./memory-people-repository";

const mbid = "12345678-1234-4234-8234-123456789abc";
const spotifyId = "1234567890123456789012";
async function setup() {
  const people = new MemoryPersonRepository(),
    media = new MemoryMediaRepository();
  const relations = new MemoryRelationRepository(media, people);
  const automatic = new AutomaticRelations(media, people, relations, offlineMediaSources);
  const person = await people.create({
    id: randomUUID(),
    source: "manual",
    kind: "group",
    name: { en: "The Band" },
    aliases: ["別名"],
    identities: [{ provider: "spotify", externalId: spotifyId, confirmed: false }]
  });
  const song = await media.create({
    id: randomUUID(),
    source: "manual",
    kind: "track",
    title: { en: "Live version" },
    credits: ["別名"],
    extra: {
      music: {
        artistIdentities: [{ provider: "spotify", externalId: spotifyId, name: "The Band" }]
      }
    }
  });
  return { people, media, relations, automatic, person, song };
}
describe("music people identity", () => {
  it("keeps membership separate from credits and rejects self, missing and nested members", async () => {
    const { people, media, relations, person } = await setup();
    const member = await people.create({
      id: randomUUID(),
      source: "manual",
      name: { en: "Member" }
    });
    const app = await buildTestServer({}, { people, media, relations });
    try {
      const headers = { ...csrf, cookie: await login(app) };
      const patch = (id: string, payload: object) =>
        app.inject({ method: "PATCH", url: `/api/admin/people/${id}`, headers, payload });
      const membership = { personId: member.id, role: "Guitar", startYear: 2020, endYear: null };
      expect((await patch(person.id, { members: [membership] })).statusCode).toBe(200);
      expect(await relations.list()).toEqual([]);
      expect(
        (await patch(person.id, { members: [{ ...membership, personId: person.id }] })).statusCode
      ).toBe(400);
      expect(
        (await patch(person.id, { members: [{ ...membership, personId: randomUUID() }] }))
          .statusCode
      ).toBe(400);
      expect(
        (await patch(person.id, { members: [{ ...membership, endYear: 2019 }] })).statusCode
      ).toBe(400);
      expect((await patch(member.id, { kind: "group" })).statusCode).toBe(400);
      expect((await patch(person.id, { kind: "person" })).statusCode).toBe(400);
      await people.delete(member.id);
      expect((await people.get(person.id))?.members).toEqual([]);
    } finally {
      await app.close();
    }
  });
  it("imports MusicBrainz groups with aliases, provenance and unconfirmed cross-provider IDs; caches lookup", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        id: mbid,
        name: "The Band",
        type: "Group",
        aliases: [
          { name: "別名", locale: "ja", primary: true },
          { name: "Search alias", locale: null, primary: null }
        ],
        relations: [{ url: { resource: `https://open.spotify.com/artist/${spotifyId}` } }]
      })
    );
    const mb = createMusicBrainz(fetcher);
    const result = await mb.artist(mbid);
    expect(result).toMatchObject({
      kind: "group",
      aliases: ["別名", "Search alias"],
      name: { en: "The Band", ja: "別名" },
      photoUrl: null,
      identities: [
        { provider: "musicbrainz", externalId: mbid, confirmed: true },
        { provider: "spotify", externalId: spotifyId, confirmed: false }
      ]
    });
    expect(await mb.artist(mbid)).toEqual(result);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[0]![1];
    expect(init.redirect).toBe("error");
    expect(init.headers).toHaveProperty("user-agent");
    await expect(mb.artist("https://invalid.example/")).rejects.toThrow(/ID/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("never auto-links a name, alias or unconfirmed mapping; confirmed IDs work despite name changes", async () => {
    const { people, media, relations, automatic, person, song } = await setup();
    expect(musicMatch(person, song, [person])).toMatchObject({ reason: "name", ambiguous: false });
    expect(await automatic.personAdded(person)).toBe(0);
    const observed = withAutomaticPeople(people, automatic, (e) => {
      throw e;
    });
    await observed.update(person.id, {
      identities: [{ provider: "spotify", externalId: spotifyId, confirmed: true }]
    });
    expect(await relations.list({ personId: person.id })).toHaveLength(1);
    expect(await automatic.personAdded((await people.get(person.id))!)).toBe(0);
    const observedMedia = withAutomaticMedia(media, automatic, (e) => {
      throw e;
    });
    const next = await observedMedia.create({
      id: randomUUID(),
      source: "manual",
      kind: "track",
      title: { en: "Different title" },
      credits: ["New spelling"],
      extra: song.extra
    });
    expect(await relations.list({ mediaId: next.id })).toHaveLength(1);
    const ambiguous = await people.create({
      id: randomUUID(),
      source: "manual",
      name: { en: "The Band" },
      aliases: ["別名"]
    });
    expect(musicMatch(ambiguous, song, await people.list())).toMatchObject({
      reason: "name",
      ambiguous: true
    });
    expect(await automatic.personAdded(ambiguous)).toBe(0);
  });
  it("validates identity uniqueness and shows only unlinked suggestions behind authentication", async () => {
    const { people, media, relations, person, song } = await setup();
    const app = await buildTestServer({}, { people, media, relations });
    try {
      const headers = { ...csrf, cookie: await login(app) };
      const path = `/api/admin/people/${person.id}`;
      expect((await app.inject({ url: `${path}/music-candidates` })).statusCode).toBe(401);
      expect(
        (await app.inject({ url: `${path}/music-candidates`, headers })).json().candidates
      ).toMatchObject([{ id: song.id, reason: "name" }]);
      const duplicate = await people.create({
        id: randomUUID(),
        source: "manual",
        name: { en: "Someone else" }
      });
      const patch = (id: string, payload: object) =>
        app.inject({ method: "PATCH", url: `/api/admin/people/${id}`, headers, payload });
      expect(
        (
          await patch(duplicate.id, {
            identities: [{ provider: "spotify", externalId: spotifyId }]
          })
        ).statusCode
      ).toBe(409);
      expect(
        (
          await patch(duplicate.id, {
            identities: [{ provider: "musicbrainz", externalId: spotifyId }]
          })
        ).statusCode
      ).toBe(400);
      expect(
        (
          await patch(person.id, {
            identities: [{ provider: "spotify", externalId: spotifyId, confirmed: true }]
          })
        ).statusCode
      ).toBe(200);
      expect(
        (await app.inject({ url: `${path}/music-candidates`, headers })).json().candidates
      ).toEqual([]);
      expect((await people.get(person.id))?.aliases).toEqual(["別名"]);
    } finally {
      await app.close();
    }
  });
});
