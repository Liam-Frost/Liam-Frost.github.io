export type QualityTier = 0 | 1 | 2 | 3;

export type PlaceholderStrategy = "none" | "solid";

// Flickr thumb tiers only need the common small→medium sizes.
// Full-res selection is handled separately in the lightbox logic.
export type FlickrThumbSuffix = "n" | "z" | "c" | "b";

export type ImageQualityConfig = {
  maxThumbSuffix: FlickrThumbSuffix;
  prefetchNeighborCount: number;
  maxConcurrentImagePrefetch: number;
  placeholderStrategy: PlaceholderStrategy;
};

export type QualityConfig = {
  // Decorative / continuous animation toggles.
  enableDecorativeAnimations: boolean;

  // Expensive CSS effects (filter/backdrop-filter/blur).
  enableFilters: boolean;

  // Generic multiplier for decorative intensity / counts.
  // (Particles/instances/etc can scale with this.)
  decorativeMultiplier: number;

  // Only run heavy animation updates every N frames.
  // (Sampling can still happen every rAF.)
  updateEveryNFrames: number;

  // Max *work* update rate for decorative animations.
  // IMPORTANT: This is NOT implemented by skipping rAF.
  // fpsCap = 0 means "do not run heavy decorative updates".
  fpsCap: number;

  // Optional cap for canvas/WebGL DPR; not used by DOM-only effects.
  dprCap: number;

  images: ImageQualityConfig;
};

export type QualityThresholds = {
  warmupBudgetMs: number;
  frameWindowSize: number;
  evalIntervalMs: number;

  // bad frame definition: dt > targetMs * badFrameMultiplier
  badFrameMultiplier: number;

  // Degrade when avgFrameMs > targetMs * degradeAvgMultiplier for >= degradeHoldMs
  degradeAvgMultiplier: number;
  degradeHoldMs: number;

  // Or degrade immediately if badFrameRatio > degradeBadRatio
  degradeBadRatio: number;

  // Upgrade when avgFrameMs < nextTargetMs * upgradeAvgMultiplier for >= upgradeHoldMs
  // and other gates pass.
  upgradeAvgMultiplier: number;
  upgradeHoldMs: number;
  upgradeBadRatio: number;

  // Minimum time since the last tier change before allowing an upgrade.
  // (Degrades still happen quickly.)
  minTimeBetweenUpgradesMs: number;

  // Long-task gating for upgrades (rolling window).
  longTaskWindowMs: number;
  maxLongTaskRateForUpgrade: number; // per second

  targetFpsByTier: Record<QualityTier, number>;
};

export type QualityMetrics = {
  avgFrameMs: number;
  p95FrameMs: number;
  badFrameRatio: number;
  sampleCount: number;

  longTaskCount10s: number;
  longTaskRate: number; // events / second

  isWarmingUp: boolean;
  isHidden: boolean;

  autoTier: QualityTier;
  effectiveTier: QualityTier;
  manualOverride: QualityTier | null;
};

export type QualitySnapshot = {
  tier: QualityTier;
  reducedMotion: boolean;
  config: QualityConfig;
  metrics: QualityMetrics;
};

type Listener = (snapshot: QualitySnapshot) => void;

export type QualityParamOverrides = Partial<Omit<QualityConfig, "images">> & {
  images?: Partial<ImageQualityConfig>;
};

const DEFAULT_THRESHOLDS: QualityThresholds = {
  warmupBudgetMs: 420,
  frameWindowSize: 120,
  evalIntervalMs: 250,

  badFrameMultiplier: 1.25,

  degradeAvgMultiplier: 1.15,
  degradeHoldMs: 1500,
  degradeBadRatio: 0.25,

  upgradeAvgMultiplier: 0.85,
  upgradeHoldMs: 12_000,
  upgradeBadRatio: 0.1,

  minTimeBetweenUpgradesMs: 12_000,

  longTaskWindowMs: 10_000,
  maxLongTaskRateForUpgrade: 0.1,

  targetFpsByTier: {
    0: 30,
    1: 30,
    2: 45,
    3: 60
  }
};

