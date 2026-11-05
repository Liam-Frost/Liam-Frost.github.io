export type FeaturedWallSettings = { visibleRows: number; targetRowHeight: number };

export const DEFAULT_FEATURED_WALL: Readonly<FeaturedWallSettings> = {
  visibleRows: 3,
  targetRowHeight: 180
};

/** Tolerant reads for old/corrupt settings; writes are validated by the API. */
export function resolveFeaturedWall(value: unknown): FeaturedWallSettings {
  const raw = value && typeof value === "object" ? (value as Partial<FeaturedWallSettings>) : {};
  return {
    visibleRows:
      Number.isInteger(raw.visibleRows) && raw.visibleRows! >= 1 && raw.visibleRows! <= 8
        ? raw.visibleRows!
        : DEFAULT_FEATURED_WALL.visibleRows,
    targetRowHeight:
      Number.isInteger(raw.targetRowHeight) &&
      raw.targetRowHeight! >= 100 &&
      raw.targetRowHeight! <= 360
        ? raw.targetRowHeight!
        : DEFAULT_FEATURED_WALL.targetRowHeight
  };
}
