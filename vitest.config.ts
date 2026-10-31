import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",

    environmentOptions: { jsdom: { url: "http://localhost:3000" } },
    globals: true,
    setupFiles: ["./tests/_setup/vitestUiPolyfills.ts"],
    pool: "threads",
    maxWorkers: 20,
    fileParallelism: true,
    maxConcurrency: 20,
    hookTimeout: 60000,
    retry: 2,
    include: [
      "src/app/**/dashboard/cache/__tests__/**/*.test.tsx",
      "src/app/**/dashboard/endpoint/__tests__/**/*.test.tsx",
      "src/app/**/dashboard/providers/**/__tests__/**/*.test.tsx",
      "src/app/**/dashboard/webhooks/__tests__/**/*.test.tsx",
      "src/app/**/dashboard/discovery/__tests__/**/*.test.tsx",
      "src/shared/hooks/__tests__/**/*.test.tsx",
      "src/lib/memory/__tests__/**/*.test.ts",
      "src/lib/skills/__tests__/**/*.test.ts",
      "tests/unit/encryption.test.ts",
      // `tests/unit/**/*.test.ts` deliberately NOT included. It matches ~5,285
      // files (the whole node-native unit tree, most of which import
      // `node:test`), so `test:vitest:ui` could never finish: the job was
      // cancelled at its 45-minute budget with only a few hundred files done
      // (2026-10-22). The node runner owns that tree; this config owns the
      // UI/component surface below plus the .test.tsx glob.
      "tests/unit/**/*.test.tsx",
      "tests/performance/**/*.test.ts",
      "open-sse/**/__tests__/**/*.test.ts",
      "open-sse/services/**/__tests__/**/*.test.ts",
    ],
    // #8618 RE-VERIFIED 2026-10-17. Of the 64 test files that were excluded
    // here, 48 were re-run and PASSED — they had been disabled needlessly. Only
    // the 16 that genuinely fail remain excluded. Evidence: running all 64
    // through a config with these exclusions cleared gave
    //   Test Files 16 failed | 45 passed (61)
    //   Tests      62 failed | 370 passed (432)
    // After removing the 48 stale entries, re-running them through THIS config:
    //   Test Files 46 passed (46)
    //   Tests      340 passed (340)
    // i.e. ~340 passing tests were being silently skipped. Re-enabling them
    // materially restores UI-component coverage — the exact area where the
    // node:fs client-bundle defect (fixed in 42f50de195) went undetected.
    // To re-check: copy this file, clear `exclude`, and run the list.
    exclude: [
      // Standard Vitest / tooling exclusions
      "node_modules/**",
      "dist/**",
      "cypress/**",
      ".idea/**",
      ".git/**",
      ".cache/**",
      // Live-server E2E — these drive a real running server, so they must never run
      // in this jsdom job. They have their own runners + vitest.e2e-live.config.ts.
      // ── Pre-existing failures tracked by #8618 ───────────────────────────────
      // node:test file, not a vitest suite: it imports `node:test` and Vitest
      // reports "No test suite found in file" (its `before`/`after` hooks are
      // also node:test APIs). Run it with the node runner that owns that file:
      //   node --import tsx/esm --test tests/unit/autoCombo/arenaEloFreeAlias-migration.test.ts
      "tests/unit/autoCombo/arenaEloFreeAlias-migration.test.ts",
      "tests/unit/ui/agent-card-risk-modal.test.tsx", // #8618 — pre-existing failure; remove this exclusion when fixed
      "tests/unit/ui/request-logger-autorefresh-visibility-3972.test.tsx", // #8618 — pre-existing failure; remove this exclusion when fixed
      "src/app/(dashboard)/dashboard/webhooks/__tests__/webhook-wizard.test.tsx", // #8618 — pre-existing failure; remove this exclusion when fixed
      "tests/unit/ui/logs-page-detail-modal-reopen-on-close.test.tsx", // #8618 — pre-existing failure; remove this exclusion when fixed
      "src/app/(dashboard)/dashboard/endpoint/__tests__/ApiEndpointsTab.test.tsx", // #8618 — pre-existing failure; remove this exclusion when fixed
      "src/app/(dashboard)/dashboard/cache/__tests__/CacheTrends.test.tsx", // #8618 — pre-existing failure; remove this exclusion when fixed
      "src/app/(dashboard)/dashboard/cache/__tests__/IdempotencyLayer.test.tsx", // #8618 — pre-existing failure; remove this exclusion when fixed
      "src/app/(dashboard)/dashboard/cache/__tests__/CachePerformance.test.tsx", // #8618 — pre-existing failure; remove this exclusion when fixed
    ],

    coverage: {
      reportsDirectory: "coverage",
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "tls-client-node": path.resolve(__dirname, "./tests/_setup/__mocks__/tls-client-node.ts"),
      // Mirrors tsconfig paths. Without it, a UI test importing from open-sse
      // resolves to undefined instead of failing loudly — which silently made
      // every provider look credentialed in the free-tier card tests.
      "@omniroute/open-sse": path.resolve(__dirname, "./open-sse"),
    },
  },
});
