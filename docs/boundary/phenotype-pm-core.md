---
repo: "phenotype-pm-core"
role: pm-tooling
status: absorbed
absorbed_into: "phenotype-tooling"
absorbed_at: "phenotype-tooling/crates/{traceability-core,traceability-decorators,trace-gate}"
absorbed_date: 2026-07-17
last_boundary_review: 2026-07-17
review_cadence: never (absorbed)
---

# Boundary — phenotype-pm-core (ABSORBED)

## Disposition

**ABSORBED** into `phenotype-tooling` on 2026-07-17.

The phenotype-pm-core repo was a small Rust workspace (142KB, 7 branches)
with 3 crates providing PM/traceability functionality:
- `crates/traceability-core` — core traceability data model (14 source files)
- `crates/traceability-decorators` — decorator pattern for traceability (4 source files + binary)
- `crates/trace-gate` — trace gate for PM governance (4 source files + binary + tests)

## Content migrated

| Crate | Source path | Target path |
|-------|-------------|-------------|
| traceability-core | `phenotype-pm-core/crates/traceability-core/` | `phenotype-tooling/crates/traceability-core/` |
| traceability-decorators | `phenotype-pm-core/crates/traceability-decorators/` | `phenotype-tooling/crates/traceability-decorators/` |
| trace-gate | `phenotype-pm-core/crates/trace-gate/` | `phenotype-tooling/crates/trace-gate/` |

## Workspace registration

Added to `phenotype-tooling/Cargo.toml` workspace members:
```toml
"crates/trace-gate",
"crates/traceability-core",
"crates/traceability-decorators",
```

Also added missing workspace deps (`indexmap`, `uuid v5` feature). Build verified
(`cargo check` passes with only doc warnings).

## Outcome

Source repo `KooshaPari/phenotype-pm-core` archived on GitHub.
Registry disposition-index updated: disposition=ABSORB, target=phenotype-tooling.
