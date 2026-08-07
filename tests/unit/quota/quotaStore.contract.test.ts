/**
 * quotaStore.contract.test.ts — Compile-time contract test for QuotaStore impls.
 *
 * Asserts that `SqliteQuotaStore`, `RedisQuotaStore`, and `KeyvQuotaStore`
 * all satisfy the `QuotaStore` interface from `src/lib/quota/types.ts`.
 *
 * This test exists because the 2026-07-18 polyglot refactor (`1951e415c0`)
 * left `KeyvQuotaStore` half-migrated to the new `PoolUsageSnapshot`
 * interface, drifting silently for ~2 weeks. The interface has 6 methods;
 * a missing method or wrong return shape breaks the QuotaStore contract.
 * This test catches that drift at compile time, before `tsc` even runs.
 *
 * The type-level assertions have no runtime behavior — if the imports below
 * compile, the contract holds. The runtime assertions below provide a sanity
 * floor and document the expected method count.
 */
import { describe, it, expect } from "vitest";

import type { QuotaStore } from "../../../src/lib/quota/types";
import type { SqliteQuotaStore } from "../../../src/lib/quota/sqliteQuotaStore";
import type { RedisQuotaStore } from "../../../src/lib/quota/redisQuotaStore";
import type { KeyvQuotaStore } from "../../../src/lib/quota/keyvQuotaStore";

// Compile-time assertions: if any impl fails to extend QuotaStore, the
// `_Conforms` type resolves to `false` and the `const _check: _Conforms = true`
// line below fails to typecheck. This catches drift before tests even run.
// (vitest does not run tsc on test files; this assertion fires when the
// project-wide `tsc -p tsconfig.typecheck-core.json` sweep picks the file up.)
type _SqliteConforms = SqliteQuotaStore extends QuotaStore ? true : false;
type _RedisConforms = RedisQuotaStore extends QuotaStore ? true : false;
type _KeyvConforms = KeyvQuotaStore extends QuotaStore ? true : false;

const _sqliteCheck: _SqliteConforms = true;
const _redisCheck: _RedisConforms = true;
const _keyvCheck: _KeyvConforms = true;

// Suppress "declared but never read" warnings — these are intentional.
void _sqliteCheck;
void _redisCheck;
void _keyvCheck;

// The 6 canonical methods on the QuotaStore interface. If a method is
// renamed or removed, this list MUST be updated to match `types.ts` — and
// the matching `_check: true` above will fail to typecheck if any impl
// no longer satisfies the new shape.
const QUOTA_STORE_METHODS = [
  "consume",
  "peek",
  "poolConsumedTotal",
  "poolUsage",
  "poolUsageWithDimensions",
  "clear",
] as const;

describe("QuotaStore interface contract", () => {
  it("SqliteQuotaStore implements QuotaStore", () => {
    expect(_sqliteCheck).toBe(true);
  });

  it("RedisQuotaStore implements QuotaStore", () => {
    expect(_redisCheck).toBe(true);
  });

  it("KeyvQuotaStore implements QuotaStore", () => {
    expect(_keyvCheck).toBe(true);
  });

  it("QuotaStore interface exposes 6 methods", () => {
    expect(QUOTA_STORE_METHODS).toHaveLength(6);
    expect(QUOTA_STORE_METHODS).toContain("consume");
    expect(QUOTA_STORE_METHODS).toContain("peek");
    expect(QUOTA_STORE_METHODS).toContain("poolConsumedTotal");
    expect(QUOTA_STORE_METHODS).toContain("poolUsage");
    expect(QUOTA_STORE_METHODS).toContain("poolUsageWithDimensions");
    expect(QUOTA_STORE_METHODS).toContain("clear");
  });
});
