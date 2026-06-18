# HexaKit domain crate eviction inventory

> **Lane O output** (2026-06-17). Companion to `BOUNDARY_OWNERS.md` P0 and
> `ECOSYSTEM_DAG.md` lanes O–P. HexaKit end-state = **scaffold only**
> (`templates/hexagon/**`, `.template.*`, CLI bootstrap) — not a lib warehouse.

---

## Evicted from workspace (P0, 2026-06-17)

| Path | Canonical owner | Action |
|------|-----------------|--------|
| `Metron/` | `PhenoObservability/crates/metrickit` | Workspace member removed; repo archived |
| `agileplus/crates/*` | `KooshaPari/AgilePlus` | Workspace members removed; Agentora staging removed (#81) |

Trees remain on disk with `README` redirect stubs for audit; `exclude` in root `Cargo.toml`.

---

## Phase P1 — observability (2026-06-17)

| Path | Canonical owner | Status |
|------|-----------------|--------|
| `Traceon/` | `PhenoObservability/crates/tracingkit` | ✅ excised #249 |
| `crates/phenotype-telemetry` | PO / phenoShared | Consumer manifest |
| `crates/phenotype-logging` | phenoShared | Wave E |
| `crates/phenotype-health` | phenoShared traits / PO runtime | Wave 12 #261 — traits git pin; PO axum/cli superset |

---

## Phase P2 — config / resilience (2026-06-17)

| Path | Canonical owner | Status |
|------|-----------------|--------|
| `crates/settly` | phenotype-config | ✅ exclude + Wave 8 stub prune |
| `crates/stashly` | phenoShared / phenotype-types | ✅ exclude #250 |
| `forgecode-fork` | Tasken / forge boundary | TBD |

---

## Phase P3 — shared infra (`phenotype-*` crates)

~40 workspace members under `crates/phenotype-*` target **phenoShared** or
**phenotype-rust-sdk** optional modules per `LANGUAGE_STACK.md`. Do not delete
until consumer repoint PRs land (Agentora, PhenoObservability vendor/, AgilePlus).

### P3 wave 1 (2026-06-17) — error crates → phenoShared

| Crate | Action | PR |
|-------|--------|-----|
| `phenotype-error-core` | workspace exclude + git dep | HexaKit #252 |
| `phenotype-errors` | workspace exclude + git dep | HexaKit #252 |

**Deferred:** bulk phenoShared git pin — `phenotype-core` re-export API diverges from phenoShared HEAD (`StateMachine`, `CacheAdapter`, `Timestamp`).

### P3 wave 2 (2026-06-17) — event + http-client → phenoShared

| Crate | Action | PR |
|-------|--------|-----|
| `phenotype-event-bus` | workspace exclude + git dep | HexaKit #256 |
| `phenotype-event-sourcing` | workspace exclude + git dep | HexaKit #256 |
| `phenotype-http-client-core` | workspace exclude + git dep | HexaKit #256 |

### P3 wave 3 (2026-06-17) — infra primitives → phenoShared

| Crate | Action | PR |
|-------|--------|-----|
| `phenotype-logging` | workspace exclude + git dep | HexaKit #258 |
| `phenotype-time` | workspace exclude + git dep | HexaKit #258 |
| `phenotype-state-machine` | workspace exclude + git dep | HexaKit #258 |
| `phenotype-policy-engine` | workspace exclude + git dep | HexaKit #258 |

### P3 wave 4 (2026-06-17) — security + macros + async-traits → phenoShared

| Crate | Action | PR |
|-------|--------|-----|
| `phenotype-security-aggregator` | workspace exclude + git dep | HexaKit #260 |
| `phenotype-async-traits` | workspace exclude + git dep | HexaKit #260 |
| `phenotype-macros` | workspace exclude + git dep | HexaKit #260 |

**Deferred:** ~~`phenotype-contracts`~~ — resolved Wave 13: traits → phenoShared git pin; `InMemory*` adapters → `phenotype-contract-adapters` scaffold (#264).

### Wave 13 (2026-06-17) — parallel lanes B/C/D

| Crate / component | Action | PR |
|-------------------|--------|-----|
| `phenotype-test-infra` | exclude + git dep → TestingKit | HexaKit #264 |
| `phenotype-bdd` | exclude stub (canonical pending journeys) | HexaKit #264 |
| `phenotype-contracts` (traits) | exclude + git dep → phenoShared | HexaKit #264 |
| `phenotype-contract-adapters` | scaffold member (HexaKit-local adapters) | HexaKit #264 |
| `crates/cipher` | exclude + git dep → Authvault `phenotype-cipher` | HexaKit #264 |

**Lane A:** `phenotype-config-loader` pre-merged eco-consolidate #255.

**16 phenoShared git pins** cumulative (includes config-loader + contracts).

### Wave 12 (2026-06-17) — health traits + cache adapter → phenoShared

| Crate | Action | PR |
|-------|--------|-----|
| `phenotype-health` | workspace exclude + git dep | HexaKit #261 |
| `phenotype-cache-adapter` | workspace exclude + git dep | HexaKit #261 |

PO `phenotype-health-axum` / `phenotype-health-cli` remain PO-only runtime layers.

### Wave 13 (2026-06-17) — stub prune (git-pinned excluded)

| Action | PR |
|--------|-----|
| Remove local `src/` + `Cargo.toml` for 12 phenoShared git deps (MIGRATED.md only) | HexaKit #262 |
| phenoShared duplicate `phenotype-cache-adapter` package fix | phenoShared #179 |

**Deferred (API diverge — still workspace members):**

- `phenotype-contracts`, `libs/phenotype-config-core`, `phenotype-validation`, `phenotype-string` — `phenotype-core` re-exports blocked; `phenotype-validation` and `phenotype-string` blocked further by Pyron submodule fetch failure (`Apisync` missing `.gitmodules` URL).

**Keep in HexaKit short-term (scaffold-adjacent):**

- `crates/hexakit-cli`
- `crates/phenotype-contract-tests` (template CI harness)
- `libs/nexus`, `libs/phenotype-config-core` (bootstrap only)

---

## Scaffold (never evict)

| Path | Role |
|------|------|
| `templates/hexagon/**` | New-repo hexagonal bootstrap |
| `.template.ci.yml`, `.template.*` | Org CI/governance mirrors |
| `docs/boundary/DISPOSITION.md` | Relocation authority |

---

## Verification

```bash
# After HexaKit P0 PR merges:
rg '"Metron"|agileplus/crates' HexaKit/Cargo.toml   # expect 0 member lines
rg 'KooshaPari/HexaKit' org manifests --glob 'Cargo.toml'  # shrinking over waves
```
