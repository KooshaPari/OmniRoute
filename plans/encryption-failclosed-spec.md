# Encryption Fail-Closed Hardening — Spec

**Feature slug:** `encryption-failclosed`
**Branch:** `fix/encryption-failclosed-20260805`
**Worktree:** `repos/OmniRoute/.worktrees/governance-cleanup-20260806`
**Base branch:** `origin/agent/migration-version-collision-fix`
**Status:** Draft — pending user approval before implementation
**Author:** droid session 2026-08-06
**Related PRs:** #505 (type-drift), #506 (decrypt catch), #507 (F3/F4 follow-up — F4 shipped in #508, F3 deferred to this PR), #508 (F4 shipped), F3 follow-up deferred by PR #507 with the rationale "*the fix could break callers that don't expect throws*".

---

## 1. Problem statement

`src/lib/db/encryption.ts` is the field-level encryption helper for all sensitive OmniRoute data (provider API keys, OAuth tokens, ID tokens) at rest in SQLite. The module declares in its header that *"If STORAGE_ENCRYPTION_KEY is not set, operates in passthrough mode (stores plaintext for development convenience)"* — and that intentional passthrough mode is fine and documented. However, the `encrypt()` implementation today has **two** behavioural states that produce plaintext output, and the second one is a HIGH-RISK silent failure that is **not** what the AGENTS.md / file header promise.

### State A — Intentional passthrough (lines 119-124)

```ts
const key = getStaticKey();
if (!key) {
  console.warn(
    "[Encryption] STORAGE_ENCRYPTION_KEY not set. Storing plaintext (passthrough mode)."
  );
  return plaintext; // passthrough mode
}
```

This is the documented behaviour for the development convenience case where an operator has not configured a key. It is observable (logs `console.warn`), it is intentional, and it is the contract that `isEncryptionEnabled() === false` callers (`decryptConnectionFields`, `encryptConnectionFields`) rely on.

### State B — Silent failure fallback (lines 137-145)

```ts
try {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${PREFIX}${iv.toString("hex")}:${encrypted}:${authTag}`;
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    `[Encryption] Encryption failed: ${message}. ` +
      `Check your STORAGE_ENCRYPTION_KEY — generate one with: openssl rand -base64 32`
  );
  return plaintext; // fallback to plaintext rather than crashing
}
```

This is the dangerous one. State B fires when `STORAGE_ENCRYPTION_KEY` **is** configured but the crypto pipeline throws (e.g., `randomBytes` returning a short buffer on a broken OpenSSL build, `createCipheriv` rejecting a derived key whose length drifts after a Node upgrade, native-binding DLOPEN half-failure, OOM). The catch returns the plaintext with a generic `console.error`. The caller — `encryptConnectionFields()` in `core.ts:348`/`providers.ts:544` — happily stores the plaintext in `provider_connections.api_key`, `provider_connections.access_token`, etc. There is no test that detects this regression. There is no opt-out. There is no way for the operator to know that "encryption was supposed to be active" has been silently downgraded to "passthrough mode".

### Why these two states get conflated

Today, both states return the same value (`plaintext`) at the same call site. From the caller's perspective the contract is *"I call `encrypt()`, I get something back, I write it to the DB."* The caller cannot tell whether encryption was attempted and failed or never attempted at all. The pre-existing audit (F3 in PR #507) called this out as the highest-priority deferred item: *"the fix could break callers that don't expect throws"*. We need a fix that preserves State A (dev convenience) and eliminates State B (silent data loss).

### Threat model

State B is exploitable in three scenarios:

1. **Operator misconfiguration** — A 4-character base64 "key" is set as a placeholder in `.env` for someone to overwrite later; the key passes `typeof === "string" && trim().length > 0` but `scryptSync` may technically succeed on a weak secret while downstream `randomBytes` (under memory pressure) throws. The plaintext goes to disk.
2. **Post-mortem key rotation** — Operator revokes a key in the secrets manager; `getStaticKey()` returns a cached old key from `_staticKey`, but on next deploy `randomBytes` works on a new Node ABI and `createCipheriv` rejects the cached old key length. Plaintext is stored.
3. **Native binding rot** — A Node upgrade breaks `randomBytes()`'s native path; the catch swallows it. Writes succeed; reads fail later (decrypt returns `null` because there's no cipher to read from).

In all three cases the system loses confidentiality of API keys and OAuth tokens **without raising an operator-actionable alert**, and **without any test catching the regression**. This violates Phenotype's "fail loudly on missing required dependencies; no silent degradation or optional fallbacks" (`Phenotype/AGENTS.md` safety rules) and the encryption-agreement in `src/lib/db/AGENTS.md` ("*Never log SQLite encryption keys or raw secrets; always use redacted values in logs*" — closely related; an operator who doesn't know the encryption layer is broken is operating on incorrect assumptions).

The fix must be **fail-closed**: when encryption was SUPPOSED to be active (State B conditions), the function must refuse to return plaintext and must instead make the broken state observable and recoverable. State A — the dev convenience of "no key, no encryption" — must be preserved untouched, because removing it would break the local-dev workflow that the file header explicitly endorses.

---

## 2. Goals

1. **No silent plaintext storage when encryption was supposed to be active.** When `STORAGE_ENCRYPTION_KEY` is set and `getStaticKey()` returns a non-null key, a downstream failure in `randomBytes` / `createCipheriv` / `cipher.update` / `cipher.final` / `cipher.getAuthTag` MUST NOT result in the plaintext being returned to the caller.
2. **Preserve intentional passthrough (State A).** When `STORAGE_ENCRYPTION_KEY` is unset, empty, or whitespace-only, `encrypt(plaintext)` continues to return `plaintext` unchanged. This is the contract documented in the file header and `AGENTS.md`. No regression.
3. **Make broken state operator-actionable.** When the chosen option fires its error path, the operator must see, in the structured log, *which* call failed, *with which key id*, and *at what timestamp*. The error must include a remediation hint (e.g., "regenerate `STORAGE_ENCRYPTION_KEY` with `openssl rand -base64 32` and restart").
4. **Avoid cascading test failures.** Existing tests in `tests/unit/encryption.spec.ts`, `tests/unit/db/encryption-error-handling.test.mjs`, and the integration tests that call `encryptConnectionFields` must continue to pass without per-file changes (other than extending the chosen option's fault-injection tests).
5. **Distinguish State A from State B observably.** The chosen option must make State A and State B externally distinguishable so that future audits can detect "encryption is configured but still writing plaintext" regressions.
6. **Throw or mark-broken, never swallow.** The chosen option is one of A/B/C (§4). Whichever is picked, `console.error`+return-plaintext is forbidden as the runtime behaviour for State B.

---

## 3. Non-goals

Explicitly NOT in this PR:

- **Not changing the encryption algorithm.** AES-256-GCM with 16-byte IV, 32-byte key, 16-byte auth tag stays. The `_staticKey` derivation (`scryptSync` with the static salt `"omniroute-field-encryption-v1"`) stays.
- **Not migrating existing data.** Even if a deployment has tokens encrypted under State B (plaintext-but-prefix-looks-encrypted), this PR does not attempt to detect or rewrite them. That is a separate work item (`/Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute/.worktrees/governance-cleanup-20260806/plans/encryption-legacy-ciphertext-migration.md` TBD — out of scope).
- **Not changing the key derivation function.** The `scryptSync(secret, STATIC_SALT, KEY_LENGTH)` call is correct on its own; only its *error handling* is being hardened. PR #508 already shipped the analogous fix for `getLegacyDynamicKey`. This PR mirrors that pattern, it does not unify the two functions.
- **Not fixing `getStaticKey()` silent null on `scryptSync` failure** (lines 79-89). That is F4 — *already shipped in PR #508*. Touching it here would create a larger diff and a different PR-review conversation. Separate PR if a holistic refresh is needed.
- **Not changing `decrypt()`** to fail-closed. `decrypt()` already returns `null` on any failure (lines 162-200). The audit explicitly notes that decrypt is "fail-closed by returning null, but does not log loudly enough" — that is `console.error` issue, not a behaviour change. Log-only tweak, not signature change. Out of scope here.
- **Not touching `migrateLegacyEncryptedString()`** (lines 273-321). That function handles the static→legacy→static migration at startup. It already has its own try/catch boundaries per candidate key. Out of scope.
- **Not adding a feature flag.** Per §9 Q6, this is a question for the user. Default recommendation is no feature flag (the existing `omni-encryption-config-rolled-out-via-env-rollout` pattern is sufficient if the user wants one later).
- **Not changing `isEncryptionEnabled()`.** That semantic ("is the env var set?") is used by callers as a quick guard and is not the place where the State A / State B distinction lives.
- **Not extracting `encryption.ts` into `phenotype-shared/`.** Per Cross-Project Reuse, this PR is scoped to the bug fix; refactoring extracts are deferred.

---

## 4. Design

Three options are evaluated. Each is genuinely distinct in tradeoffs — not "good, better, best".

### 4.1 Option A — Throw + caller decides

**Change:** `encrypt()` throws a new typed `EncryptionRuntimeError` (extends `Error`) when `getStaticKey()` returned a non-null key but the crypto pipeline threw. The intentional passthrough (State A) still returns plaintext. The State B catch is rewritten:

```ts
// Before (lines 137-147):
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    `[Encryption] Encryption failed: ${message}. ` +
      `Check your STORAGE_ENCRYPTION_KEY — generate one with: openssl rand -base64 32`
  );
  return plaintext; // fallback to plaintext rather than crashing
}

