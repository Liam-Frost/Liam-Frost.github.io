import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import type { MediaSources, PersonDetails } from "../src/media/sources";
import type { MediaRow } from "../src/media/types";
import { MemorySettingsRepository } from "../src/settings/types";
import { buildTestServer, csrf, login, multipartFile, offlineMediaSources } from "./helpers";
import { MemoryMediaRepository } from "./memory-media-repository";
import { MemoryPersonRepository, MemoryRelationRepository } from "./memory-people-repository";

let png: Buffer;

beforeAll(async () => {
  png = await sharp({ create: { width: 400, height: 600, channels: 3, background: "#642" } })
    .png()
    .toBuffer();
});

const miyazaki: PersonDetails = {
  sourceId: "608",
  sourceUrl: "https://www.themoviedb.org/person/608",
  name: { en: "Hayao Miyazaki", ja: "宮崎駿", zh: "宫崎骏" },
  originalName: null,
  bio: { en: "Japanese animator." },
  links: ["https://www.imdb.com/name/nm0594503/"],
  photoUrl: "https://image.tmdb.org/t/p/w780/miyazaki.jpg"
};

function sources(overrides: Partial<MediaSources> = {}): MediaSources {
  return {
    ...offlineMediaSources,
    available: () => ({
      tmdb: true,
      bangumi: true,
      openlibrary: true,
      googlebooks: true,
      anilist: true,
      igdb: true
    }),
    download: async () => png,
    searchPeople: async () => [
      {
        source: "tmdb",
        sourceId: "608",
        name: "Hayao Miyazaki",
        department: "Directing",
        knownFor: ["Spirited Away"],
        photoUrl: null
      }
    ],
    person: async (sourceId) => ({
      ...miyazaki,
      sourceId,
      sourceUrl: `https://www.themoviedb.org/person/${sourceId}`
    }),
    ...overrides
  };
}

const ids = {
  film: "11111111-1111-4111-8111-111111111111",
  anime: "22222222-2222-4222-8222-222222222222",
  song: "33333333-3333-4333-8333-333333333333",
  sequel: "44444444-4444-4444-8444-444444444444",
  hidden: "55555555-5555-4555-8555-555555555555",
  comic: "66666666-6666-4666-8666-666666666666"
};

async function setup(mediaSources: MediaSources = sources()) {
  const uploadDir = mkdtempSync(join(tmpdir(), "lf-people-"));
  const media = new MemoryMediaRepository();
  const people = new MemoryPersonRepository();
  const relations = new MemoryRelationRepository(media, people);
  const settings = new MemorySettingsRepository();
  const entry = (
    id: string,
    kind: MediaRow["kind"],
    title: string,
    extra: Partial<MediaRow> = {}
  ) =>
    media.create({
      id,
      kind,
      source: "manual",
      title: { zh: title },
      status: kind === "track" ? null : "done",
      ...extra
    });
  await entry(ids.film, "movie", "千与千寻", { source: "tmdb", sourceId: "movie:129", year: 2001 });
  await entry(ids.anime, "anime", "孤独摇滚！", {
    originalTitle: "ぼっち・ざ・ろっく！",
    year: 2022
  });
  await entry(ids.song, "track", "青春コンプレックス", { credits: ["結束バンド"] });
  await entry(ids.sequel, "anime", "孤独摇滚！ 剧场版", {
    originalTitle: "劇場総集編ぼっち・ざ・ろっく！",
    year: 2024
  });
  await entry(ids.hidden, "movie", "私密", { visibility: "private" });
  await entry(ids.comic, "comic", "孤独摇滚！（漫画）", {
    originalTitle: "ぼっち・ざ・ろっく！",
    year: 2018,
    credits: ["はまじあき"]
  });

  const app = await buildTestServer(
    { UPLOAD_DIR: uploadDir },
    { media, people, relations, settings, mediaSources }
  );
  const cookie = await login(app);
  const headers = { ...csrf, cookie };
  const post = (url: string, payload: object) =>
    app.inject({ method: "POST", url, headers, payload });
  const link = (payload: object) => post("/api/admin/relations", payload);
  const manual = async (name: string) =>
    (await post("/api/admin/people", { name: { en: name } })).json().person;
  return {
    app,
    media,
    people,
    relations,
    settings,
    cookie,
    headers,
    uploadDir,
    post,
    link,
    manual
  };
}

