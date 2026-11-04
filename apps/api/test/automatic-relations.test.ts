import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  SourceError,
  type CreditHit,
  type MediaSources,
  type PersonWorkCredit
} from "../src/media/sources";
import { AutomaticRelations, withAutomaticMedia } from "../src/people/automatic-relations";
import { MemorySettingsRepository } from "../src/settings/types";
import { buildTestServer, csrf, login, offlineMediaSources } from "./helpers";
import { MemoryMediaRepository } from "./memory-media-repository";
import { MemoryPersonRepository, MemoryRelationRepository } from "./memory-people-repository";

async function setup() {
  const media = new MemoryMediaRepository();
  const people = new MemoryPersonRepository();
  const relations = new MemoryRelationRepository(media, people);
  const works: PersonWorkCredit[] = [
    { sourceId: "movie:11", role: "director", character: null },
    { sourceId: "movie:12", role: "screenwriter", character: null },
    { sourceId: "movie:999", role: "director", character: null }
  ];
  const credits: CreditHit[] = [
    { sourceId: "42", name: "Same Name", role: "actor", character: "Hero", photoUrl: null },
    { sourceId: "43", name: "Same Name", role: "actor", character: "Villain", photoUrl: null }
  ];
  const sources: MediaSources = {
    ...offlineMediaSources,
    available: () => ({ ...offlineMediaSources.available(), tmdb: true }),
    person: async (sourceId) => ({
      sourceId,
      sourceUrl: `https://www.themoviedb.org/person/${sourceId}`,
      name: { en: "Same Name" },
      originalName: null,
      bio: {},
      links: [],
      photoUrl: null
    }),
    personCredits: vi.fn(async () => works),
    credits: vi.fn(async () => credits),
    details: async (_source, _kind, sourceId) => ({
      sourceId,
      sourceUrl: "https://www.themoviedb.org/movie/13",
      title: { en: "New work" },
      originalTitle: null,
      year: 2026,
      genres: [],
      credits: [],
      overview: {},
      posterUrl: null,
      episodes: null,
      publication: null
    })
  };
  const film = await media.create({
    id: randomUUID(),
    kind: "movie",
    source: "tmdb",
    sourceId: "movie:11",
    title: { en: "First" }
  });
  const second = await media.create({
    id: randomUUID(),
    kind: "movie",
    source: "tmdb",
    sourceId: "movie:12",
    title: { en: "Second" },
    visibility: "private"
  });
  const tv = await media.create({
    id: randomUUID(),
    kind: "tv",
    source: "tmdb",
    sourceId: "tv:11",
    title: { en: "Different identity" }
  });
  const app = await buildTestServer(
    {},
    { media, people, relations, settings: new MemorySettingsRepository(), mediaSources: sources }
  );
  const headers = { ...csrf, cookie: await login(app) };
  const post = (url: string, payload?: object) =>
    app.inject({ method: "POST", url, headers, ...(payload ? { payload } : {}) });
  return { app, media, people, relations, sources, film, second, tv, headers, post };
}

