import { expect, it } from "vitest";
import type { AdminMediaItem } from "@liam-frost/shared";
import { sortCollection } from "../../admin/src/lib/collectionSort";

it("sorts numeric titles, dates and missing scores without mutating curated order", () => {
  const items = [
    {
      id: "b",
      title: { en: "Episode 10" },
      createdAt: "2026-02-01",
      updatedAt: "2026-03-01",
      rating: null,
      year: null
    },
    {
      id: "a",
      title: { en: "Episode 2" },
      createdAt: "2026-01-01",
      updatedAt: "2026-02-01",
      rating: 5,
      year: 2020
    }
  ] as AdminMediaItem[];
  for (const sort of ["title", "oldest", "rating", "year"] as const)
    expect(sortCollection(items, sort).map((i) => i.id)).toEqual(["a", "b"]);
  for (const sort of ["updated", "newest", "title-desc"] as const)
    expect(sortCollection(items, sort).map((i) => i.id)).toEqual(["b", "a"]);
  expect(items[0]!.id).toBe("b");
});