const DEFAULT_CONFIG_BY_TIER: Record<QualityTier, QualityConfig> = {
  3: {
    enableDecorativeAnimations: true,
    enableFilters: true,
    decorativeMultiplier: 1,
    updateEveryNFrames: 1,
    fpsCap: 60,
    dprCap: 2,
    images: {
      maxThumbSuffix: "b",
      prefetchNeighborCount: 1,
      maxConcurrentImagePrefetch: 2,
      placeholderStrategy: "none"
    }
  },
  2: {
    enableDecorativeAnimations: true,
    enableFilters: true,
    decorativeMultiplier: 0.8,
    updateEveryNFrames: 1,
    fpsCap: 45,
    dprCap: 1.5,
    images: {
      maxThumbSuffix: "c",
      prefetchNeighborCount: 1,
      maxConcurrentImagePrefetch: 1,
      placeholderStrategy: "none"
    }
  },
  1: {
    enableDecorativeAnimations: false,
    enableFilters: false,
    decorativeMultiplier: 0.5,
    updateEveryNFrames: 2,
    fpsCap: 30,
    dprCap: 1,
    images: {
      maxThumbSuffix: "z",
      prefetchNeighborCount: 0,
      maxConcurrentImagePrefetch: 1,
      placeholderStrategy: "solid"
    }
  },
  0: {
    enableDecorativeAnimations: false,
    enableFilters: false,
    decorativeMultiplier: 0,
    updateEveryNFrames: 4,
    fpsCap: 0,
    dprCap: 1,
    images: {
      maxThumbSuffix: "n",
      prefetchNeighborCount: 0,
      maxConcurrentImagePrefetch: 0,
      placeholderStrategy: "solid"
    }
  }
};

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function targetMsForTier(thresholds: QualityThresholds, tier: QualityTier) {
  const fps = thresholds.targetFpsByTier[tier];
  // Defensive: never divide by 0.
  return fps > 0 ? 1000 / fps : 1000 / 30;
}

function pickInitialTier(metrics: Pick<QualityMetrics, "avgFrameMs" | "badFrameRatio" | "longTaskRate">, thresholds: QualityThresholds): QualityTier {
  const { avgFrameMs, badFrameRatio, longTaskRate } = metrics;

  // Conservatively pick the highest tier that looks stable in the first ~0.4s.
  const okLongTasks = longTaskRate <= thresholds.maxLongTaskRateForUpgrade;

  const tier3Ms = targetMsForTier(thresholds, 3);
  if (avgFrameMs <= tier3Ms * 1.05 && badFrameRatio < 0.2 && okLongTasks) return 3;

  const tier2Ms = targetMsForTier(thresholds, 2);
  if (avgFrameMs <= tier2Ms * 1.1 && badFrameRatio < 0.25) return 2;

  const tier1Ms = targetMsForTier(thresholds, 1);
  if (avgFrameMs <= tier1Ms * 1.1) return 1;

  return 0;
}

function clampTier(value: number): QualityTier {
  if (value <= 0) return 0;
  if (value >= 3) return 3;
  return value as QualityTier;
}

function mergeConfig(base: QualityConfig, overrides: QualityParamOverrides | null): QualityConfig {
  const merged: QualityConfig = {
    ...base,
    images: { ...base.images }
  };

  if (overrides) {
    const { images, ...rest } = overrides;
    Object.assign(merged, rest);
    if (images) Object.assign(merged.images, images);
  }

  // Sanitize.
  merged.decorativeMultiplier = clampNumber(merged.decorativeMultiplier, 0, 2);
  merged.updateEveryNFrames = clampInt(merged.updateEveryNFrames, 1, 12);
  merged.fpsCap = clampInt(merged.fpsCap, 0, 120);
  merged.dprCap = clampNumber(merged.dprCap, 1, 3);

  merged.images.prefetchNeighborCount = clampInt(merged.images.prefetchNeighborCount, 0, 4);
  merged.images.maxConcurrentImagePrefetch = clampInt(merged.images.maxConcurrentImagePrefetch, 0, 6);

  return merged;
}

class QualityManager {
  private thresholds: QualityThresholds = { ...DEFAULT_THRESHOLDS };

  private listeners = new Set<Listener>();

  private reducedMotion = false;
  private isHidden = false;

  private autoTier: QualityTier = 2;
  private manualOverride: QualityTier | null = null;
  private paramOverrides: QualityParamOverrides | null = null;

