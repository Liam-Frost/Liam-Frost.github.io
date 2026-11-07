import { afterEach, describe, expect, it, vi } from "vitest";
import { QualityManager } from "../../web/src/perf/qualityManager";

afterEach(() => {
  vi.unstubAllGlobals();
});

function frames() {
  let now = 1;
  vi.stubGlobal("performance", { now: () => now });
  const manager = new QualityManager();
  return {
    manager,
    run: (dt: number, duration: number) => {
      for (let elapsed = 0; elapsed < duration; elapsed += dt) {
        now += dt;
        manager.reportFrame(dt);
      }
    }
  };
}

describe("adaptive quality recovery", () => {
  it("recovers to the highest tier on a stable 60Hz display", () => {
    const { manager, run } = frames();
    run(1000 / 60, 15000);
    expect(manager.getMetrics().effectiveTier).toBe(3);
  });
  it("does not upgrade a stable 30Hz device to 45 or 60Hz quality", () => {
    const { manager, run } = frames();
    run(1000 / 30, 60000);
    expect(manager.getMetrics().effectiveTier).toBe(1);
  });
  it("drops under sustained load and recovers gradually after it clears", () => {
    const { manager, run } = frames();
    run(1000 / 60, 15000);
    run(70, 3000);
    expect(manager.getMetrics().effectiveTier).toBe(0);
    run(1000 / 60, 5000);
    expect(manager.getMetrics().effectiveTier).toBe(0);
    run(1000 / 60, 90000);
    expect(manager.getMetrics().effectiveTier).toBe(3);
  });
  it("honors reduced motion even with a manual high-tier override", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true, addEventListener: vi.fn() }) });
    const { manager, run } = frames();
    manager.setManualOverride(3);
    run(1000 / 120, 30000);
    expect(manager.getConfig().enableDecorativeAnimations).toBe(false);
    expect(manager.getMetrics().effectiveTier).toBe(0);
    expect(manager.getConfig().images.maxThumbSuffix).toBe("b");
  });
  it("ignores background throttling and remeasures after returning", () => {
    const doc = { hidden: false };
    vi.stubGlobal("document", doc);
    const { manager, run } = frames();
    run(1000 / 60, 15000);
    doc.hidden = true;
    manager.onVisibilityChange();
    run(1000, 10000);
    expect(manager.getMetrics().autoTier).toBe(3);
    doc.hidden = false;
    manager.onVisibilityChange();
    run(1000 / 60, 1000);
    expect(manager.getMetrics().effectiveTier).toBe(3);
  });
});
