import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3000";
// E2E_SERVER_COMMAND lets CI boot the app against the in-process PGlite stack
// (`npx tsx scripts/pglite-dev.ts --seed`) instead of a separately-provisioned
// Postgres. Defaults to the plain dev/prod server for local runs.
const serverCommand =
  process.env.E2E_SERVER_COMMAND ??
  (process.env.E2E_PRODUCTION
    ? `npm run start -- -p ${port}`
    : `npm run dev -- -p ${port}`);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: serverCommand,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
