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
      "open-sse/executors/__tests__/{hasActiveClaudeThinking,mergeAbortSignals,reasoningEffortMaps,stripVersionedToolModelPrefix,userAgentHeader}.test.ts",
      "open-sse/services/autoCombo/__tests__/**/*.test.ts",
      "open-sse/services/combo/__tests__/**/*.test.ts",
      "open-sse/services/__tests__/{antigravity-quota-family,thinkingBudget}.test.ts",
      "open-sse/translator/helpers/__tests__/**/*.test.ts",
      "src/lib/db/__tests__/**/*.test.ts",
      "src/lib/resilience/__tests__/**/*.test.ts",
      "src/shared/components/**/*.test.tsx",
      "src/shared/hooks/__tests__/**/*.test.tsx",
      "src/shared/utils/**/*.test.ts",
      "src/app/(dashboard)/**/__tests__/**/*.test.tsx",
      "tests/unit/autoCombo/**/*.test.ts",
      "tests/unit/encryption.spec.ts",
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
