import { defineConfig, devices } from "@playwright/test";

// The e2e suite drives the real API (Postgres) and the production build of the web app.
// It resets demo data through the API, so run it against a development database.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1, // tests share one database
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "uv run uvicorn app.main:app --port 8000",
      cwd: "../api",
      url: "http://localhost:8000/healthz",
      reuseExistingServer: true,
      env: { SAATHI_SIM_LATENCY_MS: "120", SAATHI_DEMO_TOOLS_ENABLED: "true", PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` },
      timeout: 60_000,
    },
    {
      command: "npm run start -- -p 3000",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