  private frameDeltas: Float64Array;
  private frameIndex = 0;
  private frameCount = 0;

  private nextEvalAt = 0;

  private degradeStartAt: number | null = null;
  private upgradeStartAt: number | null = null;
  private lastTierChangeAt = 0;

  private warmupStartAt: number | null = null;
  private warmupEndAt: number | null = null;

  private longTaskObserver: PerformanceObserver | null = null;
  private longTaskTimestamps: number[] = [];

  private metrics: QualityMetrics;

  constructor() {
    this.frameDeltas = new Float64Array(this.thresholds.frameWindowSize);

    this.isHidden = typeof document !== "undefined" ? document.hidden : false;

    this.reducedMotion = this.readReducedMotion();
    this.attachReducedMotionListener();

    this.attachLongTaskObserver();

    this.metrics = {
      avgFrameMs: 0,
      p95FrameMs: 0,
      badFrameRatio: 0,
      sampleCount: 0,

      longTaskCount10s: 0,
      longTaskRate: 0,

      isWarmingUp: false,
      isHidden: this.isHidden,

      autoTier: this.autoTier,
      effectiveTier: this.getEffectiveTier(),
      manualOverride: this.manualOverride
    };
  }

  getConfig(): QualityConfig {
    return this.getSnapshot().config;
  }

  getMetrics(): QualityMetrics {
    // Return a stable copy.
    return { ...this.metrics };
  }

