# Quota KeyvQuotaStore Type-Drift Fix — Spec

**Feature slug:** `quota-keystore-type-drift`
**Branch:** `fix/quota-keystore-type-drift-20260805`
**Worktree:** `repos/OmniRoute/.worktrees/quota-fix-20260805`
**Status:** Draft — pending user approval before implementation
**Author:** droid session 2026-08-05
**Audit ref:** `plans/quota-module-audit-2026-08-05.md` (sibling doc)

---

## 1. Problem statement

`src/lib/quota/keyvQuotaStore.ts` does not satisfy the `QuotaStore` interface in `src/lib/quota/types.ts` and silently imports three types (`PoolUsage`, `PoolUsageWithDimensions`, `PlanPoolUsage`) that do not exist anywhere in the codebase. This causes:

1. **8 TypeScript compile errors** blocking `tsc -p tsconfig.typecheck-core.json`:
   ```
   src/lib/quota/keyvQuotaStore.ts(17,3): Module './types' has no exported member 'PoolUsage'
   src/lib/quota/keyvQuotaStore.ts(18,3): Module './types' has no exported member 'PoolUsageWithDimensions'
   src/lib/quota/keyvQuotaStore.ts(19,3): Module './types' has no exported member 'PlanPoolUsage'
   src/lib/quota/keyvQuotaStore.ts(50,29): Keyv constructor overload mismatch (uri, ns)
   src/lib/quota/keyvQuotaStore.ts(50,49): Keyv constructor overload mismatch (uri)
   src/lib/quota/keyvQuotaStore.ts(112,9): 'poolUsageWithDimensions' return shape not assignable to interface
   src/lib/quota/storeFactory.ts(106,7): 'KeyvQuotaStore' not assignable to 'QuotaStore'
   src/lib/quota/storeFactory.ts(108,7): 'QuotaStore | null' not assignable to 'QuotaStore'
   ```
2. **1 runtime test failure** in `tests/e2e/quota-store.e2e.ts:117`:
   `poolUsageWithDimensions returns a structured snapshot` — expects `snapshot.poolId === "test-pool"` but receives `undefined`, because the implementation returns `Record<string, number>` (keyed by `"unit:window"`) instead of the interface-defined `PoolUsageSnapshot` (which has `.poolId`, `.generatedAt`, `.dimensions[]`).
3. **5 dead methods** (`recordPlanUsage`, `upsertProviderPlan`, `listProviderPlans`, `setPools`, `getPool`) — zero callers in `src/` or `tests/`. Only `dispose` is used (test-only cleanup).

**Root cause** (per audit §7): Incomplete refactor. Commit `1951e415c0 feat(polyglot): refactor keyvQuotaStore to align with updated QuotaStore interface` (2026-07-18) was meant to align with the canonical `PoolUsageSnapshot` interface but was left half-finished. The file's doc-comment and `implements QuotaStore` clause were updated optimistically; the type imports and method bodies were not. The silent try/catch in `storeFactory.ts:103-112` hides the failure at runtime (logs a `pino.warn` and falls back to sqlite), so the broken code can sit until someone runs `tsc`.

---

## 2. Goal

Restore `keyvQuotaStore.ts` to a valid `QuotaStore` implementation that:
- Satisfies the canonical `QuotaStore` interface (6 methods).
- Mirrors `SqliteQuotaStore`'s structural design (sliding-window semantics, `PoolUsageSnapshot` return shape, per-key `peek` for `poolUsageWithDimensions`).
- Keeps the 5 dead-code methods on a separate extension class so the file's API surface is preserved without polluting the interface contract.
- Adds a compile-time contract test that prevents recurrence of this drift.

---

## 3. Non-goals

- Not changing the `QuotaStore` interface (6 methods, `PoolUsageSnapshot` return shape). Interface is the SSOT.
- Not changing `SqliteQuotaStore` or `RedisQuotaStore` (both already correct).
- Not changing the store factory driver-selection logic.
- Not adding new dependency on `@keyv/sqlite` or other Keyv adapter packages (already a transitive dep via `keyv` URIs).
- Not changing the silent fallback in `storeFactory.ts:103-112` (separate concern: silent degradation governance).
- Not changing the 5 dead methods' runtime behavior — they are preserved as-is in the extension class for future use.

---

