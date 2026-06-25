# PhenoCompose -- Boundary

> Boundary file for PhenoCompose. Updated with 2026-06-23 audit data.

## In Scope

PhenoCompose owns the **hexagonal (Ports & Adapters) composition
library** for the Phenotype runtime. The crates are organised as:

1. **7 port-trait crates** (`port-{types,composer,publisher,runtime,
   secret,di,config}`): each crate declares one port trait with
   `async_trait` and a `+ Send + Sync` bound. `port-types` is the
   canonical 590-line `port_types::Error` aggregate.
2. **`pheno-config`**: configuration loading via `figment` (Pydantic-
   equivalent for Rust) with full redaction of secrets.
3. **`pheno-compose-driver`**: synchronous `Driver` façade that wires
   the 7 port traits to a concrete backend.
4. **`secret-file-adapter`**: file-backed `SecretStore` implementation
   (used by the driver when no cloud KMS is configured).
5. **`ports`**: runtime orchestrator that delegates to adapters
   (`adapters/argocd.rs`, `adapters/helm.rs`, etc.).
6. **`bindings/rust-ffi`**: 12 `extern "C"` functions + a complete
   in-process `shim` reference implementation (lines 398-598) so
   downstream languages can call the same surface.
7. **`bindings/go-c-export`**: `//go:build ignore` documentation C
   surface (the live build is via `pheno-integration` in nanovms).
8. **TS packages** (`packages/{pheno-config,pheno-errors,
   pheno-tracing,integration}`): TypeScript mirror of the Rust port
   surface for SvelteKit/Next.js apps.
9. **Mojo/Zig bindings** (`bindings/{mojo,zig}`): experimental ML
   runtime bindings (Mojo for tensor-heavy code, Zig for zero-cost
   FFI).

`#![forbid(unsafe_code)]` and `#![deny(missing_docs)]` are enforced
at `port-types/src/lib.rs:1-5`.

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Library implementations | `pheno*` repos | Ports are the contracts; libs are the consumers |
| The agent runtime | `thegent` | thegent is the orchestrator; PhenoCompose is the contracts |
| Cloud-specific adapters (AWS, GCP) | `phenotype-infra` | IaC concerns live there |
| The CLI / desktop app | `BytePort` | PhenoCompose is a library, not an app |

## Crossings

PhenoCompose crosses into other Phenotype repos at the following seams:

- **Auth**: depends on AuthKit `typescript/packages/auth-ts/`
- **Telemetry**: emits OTel traces via `pheno-otel` (gated on
  `pheno-otel` being published; currently stubbed via
  `phenotype-logging-stub` per PI-001..007 + ADR-036)
- **Config**: resolves from `phenotype-config` schema (Pydantic + Zod)
- **Versioning**: pinned to the pheno-standards `{major.minor}` channel
- **FFI**: the Rust-FFI crate is consumed by `pheno-compose-driver`
  (sync façade) and by `nanovms/pkg/pheno-integration` (Go shim)
- **Migrations**: per `CONSOLIDATION.md` (2026-06-08), 4 of the
  binding layers have been migrated to `thegent/nvms`; PhenoCompose
  retains the hex port trait crates + the FFI surface as the canonical
  contracts

## 71-Pillar Scorecard (2026-06-23)

**Score: 54/60 (90.0%)** — strongest repo in the compute/infra
subtree. The hexagonal `port-*` design + `#![forbid(unsafe_code)]`
+ `#![deny(missing_docs)]` is SOTA-grade (cf. claude-code-sdk-rs,
fastmcp, gastown).

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Last Review

**Date:** 2026-06-23
**Reviewer:** forge session (Phase 1 of `plans/2026-06-22-compute-infra-dag-v1.md`)
**Worklog / finding:** `phenotype-infra/worklog/2026-06-23-71-pillar-scorecard.md` + `PhenoCompose/worklog/2026-06-23-pc-001-dead-features.md`
**Decisions:**
- PC-001 (drop dead `cuda` feature flag) MERGED (commit `aebf3be`)
- `cargo check -p nvms-ffi --offline` GREEN
- The `shim` module in `bindings/rust-ffi/src/lib.rs:398-598` is
  **intentional** (in-process reference impl); not dead code.

**Next review:** 2026-07-23

## Source-of-Truth

- `phenotype-registry/ECOSYSTEM_MAP.md` section 6 (role classification)
- `docs/intent/PhenoCompose.md` (intent statement)
- `docs/registries.md` section 'Capability & Intent SSOT' (registry layer)
- `PhenoCompose/CONSOLIDATION.md` (2026-06-08 audit + migration map)
