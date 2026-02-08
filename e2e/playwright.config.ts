import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "cd .. && npm run start",
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
