import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "crm.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3001",
    viewport: { width: 1440, height: 1000 },
    channel: process.platform === "win32" ? "msedge" : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "uv run --project ../backend --frozen python ../backend/scripts/e2e_server.py",
      url: "http://127.0.0.1:18001/ready",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run dev -- --port 3001",
      url: "http://127.0.0.1:3001/companies",
      reuseExistingServer: false,
      timeout: 90_000,
      env: { API_INTERNAL_URL: "http://127.0.0.1:18001", NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
