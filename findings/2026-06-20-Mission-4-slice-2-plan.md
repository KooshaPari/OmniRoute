# Mission 4 Slice 2 — pheno-config → Configra execution plan

**Date:** 2026-06-20
**Companion to:** `2026-06-20-Mission-4-candidate-selection.md`
**Gate table:** ADR-035 (Configra migration gates)

## Target

- **Consumer:** `KooshaPari/pheno-config` (Rust)
- **Source dep:** `phenotype-config = "0.1"`
- **Target dep:** `configra = "0.1"`

## PRs (5 total per ADR-035 gate table)

### PR 1: Compat shim (pheno-config internal)

- Branch: `chore/l5-104-pheno-config-to-configra-shim-2026-06-20`
- Repo: `KooshaPari/pheno-config`
- Diff:
  - `Cargo.toml`: add `configra = "0.1"` alongside existing `phenotype-config = "0.1"`
  - `src/compat.rs`: re-export `phenotype_config::Config` shape via `configra::Config` adapter
  - `src/lib.rs`: route all public API through the compat shim
- Tests: `cargo test --workspace` green; existing `pheno-config/tests/integration.rs` unchanged

### PR 2-4: Downstream consumer bumps

- Branch pattern: `chore/l5-104-bump-configra-{crate}-2026-06-20`
- Repos: 3+ downstream crates that currently depend on `pheno-config` (TBD via L6 health audit)
- Diff: `Cargo.toml` `phenotype-config = "0.1"` → `configra = "0.1"`; imports unchanged (compat shim handles API)

### PR 5: Registry flip

- Branch: `chore/l5-104-pheno-config-uses-configra-2026-06-20`
- Repo: `KooshaPari/phenotype-registry`
- Diff: row `pheno-config` `uses: phenotype-config` → `uses: configra`

## Acceptance criteria

1. All 5 PRs merged
2. `pheno-config` `cargo test` green against `configra = "0.1"`
3. No downstream crate fails its own test suite
4. Registry index reflects the dep change
5. `phenotype-config` deprecation timeline (ADR-031) continues unaffected (2026-07-15)

## Effort estimate

- PR 1 (compat shim): 4 hours (largest)
- PR 2-4 (downstream bumps): 30 min each, parallelizable
- PR 5 (registry): 10 min
- Verification: 2 hours (full workspace build + test)

Total: ~8 hours wall (1 working day).

## Risks

| Risk | Probability | Mitigation |
|------|-------------|------------|
| API drift breaks consumers | Medium | Compat shim with 100% re-export surface |
| Cargo.lock skew across workspace | Low | Use `cargo update -w` after all bumps land |
| `phenotype-config` deprecation timeline forced earlier | Low | Slice 2 is opt-in, doesn't touch `phenotype-config` |
| Hidden runtime behavior change | Medium | Compat shim routes 100% through `phenotype_config::Config` impls initially; flip only in slice 3 |

## Out of scope (deferred to slice 3+)

- Remove compat shim (slice 3, after slice 2 stabilizes)
- TS/Go consumers (v14, after Configra SDK lands)
- `pheno-config-schema` deprecation (decide in slice 2 retro)
