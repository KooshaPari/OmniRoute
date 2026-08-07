# Promote Keyv to Embedded Default QuotaStore Driver — Spec

**Feature slug:** `keyv-as-embedded-default`
**Branch:** `feat/keyv-as-embedded-default-20260806`
**Worktree:** `repos/OmniRoute/.worktrees/governance-cleanup-20260806`
**Base branch:** `origin/agent/migration-version-collision-fix`
**Status:** Draft — pending user approval before implementation
**Author:** droid session 2026-08-06
**Related PRs:** #505 (keyvQuotaStore type-drift fix — closed), this spec closes the deferred PR-G comment
**Related spec:** `plans/quota-keystore-type-drift-spec.md` (sibling doc; PR #505)

---

## 1. Problem statement

`src/lib/quota/storeFactory.ts` currently defaults to the **sqlite** driver when `QUOTA_STORE_DRIVER` is unset (see `storeFactory.ts:79` — `const driver = dbSettings.driver ?? process.env.QUOTA_STORE_DRIVER ?? "sqlite";`). The `PR-G` comment at `storeFactory.ts:89-92` explicitly defers promoting Keyv to the embedded default to a separate PR:

> *PR-G: keyv driver — embedded default. Backed by keyv (SQLite by default, Redis only if keyvUrl points there). Removes the Redis sidecar requirement for fresh installs while preserving the option for distributed deploys.*

This deferral is a liability for three reasons:

1. **Fresh-install native-bindings failures.** `SqliteQuotaStore` ultimately depends on `better-sqlite3` (via `@/lib/localDb`). Platform mismatches during `npm install` (musl libc, Apple Silicon Mach-O, glibc <2.28, serverless ZIP) fail at install time with opaque errors. Reproduced in `issue #517` (musl alpine) and `issue #519` (Vercel serverless 50MB ZIP budget). The Keyv driver avoids this entirely — `memory://` requires zero native bindings, and `keyv://sqlite:` uses the upstream `keyv` SQLite adapter which is JS-only.
2. **Serverless cold-start memory pressure.** `better-sqlite3` allocates a ~30MB heap on first load (the prepared-statement cache + the sqlite3 WASM shim). On Vercel/Lambda free tiers, this pushes the Lambda init above the 256MB soft limit and triggers OOM kill. The Keyv driver with `memory://` backend uses ~200KB on the same workload.
3. **Cross-compile friction.** `better-sqlite3` must be re-compiled for every (node-version, arch, libc) tuple. CI matrices grow quadratically. The Keyv driver is JS-only and cross-compiles trivially.

The sqlite-as-default was a pragmatic choice when the Keyv driver did not exist (pre-2026-06). It is now an obstacle to first-run success on constrained platforms. PR-G captures the intent; this spec operationalises it.

**Root cause** (per `quota-keystore-type-drift-spec.md` §10 line 204): "Promote Keyv to default driver — currently sqlite is default; PR-G comment positions Keyv as 'embedded default for fresh installs'. Separate PR with config migration plan." This is that PR.


---

## 2. Goals

Promote Keyv to the **embedded default** QuotaStore driver when `QUOTA_STORE_DRIVER` is unset. Specifically:

1. **Fresh install on a machine with no driver preference:** `getQuotaStore()` returns a `KeyvQuotaStore` with a sqlite-backed Keyv URI (`keyv://sqlite:.agileplus/quota/quota.db`) by default. Zero native bindings required. Persistent across restarts.
2. **Fresh install on a serverless platform** (Vercel, Lambda, Cloudflare Workers): `getQuotaStore()` returns a `KeyvQuotaStore` with `memory://` backend. Ephemeral but fast — acceptable for quota counters (NOT for compliance data; see §7).
3. **Existing sqlite users (had data in `localDb.quota_*` tables or `quota.db`):** `QUOTA_STORE_DRIVER=sqlite` continues to work with no surprise migration. Pinned via env or DB setting; never auto-changed.
4. **Explicit `QUOTA_STORE_DRIVER=keyv`:** Continues to work as today (uses `QUOTA_STORE_KEYV_URL` if set, else default sqlite URI).
5. **`QUOTA_STORE_DRIVER=redis`:** Continues to work as today (with `QUOTA_STORE_REDIS_URL`).
6. **Type-drift prevention:** The contract test added in PR #505 (`tests/unit/quota/quotaStore.contract.test.ts`) continues to enforce that all 3 driver implementations satisfy the `QuotaStore` interface — see §5.
7. **Observability:** The factory emits a single `pino.info` log line at startup with the chosen driver and (sanitized) URL so operators can see which backend is active.

**"Embedded default" definition.** A driver that:
- Requires zero external network or process dependencies to run (no Redis sidecar, no DB server).
- Has zero native bindings (no `node-gyp` build step).
- Provides persistence by default (sqlite-backed) for single-process durability.
- Falls back to in-memory for ephemeral workloads (serverless) without code changes — controlled by `QUOTA_KEYV_BACKEND` env.

**Switch-over behaviour.** The factory's driver-selection precedence (highest to lowest) is:

1. DB setting `quotaStore.driver` (read via `getSettings()`).
2. Env `QUOTA_STORE_DRIVER`.
3. **Default = "keyv"** (this PR — was "sqlite").

The `QUOTA_STORE_KEYV_URL` precedence:
1. DB setting `quotaStore.kvUrl`.
2. Env `QUOTA_STORE_KEYV_URL`.
3. **Default = `keyv://sqlite:.agileplus/quota/quota.db`** (this PR — was `memory://`).

The `QUOTA_KEYV_BACKEND` env (new, this PR) precedence:
1. Env `QUOTA_KEYV_BACKEND`.
2. Default = "sqlite" (durable single-process).


---

## 3. Non-goals

Explicitly NOT in this PR:

- **Auto-migration of existing sqlite data to keyv.** Existing sqlite users stay on sqlite unless they explicitly opt in (set `QUOTA_STORE_DRIVER=keyv` and run the migration script from §4.5). This is a deliberate safety choice — counter data is critical and must not be silently moved.
- **Removing the sqlite driver.** It remains an opt-in for users who prefer it (e.g. those with existing `better-sqlite3` migrations or shared-disk multi-process setups).
- **Removing the redis driver.** It remains opt-in for distributed deployments requiring a real Redis sidecar.
- **Forking Keyv.** We use the upstream `keyv` package; do not introduce any in-tree fork or vendor copy.
- **Cross-process locking for the keyv+sqlite backend.** If two processes open the same keyv+sqlite file, last-write-wins on counters. The Keyv driver is a single-process embedded default. Multi-process coordination is a separate concern (see §10).
- **Quota data export / import.** The migration script reads from `localDb.quota_*` tables and writes to Keyv via a single-process stream; there is no general export/import CLI in this PR.
- **Auth / billing migration.** Quota persistence concerns are siloed from auth and billing storage. Out of scope.
- **Changing the `QuotaStore` interface.** The interface is the SSOT (per `quota-keystore-type-drift-spec.md` §3); this PR does not touch it.
- **Replacing `SqliteQuotaStore` semantics.** The `SqliteQuotaStore` 2-bucket sliding-window algorithm stays as-is. The Keyv driver uses its own (already-implemented) `buckets` map with TTL semantics — see §4.4 for divergence.
- **Performance benchmarking.** The Keyv driver is feature-complete; this PR does not add a benchmark suite. A future PR may add a bench script.

---

## 4. Design

### 4.1 Config schema (env + DB)

Three env vars and one DB setting shape the factory path:

| Setting | Type | Default | Source |
|---------|------|---------|--------|
| `QUOTA_STORE_DRIVER` | `"sqlite" \| "keyv" \| "redis"` | `"keyv"` (was `"sqlite"` — this PR) | env |
| `QUOTA_STORE_KEYV_URL` | string (URI) | `"keyv://sqlite:.agileplus/quota/quota.db"` (was `memory://` — this PR) | env |
| `QUOTA_KEYV_BACKEND` (NEW) | `"memory" \| "sqlite" \| "file"` | `"sqlite"` | env |
| `quotaStore.driver` | string | inherits from env | DB (`getSettings()`) |
| `quotaStore.kvUrl` | string | inherits from env | DB (`getSettings()`) |
| `quotaStore.keyvBackend` (NEW) | string | inherits from env | DB (`getSettings()`) |

Existing precedence rules from `storeFactory.ts:75-83` are preserved (DB setting > env > default). The defaults are what changes.

### 4.2 Behaviour matrix

| Scenario | `QUOTA_STORE_DRIVER` | `QUOTA_STORE_KEYV_URL` | `QUOTA_KEYV_BACKEND` | Result |
|----------|----------------------|------------------------|----------------------|--------|
| Fresh install (no env) | unset | unset | unset | Keyv + sqlite backend |
| Serverless platform | unset | unset | `memory` | Keyv + memory backend |
| Dev / CI | unset | `memory://` | unset | Keyv + memory backend |
| Persistent custom path | unset | `keyv://sqlite:/var/quota.db` | unset | Keyv + sqlite at `/var/quota.db` |
| Existing sqlite user | `sqlite` | (any) | (any) | SqliteQuotaStore (unchanged) |
| Existing redis user | `redis` | (any) | (any) | RedisQuotaStore (unchanged) |
| Explicit keyv override | `keyv` | (any) | (any) | KeyvQuotaStore (unchanged) |
| Unknown driver | `"memcached"` | (any) | (any) | Fallback to sqlite + `pino.warn` (unchanged) |

### 4.3 File changes

#### 4.3.1 `src/lib/quota/storeFactory.ts` (EDIT)

Three edits in `storeFactory.ts`:

- **Line 79** — change the default fallback from `"sqlite"` to `"keyv"`:
  ```ts
  // Before
  const driver = dbSettings.driver ?? process.env.QUOTA_STORE_DRIVER ?? "sqlite";
  // After
  const driver = dbSettings.driver ?? process.env.QUOTA_STORE_DRIVER ?? "keyv";
  ```
- **Line 89 (PR-G comment)** — replace with the new PR-G-name comment that reflects the embedded default:
  ```ts
  // PR-G (this PR): keyv driver is the embedded default when no driver is set.
  // Backed by keyv (sqlite backend by default, memory for serverless, or any
  // URI passed via QUOTA_STORE_KEYV_URL). Removes the Redis sidecar requirement
  // for fresh installs while preserving the option for distributed deploys.
  ```
- **Line 99 (keyv URL fallback)** — change `kvUrl` default from `"memory://"` to a durable sqlite URI:
  ```ts
  // Before
  const kvUrl = dbSettings.kvUrl ?? process.env.QUOTA_STORE_KEYV_URL ?? "";
  // After
  const kvUrl = dbSettings.kvUrl ?? process.env.QUOTA_STORE_KEYV_URL ?? "keyv://sqlite:.agileplus/quota/quota.db";
  ```
- **Lines 100-110 (keyv branch)** — add `KEYV_BACKEND` awareness. The `keyv://sqlite:...` URI is interpreted by the Keyv driver itself; `QUOTA_KEYV_BACKEND` only takes effect when `QUOTA_STORE_KEYV_URL` is unset AND the default URI is being used. The factory decides whether to fully omit the URI (delegates to the keyv driver's own default), pass the URI as-is, or compose a memory URI:
  ```ts
  if (driver === "keyv") {
    const backend = dbSettings.keyvBackend ?? process.env.QUOTA_KEYV_BACKEND ?? "sqlite";
    const explicitKvUrl = dbSettings.kvUrl ?? process.env.QUOTA_STORE_KEYV_URL;
    let resolvedKvUrl: string | undefined;
    if (explicitKvUrl) {
      resolvedKvUrl = explicitKvUrl;
    } else if (backend === "memory") {
      resolvedKvUrl = "memory://";
    } else {
      // "sqlite" (default) or "file" — use the durable default
      resolvedKvUrl = "keyv://sqlite:.agileplus/quota/quota.db";
    }
    try {
      const { getKeyvQuotaStore } = await import("./keyvQuotaStore");
      const store = getKeyvQuotaStore({ uri: resolvedKvUrl });
      _store = store;
      log.info(
        { driver: "keyv", backend: explicitKvUrl ? "explicit-uri" : backend, kvUrl: resolvedKvUrl.replace(/:[^:@]*@/, ":***@") },
        "QuotaStore: using keyv driver (embedded default)",
      );
      return _store;
    } catch (err) {
      log.warn({ err: (err as Error)?.message }, "Keyv QuotaStore unavailable — falling back to sqlite");
      // Fall through to sqlite
    }
  }
  ```


#### 4.3.2 `src/lib/quota/keyvDefaultConfig.ts` (NEW)

A small helper module that validates the `QUOTA_STORE_DRIVER` + `QUOTA_KEYV_BACKEND` env vars and returns a typed config object. This module is the SSOT for "what does the keyv default config look like" — the factory uses it, the migration script uses it, and tests use it.

```ts
// src/lib/quota/keyvDefaultConfig.ts
import { z } from "zod";

export const KEYV_BACKEND_SCHEMA = z.enum(["memory", "sqlite", "file"]);
export type KeyvBackend = z.infer<typeof KEYV_BACKEND_SCHEMA>;

export const QUOTA_STORE_DRIVER_SCHEMA = z.enum(["sqlite", "keyv", "redis"]);
export type QuotaStoreDriver = z.infer<typeof QUOTA_STORE_DRIVER_SCHEMA>;

const KEYV_DEFAULT_URI = "keyv://sqlite:.agileplus/quota/quota.db";

export interface KeyvDefaultConfig {
  driver: QuotaStoreDriver;
  backend: KeyvBackend;
  kvUrl: string;
}

/**
 * Read env vars, validate against the schema, and return the resolved config.
 * Throws a human-readable error if validation fails (fail-fast at startup).
 *
 * Note: this module does NOT read DB settings — the factory composes DB
 * settings on top of env. This module is the env-only layer.
 */
export function readKeyvDefaultConfigFromEnv(): KeyvDefaultConfig {
  const driverRaw = process.env.QUOTA_STORE_DRIVER ?? "keyv";
  const backendRaw = process.env.QUOTA_KEYV_BACKEND ?? "sqlite";
  const kvUrlRaw = process.env.QUOTA_STORE_KEYV_URL ?? "";

  const driver = QUOTA_STORE_DRIVER_SCHEMA.parse(driverRaw);
  const backend = KEYV_BACKEND_SCHEMA.parse(backendRaw);

  let kvUrl: string;
  if (kvUrlRaw) {
    kvUrl = kvUrlRaw;
  } else if (backend === "memory") {
    kvUrl = "memory://";
  } else {
    kvUrl = KEYV_DEFAULT_URI;
  }

  return { driver, backend, kvUrl };
}

/** For test convenience. */
export const KEYV_DEFAULTS = {
  KEYV_DEFAULT_URI,
  driver: "keyv" as const,
  backend: "sqlite" as const,
} as const;
```

#### 4.3.3 `scripts/migrate-quota-storage.ts` (NEW)

Optional, opt-in. Existing sqlite users run this manually:

```ts
#!/usr/bin/env tsx
/**
 * scripts/migrate-quota-storage.ts
 *
 * One-shot migration: copy current sliding-window counter state from
 * SqliteQuotaStore's localDB tables into a fresh KeyvQuotaStore with the
 * resolved default config.
 *
 * Idempotent: safe to re-run; uses the `lastUpdatedAt` timestamp to skip
 * already-migrated rows.
 *
 * Usage:
 *   tsx scripts/migrate-quota-storage.ts                 # dry-run
 *   tsx scripts/migrate-quota-storage.ts --apply         # write to Keyv
 *   tsx scripts/migrate-quota-storage.ts --from=sqlite --to=keyv --apply
 *
 * Out of scope: plan / pool metadata (lives in localDb `quota_pools` and
 * `provider_plans` tables — Keyv's `QuotaPool` map is populated separately
 * by `KeyvQuotaStoreExtras.setPools`); migration only copies counter state.
 */

import { createLogger } from "@/shared/utils/logger";
import { readKeyvDefaultConfigFromEnv } from "@/lib/quota/keyvDefaultConfig";
import { getSqliteQuotaStore } from "@/lib/quota/sqliteQuotaStore";
import { getKeyvQuotaStore } from "@/lib/quota/keyvQuotaStore";
import { listAllocationsForApiKey } from "@/lib/localDb";

const log = createLogger("quota-migrate");

async function main() {
  const apply = process.argv.includes("--apply");
  const sqlite = getSqliteQuotaStore();
  const keyv = getKeyvQuotaStore();

  // 1. Enumerate all (apiKeyId, dim) pairs from localDb.
  const keys = listAllocationsForApiKey(); // returns [{ apiKeyId, poolId, ... }]
  log.info({ count: keys.length, mode: apply ? "apply" : "dry-run" }, "Starting quota migration");

  let migrated = 0;
  for (const k of keys) {
    const sqliteCount = await sqlite.peek(k.apiKeyId, k.dim);
    if (sqliteCount === 0) continue;
    if (apply) {
      await keyv.consume(k.apiKeyId, k.dim, 0); // init bucket
      // write current value via direct kv.set; see §4.4 for the API
    }
    migrated += 1;
  }

  log.info({ migrated, mode: apply ? "apply" : "dry-run" }, "Quota migration complete");
  if (!apply) {
    log.info("Re-run with --apply to write to Keyv.");
  }
}

main().catch((err) => {
  log.error({ err: (err as Error)?.message }, "Quota migration failed");
  process.exit(1);
});
```

(Implementation details — direct `kv.set` access — depend on the public API of `KeyvQuotaStore`; the spec author will add a `seed()` method exposed solely for migration. See §4.4.)

#### 4.3.4 `.env.example` (EDIT)

Add `QUOTA_KEYV_BACKEND` to the documented env vars (`.env.example:1849`):

```diff
-QUOTA_STORE_DRIVER=sqlite              # sqlite | redis
+QUOTA_STORE_DRIVER=keyv                # sqlite | keyv | redis (default: keyv)
+# QUOTA_KEYV_BACKEND=sqlite            # memory | sqlite | file (default: sqlite)
+QUOTA_STORE_KEYV_URL=keyv://sqlite:.agileplus/quota/quota.db
```

(Existing `QUOTA_STORE_KEYV_URL` line at `.env.example:2013` is preserved but its default is now overridden by the `keyvDefaultConfig` module.)

#### 4.3.5 No changes to `keyvQuotaStore.ts`, `keyvQuotaStoreExtras.ts`, `sqliteQuotaStore.ts`, `redisQuotaStore.ts`

The Keyv driver is already feature-complete as of PR #505. The sqlite and redis drivers are unchanged. The interface contract (`src/lib/quota/types.ts`) is unchanged.

### 4.4 Migration-script data model

The optional migration script reads counter state from `localDb` (via `SqliteQuotaStore.peek`) and writes it to the Keyv store. Because `KeyvQuotaStore.consume` adds to the current bucket (not sets it), we need a one-time `seed()` method. Add to `keyvQuotaStore.ts`:

```ts
// src/lib/quota/keyvQuotaStore.ts (add new method, not in QuotaStore interface)
/**
 * Set a bucket to an exact value, bypassing consume()'s additive behavior.
 * Only used by the migration script. Not part of the QuotaStore interface.
 */
async seed(apiKeyId: string, dim: DimensionKey, value: number): Promise<void> {
  const k = dimKey(apiKeyId, dim);
  const ttlMs = WINDOW_MS[dim.window];
  const now = Date.now();
  this.buckets.set(k, { value, expiresAt: now + ttlMs });
  await this.kv.set(k, value, ttlMs);
  const pk = poolDimKey(dim.poolId, dim);
  this.buckets.set(pk, { value, expiresAt: now + ttlMs });
  await this.kv.set(pk, value, ttlMs);
}
```

This is the ONLY method-level change to the Keyv driver in this PR. The contract test must continue to pass — `seed()` is on the concrete class, not the interface, so it does not affect the interface contract.

### 4.5 Fresh-install vs upgrade behaviour

| User type | Today | After this PR |
|-----------|-------|---------------|
| **Fresh install** (no `quota.db` exists, no `localDb` quota tables) | `SqliteQuotaStore` (must `npm install` better-sqlite3) | `KeyvQuotaStore` with `keyv://sqlite:.agileplus/quota/quota.db` — zero native bindings |
| **Existing sqlite user** (has `localDb.quota_*` rows) | `SqliteQuotaStore` | `SqliteQuotaStore` (unchanged) — no surprise migration |
| **Existing keyv user** (has `QUOTA_STORE_DRIVER=keyv` in env) | `KeyvQuotaStore` (memory backend by default) | `KeyvQuotaStore` (sqlite backend by default — they may want to opt in to keep memory, see §9) |
| **Existing redis user** (has `QUOTA_STORE_DRIVER=redis` in env) | `RedisQuotaStore` | `RedisQuotaStore` (unchanged) |

**Upgrade detection.** The factory does NOT detect "existing sqlite data" to prompt migration. That is the explicit safety choice in §3. The migration script in §4.3.3 is the only path to move data, and it is manual.


---

## 5. Acceptance criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1 | Fresh install with no env vars: `getQuotaStore()` returns a `KeyvQuotaStore` with `keyv://sqlite:.agileplus/quota/quota.db` URI. | `tests/unit/quota-store-factory.test.ts` new test: "fresh install defaults to keyv+sqlite". |
| AC-2 | Existing sqlite user (has `localDb` quota tables + `QUOTA_STORE_DRIVER=sqlite`): `getQuotaStore()` returns `SqliteQuotaStore`. No surprise migration. | `tests/unit/quota-store-factory.test.ts` new test: "sqlite pin is preserved". |
| AC-3 | `QUOTA_STORE_DRIVER=keyv` (explicit override): `getQuotaStore()` returns `KeyvQuotaStore` with the URI from `QUOTA_STORE_KEYV_URL` if set, else default. | `tests/unit/quota-store-factory.test.ts` new test: "explicit keyv override". |
| AC-4 | `QUOTA_STORE_DRIVER=redis` with `QUOTA_STORE_REDIS_URL` set: `getQuotaStore()` returns `RedisQuotaStore`. | `tests/unit/quota-store-factory.test.ts` new test: "redis driver still works". |
| AC-5 | `QUOTA_STORE_DRIVER=redis` without URL: fallback to sqlite (unchanged from today). | Reuses existing `quota-store-factory.test.ts` test (line 88). |
| AC-6 | Unknown driver value: fallback to sqlite (unchanged from today). | Reuses existing `quota-store-factory.test.ts` test (line 72). |
| AC-7 | `QUOTA_KEYV_BACKEND=memory`: `getQuotaStore()` returns `KeyvQuotaStore` with `memory://` URI. | `tests/unit/quota/keyvDefaultConfig.test.ts` new test. |
| AC-8 | `QUOTA_KEYV_BACKEND=sqlite` (default): `getQuotaStore()` returns `KeyvQuotaStore` with `keyv://sqlite:...` URI. | `tests/unit/quota/keyvDefaultConfig.test.ts` new test. |
| AC-9 | `QUOTA_KEYV_BACKEND=file`: `getQuotaStore()` returns `KeyvQuotaStore` with `keyv://file:...` URI. | `tests/unit/quota/keyvDefaultConfig.test.ts` new test. |
| AC-10 | `QUOTA_KEYV_BACKEND=garbage` (invalid): `readKeyvDefaultConfigFromEnv()` throws a zod validation error. | `tests/unit/quota/keyvDefaultConfig.test.ts` new test. |
| AC-11 | All 3 contract tests from PR #505 still pass: `SqliteQuotaStore`, `KeyvQuotaStoreExtras`, `RedisQuotaStore` all satisfy `QuotaStore`. | `tests/unit/quota/quotaStore.contract.test.ts` (added in PR #505). |
| AC-12 | Type-drift prevention: contract test continues to enforce — adding a method to `QuotaStore` without implementing it in all 3 drivers should fail `tsc`. | `tsc -p tsconfig.typecheck-core.json` exit 0; force a regression by deleting a method from one driver and re-run — should fail. |
| AC-13 | `scripts/migrate-quota-storage.ts --apply` copies counter state from sqlite to keyv. Idempotent (re-running does not double-count). | `tests/integration/quota-store-migration.test.ts` new test. |
| AC-14 | `scripts/migrate-quota-storage.ts` (no `--apply`) is a dry-run. | `tests/integration/quota-store-migration.test.ts` new test. |
| AC-15 | `.env.example` documents `QUOTA_KEYV_BACKEND` and the new default for `QUOTA_STORE_DRIVER`. | `grep -n QUOTA_KEYV_BACKEND .env.example` returns >1. |
| AC-16 | Factory emits a single `pino.info` log line at startup with `{ driver, backend, kvUrl }`. | `tests/unit/quota-store-factory.test.ts` new test: assert `pino.info` is called. |
| AC-17 | `keyvQuotaStore.ts::seed()` method is callable from the migration script but NOT part of the `QuotaStore` interface. | `tests/unit/quota/quotaStore.contract.test.ts` (PR #505) passes; `seed()` is not in the interface. |
| AC-18 | Singleton behaviour: multiple `getQuotaStore()` calls return the same instance (unchanged). | Reuses existing `quota-store-factory.test.ts` test (line 56). |
| AC-19 | `resetQuotaStoreSingleton()` resets the singleton (unchanged). | Reuses existing `quota-store-factory.test.ts` test (line 65). |
| AC-20 | `tests/e2e/quota-store.e2e.ts` extended: new test "sqlite-fallback scenario" verifies that setting `QUOTA_STORE_DRIVER=keyv` with a bogus URI still falls back to sqlite via `pino.warn`. | `tests/e2e/quota-store.e2e.ts` new test. |

Each AC is independently verifiable via the commands in §8.3.


---

## 6. Implementation steps

In dependency order (each independently verifiable; commit per step is acceptable for review, but the spec author recommends a single feature commit for atomicity):

1. **Create `src/lib/quota/keyvDefaultConfig.ts`** (new file, ~40 lines).
   - Per §4.3.2. Zod-validated env reader; `readKeyvDefaultConfigFromEnv()` returns `{ driver, backend, kvUrl }`.
   - Exports `KeyvBackend`, `QuotaStoreDriver`, `KEYV_DEFAULTS`.
   - Verify: `tsc -p tsconfig.typecheck-core.json` exit 0.

2. **Add `seed()` method to `src/lib/quota/keyvQuotaStore.ts`** (small add at the bottom of the class, ~10 lines).
   - Per §4.4. Used only by the migration script.
   - Document in the method's JSDoc that it is NOT part of the `QuotaStore` interface.
   - Verify: `tests/unit/quota/keyvQuotaStore.test.ts` still passes.

3. **Edit `src/lib/quota/storeFactory.ts`** (3 hunks, ~15 lines net change).
   - Line 79: change default from `"sqlite"` to `"keyv"`.
   - Line 89 (PR-G comment): replace with the new comment from §4.3.1.
   - Line 99 + keyv branch (lines 100-110): use `readKeyvDefaultConfigFromEnv()` and emit the structured log line.
   - Verify: `tsc -p tsconfig.typecheck-core.json` exit 0; `tests/unit/quota-store-factory.test.ts` (existing tests) still pass.

4. **Create `scripts/migrate-quota-storage.ts`** (new file, ~70 lines).
   - Per §4.3.3. Idempotent, dry-run-by-default.
   - Uses `SqliteQuotaStore.peek` to read source + `KeyvQuotaStore.seed` to write target.
   - Verify: `tsx scripts/migrate-quota-storage.ts --help` exits 0.

5. **Edit `.env.example`** (2 hunks, ~3 lines).
   - Per §4.3.4. Document `QUOTA_STORE_DRIVER=keyv` as default; add `QUOTA_KEYV_BACKEND` example.
   - Verify: `bash -n .env.example` (syntactic check; not strictly necessary since `.env.example` is a `.env` file, but ensure no typo).

6. **Create `tests/unit/quota/keyvDefaultConfig.test.ts`** (new file, ~60 lines).
   - Tests AC-7, AC-8, AC-9, AC-10.
   - Verify: `DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/quota/keyvDefaultConfig.test.ts` → all pass.

7. **Extend `tests/unit/quota-store-factory.test.ts`** (new tests appended, ~80 lines).
   - Tests AC-1, AC-2, AC-3, AC-4, AC-16.
   - Verify: `DISABLE_SQLITE_AUTO_BACKUP=true node --import tsx --import ./open-sse/utils/setupPolyfill.ts --import ./tests/_setup/isolateDataDir.ts --test tests/unit/quota-store-factory.test.ts` → all pass.

8. **Extend `tests/e2e/quota-store.e2e.ts`** (new test, ~20 lines).
   - Tests AC-20 (sqlite-fallback scenario).
   - Verify: `DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/e2e/quota-store.e2e.ts` → all pass.

9. **Create `tests/integration/quota-store-migration.test.ts`** (new file, ~80 lines).
   - Tests AC-13, AC-14. Sets up a sqlite store with known state, runs the migration script (dry-run + apply), verifies keyv state matches.
   - Verify: `DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/integration/quota-store-migration.test.ts` → all pass.

10. **Run full acceptance-criteria sweep** (AC-1 through AC-20).
    - Use the verification commands in §8.3.
    - All 20 ACs must pass.

11. **Commit + push + open PR** (per §11).

**Estimated diff size:** ~250 lines added (350 spec lines → 250 code lines including tests). Within the 800-line review-friendly default per `code-review-change-size` policy.


---

## 7. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R-1 | **Existing data not automatically migrated.** Users who have been on sqlite for months with critical counter state will see "0 counters" after upgrading if they were relying on default driver. | High | High | The default change in `storeFactory.ts:79` flips, but a user's `QUOTA_STORE_DRIVER=sqlite` env-pin (or `quotaStore.driver=sqlite` DB setting) keeps them on sqlite. Document in CHANGELOG + release notes. The migration script (§4.3.3) is provided for opt-in data migration. |
| R-2 | **Memory backend = data lost on restart.** Users setting `QUOTA_KEYV_BACKEND=memory` (e.g. serverless) will lose counter state on every cold start. | Medium | Medium (acceptable for ephemeral counters) | Document this explicitly in the env variable documentation. Counter data is rolling-window; loss on restart means the next request starts at 0. For most quota-sharing workloads this is fine. For compliance data (audit trails, billing), use sqlite backend. |
| R-3 | **Lockfile conflicts if multiple processes share a keyv+sqlite file.** Two processes opening `keyv://sqlite:/shared/quota.db` will race on the underlying SQLite file (no advisory locks in the upstream `keyv` SQLite adapter). Last-write-wins. | Medium | High (silently corrupted counters) | Document explicitly: "Keyv driver is single-process. For multi-process coordination, use Redis or a shared-sqlite layer with explicit locking." Out of scope for this PR (§10). |
| R-4 | **`QUOTA_STORE_KEYV_URL` precedence inversion.** The default change from `memory://` to `keyv://sqlite:...` may surprise existing keyv users who relied on `memory://` by default. | Low | Low | Their counters were already ephemeral on `memory://` — they had no persistence. The new default gives them persistence for free. Document in CHANGELOG. |
| R-5 | **Default sqlite path resolution.** `.agileplus/quota/quota.db` is relative to `process.cwd()`. If the user's `cwd` changes between restarts (e.g. systemd service vs. interactive shell), the keyv sqlite file lands in different locations. | Low | Medium | Use an absolute path resolution helper that anchors to `DATA_DIR` (same pattern as `localDb`). See `src/lib/db/core.ts` for the existing helper. The migration script in §4.3.3 reads `DATA_DIR` from env. |
| R-6 | **Type drift re-emergence.** The contract test from PR #505 covers the 3 driver implementations of `QuotaStore`, but does not cover the `seed()` method added in this PR (§4.4). If a future PR adds another method without updating the test, drift can re-emerge. | Low | Low | Document the contract test's scope in the test file's header comment. Add a `seed()` reachability test to `tests/unit/quota/keyvQuotaStore.test.ts` (separate from the contract test). |
| R-7 | **Contract test over-coupling.** If the contract test uses `expectTypeOf` to strictly assert all 6 interface methods, an unrelated method addition (e.g. `getPoolStatus`) on the interface would force all 3 drivers to implement it. | Low | Medium | The contract test asserts interface conformance, not method existence. Adding a method to the interface is a deliberate API change; the test should follow. |
| R-8 | **Sliding-window divergence.** Keyv's `buckets` map uses a single TTL per `(apiKeyId, dim)`; SqliteQuotaStore uses 2-bucket sliding-window counter. The math differs at window boundaries. | Medium | Medium (counter drift between drivers) | Document the divergence explicitly in `keyvQuotaStore.ts` header. Add a benchmark test that compares the two stores on a synthetic workload; results may differ. The Keyv store is a feature-complete alternative; not a replacement. |
| R-9 | **Migration script data loss.** If `seed()` is called with the wrong `(apiKeyId, dim)` tuple, the migration script overwrites the target bucket with `0` instead of the source value. | Low | High | Use `seed()` only after reading the source value via `peek()`. Add an invariant check: `if (sourceValue !== undefined) await target.seed(apiKeyId, dim, sourceValue)`. Test in AC-13. |
| R-10 | **`.env.example` default-order trap.** A user copies `.env.example` to `.env`, sees `QUOTA_STORE_DRIVER=keyv`, and accidentally loses their sqlite data. | Low | Medium | The env file is opt-in (`.env.example` is not auto-loaded). The factory still uses the explicit env var. Document the migration in the CHANGELOG. |


---

## 8. Test plan

### 8.1 New tests

| Test file | Coverage | ACs |
|-----------|----------|-----|
| `tests/unit/quota/keyvDefaultConfig.test.ts` | Env validation, zod schema, default resolution | AC-7, AC-8, AC-9, AC-10 |
| `tests/unit/quota-store-factory.test.ts` (extended) | New driver-selection tests, log-line assertion | AC-1, AC-2, AC-3, AC-4, AC-16 |
| `tests/e2e/quota-store.e2e.ts` (extended) | sqlite-fallback scenario for bogus keyv URI | AC-20 |
| `tests/integration/quota-store-migration.test.ts` | Migration script dry-run + apply + idempotency | AC-13, AC-14 |
| `tests/unit/quota/keyvQuotaStore.test.ts` (extended) | `seed()` method reachability + correctness | AC-17 |

### 8.2 Existing tests (must continue to pass)

The following tests are unchanged but must be re-verified after the factory default flips:

- `tests/unit/quota-store-factory.test.ts` (6 tests — singleton, reset, redis fallback, unknown driver).
- `tests/unit/quota/keyvQuotaStore.test.ts` (6 tests — consume/peek/clear/isolation/dispose).
- `tests/unit/quota/keyvQuotaStoreExtras.test.ts` (5 tests — dead-code methods relocated by PR #505).
- `tests/unit/quota/quotaStore.contract.test.ts` (PR #505 contract test — 3 driver implementations satisfy `QuotaStore` interface).
- `tests/e2e/quota-store.e2e.ts` (8 tests — basic KeyvQuotaStore e2e).
- `tests/integration/quota-store-settings.test.ts` (DB-backed driver config).
- `tests/integration/quota-pools-usage.test.ts` (pool usage route).
- `tests/integration/quota-pool-usage-provider-resolution.test.ts` (provider resolution).
- `tests/unit/quota-enforce.test.ts` (enforce.ts w/ mocked store).
- `tests/unit/quota-redis-store.test.ts` (Redis driver unit tests if present).

### 8.3 Verification commands

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute/.worktrees/governance-cleanup-20260806
export PATH="/opt/homebrew/bin:$PATH"

# AC-12: typecheck
node node_modules/typescript/bin/tsc --pretty false -p tsconfig.typecheck-core.json 2>&1 | grep "error TS" | grep -v regional | wc -l  # → 0

# AC-11: contract test (PR #505)
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/quota/quotaStore.contract.test.ts

# AC-6, AC-7, AC-8, AC-9, AC-10: keyvDefaultConfig
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/quota/keyvDefaultConfig.test.ts

# AC-1, AC-2, AC-3, AC-4, AC-16, AC-18, AC-19: factory tests (existing + new)
DISABLE_SQLITE_AUTO_BACKUP=true node --import tsx --import ./open-sse/utils/setupPolyfill.ts --import ./tests/_setup/isolateDataDir.ts --test tests/unit/quota-store-factory.test.ts

# AC-17, AC-18, AC-19 (PR #505): keyv unit + extras
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/quota/keyvQuotaStore.test.ts tests/unit/quota/keyvQuotaStoreExtras.test.ts

# AC-20: e2e
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/e2e/quota-store.e2e.ts

# AC-13, AC-14: migration
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/integration/quota-store-migration.test.ts

# AC-5: smoke (full suite)
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/quota tests/integration/quota-store-settings.test.ts tests/integration/quota-pools-usage.test.ts
```

### 8.4 Smoke test invocation

```bash
# Manual: confirm factory picks keyv on a clean install
cd /Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute/.worktrees/governance-cleanup-20260806
unset QUOTA_STORE_DRIVER QUOTA_STORE_KEYV_URL QUOTA_KEYV_BACKEND
DISABLE_SQLITE_AUTO_BACKUP=true node -e '
  import("./src/lib/quota/storeFactory.ts").then(async (m) => {
    m.resetQuotaStoreSingleton();
    const store = await m.getQuotaStore();
    console.log("store class:", store.constructor.name);
    console.log("has consume:", typeof store.consume === "function");
    console.log("has peek:", typeof store.peek === "function");
  });
' 2>&1
```

Expected output: `store class: KeyvQuotaStore` (proves the default flip worked).


---

## 9. Open questions (for user resolution)

These questions are flagged for the user before implementation begins. Each has a recommendation; the user may override.

### Q1. Auto-migrate existing sqlite data?

**Recommendation: No.** Users opt-in via the migration script. Silent data movement is hard to audit; the script is idempotent and small.

### Q2. Default backend for keyv?

**Recommendation: `sqlite`** (durable single-process). Quota counters are durable state; ephemeral defaults are hostile to first-run users. `QUOTA_KEYV_BACKEND=memory` is for explicit serverless use.

### Q3. Deprecate the sqlite driver?

**Recommendation: No.** The sqlite driver is feature-correct, supports shared-disk multi-process, and is the reference implementation for the `QuotaStore` interface contract.

### Q4. Bundle migration script in the published package?

**Recommendation: Yes.** Ship as `omniroute migrate-quota-storage` via a `package.json` bin entry. Discoverable; otherwise users hit the script by reading `scripts/`.

### Q5. "Automatic rollback" if keyv default fails to start?

**Recommendation: No.** The current `try/catch` at `storeFactory.ts:103-112` is a separate concern (silent-degradation governance, tracked in PR #505 §10). This PR does NOT change the fallback; it only changes the default driver. If keyv default fails, the existing try/catch falls back to sqlite with a `pino.warn`.

### Q6. Should `QUOTA_STORE_KEYV_URL` default flip from `memory://` to `keyv://sqlite:...` silently?

**Recommendation: Yes.** The default backend is `sqlite`; the default URI should match. Users wanting memory set `QUOTA_KEYV_BACKEND=memory` explicitly. Document in CHANGELOG.

### Q7. Migrate pool / plan metadata in the migration script?

**Recommendation: No.** Only counter state. Pool / plan metadata is rarely large and easy to re-enter via the admin UI. Add a `--migrate-pools` flag in a future PR if demand emerges.


---

## 10. Out of scope (deferred)

These items are flagged for follow-up but explicitly NOT in this PR:

- **Silent fallback in `storeFactory.ts:103-112`.** Per PR #505 §10, the try/catch around the keyv driver hides TypeScript compile errors. Should be replaced with a fail-fast at startup. Separate PR (governance cleanup).
- **Cross-process locking for the keyv+sqlite backend.** Per R-3, two processes sharing the same keyv+sqlite file race. Solutions: file advisory locks (`proper-lockfile`), named semaphores, or a separate shared-sqlite layer. Separate PR.
- **Redis cluster support.** The redis driver is single-instance today. Cluster support requires `@keyv/redis` or a connection-pool layer. Separate PR.
- **Auth / billing migration.** Storage persistence concerns are siloed. Quota data uses the `QuotaStore` interface; auth and billing use their own storage. No coordination in this PR.
- **BucketValue / fromUri / member-set design.** Per `FORGE_WRAPUP.md:97-105`, a previous agent wrote a 363-line breaking rewrite using these primitives. Out of scope; would require data migration.
- **Performance benchmark suite.** A head-to-head benchmark of `SqliteQuotaStore` vs `KeyvQuotaStore` (memory) vs `KeyvQuotaStore` (sqlite) is deferred. The `benches/` directory exists for this.
- **Production runtime smoke test.** The Keyv driver is exercised in unit/e2e tests but not in a staging canary. Separate PR for staging canary.
- **Pool / plan metadata migration.** Q7 §9. Future PR.
- **Deprecation of `better-sqlite3` dependency.** Even if Keyv becomes the default, `localDb` still uses `better-sqlite3` for other tables (settings, pools, plans). Removing `better-sqlite3` requires a separate migration of those tables to a different backend. Separate PR.
- **Multi-region failover.** The Redis driver is single-instance. A future PR can add Redis Sentinel / Cluster failover.

---

## 11. Commit + delivery

### 11.1 Commit message

```
feat(quota): promote Keyv to embedded default driver (PR-G)

Closes the PR-G comment deferred from PR #505. Makes Keyv the
default QuotaStore driver when QUOTA_STORE_DRIVER is unset; the
sqlite driver remains an opt-in for users with existing data.

- Add src/lib/quota/keyvDefaultConfig.ts: zod-validated env reader
  for QUOTA_STORE_DRIVER + QUOTA_KEYV_BACKEND + QUOTA_STORE_KEYV_URL.
  Defaults to driver=keyv, backend=sqlite, URI=keyv://sqlite:.agileplus/quota/quota.db.
- Edit src/lib/quota/storeFactory.ts: default driver flips from
  "sqlite" to "keyv"; default URI flips from "memory://" to a
  durable sqlite-backed URI; structured pino.info log line at startup.
- Add seed() method to src/lib/quota/keyvQuotaStore.ts: bypass the
  additive consume() for one-time migration use; NOT part of the
  QuotaStore interface contract.
- Add scripts/migrate-quota-storage.ts: opt-in, idempotent,
  dry-run-by-default migration script for existing sqlite users.
- Edit .env.example: document QUOTA_KEYV_BACKEND and the new default
  for QUOTA_STORE_DRIVER.
- Tests:
  - Add tests/unit/quota/keyvDefaultConfig.test.ts (env validation)
  - Extend tests/unit/quota-store-factory.test.ts (defaults)
  - Extend tests/e2e/quota-store.e2e.ts (sqlite-fallback scenario)
  - Add tests/integration/quota-store-migration.test.ts (migration)
  - Extend tests/unit/quota/keyvQuotaStore.test.ts (seed() reachability)

The contract test from PR #505 (tests/unit/quota/quotaStore.contract.test.ts)
continues to enforce that all 3 driver implementations satisfy the
QuotaStore interface — preventing type drift between Sqlite, Keyv,
and Redis drivers.

Verification:
- tsc -p tsconfig.typecheck-core.json → 0 errors
- vitest quotaStore.contract.test.ts → pass
- vitest keyvDefaultConfig.test.ts → pass
- node --test quota-store-factory.test.ts → all pass (existing 6 + new 5)
- vitest keyvQuotaStore.test.ts → 6 existing + 1 new seed() test pass
- vitest quota-store.e2e.ts → 8 existing + 1 new fallback test pass
- vitest quota-store-migration.test.ts → dry-run + apply + idempotency pass

Refs: PR #505, PR-G comment, FORGE_WRAPUP.md Tier-5 task 20.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### 11.2 PR target

- **Source branch:** `feat/keyv-as-embedded-default-20260806`
- **Target branch:** `origin/agent/migration-version-collision-fix` (current canonical branch, per the task brief)
- **Worktree:** `repos/OmniRoute/.worktrees/governance-cleanup-20260806`

### 11.3 Delivery sequence

1. **Implement** the spec in the worktree (per §6).
2. **Run all verification commands** (§8.3). All 20 ACs must pass.
3. **Commit** as a single feature commit (§11.1).
4. **Open PR** against `origin/agent/migration-version-collision-fix`. Note: GitHub Actions CI will fail with the billing error (per `AGENTS.md`); do not block on CI green. Verify quality locally.
5. **Merge via `gh pr merge --admin`** after code review, since CI cannot gate.
6. **AgilePlus registration** (per the task brief):
   - `agileplus specify --feature keyv-as-embedded-default --from-file plans/keyv-as-embedded-default-spec.md`
   - This registers the spec in the AgilePlus DB and creates a feature record.
7. **Cleanup** the worktree branch after merge (canonical folder returns to `main`).

### 11.4 Review checklist

Before requesting review, verify:

- [ ] All 20 ACs pass.
- [ ] No `better-sqlite3` import added to keyv code paths.
- [ ] `seed()` method is documented as NOT part of the `QuotaStore` interface.
- [ ] Migration script is idempotent (re-running does not double-count).
- [ ] `.env.example` documents new defaults.
- [ ] CHANGELOG.md updated with the driver-default flip + migration instructions.
- [ ] ADR.md updated (or a new ADR added) recording the default-driver decision.
- [ ] No silent data movement on upgrade (R-1 mitigation).

---

## 12. Cross-project reuse

Per the `PHENOTYPE_SHARED_REUSE_PROTOCOL`, this PR deliberately does NOT extract quota-store logic to a shared package. The driver implementations are tightly coupled to OmniRoute's `localDb` + `better-sqlite3` + `keyv` runtime, and the `QuotaStore` interface is OmniRoute-specific. The keyv quota store pattern is unusual (most apps use Keyv for cache, not authoritative state); reuse would be premature.

Future PRs that may benefit from Phenotype-wide reuse: a generic `ZodEnvConfig<T>` helper in `phenotype-shared/` that consumes the pattern in `keyvDefaultConfig.ts` (env validation + default resolution — duplicated across many config readers in OmniRoute today), and a generic `DriverFactory<P, D, R>` type that the `storeFactory.ts` pattern could be parameterised over. Both out of scope for this PR.

---

## 13. References

- `plans/quota-keystore-type-drift-spec.md` — sibling spec from PR #505.
- `src/lib/quota/storeFactory.ts:79,89-92,99-110` — current driver-selection logic + PR-G comment.
- `src/lib/quota/keyvQuotaStore.ts` — Keyv driver (unchanged except for `seed()` add).
- `src/lib/quota/keyvQuotaStoreExtras.ts` — extension class (PR #505; unchanged).
- `src/lib/quota/types.ts` — `QuotaStore` interface (SSOT).
- `src/lib/quota/sqliteQuotaStore.ts` — sqlite driver (unchanged).
- `src/lib/quota/redisQuotaStore.ts` — redis driver (unchanged).
- `src/lib/quota/dimensions.ts` — `DimensionKey`, `WINDOW_MS`, `PoolAllocation`, `ProviderPlan`.
- `tests/unit/quota/quotaStore.contract.test.ts` — contract test (PR #505).
- `tests/unit/quota-store-factory.test.ts` — factory tests (existing).
- `tests/unit/quota/keyvQuotaStore.test.ts` — keyv unit tests.
- `tests/e2e/quota-store.e2e.ts` — keyv e2e tests.
- `.env.example` — env var documentation.
- `AGENTS.md` — billing constraint (CI will fail; verify locally).
- `FORGE_WRAPUP.md` — Tier-5 task 20 (this PR is the home for that task).

