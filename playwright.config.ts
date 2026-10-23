import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    extraHTTPHeaders: { "x-request-id": "e2e-acceptance" },
  },
  webServer: {
    command: "E2E=true npm run build && E2E=true npm run start -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, userAgent: "AgentRaven-E2E/1.0 desktop" } },
    { name: "mobile", use: { ...devices["Pixel 7"], userAgent: "AgentRaven-E2E/1.0 mobile" } },
  ],
});
