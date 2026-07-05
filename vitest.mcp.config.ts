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
      "open-sse/executors/__tests__/**/*.test.ts",
      "open-sse/handlers/chatCore/__tests__/**/*.test.ts",
      "open-sse/mcp-server/__tests__/**/*.test.ts",
      "open-sse/services/__tests__/antigravity-quota-family.test.ts",
      "open-sse/services/__tests__/budgetForecast.test.ts",
      "open-sse/services/__tests__/thinkingBudget.test.ts",
      "open-sse/services/autoCombo/__tests__/**/*.test.ts",
      "open-sse/services/combo/__tests__/**/*.test.ts",
      "open-sse/translator/helpers/__tests__/geminiHelper.test.ts",
      "src/app/(dashboard)/**/__tests__/**/*.test.tsx",
      "src/app/api/compression/replay/__tests__/**/*.test.ts",
      "src/lib/db/__tests__/providerHealthHistory.test.ts",
      "src/lib/resilience/__tests__/**/*.test.ts",
      "src/shared/components/**/*.test.tsx",
      "src/shared/hooks/__tests__/**/*.test.tsx",
      "src/shared/utils/*.test.ts",
      "tests/e2e/selfHealing.test.ts",
      "tests/unit/autoCombo/**/*.test.ts",
      "tests/unit/encryption.spec.ts",
      "tests/unit/transformer/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "tests/unit/autoCombo/arenaEloFreeAlias-migration.test.ts",
    ],
    coverage: {
      reportsDirectory: "coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@omniroute/open-sse": path.resolve(__dirname, "./open-sse"),
    },
  },
});
