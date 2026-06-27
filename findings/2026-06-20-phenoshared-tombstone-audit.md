# phenoShared — Tombstone Audit

**Date:** 2026-06-20
**Scope:** Inspect `repos/phenoShared/TOMBSTONE.md`, capture migration plan, verify Eidolon still compiles against the new home (`pheno/crates/phenotype-error-core`).

---

## 1. TOMBSTONE content (verbatim)

Source: `repos/phenoShared/TOMBSTONE.md` (41 lines)

```markdown
# phenoShared — Tombstone (ADR-ECO-014)

**Status:** DECOMPOSED / INTERIM STAGING RETIRED
**Date:** 2026-06-19
**Policy:** [ADR-ECO-014](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adr/ADR-ECO-014-phenoshared-decompose.md)

`phenoShared` was an interim dynamic-install monorepo for cross-cutting Phenotype
Rust crates. All crate source has been relocated to **DOMAIN_ROLES terminal owners**
or absorbed into existing repos. This repository is retained as a **tombstone** with
disposition pointers only — no publishable workspace remains.

## Do not

- Add new crates here
- Pin new git dependencies to this repo
- Expect `cargo build --workspace` to succeed

## Terminal owners (absorb targets)

| Crate(s) | Terminal owner |
|----------|----------------|
| `phenotype-error-core`, `phenotype-errors`, `phenotype-iter`, `phenotype-string`, `phenotype-validation`, `phenotype-time`, `phenotype-content-hash` | [phenotype-types](https://github.com/KooshaPari/phenotype-types) |
| `phenotype-config-core`, `phenotype-config-loader` | [phenotype-config](https://github.com/KooshaPari/phenotype-config) |
| `phenotype-http-client-core`, `phenotype-state-machine`, `phenotype-policy-engine`, `phenotype-health`, `stashly`, `phenotype-retry` | [phenotype-resilience](https://github.com/KooshaPari/ResilienceKit) |
| `phenotype-event-bus`, `phenotype-event-sourcing` | [Eventra](https://github.com/KooshaPari/Eventra) |
| `phenotype-logging` | [PhenoObservability](https://github.com/KooshaPari/PhenoObservability) |
| `phenotype-async-traits`, `phenotype-macros`, `phenotype-contracts` | [phenotype-rust-sdk](https://github.com/KooshaPari/phenotype-rust-sdk) |
| `phenotype-security-aggregator`, `phenotype-secret` | [Authvault](https://github.com/KooshaPari/Authvault) |
| `phenotype-cache-adapter` | [HexaKit](https://github.com/KooshaPari/HexaKit) inline stub (`crates/phenotype-cache-adapter-stub`) — archive-if-unused |
| `phenotype-domain`, `phenotype-application`, `phenotype-port-interfaces` | Distributed to domain SDKs per bounded context |
| `phenotype-postgres-adapter`, `phenotype-redis-adapter`, `phenotype-http-adapter` | Infrastructure adapters — owner TBD per service repo |
| `phenotype-nanovms-client`, `phenotype-bid`, `phenotype-build-info`, `phenotype-context`, `phenotype-rate-limit`, `ffi_utils` | Orphan / evaluate per registry backlog |

## Optional rename

Consider renaming this repo to `phenoShared-tombstone` after fleet pin drain completes
(registry PR required; do not rename without governance approval).

## Disposition docs

See [`docs/disposition/`](docs/disposition/) for wave-by-wave relocation records.
```

---

## 2. Migration map (terminal owners)

The TOMBSTONE.md table above IS the migration map. Re-grouped by target repo for clarity:

### 2.1 `KooshaPari/phenotype-types` (7 crates)
- `phenotype-error-core`
- `phenotype-errors`
- `phenotype-iter`
- `phenotype-string`
- `phenotype-validation`
- `phenotype-time`
- `phenotype-content-hash`

### 2.2 `KooshaPari/phenotype-config` (2 crates)
- `phenotype-config-core`
- `phenotype-config-loader`

### 2.3 `KooshaPari/ResilienceKit` (6 crates)
- `phenotype-http-client-core`
- `phenotype-state-machine`
- `phenotype-policy-engine`
- `phenotype-health`
- `stashly`
- `phenotype-retry`

### 2.4 `KooshaPari/Eventra` (2 crates)
- `phenotype-event-bus`
- `phenotype-event-sourcing`

### 2.5 `KooshaPari/PhenoObservability` (1 crate)
- `phenotype-logging`

### 2.6 `KooshaPari/phenotype-rust-sdk` (3 crates)
- `phenotype-async-traits`
- `phenotype-macros`
- `phenotype-contracts`

### 2.7 `KooshaPari/Authvault` (2 crates)
- `phenotype-security-aggregator`
- `phenotype-secret`

### 2.8 `KooshaPari/HexaKit` (inline stub, 1 crate)
- `phenotype-cache-adapter` → `crates/phenotype-cache-adapter-stub` (archive-if-unused verdict at `docs/disposition/phenotype-cache-adapter-archive-verdict.md`)

### 2.9 Distributed / domain SDKs (3 crates)
- `phenotype-domain`
- `phenotype-application`
- `phenotype-port-interfaces`

### 2.10 Infrastructure adapters — owner TBD per service repo (3 crates)
- `phenotype-postgres-adapter`
- `phenotype-redis-adapter`
- `phenotype-http-adapter`

### 2.11 Orphan / evaluate per registry backlog (6 crates)
- `phenotype-nanovms-client`
- `phenotype-bid`
- `phenotype-build-info`
- `phenotype-context`
- `phenotype-rate-limit`
- `ffi_utils`

**Total:** 36 crates tracked in TOMBSTONE.md.

---

## 3. Eidolon compile check result

