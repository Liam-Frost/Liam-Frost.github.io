import { describe, expect, it } from "vitest";
import { DEFAULT_FEATURED_WALL, resolveFeaturedWall } from "@liam-frost/shared";
import { justifiedLayout, validCoverRatio } from "../../web/src/lib/justified-layout";

const widths = [280, 335, 350, 390, 728, 984, 1200, 1360]; // viewport widths minus the site's container padding
const mixed = Array.from({ length: 60 }, (_, i) => (i % 2 ? 2 / 3 : 1));
function check(ratios: number[], width: number, rows = 3, height = 180) {
  const layout = justifiedLayout(ratios, width, { visibleRows: rows, targetRowHeight: height });
  expect(layout.rows.length).toBeLessThanOrEqual(rows);
  expect(layout.width).toBeLessThanOrEqual(width);
  expect(layout.rows.flatMap((row) => row.ratios)).toEqual(ratios.slice(0, layout.visibleCount));
  let next = 0;
  for (const row of layout.rows) {
    expect(row.start).toBe(next);
    next = row.end;
    expect(row.height).toBeGreaterThan(0);
    expect(row.ratios.reduce((sum, r) => sum + r * row.height, 0)).toBeCloseTo(layout.width, 8);
    row.ratios.forEach((r) => expect((r * row.height) / row.height).toBeCloseTo(r, 12));
  }
  expect(next).toBe(layout.visibleCount);
  return layout;
}

describe("seamless justified layout", () => {
  it.each(widths)(
    "preserves complete ordered covers without gaps at container width %s",
    (width) => {
      for (const ratios of [
        mixed,
        Array(50).fill(1),
        Array(50).fill(2 / 3),
        [1, 1, 1, 2 / 3, 1, 1, 1],
        [2 / 3, 2 / 3, 2 / 3, 1, 2 / 3]
      ])
        check(ratios, width);
    }
  );
  it("balances three complete rows close to the target without an oversized last row", () => {
    const layout = check(mixed.slice(0, 24), 1200);
    expect(layout.rows).toHaveLength(3);
    expect(layout.visibleCount).toBe(24);
    layout.rows.forEach((row) => expect(row.height).toBeCloseTo(180, 8));
  });
  it("limits a large wall to a unique prefix and makes both admin controls effective", () => {
    const one = check(mixed, 1200, 1);
    const three = check(mixed, 1200, 3);
    expect(three.visibleCount).toBeGreaterThan(one.visibleCount);
    expect(three.visibleCount).toBeLessThan(mixed.length);
    const low = check(mixed, 1200, 3, 100),
      high = check(mixed, 1200, 3, 360);
    expect(low.visibleCount).toBeGreaterThan(high.visibleCount);
    expect(high.rows[0]!.height).toBeGreaterThan(low.rows[0]!.height);
  });
  it("prefers balanced phone rows to an enlarged two-cover last row", () => {
    const layout = check(mixed, 375);
    const heights = layout.rows.map((row) => row.height);
    expect(layout.rows).toHaveLength(3);
    expect(Math.max(...heights) / Math.min(...heights)).toBeLessThan(1.3);
  });
  it("shrinks a sparse canvas, without giant covers, repeated entries or internal blank columns", () => {
    for (const ratios of [[1], [2 / 3], [1, 2 / 3], [1, 2 / 3, 0.55]]) {
      const layout = check(ratios, 1200);
      expect(layout.visibleCount).toBe(ratios.length);
      expect(layout.rows).toHaveLength(1);
      expect(layout.rows[0]!.height).toBeCloseTo(180, 10);
      expect(layout.width).toBeLessThan(1200);
    }
  });
  it("handles no content, hidden containers and malformed dimensions/settings", () => {
    expect(justifiedLayout([], 1200, DEFAULT_FEATURED_WALL).rows).toEqual([]);
    for (const width of [0, -1, Infinity, NaN])
      expect(justifiedLayout(mixed, width, DEFAULT_FEATURED_WALL).rows).toEqual([]);
    const layout = justifiedLayout([0, NaN, Infinity, -1, 1], 900, {
      visibleRows: 100,
      targetRowHeight: -1
    });
    expect(layout.rows.length).toBeLessThanOrEqual(3);
    expect(layout.rows.every((row) => Number.isFinite(row.height))).toBe(true);
    for (const pair of [
      [0, 100],
      [1, 0],
      [Infinity, 100],
      [1, 10000],
      [10000, 1]
    ])
      expect(validCoverRatio(pair[0]!, pair[1]!)).toBeNull();
    expect(validCoverRatio(150, 153)).toBe(150 / 153);
    expect(resolveFeaturedWall({ visibleRows: 2, targetRowHeight: Infinity })).toEqual({
      visibleRows: 2,
      targetRowHeight: 180
    });
  });
  it("finds the global minimum partition for a naturally fitting ordered collection", () => {
    const ratios = [1, 0.6, 1, 1, 0.65, 0.65, 1, 0.5, 1, 1, 0.7, 1, 1, 0.6, 1, 1, 0.65, 0.7];
    const layout = check(ratios, 900);
    const cost = (rows: number[][]) =>
      rows.reduce(
        (sum, row) => sum + Math.log(900 / (row.reduce((a, b) => a + b, 0) * 180)) ** 2,
        0
      );
    const chosen = cost(layout.rows.map((row) => row.ratios));
    const brute = (start: number, left: number): number => {
      if (left === 0) return start === ratios.length ? 0 : Infinity;
      let best = Infinity;
      for (let end = start + 1; end <= ratios.length - left + 1; end++) {
        const row = ratios.slice(start, end),
          height = 900 / row.reduce((a, b) => a + b, 0);
        if (height > 306 || (height < 108 && row.length > 1)) continue;
        best = Math.min(best, cost([row]) + brute(end, left - 1));
      }
      return best;
    };
    expect(layout.visibleCount).toBe(ratios.length);
    expect(chosen).toBeCloseTo(brute(0, layout.rows.length), 10);
  });
});
