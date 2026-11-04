import { describe, expect, it } from "vitest";
import { compareCompleted } from "../../web/src/lib/completed-order";

describe("home recently completed", () => {
  it("puts undated newly imported works behind older dated completions", () => {
    const items = [
      { id: "star-wars", watchedOn: null, updatedAt: "2026-11-04T12:00:00Z" },
      { id: "older", watchedOn: "2020-01-01", updatedAt: "2020-01-01T12:00:00Z" },
      { id: "recent", watchedOn: "2026-10-20", updatedAt: "2026-10-21T12:00:00Z" },
      { id: "empty-legacy-date", watchedOn: "", updatedAt: "2026-11-05T12:00:00Z" }
    ];
    expect(items.sort(compareCompleted).map((x) => x.id)).toEqual([
      "recent",
      "older",
      "empty-legacy-date",
      "star-wars"
    ]);
  });

  it("uses stable tie breakers for the same completion date", () => {
    const a = { id: "a", watchedOn: "2026-10-01", updatedAt: "2026-11-01" };
    const b = { ...a, id: "b" };
    expect([b, a].sort(compareCompleted).map((x) => x.id)).toEqual(["a", "b"]);
  });
});