describe("admin people", () => {
  it("imports a TMDB person with their photo, once", async () => {
    const { app, cookie, post, uploadDir } = await setup();
    const imported = await post("/api/admin/people/import", { source: "tmdb", sourceId: "608" });
    expect(imported.statusCode).toBe(201);
    const { person } = imported.json();
    expect(person).toMatchObject({
      source: "tmdb",
      sourceId: "608",
      name: miyazaki.name,
      links: miyazaki.links,
      works: 0
    });
    expect(existsSync(join(uploadDir, "people", person.id, person.photo.id))).toBe(true);

    expect(
      (await post("/api/admin/people/import", { source: "tmdb", sourceId: "608" })).statusCode
    ).toBe(409);
    const search = await app.inject({
      url: "/api/admin/people/search?q=miyazaki",
      headers: { cookie }
    });
    expect(search.json().results[0].existingId).toBe(person.id);
  });

  it("creates, edits and deletes people with their photo and links", async () => {
    const { app, headers, link, manual, uploadDir } = await setup();
    const person = await manual("Kessoku Band");
    const patch = (payload: object) =>
      app.inject({ method: "PATCH", url: `/api/admin/people/${person.id}`, headers, payload });

    expect((await patch({ links: ["http://example.com"] })).statusCode).toBe(400);
    expect((await patch({ name: {} })).statusCode).toBe(400);
    const edited = await patch({
      name: { en: "Kessoku Band", ja: "結束バンド" },
      links: ["https://example.com/band"],
      visibility: "private"
    });
    expect(edited.json().person).toMatchObject({
      name: { ja: "結束バンド" },
      links: ["https://example.com/band"],
      visibility: "private"
    });

    const body = multipartFile("band.png", png, "image/png");
    const uploaded = await app.inject({
      method: "POST",
      url: `/api/admin/people/${person.id}/photo`,
      headers: { ...headers, ...body.headers },
      payload: body.payload
    });
    expect(uploaded.statusCode).toBe(201);

    await link({
      from: { type: "person", id: person.id },
      toId: ids.song,
      type: "credit",
      role: "singer"
    });
    expect(
      (await app.inject({ url: `/api/admin/media/${ids.song}/relations`, headers })).json()
        .relations
    ).toHaveLength(1);

    expect(
      (await app.inject({ method: "DELETE", url: `/api/admin/people/${person.id}`, headers }))
        .statusCode
    ).toBe(204);
    expect(existsSync(join(uploadDir, "people", person.id))).toBe(false);
    // The person's links went with them.
    expect(
      (await app.inject({ url: `/api/admin/media/${ids.song}/relations`, headers })).json()
        .relations
    ).toHaveLength(0);
  });
});

