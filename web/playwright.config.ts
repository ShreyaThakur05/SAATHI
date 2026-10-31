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
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // software WebGL so the 3D connection view renders in headless runs
        launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
      },
    },
  ],
  webServer: [
    {
      command: "uv run uvicorn app.main:app --port 8000",
      cwd: "../api",
      url: "http://localhost:8000/healthz",
      reuseExistingServer: true,
      env: { SAATHI_SIM_LATENCY_MS: "120", SAATHI_DEMO_TOOLS_ENABLED: "true", SAATHI_SARVAM_API_KEY: "", SAATHI_ANTHROPIC_API_KEY: "", // e2e must be deterministic and never use a live model key
         PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` },
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
