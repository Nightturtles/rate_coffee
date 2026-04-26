import { defineConfig, devices } from "@playwright/test";

const port = 3000;
const base = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: base,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev -w @rate-coffee/web",
        url: base,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        cwd: process.cwd(),
      },
});
