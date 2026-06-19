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
| `crates/phenotype-health` | PO `rust/phenotype-health` | ✅ Wave A closeout 2026-06-18 — row #22 done; HexaKit#261 pin merged |

### Wave A closeout (2026-06-18, D-12)

- `phenotype-health` disposition row **done**; canonical runtime on PhenoObservability main
- Fleet grep: zero new HexaKit path deps on phenotype-health (checkpoint)
- `phenotype-sentry-config` (#35): ✅ done 2026-06-18 — PhenoObservability#168; rust/phenotype-sentry-config on PO main

---

## Phase P2 — config / resilience (2026-06-17)

| Path | Canonical owner | Status |
|------|-----------------|--------|
| `crates/settly` | phenotype-config | ✅ exclude + Wave 8 stub prune |
| `crates/stashly` | phenoShared / phenotype-types | ✅ exclude #250 |
| `forgecode-fork` | HexaKit scaffold (ADR-003) | **note** — no separate repo; `KooshaPari/forgecode` external fork (Tasken boundary) |

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

- ~~`phenotype-contracts`~~ — generic `Contract` trait interim phenoShared until `phenotype-rust-sdk` facade (slice crates drained wave 5)
- ~~`phenotype-validation`, `phenotype-string`~~ — resolved Phase 3 Wave A/B (#271) + phenoShared E2a
- ~~`libs/phenotype-config-core`~~ — resolved Phase 4 wave 5 (#276): phenoShared git pin; `phenotype-core::config` trait re-exports

**Keep in HexaKit short-term (scaffold-adjacent):**

- `crates/hexakit-cli`
- `crates/phenotype-contract-tests` (template CI harness)
- ~~`libs/nexus`, `libs/phenotype-config-core` (bootstrap only)~~ — nexus excluded Wave H (#269); config-core evicted wave 5 (#276)

### Phase 4 wave 5 (2026-06-19) — config-core + stub prune tail — **complete**

Wave 5a (#277) drained 7 interim phenoShared git pins; wave 5b (#278 @ `d83d1ca`) drained remaining 11 pins — **zero** `KooshaPari/phenoShared` workspace git deps on HexaKit main. Backlog tasks #56–#64, #68–#70 closed; registry ledger [#235](https://github.com/KooshaPari/phenotype-registry/pull/235), [#242](https://github.com/KooshaPari/phenotype-registry/pull/242).

| Crate / action | Action | PR |
|----------------|--------|-----|
| `phenotype-validation` | exclude + git dep → phenoShared | HexaKit #271 (task #57) |
| `phenotype-string` | exclude + git dep → phenoShared | HexaKit #271 (task #58) |
| `libs/phenotype-config-core` | exclude + git dep → phenoShared (H14 interim) | HexaKit #276 (task #59) |
| `phenotype-core` config re-exports | trait API align (`ConfigLoader`, `Priority`) | HexaKit #276 (task #56) |
| Stub prune tail | phenotype-string orphan src, config-core duplicate, sentry-config tree removed | HexaKit #276 (tasks #62, #64) |
| `phenotype-sentry-config` tree | removed post-PO #168 absorb | HexaKit #276 (task #64) |

**Workspace audit (task #70):** 15 members, 52 excluded — scaffold-only target approaching.

**Org grep checkpoint (task #68):** zero new `KooshaPari/HexaKit` path deps in fleet manifests (2026-06-19); see `docs/disposition/hexakit-path-deps-checkpoint-2026-06-19.md`.

---

## Wave 5b — phenoShared git pin drain complete (2026-06-19)

HexaKit `feat/wave5b-phenoshared-drain` → merged **HexaKit#278** @ `d83d1ca`.  
**Zero** `KooshaPari/phenoShared` git pins remain in `HexaKit/Cargo.toml` workspace.dependencies.

### Wave 5b drained (verified on owner `main` via `cargo check -p phenotype-core`)

| Pin | Terminal owner | Repo path |
|-----|----------------|-----------|
| `phenotype-event-bus` | Eventra | `rust/phenotype-event-bus` (Eventra#21) |
| `phenotype-event-sourcing` | Eventra | `rust/phenotype-event-sourcing` (Eventra#21) |
| `phenotype-time` | phenotype-types | `crates/phenotype-time` (phenotype-types#2) |
| `phenotype-iter` | phenotype-types | `crates/phenotype-iter` (phenotype-types#2) |
| `phenotype-string` | phenotype-types | `crates/phenotype-string` (phenotype-types#2) |
| `phenotype-validation` | phenotype-types | `crates/phenotype-validation` (phenotype-types#2) |
| `phenotype-config-core` | phenotype-config | `crates/phenotype-config-core` (phenotype-config#4) |
| `phenotype-async-traits` | phenotype-rust-sdk | `crates/phenotype-async-traits` (new repo) |
| `phenotype-macros` | phenotype-rust-sdk | `crates/phenotype-macros` (new repo) |
| `phenotype-contracts` | phenotype-rust-sdk | `crates/phenotype-contracts` (new repo) |
| `phenotype-health` | ResilienceKit | `crates/phenotype-health` (`HealthChecker` API; PO runtime differs) |
| `phenotype-cache-adapter` | HexaKit genesis | `libs/phenotype-cache-adapter` path stub (archive-if-unused) |

### Wave 5a drained (HexaKit#277)

| Pin | Terminal owner | Repo path |
|-----|----------------|-----------|
| `phenotype-http-client-core` | ResilienceKit (`phenotype-resilience`) | `crates/phenotype-http-client-core` |
| `phenotype-state-machine` | ResilienceKit | `crates/phenotype-state-machine` |
| `phenotype-policy-engine` | ResilienceKit | `crates/phenotype-policy-engine` |
| `phenotype-auth-contracts` | Authvault | `rust/phenotype-auth-contracts` |
| `phenotype-event-contracts` | Eventra | `rust/phenotype-event-contracts` |
| `phenotype-agent-contracts` | Agentora | `rust/phenotype-agent-contracts` |
| `phenotype-security-aggregator` | Authvault | `authkit/rust/phenotype-security-aggregator` |

**Verification:** `cargo check -p phenotype-core` green; `rg 'KooshaPari/phenoShared' Cargo.toml` → 0 workspace git pins.

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
