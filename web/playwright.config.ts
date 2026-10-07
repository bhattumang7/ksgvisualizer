import path from "node:path";
import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    { name: "mobile-360", use: { viewport: { width: 360, height: 740 } } },
    { name: "mobile-414", use: { viewport: { width: 414, height: 896 } } },
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${port}`,
    url: `http://localhost:${port}`,
    env: { KSG_DATA_DIR: path.join(__dirname, "..", "data", "sample") },
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