  getReducedMotion(): boolean {
    return this.reducedMotion;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Immediate sync.
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  setManualOverride(tier: QualityTier | null) {
    const next = tier;
    if (this.manualOverride === next) return;

    this.manualOverride = next;

    // When releasing override, re-warm-up so auto tier is immediately sensible.
    if (next === null && !this.isHidden && !this.reducedMotion) {
      this.startWarmup();
    }

    this.publish();
  }

  setParamOverrides(overrides: QualityParamOverrides | null) {
    this.paramOverrides = overrides;
    this.publish();
  }

  reportFrame(dtMs: number) {
    if (this.isHidden) return;
    if (!Number.isFinite(dtMs) || dtMs <= 0) return;

    this.pushFrameDelta(dtMs);

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();

    // Lazy-init eval timer.
    if (this.nextEvalAt === 0) this.nextEvalAt = now + this.thresholds.evalIntervalMs;

    if (now < this.nextEvalAt) return;
    this.nextEvalAt = now + this.thresholds.evalIntervalMs;

    this.recomputeMetrics(now);

    // During reduced-motion, keep effective tier at 0 and avoid auto tier churn.
    if (this.reducedMotion) {
      this.publishIfEffectiveTierChanged();
      return;
    }

    // During manual override, do not auto-adjust.
    if (this.manualOverride !== null) {
      this.publishIfEffectiveTierChanged();
      return;
    }

    // Warm-up ends: assign an initial tier quickly.
    if (this.metrics.isWarmingUp && this.warmupEndAt !== null && now >= this.warmupEndAt) {
      this.metrics.isWarmingUp = false;
      this.warmupStartAt = null;
      this.warmupEndAt = null;

      const nextTier = pickInitialTier(this.metrics, this.thresholds);
      this.setAutoTier(nextTier);

      // Reset hysteresis timers after warm-up assignment.
      this.degradeStartAt = null;
      this.upgradeStartAt = null;

      this.publish();
      return;
    }

    if (this.metrics.isWarmingUp) {
      // Avoid tier changes during warm-up.
      this.publishIfEffectiveTierChanged();
      return;
    }

    this.applyHysteresis(now);
  }

  onVisibilityChange() {
    const hidden = typeof document !== "undefined" ? document.hidden : false;
    if (hidden === this.isHidden) return;

    this.isHidden = hidden;
    this.metrics.isHidden = hidden;

    if (hidden) {
      // Never interpret background throttling as low performance.
      // Stop sampling and clamp effective tier to 0 (without mutating auto tier).
      this.resetSamplingState();
      this.publish();
      return;
    }

    // Coming back to foreground: re-warm-up.
    if (!this.reducedMotion && this.manualOverride === null) {
      this.startWarmup();
    } else {
      // Even if reduced motion is enabled, clear any stale deltas.
      this.resetSamplingState();
    }

    this.publish();
  }

  // --- internals ---

  private publish() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private lastPublishedEffectiveTier: QualityTier | null = null;
  private publishIfEffectiveTierChanged() {
    const effective = this.getEffectiveTier();
    if (this.lastPublishedEffectiveTier === effective) return;
    this.lastPublishedEffectiveTier = effective;
    this.publish();
  }

  private getSnapshot(): QualitySnapshot {
    const tier = this.getEffectiveTier();
    const base = DEFAULT_CONFIG_BY_TIER[tier];
    const config = mergeConfig(base, this.paramOverrides);

    this.metrics.autoTier = this.autoTier;
    this.metrics.manualOverride = this.manualOverride;
    this.metrics.effectiveTier = tier;

    return {
      tier,
      reducedMotion: this.reducedMotion,
      config,
      metrics: { ...this.metrics }
    };
  }

  private getEffectiveTier(): QualityTier {
    if (this.reducedMotion) return 0;
    if (this.isHidden) return 0;
    if (this.manualOverride !== null) return this.manualOverride;
    return this.autoTier;
  }

  private setAutoTier(next: QualityTier) {
    if (next === this.autoTier) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.lastTierChangeAt = now;
    this.autoTier = next;
  }

  private readReducedMotion() {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  private attachReducedMotionListener() {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onChange = () => {
      const next = mql.matches;
      if (next === this.reducedMotion) return;
      this.reducedMotion = next;

      // If reduced motion was turned off while visible, re-warm-up for a quick initial tier.
      if (!next && !this.isHidden && this.manualOverride === null) {
        this.startWarmup();
      }

      this.publish();
    };

    // Safari compatibility: addListener/removeListener.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
    } else if (typeof (mql as unknown as { addListener?: (fn: () => void) => void }).addListener === "function") {
      (mql as unknown as { addListener: (fn: () => void) => void }).addListener(onChange);
    }
  }

  private attachLongTaskObserver() {
    if (typeof window === "undefined") return;
    if (typeof PerformanceObserver === "undefined") return;

    // Guard: some browsers expose PerformanceObserver but not longtask.
    const supported = (PerformanceObserver as typeof PerformanceObserver & { supportedEntryTypes?: string[] }).supportedEntryTypes;
    if (Array.isArray(supported) && !supported.includes("longtask")) return;

    try {
      this.longTaskObserver = new PerformanceObserver((list) => {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        for (const entry of list.getEntries()) {
          // entry.startTime is in the same time origin as performance.now().
          const ts = typeof entry.startTime === "number" ? entry.startTime : now;
          this.longTaskTimestamps.push(ts);
        }

        this.trimLongTasks(now);
      });

      // Type is a string in lib.dom; "longtask" is supported in Chromium.
      this.longTaskObserver.observe({ type: "longtask", buffered: true } as PerformanceObserverInit);
    } catch {
      this.longTaskObserver = null;
    }
  }

  private startWarmup() {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();

    this.resetSamplingState();

    this.metrics.isWarmingUp = true;
    this.warmupStartAt = now;
    this.warmupEndAt = now + clampInt(this.thresholds.warmupBudgetMs, 300, 500);

    // Use a neutral starting point during warm-up.
    this.autoTier = 2;
  }

  private resetSamplingState() {
    this.frameIndex = 0;
    this.frameCount = 0;
    this.nextEvalAt = 0;

    this.degradeStartAt = null;
    this.upgradeStartAt = null;

    this.metrics.avgFrameMs = 0;
    this.metrics.p95FrameMs = 0;
    this.metrics.badFrameRatio = 0;
    this.metrics.sampleCount = 0;

    // Keep long-task history (it reflects real workload), but trim to window.
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.trimLongTasks(now);
  }

  private pushFrameDelta(dtMs: number) {
    this.frameDeltas[this.frameIndex] = dtMs;
    this.frameIndex = (this.frameIndex + 1) % this.frameDeltas.length;
    this.frameCount = Math.min(this.frameCount + 1, this.frameDeltas.length);
  }

  private recomputeMetrics(now: number) {
    const count = this.frameCount;
    this.metrics.sampleCount = count;
    if (count === 0) return;

    const targetMs = targetMsForTier(this.thresholds, this.autoTier);
    const badThreshold = targetMs * this.thresholds.badFrameMultiplier;

    let sum = 0;
    let bad = 0;
    const deltas: number[] = new Array(count);

    // Read in chronological order.
    const start = (this.frameIndex - count + this.frameDeltas.length) % this.frameDeltas.length;
    for (let i = 0; i < count; i++) {
      const v = this.frameDeltas[(start + i) % this.frameDeltas.length];
      deltas[i] = v;
      sum += v;
      if (v > badThreshold) bad++;
    }

    const avg = sum / count;
    deltas.sort((a, b) => a - b);
    const p95Index = Math.min(count - 1, Math.floor((count - 1) * 0.95));
    const p95 = deltas[p95Index];

    this.metrics.avgFrameMs = avg;
    this.metrics.p95FrameMs = p95;
    this.metrics.badFrameRatio = count > 0 ? bad / count : 0;

    this.trimLongTasks(now);
    this.metrics.longTaskCount10s = this.longTaskTimestamps.length;
    this.metrics.longTaskRate = this.longTaskTimestamps.length / (this.thresholds.longTaskWindowMs / 1000);
  }

  private trimLongTasks(now: number) {
    const cutoff = now - this.thresholds.longTaskWindowMs;
    let keepFrom = 0;
    while (keepFrom < this.longTaskTimestamps.length && this.longTaskTimestamps[keepFrom] < cutoff) {
      keepFrom++;
    }
    if (keepFrom > 0) this.longTaskTimestamps.splice(0, keepFrom);
  }

  private applyHysteresis(now: number) {
    const currentTier = this.autoTier;
    const targetMs = targetMsForTier(this.thresholds, currentTier);

    const avg = this.metrics.avgFrameMs;
    const badRatio = this.metrics.badFrameRatio;

    const shouldDegradeAvg = avg > targetMs * this.thresholds.degradeAvgMultiplier;
    const shouldDegradeBad = badRatio > this.thresholds.degradeBadRatio;

    if (currentTier > 0 && (shouldDegradeAvg || shouldDegradeBad)) {
      // Bad ratio triggers immediate drop.
      if (shouldDegradeBad) {
        this.setAutoTier(clampTier(currentTier - 1));
        this.degradeStartAt = null;
        this.upgradeStartAt = null;
        this.publish();
        return;
      }

      if (this.degradeStartAt === null) this.degradeStartAt = now;

      if (now - this.degradeStartAt >= this.thresholds.degradeHoldMs) {
        this.setAutoTier(clampTier(currentTier - 1));
        this.degradeStartAt = null;
        this.upgradeStartAt = null;
        this.publish();
        return;
      }
    } else {
      this.degradeStartAt = null;
    }

    // Upgrade path: slow and gated.
    if (currentTier < 3) {
      const sinceChange = this.lastTierChangeAt > 0 ? now - this.lastTierChangeAt : Infinity;
      const upgradeCooldownActive = sinceChange < this.thresholds.minTimeBetweenUpgradesMs;

      if (upgradeCooldownActive) {
        // Enforce minimum dwell time after any tier change before upgrading.
        this.upgradeStartAt = null;
      } else {
        const nextTier = clampTier(currentTier + 1);
        const nextTargetMs = targetMsForTier(this.thresholds, nextTier);

        const longTaskOk = this.metrics.longTaskRate <= this.thresholds.maxLongTaskRateForUpgrade;
        const shouldUpgrade =
          avg < nextTargetMs * this.thresholds.upgradeAvgMultiplier &&
          badRatio < this.thresholds.upgradeBadRatio &&
          longTaskOk;

        if (shouldUpgrade) {
          if (this.upgradeStartAt === null) this.upgradeStartAt = now;

          if (now - this.upgradeStartAt >= this.thresholds.upgradeHoldMs) {
            this.setAutoTier(nextTier);
            this.upgradeStartAt = null;
            this.degradeStartAt = null;
            this.publish();
            return;
          }
        } else {
          this.upgradeStartAt = null;
        }
      }
    }

    // Only publish on effective tier changes (avoid re-render churn).
    this.publishIfEffectiveTierChanged();
  }
}

export const qualityManager = new QualityManager();