**Command:** `cargo check -p eidolon-core 2>&1 | tail -10`
**Working dir:** `repos/Eidolon`
**Result:**

```
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.15s
```

**Verdict:** ✅ **PASS** — `eidolon-core` compiles clean against `phenotype-error-core` at the path dep declared in `Eidolon/Cargo.toml:28`:

```toml
phenotype-error-core = { path = "../pheno/crates/phenotype-error-core" }
```

This proves the migration preserved the public surface Eidolon depends on: the path dep now resolves to the live canonical crate living under `KooshaPari/pheno` (not under the defunct `phenoShared`), and `eidolon-core` builds without errors.

---

## 4. Platform variant check result

**File:** `repos/pheno/crates/phenotype-error-core/src/lib.rs`
**Command:** `grep -c "Platform" …` → **4 occurrences**
**Required:** ≥3 (enum variant + status_code match arm + is_retryable predicate + test usage)

| Line | Context | Role |
|-----:|---------|------|
| 63   | `Platform(String),` | enum variant declaration |
| 84   | `Self::Platform(_) => 500,` | HTTP status_code mapping |
| 92   | `matches!(self, Self::RateLimited \| Self::Timeout \| Self::Internal(_) \| Self::Platform(_))` | is_retryable predicate |
| 631  | `let err = ApiError::Platform("CGEventSource failed".into());` | test usage (macOS-specific CGEventSource failure case) |

**Verdict:** ✅ **PASS** — `phenotype_error_core::ApiError::Platform` exists, is mapped to HTTP 500, is marked retryable, and is exercised by a test. Full functional surface preserved in the new home.

---

## 5. GitHub remote state

**Local `repos/phenoShared`:**
- HEAD: `14bb34c` — `feat(ci): add reusable drift-check workflow (L5-116 FU6) — absorbs pheno-ci-templates role into phenoShared substrate`
- Parent of HEAD: `d1f40cb` — `chore: gut phenoShared to tombstone (ADR-ECO-014 decompose) (#197)` ← THE decompose commit
- Remote: `origin → git@github.com:KooshaPari/phenoShared.git` (configured but unreachable)

**Live GitHub (via `gh api repos/KooshaPari/phenoShared`):**
- HTTP 404 — repo does not exist on GitHub (was deleted or never existed at that name on the KooshaPari org).

**Live `KooshaPari/pheno` main HEAD:**
- `f94e88d` — `chore(pheno): remove orphaned phenotype-event-bus tombstone (L5-111) (#237)`
- (i.e. `phenotype-error-core` lives here, and the Eventra absorb is already reflected — no duplicate `phenotype-event-bus` tombstone in `pheno`.)

---

## 6. Outstanding preservation items

These items still need attention per the TOMBSTONE policy and surrounding governance:

### 6.1 Still unresolved (owners TBD / orphans)
1. **Infrastructure adapters** (3 crates) — `phenotype-postgres-adapter`, `phenotype-redis-adapter`, `phenotype-http-adapter` → owner TBD per service repo. No concrete absorbing PR tracked.
2. **Orphan crates** (6) — `phenotype-nanovms-client`, `phenotype-bid`, `phenotype-build-info`, `phenotype-context`, `phenotype-rate-limit`, `ffi_utils` → flagged "evaluate per registry backlog"; no deadlines set.
3. **Distributed domain SDKs** (3) — `phenotype-domain`, `phenotype-application`, `phenotype-port-interfaces` → "distributed to domain SDKs per bounded context". No bounded-context assignment table in TOMBSTONE.md.

### 6.2 Disposition docs (present in `repos/phenoShared/docs/disposition/`)
4. `decompose-tombstone-2026-06-19.md` — the decompose commit log
5. `phenotype-cache-adapter-archive-verdict.md` — archive-if-unused verdict for `phenotype-cache-adapter` stub
6. `wave-d-stashly-reloc.md` — stashly → ResilienceKit wave record
7. `wave-e-absorption.md` — HexaKit utility wave record (95d7479 parent)

These exist locally but are not mirrored to the registry `docs/adr/` directory referenced by the TOMBSTONE policy link.

### 6.3 Policy / governance gaps
8. **TOMBSTONE policy link points to GitHub**: `https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adr/ADR-ECO-014-phenoshared-decompose.md` — needs local mirror or annotation that ADR-ECO-014 lives on `phenotype-registry` (not `repos/`).
9. **Optional rename** — TOMBSTONE.md suggests renaming to `phenoShared-tombstone` after "fleet pin drain completes"; no completion date or pin-drain tracker exists.
10. **`docs/disposition/` not git-tracked elsewhere** — if the local `repos/phenoShared/` clone is the only copy of the disposition records, it is at risk of being lost when the worktree is cleaned up. Recommend mirroring to `phenotype-registry/docs/disposition/phenoShared/`.
11. **Local-only `Cargo.lock`** at `phenoShared/Cargo.lock` (top-level only; no `Cargo.toml`) — vestigial from pre-decompose builds; can be removed in a cleanup commit.
12. **`repos/phenoShared` itself is PAUSED-tracked in the monorepo** per ADR-023 default; no active work expected, but the local clone is the de-facto disposition record store — preserve until §6.1 is resolved.

---

## 7. Bottom line

- **TOMBSTONE.md EXISTS** (41 lines, dated 2026-06-19, anchored to ADR-ECO-014).
- **Eidolon compiles** against the new `pheno/crates/phenotype-error-core` home (path dep at `Eidolon/Cargo.toml:28`).
- **Platform variant intact** (4 references: enum, status, retryable, test).
- **GitHub `KooshaPari/phenoShared` returns HTTP 404** — repo is dead upstream; the local monorepo clone is the only tombstone copy.
- **Outstanding items: 12** — 9 unresolved migrations + 3 governance/preservation gaps.