describe("admin relations", () => {
  it("links entries and people, listed from both ends", async () => {
    const { app, headers, link, manual } = await setup();
    const band = await manual("Kessoku Band");

    const credit = await link({
      from: { type: "person", id: band.id },
      toId: ids.song,
      type: "credit",
      role: "singer"
    });
    expect(credit.statusCode).toBe(201);
    const opening = await link({
      from: { type: "media", id: ids.song },
      toId: ids.anime,
      type: "soundtrack",
      role: "ending",
      note: { zh: "第 1 季片尾曲" }
    });
    expect(opening.json().relation).toMatchObject({
      type: "soundtrack",
      role: "ending",
      direction: "from",
      other: { type: "media", id: ids.anime }
    });
    await link({ from: { type: "media", id: ids.sequel }, toId: ids.anime, type: "sequel" });

    const ofAnime = (
      await app.inject({ url: `/api/admin/media/${ids.anime}/relations`, headers })
    ).json().relations;
    expect(
      ofAnime.map((r: { type: string; direction: string; other: { id: string } }) => [
        r.type,
        r.direction,
        r.other.id
      ])
    ).toEqual([
      ["soundtrack", "to", ids.song],
      ["sequel", "to", ids.sequel]
    ]);
    const ofSong = (
      await app.inject({ url: `/api/admin/media/${ids.song}/relations`, headers })
    ).json().relations;
    expect(ofSong.map((r: { other: { type: string } }) => r.other.type)).toEqual([
      "person",
      "media"
    ]);
    const ofBand = (
      await app.inject({ url: `/api/admin/people/${band.id}/relations`, headers })
    ).json().relations;
    expect(ofBand).toMatchObject([
      { type: "credit", role: "singer", direction: "from", other: { id: ids.song } }
    ]);
    expect((await app.inject({ url: "/api/admin/people", headers })).json().people[0].works).toBe(
      1
    );
  });

  it("refuses links that do not fit", async () => {
    const { link, manual } = await setup();
    const person = await manual("Someone");
    const cases: [object, number][] = [
      [
        {
          from: { type: "media", id: ids.film },
          toId: ids.anime,
          type: "credit",
          role: "director"
        },
        400
      ],
      [{ from: { type: "person", id: person.id }, toId: ids.film, type: "credit" }, 400],
      [{ from: { type: "person", id: person.id }, toId: ids.film, type: "sequel" }, 400],
      [{ from: { type: "media", id: ids.film }, toId: ids.film, type: "related" }, 400],
      [{ from: { type: "media", id: ids.film }, toId: ids.anime, type: "soundtrack" }, 400],
      [
        {
          from: { type: "media", id: ids.song },
          toId: ids.anime,
          type: "soundtrack",
          role: "director"
        },
        400
      ],
      [{ from: { type: "media", id: ids.song }, toId: ids.film, type: "adaptation" }, 400],
      [
        {
          from: { type: "media", id: ids.film },
          toId: ids.anime,
          type: "related",
          role: "opening"
        },
        400
      ],
      [
        {
          from: { type: "media", id: ids.film },
          toId: "99999999-9999-4999-8999-999999999999",
          type: "related"
        },
        404
      ],
      // Malformed bodies are refused, not crashed on.
      [{ toId: ids.anime, type: "related" }, 400],
      [{ from: { type: "media", id: "nope" }, toId: ids.anime, type: "related" }, 400],
      [{ from: null, toId: ids.anime, type: "credit", role: "director" }, 400],
      [{ from: { type: "media", id: ids.film }, toId: ids.anime, type: "remake" }, 400]
    ];
    for (const [payload, status] of cases)
      expect((await link(payload)).statusCode, JSON.stringify(payload)).toBe(status);
  });

  it("refuses duplicates, including a related pair the other way round", async () => {
    const { app, headers, link, manual } = await setup();
    expect(
      (await link({ from: { type: "media", id: ids.film }, toId: ids.anime, type: "related" }))
        .statusCode
    ).toBe(201);
    expect(
      (await link({ from: { type: "media", id: ids.anime }, toId: ids.film, type: "related" }))
        .statusCode
    ).toBe(409);

    // The same person may have two roles in one work, but not the same role twice.
    const person = await manual("Hayao Miyazaki");
    const director = (
      await link({
        from: { type: "person", id: person.id },
        toId: ids.film,
        type: "credit",
        role: "director"
      })
    ).json().relation;
    expect(
      (
        await link({
          from: { type: "person", id: person.id },
          toId: ids.film,
          type: "credit",
          role: "screenwriter"
        })
      ).statusCode
    ).toBe(201);
    expect(
      (
        await link({
          from: { type: "person", id: person.id },
          toId: ids.film,
          type: "credit",
          role: "director"
        })
      ).statusCode
    ).toBe(409);

    const patch = (payload: object) =>
      app.inject({ method: "PATCH", url: `/api/admin/relations/${director.id}`, headers, payload });
    expect((await patch({ role: "screenwriter" })).statusCode).toBe(409);
    expect((await patch({ role: null })).statusCode).toBe(400);
    const edited = await patch({ role: "producer", note: { en: "Also producer" } });
    expect(edited.json().relation).toMatchObject({
      role: "producer",
      note: { en: "Also producer" }
    });
    // The old role is free again.
    expect(
      (
        await link({
          from: { type: "person", id: person.id },
          toId: ids.film,
          type: "credit",
          role: "director"
        })
      ).statusCode
    ).toBe(201);

    expect(
      (await app.inject({ method: "DELETE", url: `/api/admin/relations/${director.id}`, headers }))
        .statusCode
    ).toBe(204);
    expect(
      (await app.inject({ method: "DELETE", url: `/api/admin/relations/${director.id}`, headers }))
        .statusCode
    ).toBe(404);
  });

  it("removes an entry's links when it is deleted", async () => {
    const { app, headers, link } = await setup();
    await link({ from: { type: "media", id: ids.sequel }, toId: ids.anime, type: "sequel" });
    await app.inject({ method: "DELETE", url: `/api/admin/media/${ids.sequel}`, headers });
    expect(
      (await app.inject({ url: `/api/admin/media/${ids.anime}/relations`, headers })).json()
        .relations
    ).toEqual([]);
  });
});

