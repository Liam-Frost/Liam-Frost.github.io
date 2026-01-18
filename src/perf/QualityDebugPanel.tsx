import { useEffect, useMemo, useState } from "react";

import { qualityManager, type FlickrThumbSuffix, type PlaceholderStrategy, type QualityParamOverrides, type QualityTier } from "./qualityManager";
import { useQuality } from "./useQuality";

function getQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;

  const search = window.location.search ?? "";
  const hash = window.location.hash ?? "";

  const queryFromHash = (() => {
    const idx = hash.indexOf("?");
    if (idx === -1) return "";
    return hash.slice(idx);
  })();

  const params = new URLSearchParams(search || queryFromHash);
  return params.get(name);
}

function shouldShowDebugPanel() {
  if (import.meta.env.DEV) return true;
  return getQueryParam("debug") === "1";
}

const panelStyle: React.CSSProperties = {
  position: "fixed",
  right: 12,
  bottom: 12,
  width: 360,
  maxWidth: "calc(100vw - 24px)",
  maxHeight: "calc(100vh - 24px)",
  overflow: "auto",
  zIndex: 99999,

  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  fontSize: 12,
  lineHeight: 1.35,

  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(0,0,0,0.72)",
  color: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(10px)",
  padding: 12
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginTop: 8
};

const labelStyle: React.CSSProperties = { opacity: 0.85 };
const valueStyle: React.CSSProperties = { opacity: 0.95 };

function fmtMs(ms: number) {
  if (!Number.isFinite(ms)) return "-";
  return `${ms.toFixed(1)}ms`;
}

function fmtPct(v: number) {
  if (!Number.isFinite(v)) return "-";
  return `${Math.round(v * 100)}%`;
}

function toTierValue(v: string): QualityTier | null {
  if (v === "null") return null;
  const n = Number(v);
  if (n === 0 || n === 1 || n === 2 || n === 3) return n;
  return null;
}

function updateOverrides(prev: QualityParamOverrides | null, patch: QualityParamOverrides): QualityParamOverrides {
  const next: QualityParamOverrides = { ...(prev ?? {}) };

  if ("images" in patch && patch.images) {
    next.images = { ...(next.images ?? {}), ...patch.images };
  }

  const { images, ...rest } = patch;
  Object.assign(next, rest);

  return next;
}

