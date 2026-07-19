import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        "src/modules/advertising/domain/preroll-policy.ts": { 100: true },
        "src/modules/library/domain/progress-policy.ts": { 100: true },
        "src/modules/library/domain/rating-policy.ts": { 100: true },
        "src/modules/playback/domain/watchability.ts": { 100: true },
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup/vitest.setup.ts"],
  },
});
