import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.join(__dirname, "src"), "server-only": path.join(__dirname, "tests", "empty.ts") } },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    coverage: { include: ["src/**/*.{ts,tsx}"] },
  },
});