export default function QualityDebugPanel() {
  const show = shouldShowDebugPanel();
  const { tier, config, reducedMotion, metrics, setManualOverride } = useQuality();

  const [collapsed, setCollapsed] = useState(false);
  const [overrides, setOverrides] = useState<QualityParamOverrides | null>(null);

  // Keep manager in sync with local override state.
  useEffect(() => {
    qualityManager.setParamOverrides(overrides);
  }, [overrides]);

  const title = useMemo(() => {
    const rm = reducedMotion ? "RM" : "";
    return `Perf ${tier}${rm ? ` (${rm})` : ""}`;
  }, [tier, reducedMotion]);

  if (!show) return null;

  return (
    <div style={panelStyle} role="dialog" aria-label="Performance debug panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong>{title}</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            style={{
              font: "inherit",
              padding: "4px 8px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.08)",
              color: "inherit",
              cursor: "pointer"
            }}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>

      {collapsed ? null : (
        <>
          <div style={{ ...rowStyle, marginTop: 10 }}>
            <span style={labelStyle}>effectiveTier</span>
            <span style={valueStyle}>{metrics.effectiveTier}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>autoTier</span>
            <span style={valueStyle}>{metrics.autoTier}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>manualOverride</span>
            <span style={valueStyle}>{metrics.manualOverride ?? "null"}</span>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.12)", margin: "10px 0" }} />

          <div style={rowStyle}>
            <span style={labelStyle}>avgFrame</span>
            <span style={valueStyle}>{fmtMs(metrics.avgFrameMs)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>p95Frame</span>
            <span style={valueStyle}>{fmtMs(metrics.p95FrameMs)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>badRatio</span>
            <span style={valueStyle}>{fmtPct(metrics.badFrameRatio)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>longTasks(10s)</span>
            <span style={valueStyle}>
              {metrics.longTaskCount10s} ({metrics.longTaskRate.toFixed(2)}/s)
            </span>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.12)", margin: "10px 0" }} />

          <div style={rowStyle}>
            <label style={labelStyle}>
              override tier
              <select
                value={String(metrics.manualOverride ?? "null")}
                onChange={(e) => setManualOverride(toTierValue(e.target.value))}
                style={{
                  marginLeft: 8,
                  font: "inherit",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.08)",
                  color: "inherit",
                  padding: "4px 8px"
                }}
              >
                <option value="null">auto</option>
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                setManualOverride(null);
                setOverrides(null);
              }}
              style={{
                font: "inherit",
                padding: "4px 8px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.08)",
                color: "inherit",
                cursor: "pointer"
              }}
            >
              Reset
            </button>
          </div>

          <div style={rowStyle}>
            <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={config.enableDecorativeAnimations}
                onChange={(e) => setOverrides((prev) => updateOverrides(prev, { enableDecorativeAnimations: e.target.checked }))}
              />
              decorative
            </label>

            <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={config.enableFilters}
                onChange={(e) => setOverrides((prev) => updateOverrides(prev, { enableFilters: e.target.checked }))}
              />
              filters
            </label>
          </div>

          <div style={rowStyle}>
            <label style={labelStyle}>
              decorativeMultiplier
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={config.decorativeMultiplier}
                onChange={(e) => setOverrides((prev) => updateOverrides(prev, { decorativeMultiplier: Number(e.target.value) }))}
                style={{ width: 150, marginLeft: 8 }}
              />
            </label>
            <span style={valueStyle}>{config.decorativeMultiplier.toFixed(2)}</span>
          </div>

          <div style={rowStyle}>
            <label style={labelStyle}>
              updateEveryNFrames
              <input
                type="number"
                min={1}
                max={12}
                value={config.updateEveryNFrames}
                onChange={(e) => setOverrides((prev) => updateOverrides(prev, { updateEveryNFrames: Number(e.target.value) }))}
                style={{
                  marginLeft: 8,
                  width: 64,
                  font: "inherit",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.08)",
                  color: "inherit",
                  padding: "4px 8px"
                }}
              />
            </label>

            <label style={labelStyle}>
              fpsCap
              <input
                type="number"
                min={0}
                max={120}
                value={config.fpsCap}
                onChange={(e) => setOverrides((prev) => updateOverrides(prev, { fpsCap: Number(e.target.value) }))}
                style={{
                  marginLeft: 8,
                  width: 64,
                  font: "inherit",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.08)",
                  color: "inherit",
                  padding: "4px 8px"
                }}
              />
            </label>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.12)", margin: "10px 0" }} />

          <div style={{ ...rowStyle, alignItems: "flex-start" }}>
            <div style={labelStyle}>images</div>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <label style={labelStyle}>
                maxThumbSuffix
                <select
                  value={config.images.maxThumbSuffix}
                  onChange={(e) => setOverrides((prev) => updateOverrides(prev, { images: { maxThumbSuffix: e.target.value as FlickrThumbSuffix } }))}
                  style={{
                    marginLeft: 8,
                    font: "inherit",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.08)",
                    color: "inherit",
                    padding: "4px 8px"
                  }}
                >
                  <option value="n">n (320)</option>
                  <option value="z">z (640)</option>
                  <option value="c">c (800)</option>
                  <option value="b">b (1024)</option>
                </select>
              </label>

              <label style={labelStyle}>
                prefetchNeighborCount
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={config.images.prefetchNeighborCount}
                  onChange={(e) =>
                    setOverrides((prev) =>
                      updateOverrides(prev, { images: { prefetchNeighborCount: Number(e.target.value) } })
                    )
                  }
                  style={{
                    marginLeft: 8,
                    width: 64,
                    font: "inherit",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.08)",
                    color: "inherit",
                    padding: "4px 8px"
                  }}
                />
              </label>

              <label style={labelStyle}>
                maxConcurrentPrefetch
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={config.images.maxConcurrentImagePrefetch}
                  onChange={(e) =>
                    setOverrides((prev) =>
                      updateOverrides(prev, { images: { maxConcurrentImagePrefetch: Number(e.target.value) } })
                    )
                  }
                  style={{
                    marginLeft: 8,
                    width: 64,
                    font: "inherit",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.08)",
                    color: "inherit",
                    padding: "4px 8px"
                  }}
                />
              </label>

              <label style={labelStyle}>
                placeholder
                <select
                  value={config.images.placeholderStrategy}
                  onChange={(e) =>
                    setOverrides((prev) =>
                      updateOverrides(prev, { images: { placeholderStrategy: e.target.value as PlaceholderStrategy } })
                    )
                  }
                  style={{
                    marginLeft: 8,
                    font: "inherit",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.08)",
                    color: "inherit",
                    padding: "4px 8px"
                  }}
                >
                  <option value="none">none</option>
                  <option value="solid">solid</option>
                </select>
              </label>
            </div>
          </div>

          <div style={{ marginTop: 10, opacity: 0.75 }}>
            reduced motion forces tier 0; overrides ignored.
          </div>
        </>
      )}
    </div>
  );
}
