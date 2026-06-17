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

**Deferred:** `phenotype-contracts` — HexaKit `InMemory*` adapter surface diverges from phenoShared HEAD (`Contract`/`MetricsHook` traits).

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