// After (Option A):
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  log.error(
    { err: message, op: "encrypt", keyId: maskKeyId(_staticKey) },
    `[Encryption] STORAGE_ENCRYPTION_KEY is set but encrypt() failed. ` +
      `Refusing to write plaintext. Regenerate with: openssl rand -base64 32`
  );
  throw new EncryptionRuntimeError(
    `Encryption failed: ${message}. ` +
      `Refusing to write plaintext. Check STORAGE_ENCRYPTION_KEY.`,
    { cause: err }
  );
}
```

**Caller impact:**

- `encryptConnectionFields()` (lines 214-223) must wrap each `encrypt()` call site individually OR wrap once at the top. Recommended: wrap once at the top — return `null` from `encryptConnectionFields` if any field's `encrypt()` throws, log loudly. The `null` propagates to `_insertConnectionRow(db, null)` in `providers.ts:348` and `_updateConnectionRow(db, id, null)` in `providers.ts:544`, both of which would surface as a 500 to the caller — which is correct (the operator gets a visible error, not silent data loss).
- `commandCodeAuth.ts:142` (`markCommandCodeAuthSessionReceived`) — currently does `const encryptedApiKey = encrypt(input.apiKey);` and writes to DB. Must wrap in try/catch; on throw, mark the session as failed and surface a structured error.
- `migrateLegacyEncryptedString()` (line 295: `return { updated: true, value: encrypt(legacyDecrypted) }`) — must catch the throw and either return `{ updated: false, value: null }` or bubble up. Recommended: bubble up — the migration is one-shot at startup; a throw there is operator-actionable.

**Pros:**

- Most explicit. The type signature (`encrypt(): string | null`) is unchanged, but the *throws* clause is documented in JSDoc and TypeScript-introspectable.
- No silent data loss. The DB write either succeeds with ciphertext or fails loudly with a 500/exception.
- Aligns with `Phenotype/AGENTS.md` safety rule: "Fail loudly on missing required dependencies; no silent degradation or optional fallbacks."
- Test seam is straightforward — `expect(() => encrypt(x)).toThrow(EncryptionRuntimeError)`.

**Cons:**

- Breaks any caller that doesn't expect throw. Every call site in `rg -n "encrypt\(" src/lib/db/` becomes a potential `try/catch` site.
- Cascades up through `encryptConnectionFields` and into `core.ts:348,544`. The team must audit all 4 callers; each adds try/catch.
- Next.js App Router route handlers may not handle the throw gracefully — need to verify that 500 propagates to the user rather than crashing the worker.
- Tests that don't set `STORAGE_ENCRYPTION_KEY` and call `encrypt()` with a malformed scenario may need to be updated.

### 4.2 Option B — Mark-broken + quarantine

**Change:** `encrypt()` returns a tagged-union `{ value: string, broken: boolean }`. The caller must check `broken`. The intentional passthrough (State A) continues to return `string` — breaking the return type would cascade to every caller, so we keep a separate shape. Recommendation: a wrapper function `encryptSafely()` is introduced alongside the current `encrypt()`:

```ts
// New function in encryption.ts
export type EncryptResult =
  | { ok: true; value: string }
  | { ok: false; reason: "crypto-failure"; error: string };

