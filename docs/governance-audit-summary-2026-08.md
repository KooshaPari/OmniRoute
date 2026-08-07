# OmniRoute Governance Audit Summary — August 2026

This document captures the audit-driven governance cleanup pass that landed in
PRs #505 through #527 across late July / early August 2026. It is the
contributor-facing reference for the patterns we addressed, the tooling we
introduced to prevent regression, and the architectural changes that emerged.

## Background

The OmniRoute fork (KooshaPari/OmniRoute) had accumulated several classes of
governance debt that were not actively tracked:

- **Silent fail-open patterns**: empty catches, `.catch(() => null|undefined|false|"")`,
  and `console.*` callsites that swallowed real errors.
- **Console.* sprawl**: hundreds of `console.log|warn|error` calls scattered
  through `src/lib/` and `open-sse/`, with no structured logging.
- **Type drift**: the quota keystore had ghost-type imports from an unfinished
  refactor (PR #505 root cause).
- **Broken imports**: an `@/lib/featureFlags` import path that resolved to a
  non-existent module, silently swallowed by `try/catch` in callers.
- **Crypto-relevant silent returns**: `createHmac`, `scryptSync`, `jwtVerify`
  catches returning `""` or `null` instead of propagating.
- **State-lie patterns**: `catch { return { alive: true } }` after a failed
  process check.

The audit was triggered by an explicit search for the quota-keystore type-drift
bug, then expanded systematically to the rest of the codebase.

## Audit methodology

For each pattern class, the audit followed:

1. **Discover** — ripgrep across `src/` and `open-sse/` to enumerate sites
2. **Classify** — distinguish "intentional / user-facing" (CLI banners, browser
   console, debug instrumentation) from "silent fail-open" (production code
   paths)
3. **Fix** — convert silent to structured logging via the established pino
   `createLogger` pattern
4. **Test** — verify success-path behavior unchanged; targeted node:test /
   vitest suites run
5. **Document** — note the pattern in this doc + per-file inline comments
6. **Prevent** — encode the pattern as an automated check (this PR)

## Findings summary

### Silent fail-open patterns (PRs #506, #507, #509, #510, #512, #518, #526)

| File pattern | Count | PR |
|---|---|---|
| `} catch { /* swallow */ }` in src/lib | ~50 | #506, #512, #526 |
| `} catch (err) { /* swallow */ }` with empty body | ~30 | #512, #526 |
| `.catch(() => null)` / `.catch(() => undefined)` weak fallbacks | ~10 | #526 |
| `} catch { return "" }` after crypto API | ~6 | #509, #510 |
| `} catch { return { alive: true } }` lie | 1 | #507 |
| `console.*` swallows crypto errors | ~7 | #510 |

Total: **~100 silent fail-open patterns** converted to structured `log.error`
across 50+ files.

### Console.* → pino migration (PRs #522, #525)

| File group | Count | PR |
|---|---|---|
| `src/lib/db/*.ts` | ~155 | #522 |
| `src/lib/*.ts` (rest) | ~50 | #525 |
| `open-sse/*.ts` | ~30 | #525 |
| `src/server/*` | ~5 | #525 |
| `src/sse/*` | ~5 | #525 |

Total: **~245 console.* callsites migrated** to `createLogger("domain:subsystem")`.

Remaining intentionally NOT migrated:
- `src/app/*` (browser-side React; devtools output)
- `src/lib/oauth/utils/ui.ts` (CLI formatting with picocolors)
- `src/mitm/*` (CLI-driven tooling)
- `src/lib/proxyLogger.ts` (defines the logger interface itself)
- `src/lib/consoleInterceptor.ts` (defines the interceptor)

### Type drift (PR #505)

8 TypeScript errors in `src/lib/quota/keyvQuotaStore.ts` from ghost imports of
`PoolUsage`, `PoolUsageWithDimensions`, `PlanPoolUsage` (none existed).
Fix: added `PlanPoolUsage` to `types.ts`, rewrote `keyvQuotaStore.ts` to mirror
`SqliteQuotaStore` semantics.

### Broken imports (PR #507)

`@/lib/featureFlags` (does not exist; correct: `@/shared/utils/featureFlags`)
was imported in `anomalyHook.ts` + `server-init.ts` and silently swallowed by
`try/catch`. Fixed + log.error upgrade added.

### Crypto-relevant silent returns (PRs #509, #510, #518)

- `machineToken.ts:44, 62`: HMAC + SHA-256 catches returning `""` (all tokens
  become constant-keyed on fallback)
- `encryption.ts:87-95`: legacy key derivation catch returning `null`
- `encryption.ts:144-148`: encrypt fallback returning plaintext (highest risk —
  addressed by PR #518 with startup canary + structured error class)
- `cloudSync.ts:47-56`: HMAC fail-open when `CLOUD_SYNC_SECRET` is unset

### State-lie patterns (PR #507)

`processManager.ts:155`: catch returned `{pid, alive: true}` after `ps`/readFile
failures (lies when process is gone). Fixed to return `{pid, alive: false}`.

## PRs shipped (chronological)

| PR | Title | Files | +/− |
|---|---|---|---|
| [#505](https://github.com/KooshaPari/OmniRoute/pull/505) | fix(quota): rewrite KeyvQuotaStore | 10 | +1033/−100 |
| [#506](https://github.com/KooshaPari/OmniRoute/pull/506) | fix(governance): 5 silent try/catch → log.error | 5 | +51/−9 |
| [#507](https://github.com/KooshaPari/OmniRoute/pull/507) | fix(governance): broken imports + 3 fail-opens | 6 | +121/−7 |
| [#509](https://github.com/KooshaPari/OmniRoute/pull/509) | fix(security): 3 crypto catches | 2 | +30/−4 |
| [#510](https://github.com/KooshaPari/OmniRoute/pull/510) | fix(security): 4 audit findings + encryption pino | 5 | +58/−18 |
| [#511](https://github.com/KooshaPari/OmniRoute/pull/511) | docs(plans): 2 governance specs | 2 | +1581/−0 |
| [#512](https://github.com/KooshaPari/OmniRoute/pull/512) | fix(governance): empty catches in binaryManager + adapters | 5 | +112/−22 |
| [#518](https://github.com/KooshaPari/OmniRoute/pull/518) | feat(security): encryption.ts failclosed | 9 | +2175/−14 |
| [#521](https://github.com/KooshaPari/OmniRoute/pull/521) | feat(quota): Keyv as embedded default | 10 | +3089/−48 |
| [#522](https://github.com/KooshaPari/OmniRoute/pull/522) | refactor(db): console.* → pino in src/lib/db/ | 17 | +365/−232 |
| [#525](https://github.com/KooshaPari/OmniRoute/pull/525) | refactor: console.* → pino in remaining src/open-sse | 37 | +401/−233 |
| [#526](https://github.com/KooshaPari/OmniRoute/pull/526) | fix(governance): 6 empty catches + 10 weak fallbacks | 13 | +155/−18 |
| [#527](https://github.com/KooshaPari/OmniRoute/pull/527) | fix(encryption): F8 decrypt error distinction | 2 | +74/−7 |

Total: 13 PRs, ~123 files, ~8,200 lines added, ~1,200 lines removed.

## Patterns to avoid (for future contributors)

### Don't write these

```ts
// Empty catch
} catch {
  // silent
}

// Crypto-relevant silent return
} catch (err) {
  return "";
}

// Weak peer-dep fallback
const mod = await import(someModule).catch(() => null);

// State lie
} catch {
  return { alive: true };
}

// console.* in src/lib/ or open-sse/
console.error("Encryption failed:", err);
console.log(`[Context] ${msg}`);
```

### Write these instead

```ts
// Structured log
import { createLogger } from "@/shared/utils/logger";
const log = createLogger("domain:subsystem");
} catch (err) {
  log.error({ err, /* relevant context */ }, "context: failure description");
  // existing fallback behavior preserved
}

// Crypto-relevant: log AND propagate
} catch (err) {
  log.error({ err }, "encryption.deriveToken: failed — caller decides");
  throw new EncryptionDecryptionError("derivation failed", { cause: err });
}

// Weak peer-dep fallback: log the failure
const mod = await import(someModule).catch((err) => {
  log.warn({ err, someModule }, "context: optional module unavailable — feature degraded");
  return null;
});

// Honest state
} catch (err) {
  log.error({ err, pid }, "processManager: failed to read process info");
  return { pid, alive: false };
}

// pino logger
log.error({ err }, "encryption: encrypt failed");
log.info({ count }, "processed items");
```

## New tooling (PR #528)

Three new governance check scripts in `scripts/check/`:

| Script | Detects | Exit code |
|---|---|---|
| `check:crypto-failures` | crypto API calls followed by silent catches | 1 on finding |
| `check:console-in-src` | console.* in `src/lib/` + `open-sse/` | 1 on finding |
| `check:broken-imports` | known broken import paths (registry-driven) | 1 on finding |

Combined: `npm run check:governance` runs all 3 + the existing `check:fail-open`.

Note: GitHub Actions CI is billing-disabled for this account, so these checks
run locally only. Run before merging any PR.

## Specs authored (AgilePlus)

1. **`encryption-failclosed`** — Hardening the `encrypt()` plaintext fallback.
   Compares 3 design options. Recommendation: **C+A (startup canary + runtime
   throw)**. Implementation in PR #518.
2. **`keyv-as-embedded-default`** — Promote Keyv from optional driver to
   embedded default for fresh installs. Includes backwards-compat plan.
   Implementation in PR #521.

## Lessons learned

1. **Always check the base branch before forking a worktree.** Subagents that
   forked off an unmerged PR branch inherited that PR's diff, leading to
   contaminated PRs. The replacement PR approach (closing contaminated PR +
   opening a new one on a clean branch) works but loses review history.

2. **Concurrent worktree edits can conflict.** When multiple subagents work
   in the same worktree, they can step on each other. The fresh-worktree
   pattern (one worktree per logical change) is more reliable.

3. **Compile-time contract tests prevent type drift.** PR #505's
   `tests/unit/quota/quotaStore.contract.test.ts` (compile-time
   `_SqliteConforms = SqliteQuotaStore extends QuotaStore ? true : false`)
   is a low-cost safety net.

4. **Spec-first governance work pays off.** The 2 specs authored in #511
   (encryption-failclosed, keyv-as-embedded-default) gave the implementing
   subagents a clear contract — deviations were tracked in PR descriptions.

5. **Per-file allow-lists are essential.** The `check:console-in-src` and
   `check:crypto-failures` scripts produce false positives (intentional
   console.* in CLI tools, legitimate crypto checks in fallback paths).
   Allow-lists via `--allow-list=path` keep the checks useful without
   exempting entire classes.

6. **Crypto-relevant catches are special.** A catch on a crypto function that
   returns `""` or `null` is a security failure: it collapses all inputs to a
   constant-key value. These need not just `log.error` but typed-error
   propagation so callers can refuse to overwrite corrupted data.

7. **State-lie patterns are subtle.** `catch { return { alive: true } }` is
   a defensive lie that hides broken checks. Always return the honest
   answer (`alive: false`) + log the error.

## Future governance work (queue)

The remaining governance debt after this pass:

- **Console.* cleanup in CLI files**: `src/mitm/*` and `src/lib/oauth/utils/ui.ts`
  intentionally use console; document why in per-file comments.
- **Encrypt/decrypt typed-error propagation**: PR #527 added the
  `EncryptionDecryptionError` class but kept `decrypt()` returning `null`. A
  future PR could add `decryptStrict()` (throws) + update callers where the
  typed error adds value.
- **Quota contract test enforcement in CI**: run `tests/unit/quota/quotaStore.contract.test.ts`
  as part of `npm run check:governance`.
- **Property-based tests for crypto catches**: verify all catch blocks in
  crypto paths fire `log.error` with the expected structured context.
- **OAuth provider health audit**: deeper dive into `src/lib/oauth/providers/*`
  for per-provider silent failures.
- **Plugin system hardening**: `src/lib/plugins/{loader,manager}.ts` had 4
  silent catches fixed in #526 — verify the audit covers all plugin paths.
- **Self-healing test wiring**: `src/lib/resilience/__tests__/selfHealingManager.test.ts`
  exists but isn't picked up by vitest or `node --test`. Either add to
  `vitest.config.ts` `include` or migrate to vitest format.

## References

- Source spec: `plans/encryption-failclosed-spec.md` (883 lines)
- Source spec: `plans/keyv-as-embedded-default-spec.md` (698 lines)
- Existing governance: `src/lib/db/AGENTS.md`, `~/.claude/AGENTS.md`,
  `~/.claude/CLAUDE.md`, `/Users/kooshapari/CodeProjects/CLAUDE.md`,
  `/Users/kooshapari/CodeProjects/Phenotype/AGENTS.md`
