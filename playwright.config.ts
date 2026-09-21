import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000", browserName: "chromium", channel: "msedge", headless: true, trace: "retain-on-failure" },
  reporter: [["list"]],
  testIgnore: "**/workflow.spec.ts",
  webServer: { command: "npm run dev -- --hostname 127.0.0.1", url: "http://127.0.0.1:3000", reuseExistingServer: true, timeout: 120000, env: { TRUSTLINK_STORAGE: "local", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" } },
});
