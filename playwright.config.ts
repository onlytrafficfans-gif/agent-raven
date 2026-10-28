import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const e2ePort = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    extraHTTPHeaders: { "x-request-id": "e2e-acceptance" },
  },
  webServer: {
    command: `export BETTER_AUTH_URL=${baseURL}; E2E=true npm run build && E2E=true npm run start -- --hostname 127.0.0.1 --port ${e2ePort}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, userAgent: "AgentRaven-E2E/1.0 desktop" } },
    { name: "mobile", use: { ...devices["Pixel 7"], userAgent: "AgentRaven-E2E/1.0 mobile" } },
  ],
});
