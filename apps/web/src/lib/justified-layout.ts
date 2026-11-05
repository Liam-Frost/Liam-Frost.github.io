import { resolveFeaturedWall, type FeaturedWallSettings } from "@liam-frost/shared";

export type JustifiedRow = { start: number; end: number; height: number; ratios: number[] };
export type JustifiedLayout = { width: number; rows: JustifiedRow[]; visibleCount: number };

/** Sane cover range. Invalid dimensions use a neutral shape; never coerce/stretch a real image. */
export function validCoverRatio(width: number, height: number): number | null {
  const ratio = width / height;
  return Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0 &&
    ratio >= 0.2 &&
    ratio <= 5
    ? ratio
    : null;
}

/**
 * Globally partition contiguous, ordered covers with dynamic programming. Every complete row solves
 * H=W/sum(r). Large sets select the best-fitting prefix, without repeating or clipping any entry.
 * Sparse sets shrink the entire canvas instead of inflating a last row or leaving an internal void.
 */
export function justifiedLayout(
  input: readonly number[],
  width: number,
  settings: FeaturedWallSettings
): JustifiedLayout {
  const empty = { width: 0, rows: [], visibleCount: 0 };
  if (!Number.isFinite(width) || width <= 0 || !input.length) return empty;
  const { visibleRows, targetRowHeight } = resolveFeaturedWall(settings);
  const target = Math.min(targetRowHeight, Math.max(100, width * 0.5));
  const minHeight = Math.max(64, target * 0.6),
    maxHeight = target * 1.7;
  const ratios: number[] = [],
    prefix = [0];
  const capacity = (visibleRows * width) / minHeight;
  for (const value of input) {
    ratios.push(Number.isFinite(value) && value >= 0.2 && value <= 5 ? value : 2 / 3);
    prefix.push(prefix[prefix.length - 1]! + ratios[ratios.length - 1]!);
    if (prefix[prefix.length - 1]! > capacity + 5) break;
  }
  const n = ratios.length,
    maxRows = Math.min(visibleRows, n);
  const dp = Array.from({ length: maxRows + 1 }, () => new Float64Array(n + 1).fill(Infinity));
  const back = Array.from({ length: maxRows + 1 }, () => new Int32Array(n + 1).fill(-1));
  dp[0]![0] = 0;
  for (let k = 1; k <= maxRows; k++) {
    for (let end = k; end <= n; end++) {
      for (let start = end - 1; start >= k - 1; start--) {
        const h = width / (prefix[end]! - prefix[start]!);
        if (h < minHeight && start !== end - 1) break;
        if (h > maxHeight || !Number.isFinite(dp[k - 1]![start])) continue;
        const deviation = Math.log(h / target);
        const score = dp[k - 1]![start]! + deviation * deviation;
        if (score < dp[k]![end]!) {
          dp[k]![end] = score;
          back[k]![end] = start;
        }
      }
    }
  }
  const fits = n === input.length && (prefix[n]! * target) / width <= visibleRows * 1.18;
  const partitionScore = (count: number, end: number) => {
    if (!Number.isFinite(dp[count]![end])) return Infinity;
    let sum = 0,
      squares = 0,
      smallest = Infinity,
      largest = 0;
    for (let k = count; k > 0; k--) {
      const start = back[k]![end]!;
      const height = width / (prefix[end]! - prefix[start]!);
      const log = Math.log(height / target);
      sum += log;
      squares += log * log;
      smallest = Math.min(smallest, height);
      largest = Math.max(largest, height);
      end = start;
    }
    // A slightly denser but balanced complete prefix beats a conspicuously enlarged last row.
    const variance = Math.max(0, squares / count - (sum / count) ** 2);
    const spread = Math.max(0, Math.log(largest / smallest) - Math.log(1.45));
    return squares / count + 0.9 * variance + 0.6 * spread * spread;
  };
  let best = Infinity,
    count = 0,
    last = 0;
  // Prefer including every item when the collection fits naturally, globally balancing the last row.
  if (fits)
    for (let k = 1; k <= maxRows; k++) {
      const score = partitionScore(k, n);
      if (score < best) {
        best = score;
        count = k;
        last = n;
      }
    }
  if (!count && fits) {
    const canvas = Math.min(width, prefix[n]! * target);
    return {
      width: canvas,
      rows: [{ start: 0, end: n, height: canvas / prefix[n]!, ratios }],
      visibleCount: n
    };
  }
  if (!count) {
    for (let k = maxRows; k >= 1; k--) {
      for (let end = k; end <= n; end++) {
        const score = partitionScore(k, end) + (maxRows - k) * 0.18;
        if (score < best - 1e-10 || (Math.abs(score - best) < 1e-10 && end > last)) {
          best = score;
          count = k;
          last = end;
        }
      }
    }
  }
  if (!count) {
    // Only pathological input reaches here; keep the first whole cover at a natural size.
    const canvas = Math.min(width, target * ratios[0]!);
    return {
      width: canvas,
      rows: [{ start: 0, end: 1, height: canvas / ratios[0]!, ratios: ratios.slice(0, 1) }],
      visibleCount: 1
    };
  }
  const rows: JustifiedRow[] = [];
  const visibleCount = last;
  for (let k = count; k > 0; k--) {
    const start = back[k]![last]!;
    rows.unshift({
      start,
      end: last,
      height: width / (prefix[last]! - prefix[start]!),
      ratios: ratios.slice(start, last)
    });
    last = start;
  }
  return { width, rows, visibleCount };
}
