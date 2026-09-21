import { defineConfig } from "@playwright/test";
export default defineConfig({
  outputDir: "workflow-test-results",
  testDir: "./tests/browser", testMatch: "workflow.spec.ts", timeout: 180000,
  expect: { timeout: 20000 }, workers: 1,
  use: { baseURL: "http://127.0.0.1:3001", channel: "msedge", headless: true, actionTimeout: 20000, trace: "retain-on-failure" },
  webServer: [
    { command: "node --import tsx tests/support/supabase-fixture.mts", url: "http://127.0.0.1:54329/health", timeout: 120000,
      env: { TRUSTLINK_TEST_FIXTURE: "1", NODE_ENV: "test" } },
    { command: "npm run start -- --hostname 127.0.0.1 --port 3001", url: "http://127.0.0.1:3001", timeout: 120000,
      env: { TRUSTLINK_STORAGE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-publishable-nonfunctional", SUPABASE_SERVICE_ROLE_KEY: "test-service-role-nonfunctional" } },
  ],
});
