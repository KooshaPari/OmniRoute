#!/usr/bin/env tsx
/**
 * scripts/migrate-quota-storage.ts
 *
 * One-shot migration: copy current sliding-window counter state from
 * `SqliteQuotaStore`'s `quota_consumption` table into a fresh
 * `KeyvQuotaStore` with the resolved default config.
 *
 * Idempotent: `KeyvQuotaStore.seed()` is overwrite-not-increment, so re-running
 * with the same source data yields the same keyv state. Safe to re-run.
 *
 * Usage:
 *   tsx scripts/migrate-quota-storage.ts                 # dry-run (default)
 *   tsx scripts/migrate-quota-storage.ts --apply         # write to Keyv
 *   tsx scripts/migrate-quota-storage.ts --apply --from=sqlite --to=keyv
 *
 * Out of scope:
 *   - Plan / pool metadata migration (pools stay in localDb; keyv stores only
 *     counter state for the duration of the sliding window).
 *   - Reverse migration (keyv → sqlite). Run the same script with `--from=keyv`
 *     once that direction is implemented (separate spec).
 *
 * Per `plans/keyv-as-embedded-default-spec.md` §4.3.3 / §4.4.
 */

import { createLogger } from "@/shared/utils/logger";
import { getSqliteQuotaStore } from "@/lib/quota/sqliteQuotaStore";
import {
  __resetKeyvQuotaStoreForTests,
  getKeyvQuotaStore,
} from "@/lib/quota/keyvQuotaStore";
import { readKeyvDefaultConfigFromEnv, KEYV_DEFAULT_URI } from "@/lib/quota/keyvDefaultConfig";
import { listPools } from "@/lib/db/quotaPools";
import { listPlans } from "@/lib/db/providerPlans";
import type { DimensionKey, QuotaUnit, QuotaWindow } from "@/lib/quota/dimensions";
import type { QuotaStore } from "@/lib/quota/types";

const log = createLogger("quota-migrate");

export interface MigrateOptions {
  apply: boolean;
}

export interface MigrateSummary {
  dryRun: boolean;
  kvUri: string;
  poolsScanned: number;
  dimensionsScanned: number;
  rowsMigrated: number;
  rowsSkipped: number;
}

/** Default set of (unit, window) dimensions every pool/plan combo is checked against. */
const DEFAULT_DIMENSIONS: Array<{ unit: QuotaUnit; window: QuotaWindow }> = [
  { unit: "tokens", window: "hourly" },
  { unit: "requests", window: "hourly" },
  { unit: "usd", window: "daily" },
];

/**
 * Run the migration. Pure function — exported separately so it can be
 * exercised by `tests/integration/quota-store-migration.test.ts` without
 * spawning a child process.
 */
export async function runQuotaMigration(opts: MigrateOptions): Promise<MigrateSummary> {
  const apply = opts.apply;

  // Reset the keyv singleton so we get a fresh store pinned to the resolved
  // URI (rather than whatever the test/process may have cached).
  __resetKeyvQuotaStoreForTests();

  const envCfg = readKeyvDefaultConfigFromEnv();
  const kvUri = process.env.QUOTA_STORE_KEYV_URL ?? envCfg.kvUrl ?? KEYV_DEFAULT_URI;

  const sqlite = getSqliteQuotaStore();
  const keyv = getKeyvQuotaStore({ uri: kvUri });

  const pools = listPools();
  const plans = listPlans();

  // Map connectionId → plan dimensions (may be empty if no plan is set).
  const planDimsByConn = new Map<string, Array<{ unit: QuotaUnit; window: QuotaWindow }>>();
  for (const plan of plans) {
    const dims = (plan.dimensions ?? []).map((d) => ({
      unit: d.unit,
      window: d.window,
    }));
    if (plan.connectionId) {
      planDimsByConn.set(plan.connectionId, dims);
    }
  }

  let dimensionsScanned = 0;
  let rowsMigrated = 0;
  let rowsSkipped = 0;

  for (const pool of pools) {
    const planDims = planDimsByConn.get(pool.connectionId) ?? DEFAULT_DIMENSIONS;

    for (const alloc of pool.allocations) {
      for (const dim of planDims) {
        const dimKey: DimensionKey = {
          poolId: pool.id,
          unit: dim.unit,
          window: dim.window,
        };
        dimensionsScanned += 1;

        const sourceValue = await sqlite.peek(alloc.apiKeyId, dimKey);
        if (!Number.isFinite(sourceValue) || sourceValue <= 0) {
          rowsSkipped += 1;
          continue;
        }

        if (apply) {
          await keyv.seed(alloc.apiKeyId, dimKey, sourceValue);
        }
        rowsMigrated += 1;
      }
    }
  }

  // NOTE: we deliberately do NOT call `keyv.dispose()` here so that the
  // singleton stays alive for follow-up reads in the same process (e.g. in
  // integration tests). The cleanupTimer is unref'd and will not keep the
  // event loop alive; the OS will reclaim resources on process exit.
  // For long-running services, callers should `__resetKeyvQuotaStoreForTests`
  // and create a fresh store if they want to flush writes elsewhere.

  const summary: MigrateSummary = {
    dryRun: !apply,
    kvUri,
    poolsScanned: pools.length,
    dimensionsScanned,
    rowsMigrated,
    rowsSkipped,
  };

  log.info(summary, apply ? "Quota migration applied" : "Quota migration (dry-run)");
  return summary;
}

/**
 * CLI entrypoint. Splits argv for flags and forwards to `runQuotaMigration`.
 */
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  let summary: MigrateSummary;
  try {
    summary = await runQuotaMigration({ apply });
  } catch (err) {
    log.error({ err: (err as Error)?.message }, "Quota migration failed");
    process.exit(1);
    return;
  }

  // Friendly stdout summary so the operator can grep CI logs.
  const payload = {
    mode: summary.dryRun ? "dry-run" : "apply",
    kvUri: summary.kvUri,
    pools: summary.poolsScanned,
    dimensions: summary.dimensionsScanned,
    migrated: summary.rowsMigrated,
    skipped: summary.rowsSkipped,
  };
  console.log(JSON.stringify(payload, null, 2));

  if (summary.dryRun) {
    log.info("Re-run with --apply to write to Keyv.");
  }
}

// Only run main when invoked as a script (not when imported by tests).
const isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  /migrate-quota-storage\.[cm]?[jt]sx?$/.test(process.argv[1]);

if (isMain) {
  void main();
}

// Re-export the helper for tests + future programmatic use.
export { main as runMigrationCli };
export type { QuotaStore };
