import { describe, expect, it } from "vitest";
import { createMediaSources } from "../src/media/sources";

describe("TMDB automatic credit identities", () => {
  it("normalizes filmography with movie/TV identities, multiple roles and duplicate jobs", async () => {
    const sources = createMediaSources({
      tmdbKey: "test",
      fetchImpl: (async (url) => {
        expect(new URL(String(url)).pathname).toBe("/3/person/42/combined_credits");
        return Response.json({
          cast: [
            { id: 11, media_type: "movie", character: "Hero (voice)" },
            { id: 11, media_type: "tv", character: "Guest" },
            { id: 5, media_type: "person", character: "Wrong type" },
            { id: -1, media_type: "movie" }
          ],
          crew: [
            { id: 11, media_type: "movie", job: "Director" },
            { id: 11, media_type: "movie", job: "Writer" },
            { id: 11, media_type: "movie", job: "Screenplay" },
            { id: 11, media_type: "movie", job: "Original Music Composer" },
            { id: 11, media_type: "movie", job: "Unknown unrelated job" }
          ]
        });
      }) as typeof fetch
    });
    expect(await sources.personCredits("42")).toEqual([
      { sourceId: "movie:11", role: "voice", character: "Hero" },
      { sourceId: "tv:11", role: "actor", character: "Guest" },
      { sourceId: "movie:11", role: "director", character: null },
      { sourceId: "movie:11", role: "screenwriter", character: null },
      { sourceId: "movie:11", role: "composer", character: null }
    ]);
  });

  it("keeps suggestions short but uses full cast for automatic matching", async () => {
    const sources = createMediaSources({
      tmdbKey: "test",
      fetchImpl: (async () =>
        Response.json({
          credits: {
            cast: Array.from({ length: 20 }, (_, i) => ({
              id: i + 1,
              name: `Actor ${i + 1}`,
              order: i
            }))
          }
        })) as typeof fetch
    });
    expect(await sources.credits("movie:11", "movie")).toHaveLength(8);
    expect(await sources.credits("movie:11", "movie", { all: true })).toHaveLength(20);
  });

  it("uses aggregate TV credits for guest actors and crew across episodes", async () => {
    const sources = createMediaSources({
      tmdbKey: "test",
      fetchImpl: (async (url) => {
        expect(new URL(String(url)).searchParams.get("append_to_response")).toBe(
          "credits,aggregate_credits"
        );
        return Response.json({
          aggregate_credits: {
            cast: [
              { id: 42, name: "Guest", roles: [{ character: "First" }, { character: "Second" }] }
            ],
            crew: [{ id: 43, name: "Director", jobs: [{ job: "Director" }, { job: "Writer" }] }]
          }
        });
      }) as typeof fetch
    });
    expect(await sources.credits("tv:11", "tv", { all: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: "42", role: "actor", character: "First / Second" }),
        expect.objectContaining({ sourceId: "43", role: "director" }),
        expect.objectContaining({ sourceId: "43", role: "screenwriter" })
      ])
    );
  });
});
