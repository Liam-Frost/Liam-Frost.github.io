import { describe, expect, it } from "vitest";

import { AnalyticsService } from "../src/analytics/service";
import { RequestRecorder, SystemLog } from "../src/analytics/system";
import { loadConfig } from "../src/config/env";
import { MemoryAnalyticsStore } from "./memory-analytics-store";

describe("analytics collection switch", () => {
  it("stops system events and discards buffered request metrics while disabled", async () => {
    const store = new MemoryAnalyticsStore();
    const service = new AnalyticsService(store, loadConfig({}).analytics, {
      source: "none",
      country: async () => null
    });
    const enabled = () => service.isEnabled();
    const log = new SystemLog(store, undefined, undefined, enabled);
    const requests = new RequestRecorder(store, service.clock, undefined, enabled);
    await service.setEnabled(false);
    log.record("job", "disabled-import", true);
    requests.record("/api/photos", 200, 12);
    await requests.flush();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(store.system).toHaveLength(0);
    expect(store.requests.size).toBe(0);

    await service.setEnabled(true);
    log.record("job", "enabled-import", true);
    requests.record("/api/photos", 200, 14);
    await requests.flush();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(store.system.map((event) => event.name)).toEqual(["enabled-import"]);
    expect([...store.requests.values()][0]?.requests).toBe(1);

    requests.record("/api/photos", 200, 15);
    await service.setEnabled(false);
    await requests.flush();
    expect([...store.requests.values()][0]?.requests).toBe(1);
  });
});