describe("relation suggestions", () => {
  it("suggests TMDB cast and crew, marking people already in the collection", async () => {
    const credits: MediaSources["credits"] = async () => [
      {
        sourceId: "608",
        name: "Hayao Miyazaki",
        role: "director",
        character: null,
        photoUrl: null
      },
      {
        sourceId: "608",
        name: "Hayao Miyazaki",
        role: "screenwriter",
        character: null,
        photoUrl: null
      },
      {
        sourceId: "1000",
        name: "Rumi Hiiragi",
        role: "actor",
        character: "Chihiro",
        photoUrl: null
      }
    ];
    const { app, headers, post, link } = await setup(sources({ credits }));
    const { person } = (
      await post("/api/admin/people/import", { source: "tmdb", sourceId: "608" })
    ).json();
    await link({
      from: { type: "person", id: person.id },
      toId: ids.film,
      type: "credit",
      role: "director"
    });

    const { suggestions } = (
      await app.inject({ url: `/api/admin/media/${ids.film}/suggestions`, headers })
    ).json();
    expect(suggestions).toEqual([
      {
        kind: "tmdb-person",
        sourceId: "608",
        name: "Hayao Miyazaki",
        role: "screenwriter",
        character: null,
        photoUrl: null,
        personId: person.id
      },
      {
        kind: "tmdb-person",
        sourceId: "1000",
        name: "Rumi Hiiragi",
        role: "actor",
        character: "Chihiro",
        photoUrl: null,
        personId: null
      }
    ]);
  });

  it("matches a song's singers to people by name", async () => {
    const { app, headers, manual, people } = await setup();
    const band = await manual("Kessoku Band");
    await people.update(band.id, { name: { en: "Kessoku Band", ja: "結束バンド" } });
    const { suggestions } = (
      await app.inject({ url: `/api/admin/media/${ids.song}/suggestions`, headers })
    ).json();
    expect(suggestions).toEqual([
      { kind: "name", name: "結束バンド", role: "singer", personId: band.id }
    ]);
  });

  it("suggests a comic's authors by name", async () => {
    const { app, headers } = await setup();
    const { suggestions } = (
      await app.inject({ url: `/api/admin/media/${ids.comic}/suggestions`, headers })
    ).json();
    expect(suggestions).toEqual([
      { kind: "name", name: "はまじあき", role: "author", personId: null }
    ]);
  });

  it("turns AniList relations into links between entries in the collection", async () => {
    const relations: MediaSources["relations"] = async () => [
      {
        relationType: "SEQUEL",
        kind: "anime",
        titles: ["劇場総集編 ぼっち・ざ・ろっく！", "Bocchi the Rock! Movie"]
      },
      // The manga has the TV anime's title: it matches the comic, not the anime itself.
      { relationType: "SOURCE", kind: "comic", titles: ["ぼっち・ざ・ろっく！"] },
      { relationType: "CHARACTER", kind: "anime", titles: ["劇場総集編ぼっち・ざ・ろっく！"] }
    ];
    const { app, headers, link } = await setup(sources({ relations }));
    const url = `/api/admin/media/${ids.anime}/suggestions`;
    const { suggestions } = (await app.inject({ url, headers })).json();
    // The film is the TV anime's sequel (the link starts at the film); the anime adapts the comic.
    expect(suggestions).toEqual([
      {
        kind: "media",
        relation: { from: { type: "media", id: ids.sequel }, toId: ids.anime, type: "sequel" },
        other: expect.objectContaining({ type: "media", id: ids.sequel })
      },
      {
        kind: "media",
        relation: { from: { type: "media", id: ids.anime }, toId: ids.comic, type: "adaptation" },
        other: expect.objectContaining({ type: "media", id: ids.comic, kind: "comic" })
      }
    ]);
    for (const suggestion of suggestions) await link(suggestion.relation);
    expect((await app.inject({ url, headers })).json().suggestions).toEqual([]);
  });
});

