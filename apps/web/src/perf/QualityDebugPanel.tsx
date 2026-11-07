import { useEffect, useState } from "react";
import { qualityManager, type DimensionOverrides } from "./qualityManager";
import { useQuality } from "./useQuality";
import "./quality-debug.css";

function enabled() {
  const outer = new URLSearchParams(window.location.search);
  const inner = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  return import.meta.env.DEV || outer.get("debug") === "1" || inner.get("debug") === "1";
}
export default function QualityDebugPanel() {
  const { tier, config, reducedMotion, setManualOverride } = useQuality();
  const [closed, setClosed] = useState(false);
  const [metrics, setMetrics] = useState(() => qualityManager.getMetrics());
  const [overrides, setOverrides] = useState<Partial<DimensionOverrides>>({});
  const show = enabled();
  useEffect(() => {
    if (!show || closed) return;
    const timer = window.setInterval(() => setMetrics(qualityManager.getMetrics()), 1000);
    return () => clearInterval(timer);
  }, [show, closed]);
  if (!show) return null;
  const update = (key: keyof DimensionOverrides, raw: string) => {
    const value = raw === "auto" ? null : key === "images" ? raw : Number(raw);
    const next = { [key]: value } as Partial<DimensionOverrides>;
    setOverrides((old) => ({ ...old, ...next }));
    qualityManager.setDimensionOverrides(next);
  };
  const budgets = [
    {
      key: "motion" as const,
      title: "动画",
      value: `${["静态", "轻量", "平衡", "完整"][tier]} · 更新上限 ${config.fpsCap} fps`,
      hint: "背景、打字与滚动装饰；不影响内容导航",
      choices: ["0", "1", "2", "3"]
    },
    {
      key: "filters" as const,
      title: "滤镜",
      value: ["关闭", "轻量", "完整"][config.filterTier ?? 2],
      hint: "独立降低背景和头部模糊效果",
      choices: ["0", "1", "2"]
    },
    {
      key: "images" as const,
      title: "图片",
      value: `最高 ${{ n: 320, z: 640, c: 800, b: 1024 }[config.images.maxThumbSuffix]}px 长边`,
      hint: "图片尺寸独立于动画性能调整",
      choices: ["n", "z", "c", "b"]
    },
    {
      key: "prefetch" as const,
      title: "预加载",
      value: `并发 ${config.images.maxConcurrentImagePrefetch}`,
      hint: "省流、慢连接或后台状态可能暂停推测请求",
      choices: ["0", "1", "2"]
    }
  ];
  return (
    <aside className={`qualityDebug ${closed ? "isCollapsed" : ""}`} aria-label="性能调试面板">
      <header>
        <div>
          <strong>性能与资源预算</strong>
          <small>四个维度独立调整</small>
        </div>
        <button type="button" aria-expanded={!closed} onClick={() => setClosed(!closed)}>
          {closed ? "展开" : "收起"}
        </button>
      </header>
      {!closed && (
        <>
          {(reducedMotion || metrics.isHidden) && (
            <p role="status" className="qualityNotice">
              {reducedMotion
                ? "已遵循减少动画偏好，手动设置不能强制开启动画。"
                : "页面在后台，动画和预加载已暂停。"}
            </p>
          )}
          <dl className="qualityMetrics">
            <div>
              <dt>平均帧耗时</dt>
              <dd>{metrics.avgFrameMs.toFixed(1)} ms</dd>
            </div>
            <div>
              <dt>P95</dt>
              <dd>{metrics.p95FrameMs.toFixed(1)} ms</dd>
            </div>
            <div>
              <dt>慢帧比例</dt>
              <dd>{Math.round(metrics.badFrameRatio * 100)}%</dd>
            </div>
            <div>
              <dt>长任务 / 10s</dt>
              <dd>{metrics.longTaskCount10s}</dd>
            </div>
          </dl>
          <div className="qualityBudgets">
            {budgets.map((budget) => (
              <section key={budget.key}>
                <div>
                  <h3>{budget.title}</h3>
                  <strong>{budget.value}</strong>
                  <p>{budget.hint}</p>
                </div>
                <label>
                  <span className="srOnly">{budget.title}预算</span>
                  <select
                    aria-label={`${budget.title}预算`}
                    value={String(overrides[budget.key] ?? "auto")}
                    onChange={(e) => update(budget.key, e.target.value)}
                  >
                    <option value="auto">自动</option>
                    {budget.choices.map((value) => (
                      <option key={value} value={value}>
                        {budget.key === "images"
                          ? (
                              { n: "320px", z: "640px", c: "800px", b: "1024px" } as Record<
                                string,
                                string
                              >
                            )[value]
                          : budget.key === "motion"
                            ? ["静态", "轻量", "平衡", "完整"][Number(value)]
                            : budget.key === "filters"
                              ? ["关闭", "轻量", "完整"][Number(value)]
                              : ["暂停", "并发1", "并发2"][Number(value)]}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            ))}
          </div>
          <footer>
            <span>
              自动动画基准：{metrics.autoTier} · 样本 {metrics.sampleCount}
            </span>
            <button
              type="button"
              onClick={() => {
                setOverrides({});
                setManualOverride(null);
                qualityManager.setParamOverrides(null);
                qualityManager.setDimensionOverrides({
                  motion: null,
                  filters: null,
                  images: null,
                  prefetch: null
                });
              }}
            >
              恢复全部自动
            </button>
          </footer>
        </>
      )}
    </aside>
  );
}