export function encryptSafely(plaintext: string): EncryptResult {
  if (!plaintext || typeof plaintext !== "string") return { ok: true, value: String(plaintext) };

  const key = getStaticKey();
  if (!key) {
    console.warn("[Encryption] STORAGE_ENCRYPTION_KEY not set. Storing plaintext (passthrough mode).");
    return { ok: true, value: plaintext };
  }

  if (plaintext.startsWith(PREFIX)) return { ok: true, value: plaintext };

  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return { ok: true, value: `${PREFIX}${iv.toString("hex")}:${encrypted}:${authTag}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, op: "encryptSafely" }, `[Encryption] encryptSafely() refused to encrypt; returning broken result`);
    return { ok: false, reason: "crypto-failure", error: message };
  }
}
```

Existing `encrypt()` remains unchanged (it's already pinned to the plain `string` return type for backwards compatibility). New code can opt into `encryptSafely()`.

**Caller impact:**

- Existing callers of `encrypt()` are unaffected. They continue to get plaintext-on-failure (State B) — but **the call sites that import `encryptSafely()` get the marked-broken behaviour**.
- This means State B is not eliminated globally; it is only eliminated at the call sites that adopt `encryptSafely()`. The remaining `encrypt()` call sites still need to be migrated separately.
- The TypeScript signature is clean (`{ ok, value | reason, error }`), but two parallel APIs is a long-term maintenance cost.

**Pros:**

- Compatible with the existing `encrypt(): string` return type.
- Lowest test churn — existing tests don't change.
- Explicit. Each `encryptSafely()` call site has a forced `if (!result.ok) { ... }` branch.

**Cons:**

- Type signature is messy if we shoehorn both shapes into `encrypt()`. Two parallel APIs is the only clean answer.
- Each caller must remember to check `result.ok`. Forgetting the check re-introduces the bug at the call site.
- Doesn't fix State B globally — only at sites that opt in. Callers in `commandCodeAuth.ts:142`, `providers.ts:348`, `providers.ts:544` need to be migrated, but they have to be migrated *forwards*, and any missed migration is a regression.
- Naming `encryptSafely` is a code smell — the unsafe version should not exist.

### 4.3 Option C — Startup-time fail-fast + runtime panic

**Change:** Add a `validateEncryptionAtStartup()` helper that performs a full encrypt/decrypt cycle at server startup using a known test vector. If the cycle fails (or `getStaticKey()` returns null while `STORAGE_ENCRYPTION_KEY` is set), the server refuses to start. The runtime `encrypt()` is rewritten: State A (no key) returns plaintext; State B (crypto threw) calls `process.exit(1)` with a structured log message naming the failure point and (if possible) a structured `sentry.captureException`.

```ts
// New module src/lib/db/encryptionStartup.ts
import { encrypt, decrypt, isEncryptionEnabled } from "./encryption";

const CANARY_PLAINTEXT = "omniroute-startup-canary-do-not-use";

export function validateEncryptionAtStartup(): void {
  if (!isEncryptionEnabled()) {
    log.warn("[Encryption] No STORAGE_ENCRYPTION_KEY set — passthrough mode active");
    return;
  }
  let encrypted: string;
  try {
    encrypted = encrypt(CANARY_PLAINTEXT);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.fatal(
      { err: message, op: "startup-canary-encrypt" },
      `[Encryption] FATAL — STORAGE_ENCRYPTION_KEY is set but encrypt() threw at startup. ` +
        `Server refusing to start. Regenerate with: openssl rand -base64 32`
    );
    throw new StartupEncryptionError(`encryption startup check failed: ${message}`, { cause: err });
  }
  if (!encrypted || !encrypted.startsWith(PREFIX)) {
    log.fatal(
      { encrypted },
      `[Encryption] FATAL — encryption returned no prefix at startup (broken crypto). Server refusing to start.`
    );
    throw new StartupEncryptionError("encrypt() returned plaintext at startup despite a key being set");
  }
  const decrypted = decrypt(encrypted);
  if (decrypted !== CANARY_PLAINTEXT) {
    log.fatal(
      { decrypted },
      `[Encryption] FATAL — encrypt/decrypt round-trip mismatch at startup. Server refusing to start.`
    );
    throw new StartupEncryptionError(`round-trip mismatch: ${JSON.stringify({ expected: CANARY_PLAINTEXT, got: decrypted })}`);
  }
  log.info("[Encryption] Startup validation passed — encrypt/decrypt round-trip OK");
}
```

The runtime catch is rewritten to log a fatal error and re-throw (caller decides: route handlers return 500; startup path crashes the process).

**Caller impact:**

- All call sites: same as Option A (runtime throw).
- Plus: every entry-point that calls `getDbInstance()` must invoke `validateEncryptionAtStartup()` before serving traffic. The cleanest hook in Next.js App Router is the `instrumentation.ts` file, which runs once at server start.
- Existing CI/test fixtures that set `STORAGE_ENCRYPTION_KEY=test-secret-key-12345` will pass the canary (encrypt/decrypt round-trip is functional for that key). Fixtures that use a broken/empty key will now refuse to start, which is the desired behaviour.

**Pros:**

- Operator **cannot** accidentally enter the broken state. The server refuses to start if the canary fails; you cannot reach State B during normal operation because the canary would have failed first.
- Clean runtime semantics: `encrypt()` either succeeds, throws (Option A behaviour), or returns plaintext only in State A.
- Catches both State B conditions AND the additional failure mode where `getStaticKey()` returns null while `STORAGE_ENCRYPTION_KEY` is set (silent `null` in the current code).

**Cons:**

- Requires a server-lifecycle hook. Next.js App Router has `instrumentation.ts`, but it's run after some module-load evaluation; we need to verify the ordering for the encryption-canary call.
- Doesn't help long-running servers whose keys get *revoked mid-flight* (State B scenario #2). For that case, the runtime catch still needs Option-A-style throw behaviour, so this PR effectively combines Options A and C: runtime throw + startup validation.
- The `instrumentation.ts` file is a Next.js-specific concept; non-Next entry points (CLI scripts, worker processes) need their own hook.
- Test fixtures that don't set `STORAGE_ENCRYPTION_KEY` will see the canary skip-and-warn (not crash). This is fine for State A but should be tested explicitly.

### 4.4 Recommendation

**Recommendation: Option C, with Option A's runtime-throw as a backstop.**

This combines the best of both:

1. **Startup canary (`validateEncryptionAtStartup()`)** — runs at server boot. Catches any crypto breakage before the first request hits a DB write. Operator gets a fat log line + non-zero exit.
2. **Runtime throw (`EncryptionRuntimeError`)** — even after a clean startup, if `randomBytes` / `createCipheriv` throws mid-flight (e.g., OOM, native-binding rot during a long-running worker), `encrypt()` refuses to return plaintext and surfaces a 500 to the caller instead.
3. **State A preserved** — when `STORAGE_ENCRYPTION_KEY` is unset, `encrypt(plaintext)` returns plaintext exactly as before.

The diff is larger than pure Option A, but it is the only option that addresses **both** the boot-time failure mode (Option C) AND the runtime failure mode (Option A) without leaving a gap.

**Files touched for Option C+A:**

- `src/lib/db/encryption.ts` — add `EncryptionRuntimeError`, `StartupEncryptionError`, `validateEncryptionAtStartup`; replace State B catch to throw; add `createLogger` import.
- `src/lib/db/encryptionStartup.ts` (NEW) — the canary function + a `runEncryptionStartupCheck()` wrapper.
- `src/instrumentation.ts` (NEW, if absent) — calls `runEncryptionStartupCheck()` before serving traffic.
- `src/lib/db/encryption.ts` `encryptConnectionFields()` — wrap each `encrypt()` call with try/catch; on throw, return the connection object with the broken field marked and log the failure. Don't write plaintext to DB.
- `src/lib/db/providers.ts:348,544` — accept the new return shape from `encryptConnectionFields` and refuse to insert/update if the shape indicates failure.
- `src/lib/db/commandCodeAuth.ts:142` — wrap the `encrypt()` call in try/catch; on throw, mark session as failed.
- Test fixtures (`tests/unit/encryption.spec.ts`, `tests/unit/db/encryption-error-handling.test.mjs`) — add fault-injection tests for the new behaviour.
- `.env.example` — document the new error names so operators can grep for them.

**Why not Option A alone?** Without the startup canary, a freshly-deployed server with a bad `STORAGE_ENCRYPTION_KEY` will pass all unit tests (which use a known-good key), boot, and fail at first request. That's strictly worse than catching it at boot.

**Why not Option B?** Two parallel `encrypt()` / `encryptSafely()` APIs is a maintenance tax. Option C+A is a one-time migration cost; Option B is a permanent fork.

The Open Questions in §9 re-confirm this recommendation with the user before implementation begins, especially Q6 (feature flag roll-out).

---

## 5. Acceptance criteria

| #   | Criterion                                                                                                                                                          | Verification                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | When `STORAGE_ENCRYPTION_KEY` is **unset**, `encrypt(plaintext)` returns `plaintext` (intentional passthrough, State A preserved).                                  | `tests/unit/encryption.spec.ts` "passthrough mode" describe-block continues to pass without modification.                  |
| AC-2 | When `STORAGE_ENCRYPTION_KEY` is set and `getStaticKey()` returns a key, but `randomBytes()` is mocked to throw, `encrypt(plaintext)` throws `EncryptionRuntimeError`. | New test in `tests/unit/encryption.spec.ts`: `encrypt-throws-on-crypto-failure.test.ts`. Pre-fix: returns plaintext (fail). |
| AC-3 | The thrown `EncryptionRuntimeError` carries a `cause` chain pointing to the original `randomBytes` error (so `Error.cause` is non-null).                            | New test: `expect(err.cause).toBeDefined()`.                                                                                  |
| AC-4 | The thrown `EncryptionRuntimeError` includes the remediation hint "*Regenerate with: openssl rand -base64 32*" in `.message`.                                     | New test: `expect(err.message).toContain("openssl rand -base64 32")`.                                                        |
| AC-5 | Audit log shows an `error`-level structured entry with `{ err, op: "encrypt", envSet: true, keyId: <masked> }` when State B fires.                               | New test: spy on `createLogger`; assert log output includes `op === "encrypt"` and `envSet === true`.                       |
| AC-6 | `validateEncryptionAtStartup()` passes silently (single `info`-level log) on a known-good `STORAGE_ENCRYPTION_KEY`.                                                | New test in `tests/unit/db/encryptionStartup.test.ts`.                                                                       |
| AC-7 | `validateEncryptionAtStartup()` throws `StartupEncryptionError` when `STORAGE_ENCRYPTION_KEY` is set but `encrypt(canary)` throws.                                | New test: mock `encrypt` to throw; assert `StartupEncryptionError` propagates.                                              |
| AC-8 | `validateEncryptionAtStartup()` throws `StartupEncryptionError` when `STORAGE_ENCRYPTION_KEY` is set and `encrypt(canary)` returns plaintext (no `enc:v1:` prefix). | New test: mock `encrypt` to return canary plaintext; assert throw.                                                            |
| AC-9 | `validateEncryptionAtStartup()` throws `StartupEncryptionError` when `STORAGE_ENCRYPTION_KEY` is set and the round-trip `decrypt(encrypt(canary))` doesn't match.    | New test: mock `encrypt` to return a valid-looking-but-bogus ciphertext; assert throw.                                      |
| AC-10 | `validateEncryptionAtStartup()` warns (does not throw) when `STORAGE_ENCRYPTION_KEY` is unset.                                                                   | New test: `expect(log.warn).toHaveBeenCalledWith(/passthrough/i)`.                                                          |
| AC-11 | `encryptConnectionFields()` refactored: when any inner `encrypt()` throws, the function returns `null` (not a partially-encrypted object) and logs the failure.    | New test in `tests/unit/db/encryption-connection-fields-failclosed.test.mjs`.                                                |
| AC-12 | `providers.ts:348,544` callers handle the `null` return from `encryptConnectionFields()` by short-circuiting the insert/update (no DB write, error logged).       | New test in `tests/integration/db/providers-failclosed.test.ts` (extends existing `providers.test.ts`).                     |
| AC-13 | `commandCodeAuth.ts:142` wraps the `encrypt()` call; on throw, the session status is set to `'failed'` and the `last_error` is logged (no plaintext to DB).       | New test in `tests/unit/db/commandCodeAuth-failclosed.test.mjs`.                                                              |
| AC-14 | `migrateLegacyEncryptedString()` (line 295) bubbles `EncryptionRuntimeError` upward (does not swallow it).                                                         | New test: confirm `migrateLegacyEncryptedString` re-throws when `encrypt(legacyDecrypted)` throws.                          |
| AC-15 | `decrypt()` is **not** changed by this PR; existing tests in `tests/unit/db/encryption-error-handling.test.mjs` continue to pass unchanged.                       | Pre-existing tests pass without modification.                                                                                |
| AC-16 | `tsc --pretty false -p tsconfig.typecheck-core.json` exits 0; no new TypeScript errors.                                                                            | CI step (locally executed since CI is billing-blocked).                                                                       |
| AC-17 | All existing unit tests (`tests/unit/encryption.spec.ts`, `tests/unit/db/encryption-error-handling.test.mjs`) continue to pass without per-file changes.          | `vitest run tests/unit/encryption.spec.ts tests/unit/db/encryption-error-handling.test.mjs` exits 0.                       |
| AC-18 | All existing integration tests (`tests/integration/db/encrypt.test.mjs`, `tests/integration/db/providers.test.ts`) that exercise the `encrypt` / `encryptConnectionFields` paths continue to pass. | `vitest run tests/integration/db/encrypt.test.mjs` exits 0.                                                              |

Each AC has a single-source verification command in §8.

---

## 6. Implementation steps

In dependency order. Each step is independently verifiable. Commit per step is acceptable for review, but the spec author recommends one **feature commit + one test commit** for atomicity, mirroring the sibling spec (`keyv-as-embedded-default-spec.md` §11.1).

### Step 1: `src/lib/db/encryption.ts` — imports + error class

**At line ~30**, add the import:

```ts
import { createLogger } from "@/shared/utils/logger";
const log = createLogger("db:encryption");
```

**After the `ConnectionFields` interface (line ~62)**, add:

```ts
/** Thrown when encrypt() was supposed to encrypt (key configured) but the
 *  crypto pipeline threw. Carries the original error as `.cause`.
 *  This is FAIL-CLOSED behaviour — callers must NOT swallow this and write
 *  the plaintext; that would re-introduce the State-B bug. */
export class EncryptionRuntimeError extends Error {
  override readonly name = "EncryptionRuntimeError";
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

/** Thrown by validateEncryptionAtStartup() when the round-trip canary fails.
 *  Distinct from EncryptionRuntimeError so operators can grep for the
 *  startup-specific path and the runtime-specific path separately. */
export class StartupEncryptionError extends Error {
  override readonly name = "StartupEncryptionError";
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}
```

Verify: `tsc -p tsconfig.typecheck-core.json` exit 0.

### Step 2: `src/lib/db/encryption.ts` — replace State B catch

**Replace lines 137-147** with:

```ts
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  log.error(
    {
      err: message,
      op: "encrypt",
      envSet: !!process.env.STORAGE_ENCRYPTION_KEY,
      // _staticKey is a Buffer; never log the key material itself.
      keyBytes: _staticKey?.length ?? null,
    },
    `[Encryption] STORAGE_ENCRYPTION_KEY is set but encrypt() failed. ` +
      `Refusing to write plaintext. Regenerate with: openssl rand -base64 32`
  );
  throw new EncryptionRuntimeError(
    `Encryption failed at runtime: ${message}. ` +
      `Refusing to write plaintext. Check your STORAGE_ENCRYPTION_KEY — ` +
      `regenerate one with: openssl rand -base64 32`,
    { cause: err }
  );
}
```

Verify: `vitest run tests/unit/encryption.spec.ts` — existing tests pass; new AC-2/AC-3/AC-4/AC-5 tests fail without further changes (TDD; the next steps introduce the supporting changes).

### Step 3: `src/lib/db/encryption.ts` — refactor `encryptConnectionFields` to fail-closed

**Replace lines 214-223** with:

```ts
/** Encrypt all sensitive fields on a connection row (mutates in-place).
 *  FAIL-CLOSED: if any inner encrypt() throws EncryptionRuntimeError,
 *  returns null AND logs the failure. Callers must check for null and
 *  refuse to write plaintext to the DB. */
export function encryptConnectionFields<T extends ConnectionFields | null | undefined>(conn: T): T | null {
  if (!isEncryptionEnabled()) return conn;
  if (!conn) return conn;
  try {
    if (conn.apiKey) conn.apiKey = encrypt(conn.apiKey) ?? conn.apiKey;
    if (conn.accessToken) conn.accessToken = encrypt(conn.accessToken) ?? conn.accessToken;
    if (conn.refreshToken) conn.refreshToken = encrypt(conn.refreshToken) ?? conn.refreshToken;
    if (conn.idToken) conn.idToken = encrypt(conn.idToken) ?? conn.idToken;
    return conn;
  } catch (err: unknown) {
    if (err instanceof EncryptionRuntimeError) {
      log.error(
        { err: err.message, op: "encryptConnectionFields" },
        `[Encryption] encryptConnectionFields() refused to write plaintext. ` +
          `Refusing to insert/update connection row.`
      );
      return null;
    }
    throw err; // Unexpected error; bubble up.
  }
}
```

**Signature change:** the return type is now `T | null` (was `T`). This is a TypeScript-breaking change for any TS consumer that expected `T`. We audit:

- `src/lib/db/providers.ts:348` — `encryptConnectionFields({ ...connection })` is passed to `_insertConnectionRow`. Verify the call site; add `null`-check.
- `src/lib/db/providers.ts:544` — same pattern.
- `src/lib/container.ts:24,105` — `encryptConnectionFields` is re-exported via the DI container. Consumers via the container will see the union.

Verify: `tsc -p tsconfig.typecheck-core.json` exit 0 (after Step 4).

### Step 4: `src/lib/db/providers.ts` — handle `null` from `encryptConnectionFields`

**At line 348**, replace:

```ts
_insertConnectionRow(db, encryptConnectionFields({ ...connection }));
const providerId = toStringOrNull(data.provider);
if (providerId) {
  _reorderConnections(db, providerId);
}
backupDbFile("pre-write");
invalidateDbCache("connections");
```

with:

```ts
const fieldsToWrite = encryptConnectionFields({ ...connection });
if (fieldsToWrite === null) {
  log.error(
    { provider: data.provider },
    `[providers] Refusing to insert connection row: encryption layer is broken. ` +
      `Check STORAGE_ENCRYPTION_KEY and restart.`
  );
  throw new Error(`[providers] Cannot insert connection for ${data.provider}: encryption layer failed`);
}
_insertConnectionRow(db, fieldsToWrite);
const providerId = toStringOrNull(data.provider);
if (providerId) {
  _reorderConnections(db, providerId);
}
backupDbFile("pre-write");
invalidateDbCache("connections");
```

**At line 544**, mirror the change for the `_updateConnectionRow` path.

Add the `import { createLogger } from "@/shared/utils/logger";` at the top of `providers.ts` if not already present, and `const log = createLogger("db:providers");`.

Verify: `tsc -p tsconfig.typecheck-core.json` exit 0.

### Step 5: `src/lib/db/commandCodeAuth.ts` — wrap `encrypt()` in try/catch

**At line 142**, replace:

```ts
const encryptedApiKey = encrypt(input.apiKey);
db().prepare(...).run(encryptedApiKey, ...);
```

with:

```ts
let encryptedApiKey: string | null;
try {
  encryptedApiKey = encrypt(input.apiKey) ?? null;
} catch (err: unknown) {
  if (err instanceof EncryptionRuntimeError) {
    log.error(
      { err: err.message, op: "markCommandCodeAuthSessionReceived", stateHash: input.stateHash },
      `[commandCodeAuth] Refusing to store apiKey — encryption layer failed.`
    );
    return null; // Existing return type; surfaced as "session not found" to the caller.
  }
  throw err;
}
if (encryptedApiKey === null) {
  return null;
}
db().prepare(...).run(encryptedApiKey, ...);
```

Add the `EncryptionRuntimeError` import at the top.

Verify: `tsc -p tsconfig.typecheck-core.json` exit 0.

### Step 6: `src/lib/db/encryption.ts` — `migrateLegacyEncryptedString()` re-throws

**At line 295**, the existing `return { updated: true, value: encrypt(legacyDecrypted) }` will now propagate the throw. Verify the function's type signature reflects that — `EncryptionRuntimeError` is now part of its throw graph. Document in JSDoc.

Verify: `tsc -p tsconfig.typecheck-core.json` exit 0.

### Step 7: `src/lib/db/encryptionStartup.ts` (NEW)

Per §4.3. New file (~50 lines). Exports:

- `validateEncryptionAtStartup(): void` — throws `StartupEncryptionError` on failure.
- `runEncryptionStartupCheck(): Promise<void>` — wrapper that awaits any async setup and then calls `validateEncryptionAtStartup()`.

Verify: `vitest run tests/unit/db/encryptionStartup.test.ts` (new file) passes all 5 tests for AC-6, AC-7, AC-8, AC-9, AC-10.

### Step 8: `src/instrumentation.ts` (NEW if absent)

Per Next.js App Router convention. If the file exists, add a call to `runEncryptionStartupCheck()`. The hook must run before any DB call (including `getDbInstance()`).

```ts
// src/instrumentation.ts
import { runEncryptionStartupCheck } from "@/lib/db/encryptionStartup";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  await runEncryptionStartupCheck();
}
```

Verify: locally start `next dev` with a known-good `STORAGE_ENCRYPTION_KEY` and confirm no startup error. Start with a broken key (e.g., `STORAGE_ENCRYPTION_KEY=""`) and confirm the process exits non-zero with the expected log line.

### Step 9: Test files — fault-injection suites

**NEW `tests/unit/db/encryption-failclosed.test.ts`** (~80 lines):

- AC-2: mock `randomBytes` to throw; call `encrypt(plaintext)`; assert `EncryptionRuntimeError` thrown.
- AC-3: assert `err.cause` is the original error.
- AC-4: assert `err.message` contains `"openssl rand -base64 32"`.
- AC-5: spy on `createLogger`; assert log output with `{ op: "encrypt", envSet: true }`.

**NEW `tests/unit/db/encryption-connection-fields-failclosed.test.mjs`** (~50 lines):

- AC-11: `encryptConnectionFields({ apiKey: "x", accessToken: "y" })` with mocked-throwing `encrypt` returns `null`; verify log line.

**EXTEND `tests/integration/db/providers-failclosed.test.ts`** (~60 lines):

- AC-12: integration test that calls `_insertConnectionRow` path with a broken-encrypt mock; assert the insert is refused and the error propagates.

**NEW `tests/unit/db/commandCodeAuth-failclosed.test.mjs`** (~50 lines):

- AC-13: `markCommandCodeAuthSessionReceived` with mocked-throwing `encrypt`; assert no DB write (session is `'failed'` state) and log line.

### Step 10: `.env.example` — document the new error names

**At `.env.example:1849` area** (where `STORAGE_ENCRYPTION_KEY` is documented), add a note:

```bash
# When STORAGE_ENCRYPTION_KEY is set but the crypto layer fails (e.g., broken
# native bindings, key length drift after a Node upgrade), OmniRoute refuses
# to write plaintext and surfaces:
#   - EncryptionRuntimeError (runtime calls — surfaces as 500 to the user)
#   - StartupEncryptionError (startup-canary in instrumentation.ts — process exits non-zero)
# Grep for these names in the logs to diagnose. Regenerate the key with:
#   openssl rand -base64 32
STORAGE_ENCRYPTION_KEY=...your-key-here...
```

### Step 11: Verification sweep (per §8.3)

Run all verification commands. All 18 ACs must pass.

### Step 12: Commit + push + open PR

Per §11.

---

## 7. Risks

| #   | Risk                                                                                                                                                                                                                          | Likelihood | Impact | Mitigation                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | **Production deployments with a broken `STORAGE_ENCRYPTION_KEY` refuse to start.** A 4-character placeholder, a leading-whitespace key, or a key with non-base64 chars will pass `typeof === "string" && trim().length > 0` but may fail at `scryptSync` or `randomBytes`. After this PR, those deployments cannot boot.                                                                  | High       | High   | The `validateEncryptionAtStartup` canary emits a structured log line naming the failure mode AND prints the regeneration hint. Operators get a clear failure. Document prominently in CHANGELOG. Add a "diagnostic" sub-command so operators can probe without booting. |
| R-2 | **Existing test fixtures that don't set `STORAGE_ENCRYPTION_KEY` may need updates.** Many tests use `vi.resetModules()` and rely on passthrough behaviour. After this PR, those tests still pass (State A is preserved), but fixtures that *do* set a broken key will start failing the new canary.                                                     | Medium     | Medium | Audit fixtures in `tests/unit/encryption.spec.ts` (uses `"test-secret-key-12345"` which is valid). Audit fixtures in `tests/integration/db/*.test.mjs` — no key is set in default test runs, so passthrough mode is used. Document the audit result in the PR description. |
| R-3 | **Next.js `instrumentation.ts` may not run before the first DB call in all routes.** The file is loaded on first request (or once at boot, depending on config), and `getDbInstance()` is called eagerly from some route imports. If the canary runs *after* the first DB call, the broken state has already been hit.                                                              | Medium     | High   | Verify by running `next build && NEXT_PHASE=phase-production-build node ./dist/server.js` and inspecting the load order. If the canary runs late, move `runEncryptionStartupCheck()` into a top-of-module import in `core.ts` (synchronous version), or accept a brief race window and add a guard inside `getDbInstance()`. |
| R-4 | **`encryptConnectionFields` now returns `T | null`, a TS-breaking change.** Three files (`providers.ts:348`, `providers.ts:544`, `container.ts:24`) are affected; any out-of-tree consumer that relies on the old signature may break.                                                                        | Medium     | Medium | The change is intentional and surfaced in the type system. Document in CHANGELOG ("`encryptConnectionFields` may now return `null` when encryption is broken"). For external consumers pinned to older API, add a deprecated shim that wraps in try/catch and returns the original object — but that's a follow-up. |
| R-5 | **State A passthrough behaviour is preserved, but operators may inadvertently deploy without setting `STORAGE_ENCRYPTION_KEY`.** Today, if an operator forgets to set the env var, OmniRoute silently passes through plaintext. The PR does not fix this — it's a separate "enforce key always" question (§9 Q2).                                                              | High       | High (already true today) | Out of scope for this PR; flag in CHANGELOG. Operators who want fail-on-missing-key can set `STORAGE_ENCRYPTION_KEY=$(openssl rand -base64 32)` in their deploy scripts. |
| R-6 | **Test runner interprets the startup canary's `throw` as a "test failed".** When `runEncryptionStartupCheck()` is called from a test context (e.g., `tests/integration/db/startup.test.ts`), the `throw` will mark the test as failed unless the test wraps it in `expect(...).rejects.toThrow(...)`.                                                     | Low        | Low    | Add the wrapper in the integration test. Document the pattern. Vitest's `expect.rejects` is the idiomatic API. |
| R-7 | **The fix introduces a second `console.error` source (in addition to the existing `console.error` calls in `getStaticKey` and `getLegacyDynamicKey`).** Operators grepping logs for `"[Encryption]"` will now see structured pino entries AND legacy `console.error` lines mixed.                                                      | Low        | Low    | Migrate the remaining `console.error` calls to `log.error` in a follow-up PR (out of scope here, per "Non-goals: not fixing `getStaticKey` silent null on scryptSync failure"). Document in the PR description. |

---

## 8. Test plan

### 8.1 New tests

| Test file                                                                                             | Coverage                                                | ACs                         |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------- |
| `tests/unit/db/encryption-failclosed.test.ts` (NEW)                                                   | `encrypt()` throw on crypto failure + cause + log       | AC-2, AC-3, AC-4, AC-5      |
| `tests/unit/db/encryption-connection-fields-failclosed.test.mjs` (NEW)                                | `encryptConnectionFields()` returns `null` on throw     | AC-11                       |
| `tests/integration/db/providers-failclosed.test.ts` (NEW)                                             | Integration: insert/update refused on encryption fail   | AC-12                       |
| `tests/unit/db/commandCodeAuth-failclosed.test.mjs` (NEW)                                             | `markCommandCodeAuthSessionReceived` refuses on failure | AC-13                       |
| `tests/unit/db/encryptionStartup.test.ts` (NEW)                                                       | Startup canary: pass / fail / no-key-warn               | AC-6, AC-7, AC-8, AC-9, AC-10 |
| `tests/unit/db/encryption-failclosed-migrateLegacy.test.ts` (NEW)                                     | `migrateLegacyEncryptedString()` re-throws              | AC-14                       |

### 8.2 Existing tests (must continue to pass)

The following tests are unchanged but must be re-verified after the State B catch is replaced:

- `tests/unit/encryption.spec.ts` — passthrough / roundtrip / legacy migration / already-encrypted / malformed ciphertext / isEncryptionEnabled (5 describe blocks; ~30 individual `it`).
- `tests/unit/db/encryption-error-handling.test.mjs` — decrypt failure modes (5 tests).
- `tests/integration/db/encrypt.test.mjs` (if present) — full round-trip integration.
- `tests/integration/db/providers.test.ts` — `encryptConnectionFields` happy path.
- `tests/unit/db/commandCodeAuth.test.mjs` (if present) — existing session flow.

### 8.3 Verification commands

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute/.worktrees/governance-cleanup-20260806
export PATH="/opt/homebrew/bin:$PATH"

# AC-16: typecheck
node node_modules/typescript/bin/tsc --pretty false -p tsconfig.typecheck-core.json 2>&1 | grep "error TS" | wc -l  # → 0

# AC-1, AC-15 (pre-existing): encrypt/decrypt happy + edge paths
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/encryption.spec.ts
DISABLE_SQLITE_AUTO_BACKUP=true node --test tests/unit/db/encryption-error-handling.test.mjs

# AC-2, AC-3, AC-4, AC-5 (NEW): State B throw + cause + log
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/db/encryption-failclosed.test.ts

# AC-11 (NEW): encryptConnectionFields null-return on throw
DISABLE_SQLITE_AUTO_BACKUP=true node --test tests/unit/db/encryption-connection-fields-failclosed.test.mjs

# AC-12 (NEW): providers refuse to insert/update on broken encrypt
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/integration/db/providers-failclosed.test.ts

# AC-13 (NEW): commandCodeAuth session refuses to write apiKey
DISABLE_SQLITE_AUTO_BACKUP=true node --test tests/unit/db/commandCodeAuth-failclosed.test.mjs

# AC-6, AC-7, AC-8, AC-9, AC-10 (NEW): startup canary
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/db/encryptionStartup.test.ts

# AC-14 (NEW): migrateLegacyEncryptedString re-throws
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/db/encryption-failclosed-migrateLegacy.test.ts

# AC-17 (existing): full encryption unit suite
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/unit/encryption.spec.ts tests/unit/db/encryption-error-handling.test.mjs tests/unit/db/encryption-failclosed.test.ts tests/unit/db/encryption-failclosed-migrateLegacy.test.ts tests/unit/db/encryptionStartup.test.ts tests/unit/db/encryption-connection-fields-failclosed.test.mjs

# AC-18 (existing): full encryption integration suite
DISABLE_SQLITE_AUTO_BACKUP=true node node_modules/.bin/vitest run tests/integration/db/encrypt.test.mjs tests/integration/db/providers-failclosed.test.ts

# Smoke (manual): startup canary fires on a broken key
cd /Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute/.worktrees/governance-cleanup-20260806
STORAGE_ENCRYPTION_KEY="" timeout 5 node -e '
  import("./src/lib/db/encryptionStartup.ts").then((m) => m.runEncryptionStartupCheck())
' 2>&1
# Expected: single warn log line "STORAGE_ENCRYPTION_KEY not set — passthrough mode active"

STORAGE_ENCRYPTION_KEY="valid-base64-key" timeout 5 node -e '
  import("./src/lib/db/encryptionStartup.ts").then((m) => m.runEncryptionStartupCheck())
' 2>&1
# Expected: single info log line "Startup validation passed — encrypt/decrypt round-trip OK"
```

### 8.4 Smoke test invocation

```bash
# Manual: confirm encrypt() throws on a deliberately-broken randomBytes
cd /Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute/.worktrees/governance-cleanup-20260806
STORAGE_ENCRYPTION_KEY="test-secret-key-12345" node --import tsx --test - <<'EOF'
import { test } from "node:test";
import assert from "node:assert";
import { createCipheriv, randomBytes, scryptSync } from "crypto";
import assert from "node:assert/strict";

// Override randomBytes to throw
const brokenMod = await import("./src/lib/db/encryption.ts");
const originalRandomBytes = brokenMod;

// (Implementation detail: monkey-patch via test setup; the spec author
//  will add a vitest mock in tests/unit/db/encryption-failclosed.test.ts)

test("encrypt() throws EncryptionRuntimeError when randomBytes throws", () => {
  // ... see tests/unit/db/encryption-failclosed.test.ts for the canonical test
});
EOF
```

---

## 9. Open questions (for user resolution)

These questions are flagged for the user before implementation begins. Each has a recommendation; the user may override.

### Q1. Which design option (A, B, or C)?

**Recommendation: C + A backstop** (§4.4). Startup canary + runtime throw. Pure A (runtime throw only) leaves the boot-time failure mode uncovered. Pure B (mark-broken) is a maintenance tax (two parallel APIs).

### Q2. Should the silent-passthrough behaviour be removed entirely?

Today, `isEncryptionEnabled() === false && encrypt() === passthrough` is the dev-mode convenience. Some deployments (CI, tests, local dev) rely on this. Three options:

- **(a) Preserve** — recommend this PR keeps the passthrough (State A).
- **(b) Warn loudly** — keep passthrough, but add a one-time-per-process `console.warn` "you are running without encryption in production is dangerous". Requires a `NODE_ENV === "production"` check.
- **(c) Enforce always** — refuse to start when `STORAGE_ENCRYPTION_KEY` is unset in `NODE_ENV === "production"`.

**Recommendation: (a).** Remove the dev-mode convenience in a separate, more sweeping PR once we have telemetry on how many real deployments rely on it.

### Q3. What log level on `EncryptionRuntimeError`? `error` vs `fatal`?

The recommendation uses `log.error` (and `log.fatal` for the startup canary). Some teams prefer a single level across all encryption failures. **Recommendation: `error` for runtime (`EncryptionRuntimeError`), `fatal` for startup (`StartupEncryptionError`).** Operators can grep separately.

### Q4. Should `migrateLegacyEncryptedString` follow the same hardening rule?

Per the §4.4 step, yes — the function bubbles the throw. **Recommendation: yes.** But verify that the only caller (`core.ts:autoMigrateLegacyEncryptedConnections`) handles the throw correctly (it already wraps in try/catch + logs at lines 595-617).

### Q5. What about `decrypt()` returning null — should that be a startup check or `error.fatal`?

`decrypt()` already fails closed by returning `null`. The remaining hardening is a *log* change (the current `console.error` is too generic). **Recommendation: leave for a follow-up PR.** This PR is scoped to `encrypt()` only.

### Q6. Does the chosen option need a feature flag for gradual rollout?

The chosen option is a strict superset of today's behaviour for State A (passthrough preserved) and a strict improvement for State B (now throws). The only "breaking" surface is `encryptConnectionFields`'s `T | null` return type, which is surfaced in TypeScript at compile time. **Recommendation: no feature flag.** Document the breaking surface in CHANGELOG. If the user disagrees, the flag name `OMNIROUTE_ENCRYPTION_FAILCLOSED` (default `"1"`) is suggested, and the gate can be added to `validateEncryptionAtStartup()` and `encryptConnectionFields()`.

### Q7. Should we add a `encryptSafely()` helper that any caller can opt into?

Per Option B (§4.2). **Recommendation: no.** The chosen Option C+A makes `encryptSafely()` redundant — `encrypt()` throws, callers handle the throw. Adding a parallel API is the maintenance tax we want to avoid.

---

## 10. Out of scope (deferred)

- **Migration of legacy ciphertext.** A separate PR (`plans/encryption-legacy-ciphertext-migration.md` TBD).
- **Key rotation.** The current code derives `_staticKey` once and caches it forever. A rotation workflow requires re-derivation + re-encryption pass.
- **Hardware-backed keys (HSM, KMS).** Out of scope; would require moving `scryptSync` to a KMS adapter.
- **`decrypt()` log hardening** (Q5). Follow-up PR.
- **`getStaticKey` log migration to `createLogger`** (R-7 mitigation). Follow-up PR.
- **External shim for `encryptConnectionFields` non-null return.** External consumers may pin to the old `T` signature; a deprecated shim is a follow-up.
- **Removing dev-mode passthrough** (Q2). Requires telemetry on real deployments.
- **Multi-region / multi-process `randomBytes` consistency.** Out of scope; native crypto is per-process.

---

## 11. Commit + delivery

### 11.1 Commit messages

```
feat(security): encryption.ts failclosed on crypto failure

- Add EncryptionRuntimeError + StartupEncryptionError typed errors.
- Replace encrypt() State-B catch with structured log + throw.
- Add validateEncryptionAtStartup() canary in src/lib/db/encryptionStartup.ts.
- Wire canary into src/instrumentation.ts.
- Refactor encryptConnectionFields() to return T | null on encrypt() throw.
- Refactor providers.ts:348,544 to short-circuit on null encrypt result.
- Refactor commandCodeAuth.ts:142 to wrap encrypt() in try/catch.
- Document behaviour in .env.example under STORAGE_ENCRYPTION_KEY.

Refs: PR #507 F3 follow-up. Closes State B from audit.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```
test(security): encryption failclosed fault injection

- tests/unit/db/encryption-failclosed.test.ts (NEW)
  - AC-2: encrypt() throws EncryptionRuntimeError on randomBytes throw
  - AC-3: err.cause is the original error
  - AC-4: err.message contains regeneration hint
  - AC-5: log.error structured entry with op=encrypt, envSet=true
- tests/unit/db/encryption-connection-fields-failclosed.test.mjs (NEW)
  - AC-11: encryptConnectionFields returns null on inner throw
- tests/integration/db/providers-failclosed.test.ts (NEW)
  - AC-12: providers insert/update refuses on null encrypt result
- tests/unit/db/commandCodeAuth-failclosed.test.mjs (NEW)
  - AC-13: markCommandCodeAuthSessionReceived refuses on encrypt throw
- tests/unit/db/encryptionStartup.test.ts (NEW)
  - AC-6, AC-7, AC-8, AC-9, AC-10: canary pass/fail/no-key
- tests/unit/db/encryption-failclosed-migrateLegacy.test.ts (NEW)
  - AC-14: migrateLegacyEncryptedString re-throws

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### 11.2 PR target

- **Source branch:** `fix/encryption-failclosed-20260805`
- **Target branch:** `origin/agent/migration-version-collision-fix` (current canonical branch, per the task brief)
- **Worktree:** `repos/OmniRoute/.worktrees/governance-cleanup-20260806`

### 11.3 Delivery sequence

1. **Implement** the spec in the worktree (per §6).
2. **Run all verification commands** (§8.3). All 18 ACs must pass.
3. **Commit** as a feature commit + a test commit (§11.1).
4. **Open PR** against `origin/agent/migration-version-collision-fix`. Note: GitHub Actions CI will fail with the billing error (per `AGENTS.md`); do not block on CI green. Verify quality locally.
5. **Merge via `gh pr merge --admin`** after code review, since CI cannot gate.
6. **AgilePlus registration** (per §11.4).
7. **Cleanup** the worktree branch after merge (canonical folder returns to `main`).

### 11.4 AgilePlus registration

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute/.worktrees/governance-cleanup-20260806
agileplus specify --feature encryption-failclosed --from-file plans/encryption-failclosed-spec.md --target-branch origin/agent/migration-version-collision-fix
```

### 11.5 Review checklist

Before requesting review, verify:

- [ ] All 18 ACs pass.
- [ ] No `console.log` or `console.error` added — only `log.error` / `log.fatal` via `createLogger`.
- [ ] `EncryptionRuntimeError` and `StartupEncryptionError` are exported and grep-able.
- [ ] `encryptConnectionFields()` type signature is `T | null` (not `T`).
- [ ] `providers.ts:348,544` are updated to handle `null`.
- [ ] `commandCodeAuth.ts:142` is wrapped in try/catch.
- [ ] `migrateLegacyEncryptedString()` re-throws are documented in JSDoc.
- [ ] `instrumentation.ts` calls `runEncryptionStartupCheck()` BEFORE any DB call.
- [ ] `.env.example` documents `STORAGE_ENCRYPTION_KEY` + the two error names.
- [ ] No destruction of `decrypt()` or `getLegacyDynamicKey()` behaviour (out of scope).
- [ ] Existing `tests/unit/encryption.spec.ts` is unmodified.
- [ ] CHANGELOG.md entry: "Encryption: `encrypt()` now throws `EncryptionRuntimeError` when the crypto pipeline fails while a key is configured. Plaintext is NEVER written to disk in that state. Set `STORAGE_ENCRYPTION_KEY` to a valid value (regenerate with `openssl rand -base64 32`) to resolve."
- [ ] DO NOT MERGE until open questions are answered (§9).

---

## 12. Cross-project reuse

Per `PHENOTYPE_SHARED_REUSE_PROTOCOL`, this PR deliberately does NOT extract the encryption helper to a shared package. The helper is tightly coupled to OmniRoute's `crypto.scryptSync` + AES-256-GCM pipeline, and the migration logic (`migrateLegacyEncryptedString`) is OmniRoute-specific (legacy dynamic-salt key). Reuse would be premature.

A future PR may extract:

- A generic `fail-closed-on-error<T>` typed-error wrapper in `phenotype-shared/` (the `EncryptionRuntimeError` + `cause` pattern is reusable for any "refuse to degrade silently" module).
- A generic `startup-canary-validator<Canary>` helper that the `validateEncryptionAtStartup()` pattern can be parameterised over.

Both out of scope for this PR.

---

## 13. References

- `src/lib/db/encryption.ts:80-150` — the file in question. Pay attention to the State B catch at lines 137-147.
- `src/lib/db/AGENTS.md` — domain convention. Encryption hardening MUST be fail-closed.
- `src/lib/db/core.ts:348-617` — `encryptConnectionFields()` callers and `migrateLegacyEncryptedString()` integration.
- `src/lib/db/providers.ts:348,544` — the two provider connection insert/update paths.
- `src/lib/db/commandCodeAuth.ts:142` — auth-session write path.
- `tests/unit/encryption.spec.ts` — existing unit tests (must continue to pass without modification).
- `tests/unit/db/encryption-error-handling.test.mjs` — existing decrypt failure tests.
- PR #507 follow-up — F3 deferred to this spec.
- PR #508 — F4 (`getLegacyDynamicKey` catch) shipped; pattern mirrored here.
- `keyv-as-embedded-default-spec.md` (sibling spec, this worktree) — tone/format reference.
- `AGENTS.md` / `CLAUDE.md` — billing constraint (CI will fail; verify locally).
- `Phenotype/AGENTS.md` safety rule: "Fail loudly on missing required dependencies; no silent degradation or optional fallbacks."
