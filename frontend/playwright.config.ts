import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: "http://localhost:8081",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run web -- --port 8081",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: { EXPO_NO_TELEMETRY: "1" },
  },
});