## 4. Design

### 4.1 New file layout

```
src/lib/quota/
├── keyvQuotaStore.ts           # REWRITTEN — KeyvQuotaStore class implements QuotaStore
├── keyvQuotaStoreExtras.ts     # NEW — KeyvQuotaStoreExtras class (5 dead methods + dispose)
├── types.ts                    # EDITED — add PlanPoolUsage type declaration
└── storeFactory.ts             # EDITED — use KeyvQuotaStoreExtras for the 5 extras if any caller materializes
```

### 4.2 Type additions

In `src/lib/quota/types.ts`, add:

```ts
/**
 * Plan-level consumption rollup (used by the KeyvQuotaStoreExtras extension;
 * not part of the QuotaStore interface contract).
 */
export interface PlanPoolUsage {
  totalConsumed?: number;
  lastUpdatedAt: number;
  poolId?: string;
  connectionId?: string;
  provider?: string;
}
```

(Shape inferred from current keyvQuotaStore.ts:130-138 usage; extend if test demand shows otherwise.)

### 4.3 `KeyvQuotaStore` (rewritten) — interface contract

```ts
export class KeyvQuotaStore implements QuotaStore {
  private readonly kv: Keyv;
  private readonly buckets = new Map<string, { value: number; expiresAt: number }>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(options: KeyvQuotaStoreOptions = {}) { /* same as today, but Keyv ctor fixed */ }

  // --- 6 QuotaStore methods (all match SqliteQuotaStore semantics) ---
  async consume(apiKeyId, dim, cost): Promise<number>;
  async peek(apiKeyId, dim): Promise<number>;
  async poolConsumedTotal(poolId, dim): Promise<number>;
  async poolUsage(poolId): Promise<PoolUsageSnapshot>;        // empty-shell snapshot (matches sqlite)
  async poolUsageWithDimensions(poolId, planDimensions): Promise<PoolUsageSnapshot>;  // full per-key breakdown (matches sqlite)
  async clear(apiKeyId, dim): Promise<void>;
}
```

**`poolUsageWithDimensions` algorithm** (mirror `sqliteQuotaStore.ts:167-237`):
1. `pool = await getPool(poolId)` from `@/lib/localDb` (DB-backed, same as peers)
2. If pool null → return `{ poolId, generatedAt, dimensions: [] }`
3. `totalWeight = sum(pool.allocations.weight)`
4. For each `planDim` in `planDimensions`:
   - `consumedTotal = 0`, `perKey = []`
   - For each `alloc` in `pool.allocations`:
     - `consumed = await this.peek(alloc.apiKeyId, dim)`
     - `consumedTotal += consumed`
     - `fairShare = (effectiveWeight / 100) * planDim.limit`
     - `deficit = consumed - fairShare`
     - `borrowing = consumed > fairShare`
     - `perKey.push({ apiKeyId, consumed, fairShare, deficit, borrowing })`
   - `burnRate = computeBurnRateFromWindow(...)` (if applicable)
   - `dimensions.push({ unit, window, limit, consumedTotal, perKey })`
5. Return `{ poolId, generatedAt, dimensions }`

**`poolUsage` algorithm** (mirror `sqliteQuotaStore.ts:132-148`):
- Return empty-shell `{ poolId, generatedAt: new Date().toISOString(), dimensions: [] }` because KeyvQuotaStore does not carry pool allocation metadata (and `setPools` has zero callers).

### 4.4 `KeyvQuotaStoreExtras` (new file)

```ts
// src/lib/quota/keyvQuotaStoreExtras.ts
import type { KeyvQuotaStore } from "./keyvQuotaStore";
import type { ProviderPlan, QuotaPool } from "./dimensions";
import type { PlanPoolUsage } from "./types";

/**
 * Extension class for KeyvQuotaStore. Carries the 5 dead-code methods
 * preserved for future use; not part of the QuotaStore interface contract.
 * The peer SqliteQuotaStore does not need this because its plan/pool
 * metadata lives in the same SQLite DB as its counters; the Keyv store's
 * Keyv-backed plan/pool storage is intentionally separate.
 */
export class KeyvQuotaStoreExtras {
  constructor(private readonly store: KeyvQuotaStore) {}

  async recordPlanUsage(
    connectionId: string,
    provider: string,
    poolId: string,
    _dimensions: Array<{ unit: QuotaUnit; window: QuotaWindow }>,
    consumed: number,
  ): Promise<PlanPoolUsage> { /* moved from KeyvQuotaStore L124-141 */ }

  async upsertProviderPlan(plan: ProviderPlan): Promise<void> { /* moved from L144-147 */ }

  async listProviderPlans(): Promise<ProviderPlan[]> { /* moved from L149-151 */ }

  async setPools(pools: QuotaPool[]): Promise<void> { /* moved from L153-156 */ }

  async getPool(poolId: string): Promise<QuotaPool | undefined> { /* moved from L157-160 */ }
}
```