describe("public people and links", () => {
  it("shows people credited in shown entries, and links whose ends are shown", async () => {
    const { app, link, manual, headers } = await setup();
    const band = await manual("Kessoku Band");
    const director = await manual("Hidden Work Director");
    const loner = await manual("No Works");
    await link({
      from: { type: "person", id: band.id },
      toId: ids.song,
      type: "credit",
      role: "singer"
    });
    await link({
      from: { type: "person", id: director.id },
      toId: ids.hidden,
      type: "credit",
      role: "director"
    });
    await link({
      from: { type: "media", id: ids.song },
      toId: ids.anime,
      type: "soundtrack",
      role: "ending"
    });
    await link({ from: { type: "media", id: ids.hidden }, toId: ids.anime, type: "related" });

    const collection = (await app.inject("/api/collection")).json();
    expect(collection.people.map((p: { id: string }) => p.id)).toEqual([band.id]);
    expect(collection.people[0]).toMatchObject({ roles: ["singer"], works: 1 });

    const anime = (await app.inject(`/api/collection/${ids.anime}`)).json();
    expect(anime.links).toMatchObject([
      {
        type: "soundtrack",
        role: "ending",
        direction: "to",
        other: { type: "media", item: { id: ids.song } }
      }
    ]);
    const song = (await app.inject(`/api/collection/${ids.song}`)).json();
    expect(song.links.map((l: { other: { type: string } }) => l.other.type)).toEqual([
      "person",
      "media"
    ]);

    const person = await app.inject(`/api/people/${band.id}`);
    expect(person.statusCode).toBe(200);
    expect(person.json()).toMatchObject({
      name: { en: "Kessoku Band" },
      credits: [{ role: "singer", item: { id: ids.song } }]
    });
    expect((await app.inject(`/api/people/${director.id}`)).statusCode).toBe(404);
    expect((await app.inject(`/api/people/${loner.id}`)).statusCode).toBe(404);

    // The people switch hides people everywhere.
    await app.inject({
      method: "PUT",
      url: "/api/admin/collection/settings",
      headers,
      payload: {
        show: { movie: true, tv: true, anime: true, music: true, people: false },
        showWant: true
      }
    });
    expect((await app.inject("/api/collection")).json().people).toEqual([]);
    expect(
      (await app.inject(`/api/collection/${ids.song}`))
        .json()
        .links.map((l: { other: { type: string } }) => l.other.type)
    ).toEqual(["media"]);
    expect((await app.inject(`/api/people/${band.id}`)).statusCode).toBe(404);
  });

  it("serves a person's photo only while they are public and people are shown", async () => {
    const { app, headers, cookie, manual } = await setup();
    const person = await manual("Someone");
    const body = multipartFile("p.png", png, "image/png");
    const { person: withPhoto } = (
      await app.inject({
        method: "POST",
        url: `/api/admin/people/${person.id}/photo`,
        headers: { ...headers, ...body.headers },
        payload: body.payload
      })
    ).json();
    const url = withPhoto.photo.variants[0].url;
    expect((await app.inject(url)).statusCode).toBe(200);
    await app.inject({
      method: "PATCH",
      url: `/api/admin/people/${person.id}`,
      headers,
      payload: { visibility: "private" }
    });
    expect((await app.inject(url)).statusCode).toBe(404);
    expect((await app.inject({ url, headers: { cookie } })).statusCode).toBe(200);
  });
});

describe("bulk actions on people", () => {
  it("hides and deletes many people with their links", async () => {
    const { app, headers, link, manual } = await setup();
    const a = await manual("A");
    const b = await manual("B");
    await link({
      from: { type: "person", id: a.id },
      toId: ids.film,
      type: "credit",
      role: "director"
    });
    const batch = (payload: object) =>
      app.inject({ method: "POST", url: "/api/admin/people/batch", headers, payload });

    expect(
      (
        await batch({ action: "update", ids: [a.id, b.id], patch: { visibility: "private" } })
      ).json()
    ).toEqual({ done: [a.id, b.id], failed: [] });
    expect(
      (await app.inject({ url: "/api/admin/people", headers }))
        .json()
        .people.every((p: { visibility: string }) => p.visibility === "private")
    ).toBe(true);
    expect(
      (await batch({ action: "update", ids: [a.id], patch: { name: { en: "x" } } })).statusCode
    ).toBe(400);

    expect((await batch({ action: "delete", ids: [a.id, b.id] })).json()).toEqual({
      done: [a.id, b.id],
      failed: []
    });
    expect(
      (await app.inject({ url: `/api/admin/media/${ids.film}/relations`, headers })).json()
        .relations
    ).toEqual([]);
    expect((await batch({ action: "delete", ids: [a.id] })).json().failed).toEqual([
      { id: a.id, message: "Person not found" }
    ]);
  });
});
