import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web/src"),
    },
  },
  test: {
    environment: "node",
    include: ["apps/web/src/perf/**/*.perf.ts"],
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
