import { defineConfig, devices } from "@playwright/test";

/**
 * Layout and behaviour checks of the built admin against the real API, with in-memory data (see
 * e2e/server.mts). Run with `npm run test:e2e -w apps/admin`; browsers come from `playwright install`.
 */
const PORT = 4191;
const browsers = [
  { name: "chromium", use: devices["Desktop Chrome"] },
  { name: "firefox", use: devices["Desktop Firefox"] },
  { name: "webkit", use: devices["Desktop Safari"] }
];
// Geometry is the same engine-independent contract everywhere, so it runs once; behaviour runs on all.
const CHROMIUM_ONLY = /layout\.spec|visual\.spec/;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  // One in-memory server with one data set: tests take turns.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  snapshotPathTemplate: "{testDir}/__snapshots__/{arg}{ext}",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    colorScheme: "light",
    locale: "zh-CN",
    trace: "off"
  },
  projects: browsers.flatMap(({ name, use }) => [
    { name: `setup-${name}`, testMatch: /auth\.setup\.ts/, use },
    {
      name,
      use: { ...use, storageState: `e2e/.auth/${name}.json` },
      dependencies: [`setup-${name}`],
      testIgnore: name === "chromium" ? /auth\.setup/ : [/auth\.setup/, CHROMIUM_ONLY]
    }
  ]),
  webServer: {
    command:
      "npx vite build --outDir e2e/dist --emptyOutDir && node ../../node_modules/tsx/dist/cli.mjs e2e/server.mts",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { DATABASE_URL: "" }
  }
});