describe("automatic person/work credits", () => {
  it("backfills imported people by source id, including private works, without importing new works", async () => {
    const { app, media, relations, post, film, second, tv } = await setup();
    const result = await post("/api/admin/people/import", { source: "tmdb", sourceId: "42" });
    expect(result.statusCode).toBe(201);
    expect(result.json().person.works).toBe(2);
    expect((await relations.list()).map((x) => x.toMediaId).sort()).toEqual(
      [film.id, second.id].sort()
    );
    expect(await relations.list({ mediaId: tv.id })).toEqual([]);
    expect(await media.list({ includePrivate: true })).toHaveLength(3);
    await app.close();
  });

  it("links future imports only to existing source identities, including credits outside the suggested top cast", async () => {
    const { app, people, relations, sources, post } = await setup();
    const known = await people.create({
      id: randomUUID(),
      source: "tmdb",
      sourceId: "42",
      name: { en: "Same Name" }
    });
    await people.create({ id: randomUUID(), source: "manual", name: { en: "Same Name" } });
    const result = await post("/api/admin/media/import", {
      source: "tmdb",
      kind: "movie",
      sourceId: "movie:13"
    });
    expect(result.statusCode).toBe(201);
    const links = await relations.list({ mediaId: result.json().item.id });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ fromPersonId: known.id, role: "actor", note: { en: "Hero" } });
    expect(sources.credits).toHaveBeenCalledWith("movie:13", "movie", { all: true });
    expect(await people.list({ includePrivate: true })).toHaveLength(2);
    await app.close();
  });

  it("is idempotent, keeps manual notes, and serializes concurrent retries", async () => {
    const { app, relations, post, film } = await setup();
    const person = (
      await post("/api/admin/people/import", { source: "tmdb", sourceId: "42" })
    ).json().person;
    const link = (await relations.list({ mediaId: film.id }))[0]!;
    await relations.update(link.id, { note: { zh: "我的手工备注" } });
    const retries = await Promise.all([
      post(`/api/admin/people/${person.id}/sync-relations`),
      post(`/api/admin/people/${person.id}/sync-relations`)
    ]);
    expect(retries.map((x) => x.json().added)).toEqual([0, 0]);
    expect((await relations.get(link.id))?.note).toEqual({ zh: "我的手工备注" });
    expect(await relations.list()).toHaveLength(2);
    await app.close();
  });

  it("keeps a successfully imported person when the external credits fail and allows explicit retry", async () => {
    const { app, sources, relations, post } = await setup();
    const normal = sources.personCredits;
    sources.personCredits = async () => {
      throw new SourceError("TMDB temporarily unavailable");
    };
    const imported = await post("/api/admin/people/import", { source: "tmdb", sourceId: "42" });
    expect(imported.statusCode).toBe(201);
    const id = imported.json().person.id;
    expect((await post(`/api/admin/people/${id}/sync-relations`)).statusCode).toBe(502);
    expect(await relations.list()).toHaveLength(0);
    sources.personCredits = normal;
    expect((await post(`/api/admin/people/${id}/sync-relations`)).json().added).toBe(2);
    await app.close();
  });

  it("uses an explicit author link as evidence, backfills earlier books, and observes later repository imports", async () => {
    const { app, media, people, relations, sources, post } = await setup();
    const book = async () =>
      media.create({
        id: randomUUID(),
        source: "manual",
        kind: "book",
        title: { en: "A book" },
        credits: ["An Author"]
      });
    const first = await book();
    const second = await book();
    const person = (await post("/api/admin/people", { name: { en: "An Author" } })).json().person;
    expect(await relations.list()).toHaveLength(0);
    const linked = await post("/api/admin/relations", {
      from: { type: "person", id: person.id },
      toId: first.id,
      type: "credit",
      role: "author"
    });
    expect(linked.statusCode).toBe(201);
    expect((await relations.list({ personId: person.id })).map((x) => x.toMediaId).sort()).toEqual(
      [first.id, second.id].sort()
    );
    const automatic = new AutomaticRelations(media, people, relations, sources);
    const errors = vi.fn();
    const observed = withAutomaticMedia(media, automatic, errors);
    const next = await observed.create({
      id: randomUUID(),
      source: "manual",
      kind: "book",
      title: { en: "Next" },
      credits: ["An Author"]
    });
    expect(await relations.list({ mediaId: next.id })).toHaveLength(1);
    expect(errors).not.toHaveBeenCalled();
    // Adding a second person with the same name must stop future name-only matches.
    await people.create({ id: randomUUID(), source: "manual", name: { en: "An Author" } });
    const ambiguous = await observed.create({
      id: randomUUID(),
      source: "manual",
      kind: "book",
      title: { en: "Ambiguous" },
      credits: ["An Author"]
    });
    expect(await relations.list({ mediaId: ambiguous.id })).toEqual([]);
    await app.close();
  });

  it("requires authentication and CSRF for explicit backfill", async () => {
    const { app, people, headers } = await setup();
    const person = await people.create({
      id: randomUUID(),
      source: "manual",
      name: { en: "Artist" }
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/admin/people/${person.id}/sync-relations`,
          headers: csrf
        })
      ).statusCode
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/admin/people/${person.id}/sync-relations`,
          headers: { cookie: headers.cookie }
        })
      ).statusCode
    ).toBe(403);
    await app.close();
  });
});
