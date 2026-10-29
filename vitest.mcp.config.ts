import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "threads",
    maxWorkers: 20,
    fileParallelism: true,
    maxConcurrency: 20,
    include: [
      "open-sse/mcp-server/__tests__/**/*.test.ts",
      "open-sse/services/autoCombo/__tests__/**/*.test.ts",
      "open-sse/services/combo/__tests__/**/*.test.ts",
      "open-sse/services/__tests__/antigravity-quota-family.test.ts",
      // #8890 shipped this suite into a directory no runner collects, so it had
      // never executed once (check:test-discovery flags it as a NEW orphan).
      "open-sse/services/__tests__/fail-fast-concurrency-gate.test.ts",
      "src/lib/memory/__tests__/generic-backend.test.ts",
      "tests/unit/autoCombo/**/*.test.ts",
      "tests/unit/api/**/*.spec.ts",
      "tests/unit/encryption.spec.ts",
      "src/shared/components/**/*.test.tsx",
      "src/shared/hooks/__tests__/**/*.test.tsx",
      "src/app/(dashboard)/**/__tests__/**/*.test.tsx",
      // check:test-discovery caught these as NEW orphans once vitest.config.ts
      // stopped taking the whole `tests/unit/**/*.test.ts` tree (5,285 files:
      // test:vitest:ui could never finish, so nothing there actually ran).
      // They are vitest suites, so they belong here, not in the node runner.
      "src/app/api/settings/__tests__/**/*.test.ts",
      "src/lib/db/__tests__/**/*.test.ts",
      "src/lib/resilience/__tests__/**/*.test.ts",
      "src/sse/handlers/__tests__/**/*.test.ts",
      "src/shared/utils/**/*.test.ts",
      "tests/unit/open-sse/**/*.test.ts",
      "tests/unit/quota/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      // node:test suite: it imports `node:test` (and node:test's before/after),
      // so Vitest reports "No test suite found in file" and fails the whole run.
      // It is a node-native test; run it with
      //   node --import tsx/esm --test tests/unit/autoCombo/arenaEloFreeAlias-migration.test.ts
      "tests/unit/autoCombo/arenaEloFreeAlias-migration.test.ts",
    ],
    coverage: {
      reportsDirectory: "coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Mirrors tsconfig paths. Without it, a UI test importing from open-sse
      // resolves to undefined instead of failing loudly — which silently made
      // every provider look credentialed in the free-tier card tests.
      "@omniroute/open-sse": path.resolve(__dirname, "./open-sse"),
    },
  },
});
