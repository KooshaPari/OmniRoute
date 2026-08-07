#!/usr/bin/env node
// scripts/check/quota-contract.ts
//
// Enforces the QuotaStore contract test from PR #505 (the type-drift
// fix that prompted this whole governance pass). Runs the contract
// test via vitest; exits non-zero on failure.
//
// The contract test asserts that SqliteQuotaStore, RedisQuotaStore, and
// KeyvQuotaStore all extend the QuotaStore interface. Compile-time
// type assertions catch drift BEFORE runtime, so this script is the
// last line of defense if vitest include paths change.
//
// Usage:
//   node --import tsx scripts/check/quota-contract.ts
//
// Exits 0 on pass, 1 on fail.

import { spawnSync } from "node:child_process";

const CONTRACT_TEST = "tests/unit/quota/quotaStore.contract.test.ts";

const result = spawnSync(
  process.execPath,
  [
    "node_modules/.bin/vitest",
    "run",
    CONTRACT_TEST,
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env, DISABLE_SQLITE_AUTO_BACKUP: "true" },
  },
);

if (result.error) {
  console.error(`scripts/check/quota-contract: failed to spawn vitest: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
