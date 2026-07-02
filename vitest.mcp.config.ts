import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "forks",
    maxWorkers: 4,
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 120000,
    hookTimeout: 30000,
    include: [
      "open-sse/mcp-server/__tests__/**/*.test.ts",
      "open-sse/services/autoCombo/__tests__/**/*.test.ts",
      "open-sse/services/combo/__tests__/**/*.test.ts",
      "tests/unit/autoCombo/**/*.test.ts",
      "tests/unit/encryption.spec.ts",
      "src/shared/components/**/*.test.tsx",
      "src/shared/hooks/__tests__/**/*.test.tsx",
      "src/app/(dashboard)/**/__tests__/**/*.test.tsx",
    ],
    exclude: ["**/node_modules/**", "**/.git/**"],
    coverage: {
      reportsDirectory: "coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
