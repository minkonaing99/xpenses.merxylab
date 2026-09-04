import { defineConfig } from "@playwright/test";

const viewports = [
  ["phone", 390, 844],
  ["ipad-mini-portrait", 744, 1133],
  ["ipad-mini-landscape", 1133, 744],
  ["desktop", 1440, 900],
] as const;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  use: { baseURL: "http://127.0.0.1:4173", screenshot: "only-on-failure", reducedMotion: "reduce" },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 4173", url: "http://127.0.0.1:4173", reuseExistingServer: true },
  projects: ["chromium", "webkit"].flatMap((browserName) => viewports.map(([name, width, height]) => ({
    name: `${browserName}-${name}`,
    use: { browserName, viewport: { width, height } },
  }))),
});