**Note:** `dispose()` stays on `KeyvQuotaStore` itself (it's part of cleanup, not data, and is used by tests).

### 4.5 Singleton wiring

Keep `getKeyvQuotaStore()` and `__resetKeyvQuotaStoreForTests()` as today. Add a sibling `getKeyvQuotaStoreExtras()` and `__resetKeyvQuotaStoreExtrasForTests()` to the new file.

### 4.6 Keyv constructor fix

The current `new Keyv(uri, ns)` triggers overload errors. Inspect `node_modules/keyv/package.json` to confirm version, then use the supported form. Most likely:

```ts
this.kv = ns ? new Keyv({ uri, namespace: ns.namespace }) : new Keyv({ uri });
```

(or `new Keyv(uri as any)` if the typed form rejects — verify in implementation.)

---

## 5. Acceptance criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1 | `tsc -p tsconfig.typecheck-core.json` reports 0 errors in `src/lib/quota/`. | `node node_modules/typescript/bin/tsc --pretty false -p tsconfig.typecheck-core.json 2>&1 \| grep "error TS" \| grep -v regional \| wc -l` returns `0`. |
| AC-2 | `KeyvQuotaStore` declares `implements QuotaStore` and TypeScript accepts the assignment `const s: QuotaStore = new KeyvQuotaStore()`. | Compile-time check. |
| AC-3 | All 6 `tests/unit/quota/keyvQuotaStore.test.ts` cases still pass. | `DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/quota/keyvQuotaStore.test.ts` → 6 passed, 0 failed. |
| AC-4 | All 8 previously-passing `tests/e2e/quota-store.e2e.ts` cases still pass AND the previously-failing `poolUsageWithDimensions returns a structured snapshot` case now passes. | `… vitest run tests/e2e/quota-store.e2e.ts` → 8 passed, 0 failed (currently 7 passed, 1 failed). |
| AC-5 | `tests/unit/quota-store-factory.test.ts` (node:test) still passes 6/6. | `node --import tsx --import ./open-sse/utils/setupPolyfill.ts --import ./tests/_setup/isolateDataDir.ts --test tests/unit/quota-store-factory.test.ts` → 6 pass, 0 fail. |
| AC-6 | New contract test asserts all 3 QuotaStore impls satisfy the interface. | `tests/unit/quota/quotaStore.contract.test.ts` exists; passes; uses `expectTypeOf` or equivalent compile-time assertion. |
| AC-7 | The 5 dead methods (now in `KeyvQuotaStoreExtras`) are reachable via the new singleton. | `getKeyvQuotaStoreExtras().recordPlanUsage(...)` typechecks and runs. |
| AC-8 | `PlanPoolUsage` is a real exported type from `./types` (not a ghost). | `import { PlanPoolUsage } from "./types"` resolves. |
| AC-9 | No behavior change for callers of `consume` / `peek` / `poolConsumedTotal` / `clear`. | The 6 unit tests (AC-3) + the integration tests that exercise these methods via the factory path. |

---

## 6. Implementation steps

In dependency order (each independently verifiable):

1. **Add `PlanPoolUsage` to `types.ts`.** Edit `src/lib/quota/types.ts` to add the type declaration from §4.2.
2. **Rewrite `keyvQuotaStore.ts`.**
   - Replace L15-20 imports with the canonical types.
   - Fix the `Keyv` constructor at L47-55 per §4.6.
   - Rewrite `poolUsage` (L100-108) to return empty-shell `PoolUsageSnapshot`.
   - Rewrite `poolUsageWithDimensions` (L113-122) to mirror `sqliteQuotaStore.ts:167-237` (using `getPool` from `@/lib/localDb`).
   - Remove the 5 dead methods (`recordPlanUsage`, `upsertProviderPlan`, `listProviderPlans`, `setPools`, `getPool`).
   - Keep `consume`, `peek`, `poolConsumedTotal`, `clear`, `dispose`, and the singleton getters (`getKeyvQuotaStore`, `__resetKeyvQuotaStoreForTests`).
3. **Create `keyvQuotaStoreExtras.ts`.** Move the 5 dead methods + their getters into the extension class.
4. **Add contract test.** Create `tests/unit/quota/quotaStore.contract.test.ts` with compile-time assertions that `SqliteQuotaStore`, `RedisQuotaStore`, and `KeyvQuotaStore` all satisfy `QuotaStore`. Use `expectTypeOf` from vitest or a type-level assertion via assignment.
5. **Run all acceptance-criteria checks** (AC-1 through AC-9).
6. **Commit** as a single feature commit on `fix/quota-keystore-type-drift-20260805`. Then push and open a PR against `agent/migration-version-collision-fix` (current canonical branch).

---

## 7. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `poolUsageWithDimensions` rewrite uses wrong `getPool` import path | Low | High (incorrect pool data) | Mirror sqliteQuotaStore.ts:18 (`import { getPool } from "@/lib/localDb"`) verbatim. |
| `Keyv` constructor fix breaks runtime for `keyv://sqlite:` URIs | Low | Medium | Keep `new Keyv({ uri })` form; verify by running the e2e test which exercises this path. |
| Sliding-window semantics differ between Keyv in-memory `buckets` map and sqlite 2-bucket formula | Medium | Medium (counter drift) | Audit confirms Keyv already uses an `expiresAt`-based window (same intent as sqlite's 2-bucket). Mirror sqlite's `WINDOW_MS[dim.window]` math verbatim; do not invent a new windowing strategy. |
| Contract test doesn't actually catch the drift (e.g. uses `any` assertions) | Low | Low (drift can recur) | Use `expectTypeOf<typeof SqliteQuotaStore.prototype.consume>().toMatchTypeOf<QuotaStore["consume"]>()` — strict signature match. |
| Hidden callers of the 5 dead methods surface after rewrite | Low | Low | Audit confirmed zero callers across `src/` and `tests/`. If any caller is added later, they'd import from `./keyvQuotaStoreExtras`. |

---

## 8. Test plan

### 8.1 Existing tests (must continue to pass)

- `tests/unit/quota/keyvQuotaStore.test.ts` — 6 tests (consume/peek/clear/dispose/key-isolation).
- `tests/e2e/quota-store.e2e.ts` — 8 tests (was 7 + 1 failing; the failing one must now pass).
- `tests/unit/quota-store-factory.test.ts` — 6 tests (node:test format).
- `tests/integration/quota-store-settings.test.ts` — DB-backed driver config.
- `tests/integration/quota-pools-usage.test.ts` — Pool usage route via `getQuotaStore`.
- `tests/integration/quota-pool-usage-provider-resolution.test.ts` — Pool usage plan-resolution.
- `tests/unit/quota-enforce.test.ts` — `enforce.ts` w/ mocked store.

### 8.2 New tests

- `tests/unit/quota/quotaStore.contract.test.ts` — Compile-time assertion that all 3 QuotaStore impls match the interface.
- `tests/unit/quota/keyvQuotaStoreExtras.test.ts` — Sanity test for the 5 dead methods relocated to the extension class (1 test per method, verifying type-level reachability).

### 8.3 Verification commands

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute/.worktrees/quota-fix-20260805
export PATH="/opt/homebrew/bin:$PATH"

# AC-1: typecheck
node node_modules/typescript/bin/tsc --pretty false -p tsconfig.typecheck-core.json 2>&1 | grep "error TS" | grep -v regional | wc -l  # → 0

# AC-3, AC-4: keyv unit + e2e
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/quota/keyvQuotaStore.test.ts tests/e2e/quota-store.e2e.ts

# AC-5: factory test (node:test)
DISABLE_SQLITE_AUTO_BACKUP=true node --import tsx --import ./open-sse/utils/setupPolyfill.ts --import ./tests/_setup/isolateDataDir.ts --test tests/unit/quota-store-factory.test.ts

# AC-6: contract test
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/quota/quotaStore.contract.test.ts
```

---

## 9. Open questions (resolved by spec author)

The audit raised 9 open questions. Resolutions adopted in this spec:

1. **`PlanPoolUsage` shape** — Declared in `types.ts` as `{ totalConsumed?: number; lastUpdatedAt: number; poolId?: string; connectionId?: string; provider?: string }` (minimal inferred shape; extensible if demand emerges). Used only by the `KeyvQuotaStoreExtras.recordPlanUsage` method.
2. **Pool source for `poolUsageWithDimensions`** — Use `getPool` from `@/lib/localDb` (DB-backed), matching `sqliteQuotaStore.ts:18` and `redisQuotaStore.ts:20`. The Keyv-backed `getPool` lives in the extension class for future use.
3. **Commit `2217f31b1e` content** — Acknowledged as unverified in audit; not blocking. If the rewrite deviates from the original intent, the git history will show the divergence and the spec can be amended.
4. **PR-G original commit** — `storeFactory.ts` comment preserved as-is. "Embedded default" framing is the intent; the rewrite preserves it.
5. **`@keyv/sqlite` runtime adapter** — Will verify during implementation; if missing, add to `package.json` `optionalDependencies`. Not blocking for the in-memory `memory://` default used by tests.
6. **FORGE_WRAPUP.md Tier-5 task 20** — This spec is the Tier-5 task coming home. Confirmation noted; out-of-band.
7. **Test execution** — Verified during this session: keyv unit 6/6 pass, e2e 7/8 pass (1 expected failure), factory 6/6 pass (node:test).
8. **Strategy choice** — User picked "Stable rewrite" + "separate extension class" → Option A from audit §8 step 6. Adopted.
9. **Pool source for extension's `getPool`** — Keyv-backed (preserves the existing local behavior for callers that opt into the extension).

---

## 10. Out of scope (deferred)

These are flagged for follow-up but explicitly NOT in this fix:

- **Silent fallback in `storeFactory.ts:103-112`** — try/catch around keyv driver hides TypeScript compile errors. Should be replaced with a fail-fast at startup. Separate PR.
- **Promote Keyv to default driver** — currently sqlite is default; PR-G comment positions Keyv as "embedded default for fresh installs". Separate PR with config migration plan.
- **BucketValue / fromUri / member-set design** — Per `FORGE_WRAPUP.md:97-105`, a previous agent wrote a 363-line breaking rewrite using these primitives. Out of scope; would require data migration.
- **Add KeyvQuotaStore to production runtime smoke** — Currently only exercised in unit/e2e tests. Separate PR for staging canary.

---

## 11. Commit + delivery

```
fix(quota): rewrite KeyvQuotaStore to satisfy QuotaStore interface (Phase P0 type-drift)

- Add PlanPoolUsage type to src/lib/quota/types.ts
- Rewrite src/lib/quota/keyvQuotaStore.ts: align with PoolUsageSnapshot
  interface; mirror SqliteQuotaStore sliding-window semantics for
  poolUsageWithDimensions (per-key peek + fair-share + deficit + borrowing +
  burn rate); use getPool from @/lib/localDb to match peers
- Create src/lib/quota/keyvQuotaStoreExtras.ts: relocate 5 dead-code methods
  (recordPlanUsage, upsertProviderPlan, listProviderPlans, setPools, getPool)
  + their getters behind a separate extension class
- Fix Keyv constructor overload mismatch
- Add tests/unit/quota/quotaStore.contract.test.ts: compile-time assertion
  that SqliteQuotaStore, RedisQuotaStore, and KeyvQuotaStore all satisfy
  QuotaStore (prevents recurrence of the drift)
- Add tests/unit/quota/keyvQuotaStoreExtras.test.ts: reachability sanity for
  the 5 extension methods

Closes [TBD-issue]

Verification:
- tsc -p tsconfig.typecheck-core.json → 0 errors in src/lib/quota/
- vitest keyvQuotaStore.test.ts → 6/6 pass
- vitest quota-store.e2e.ts → 8/8 pass (was 7/8 with 1 expected failure)
- node --test quota-store-factory.test.ts → 6/6 pass
- vitest quotaStore.contract.test.ts → pass

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

PR target: `agent/migration-version-collision-fix` (current canonical branch).
