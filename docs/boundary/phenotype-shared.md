---
repo: "phenotype-shared"
role: shared
status: archived
last_boundary_review: 2026-07-17
review_cadence: 30d
in_scope:
  - "<see absorbed-into pheno crates>"
out_of_scope:
  - "<absorbed — see pheno>"
---

# Boundary — phenotype-shared

## In Scope

<Absorbed into pheno monorepo 2026-07-17 — see pheno boundary docs for current scope.>

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| `crates/phenotype-manifest` | `pheno/crates/phenotype-manifest` | Absorbed 2026-07-17 |
| `crates/phenotype-port-adapter-shim` | `pheno/crates/phenotype-port-adapter-shim` | Absorbed 2026-07-17 |
| `crates/ffi_utils` | `pheno/crates/ffi_utils` | Absorbed 2026-07-17 |
| `schemas/odin.nvms.schema.json` | `pheno/schemas/odin.nvms.schema.json` | Absorbed 2026-07-17 |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| odin.nvms v0.2 schema | this-repo → pheno | JSON Schema (Draft 2020-12) | green |
| PortAdapter/NvmsAdapter traits | this-repo → pheno | Rust trait | green |
| DeploymentId/PortManifest value types | this-repo → pheno | Rust types | green |
| FFI Mutex alias | this-repo → pheno (helios_cli) | Rust alias | green |

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** forge subagent (queue-refresh-batch2)
**Worklog / finding:** `audits/absorption-justifications/phenotype-shared-2026-07-17.md`
**Decisions:**
- Source repo `KooshaPari/phenotype-shared` (293KB, 4 remote branches) lifted as 3 distinct workspace
  members of `pheno` (`crates/phenotype-manifest`, `crates/phenotype-port-adapter-shim`, `crates/ffi_utils`).
- Package names verified non-colliding against existing pheno members.
- `cargo check -p phenotype-manifest -p phenotype-port-adapter-shim -p ffi_utils` passes.
- `cargo test` for the absorbed crates: 17 passed, 0 failed.
- Source repo archived on GitHub via `gh repo archive KooshaPari/phenotype-shared -y` on 2026-07-17.

**Next review:** 2026-08-17