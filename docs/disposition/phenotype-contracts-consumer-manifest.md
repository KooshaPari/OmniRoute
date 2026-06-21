# phenotype-contracts consumer manifest (D-01 slice 1)

**Source:** HexaKit `crates/phenotype-contracts`  
**Interim canonical:** phenoShared `crates/phenotype-contracts` (git pin [HexaKit#264](https://github.com/KooshaPari/HexaKit/pull/264))  
**Plan:** [contracts-decompose-plan.md](./contracts-decompose-plan.md)  
**Scan date:** 2026-06-18  
**Method:** `migration-work` workspace `Cargo.toml` grep; GitHub code search attempted (TLS timeout — local scan authoritative)

## Consumer scan

| Repo / path | Import style | Direct consumer(s) | Blocker | Next action |
|-------------|--------------|--------------------|---------|-------------|
| **HexaKit** | workspace path + member | `phenotype-core` re-export | Wave AB prune (#266) | Git-pin traits → phenoShared; exclude local crate after consumer manifest |
| **HexaKit-wtrees/wave3-eviction** | git → phenoShared `main` | workspace | open PR head | Merge #264 pattern to main |
| **phenoShared** | path (interim SSOT) | fleet git pins | P4 decompose gate | Hold traits here for slice 1 only |
| **Pyron** | path (vendored copy) | local workspace members | submodule / validation fetch | Repoint to phenoShared git pin; drop vendored crate |
| **Pyron-wtrees/wave3-repoint** | path (vendored copy) | local workspace | same as Pyron | Lockstep with Pyron #56 pattern |
| **ResilienceKit** | path (vendored under `rust/`) | `phenotype-port-traits` | none | Slice 3+ — resilience domain contracts → **phenotype-resilience** |
| **phenotype-python-sdk** `packages/auth-kit/rust` | path (vendored) | auth-kit Rust workspace | Block-C absorbed | Slice 2 — auth contract traits → **Authvault** |
| **phenotype-python-sdk** `packages/resilience-kit/rust` | path (vendored) | `phenotype-port-traits` | kit umbrella | Slice 3 — port traits adjacency → **phenotype-resilience** |
| **PhenoLang** | path (vendored copy) | local DSL workspace | Wave H done | phenoUtils index canonical (gw-phenolang closed) |
| **phenotype-registry** | docs / disposition only | registry rows, ECOSYSTEM_MAP | none | Track slices; do **not** close row #11 until terminal owners |

**Not found in migration-work (no direct `phenotype-contracts` dep today):** Authvault, Eventra, Agentora, substrate, TestingKit, PhenoObservability, phenotype-config.


## 2026-06-20 repo-level PhenoContracts sweep

GitHub code search for external runtime consumers of `PhenoContracts`, `phenotype-contracts`, and `contract_verifier` found no live external `Cargo.toml`, `package.json`, or `go.mod` dependency on the `KooshaPari/PhenoContracts` repo itself. Hits are either inside `PhenoContracts`, historical docs/worklogs, or separate in-flight `phenotype-contracts` crate copies governed by this manifest.

Delete-readiness ruling: **hold-decompose**, not archive-ready. The repo remains active/non-archived and owns formal-verification TS ports/adapters (`ports/contract_verifier.ts`, `ports/adapters/kani.ts`, `ports/adapters/prusti.ts`) plus Rust crate surfaces. Archive/delete is safe only after those adapter surfaces are absorbed into a named terminal owner or explicitly retired in a follow-up ADR.
## Slice 1 scope (in progress)

Port traits and domain contract surface (`Contract`, `Event`, `MetricsHook`, …) remain on **phenoShared interim** via HexaKit#264 git pin:

1. Canonical traits live in `phenoShared/crates/phenotype-contracts`.
2. HexaKit retains `phenotype-contract-adapters` (InMemory*) — **done** per #264.
3. External consumers repoint manifests to phenoShared git pin (not HexaKit path).
4. Row **#11** stays `fsm: relocating` until per-domain slices land.

## Next slices (DOMAIN_ROLES terminal owners)

| Slice | Domain | Terminal owner | Role | Notes |
|-------|--------|----------------|------|-------|
| 2 | Auth / policy contracts | **Authvault** | `connect` | Security, policy-engine, bid/content-hash adjacency from AuthKit absorption |
| 3 | Event / bus contracts | **Eventra** | events | `phenotype-event-bus` already terminal Eventra; event trait slices follow |
| 4 | Agent / HTTP adapters | **Agentora** | `agent-runtime` / `connect` | HTTP/event adapter traits; substrate MCP plane for runtime edges |

Per [ADR-ECO-014](../adrs/ADR-ECO-014-phenoshared-decompose.md): phenoShared is **interim staging only** — each slice opens a per-domain PR when the owner is named in [DOMAIN_ROLES.md](../../DOMAIN_ROLES.md), not phenoShared as terminal.

## Verification

```bash
# Re-run consumer scan (from migration-work root)
Get-ChildItem -Recurse -Filter Cargo.toml | Select-String 'phenotype-contracts'

# Registry meta
jq '.rows[] | select(.path | test("phenotype-contracts"))' registry/disposition-index.json
```

