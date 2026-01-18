import React, { createContext, useEffect, useMemo, useState } from "react";

import { qualityManager, type QualityConfig, type QualityMetrics, type QualityTier } from "./qualityManager";
import QualityDebugPanel from "./QualityDebugPanel";
import { setMaxConcurrentImagePrefetch } from "../images/prefetch";

export type QualityContextValue = {
  tier: QualityTier;
  config: QualityConfig;
  reducedMotion: boolean;
  metrics: QualityMetrics;
  setManualOverride: (tier: QualityTier | null) => void;
};

export const QualityContext = createContext<QualityContextValue | null>(null);

type Props = {
  children: React.ReactNode;
};

export default function QualityProvider({ children }: Props) {
  const initialMetrics = qualityManager.getMetrics();

  const [tier, setTier] = useState<QualityTier>(initialMetrics.effectiveTier);
  const [config, setConfig] = useState<QualityConfig>(() => qualityManager.getConfig());
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => qualityManager.getReducedMotion());
  const [metrics, setMetrics] = useState<QualityMetrics>(initialMetrics);

  useEffect(() => {
    return qualityManager.subscribe((snapshot) => {
      setTier(snapshot.tier);
      setConfig(snapshot.config);
      setReducedMotion(snapshot.reducedMotion);
      setMetrics(snapshot.metrics);
    });
  }, []);

  // Apply global DOM toggles (for CSS degrade ladder).
  useEffect(() => {
    const root = document.documentElement;

    root.dataset.perfTier = String(tier);
    root.dataset.perfFilters = config.enableFilters ? "on" : "off";

    // Helpful for future canvas/WebGL usage.
    root.style.setProperty("--perf-dpr-cap", String(config.dprCap));

    // Keep image prefetch concurrency in sync.
    setMaxConcurrentImagePrefetch(config.images.maxConcurrentImagePrefetch);
  }, [tier, config.enableFilters, config.dprCap, config.images.maxConcurrentImagePrefetch]);

  // rAF sampling loop + visibility handling.
  useEffect(() => {
    let raf = 0;
    let running = false;
    let last = 0;

    const tick = (now: number) => {
      if (!running) return;

      const dt = last > 0 ? now - last : 0;
      last = now;

      if (dt > 0) qualityManager.reportFrame(dt);

      raf = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      raf = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };

    const onVisibilityChange = () => {
      qualityManager.onVisibilityChange();
      if (document.hidden) stop();
      else start();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    // Initial run (useEffect runs post-paint).
    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const value = useMemo<QualityContextValue>(
    () => ({
      tier,
      config,
      reducedMotion,
      metrics,
      setManualOverride: (t) => qualityManager.setManualOverride(t)
    }),
    [tier, config, reducedMotion, metrics]
  );

  return (
    <QualityContext.Provider value={value}>
      {children}
      <QualityDebugPanel />
    </QualityContext.Provider>
  );
}
