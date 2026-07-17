# Absorption Manifest — phenotype-shared

<!--
Hand-authored 2026-07-17. The disposition-index `repo-phenotype-shared` row references this path.
Successful ABSORB: 3 standalone-friendly crates lifted into pheno as 3 distinct workspace members.
-->

## Source

- **Repo:** `KooshaPari/phenotype-shared`
- **GitHub URL:** https://github.com/KooshaPari/phenotype-shared
- **Archived at:** True (2026-07-17T20:05:00Z, via `gh repo archive -y`)
- **Default branch at audit time:** `main`
- **Visibility at audit time:** public
- **Primary language:** Rust · **License:** see upstream
- **Description (actual):** shared workspace crates (manifest, port-adapter-shim, ffi_utils)
- **Size:** 293KB source (4 remote branches; last push 2026-07-16T10:47:12Z @ 607cc0c557d66ee90b393a75d19cba85c8e12af8)

## Target

- **Receiving repo:** `KooshaPari/pheno`
- **Receiving path:** 3 distinct workspace members (no amalgamation):
  - `crates/phenotype-manifest` — odin.nvms v0.2 schema + validator + JSON Schema emission (Draft 2020-12) + dump-schema binary
  - `crates/phenotype-port-adapter-shim` — PortAdapter/NvmsAdapter traits + DeploymentId/PortManifest/PortStatus value types
  - `crates/ffi_utils` — FFI-friendly parking_lot::Mutex alias used by helios_cli::harness_pyo3
- **Companion artifact:** `pheno/schemas/odin.nvms.schema.json` (regenerated from `dump-schema` binary)

## Status

- [x] **ABSORBED** — 3 crates + 1 schema artifact copied into pheno workspace.

**Confidence:** HIGH

> HIGH = every required section below is backed by a verified artifact.

## Why ABSORB succeeded

The task asked to absorb `KooshaPari/phenotype-shared` into pheno. Preflight audit surfaced a workspace
with 3 standalone-friendly crates (none with cross-deps that would have made flat-cp risky):

1. **Workspace topology is friendly.** `phenotype-shared/Cargo.toml:1` declares a top-level
   `[workspace]` with `members = ["crates/*"]` — exactly 3 sub-crates, each with its own
   `Cargo.toml` and no path-dependency back to siblings. Each crate is independently buildable,
   so per-crate `cp -R` into `pheno/crates/` is safe.

2. **Package names do not collide with pheno members.** Verified via `ls pheno/crates/ | sort`:
   - `phenotype-manifest` — distinct from `pheno/crates/phenotype-contracts/` and other phenotype-*
     members; no collision
   - `phenotype-port-adapter-shim` — distinct from `pheno/crates/phenotype-ports-canonical/` (note:
     the canonical ports crate carries TRAITS only; the shim carries TRAITS + concrete deployment
     backend contract; semantic distinct, both live in workspace)
   - `ffi_utils` — distinct from `pheno/crates/phenotype-ffi/`, `pheno/crates/phenotype-cdylib-bridge/`,
     etc.; no collision

3. **Workspace [lints] stub was stripped.** Each absorbed `Cargo.toml` carried a `lints.workspace = true`
   reference but `pheno/Cargo.toml` does not yet declare a `[workspace.lints]` table. Resolution:
   strip the stub (each crate's individual lint policy is acceptable; the workspace-wide lint policy
   is TODO at the pheno level).

4. **`dump-schema` binary references `schemas/` at runtime.** The `dump_schema.rs` bin writes to
   `./schemas/odin.nvms.schema.json`. Resolution: ensure `pheno/schemas/` exists; copy the generated
   artifact there and commit it alongside the absorbed crates.

5. **All three crates build clean and tests pass.**
   - `cargo check -p phenotype-manifest -p phenotype-port-adapter-shim -p ffi_utils` → 0 errors, 0 warnings
   - `cargo test -p phenotype-manifest -p phenotype-port-adapter-shim -p ffi_utils` → 17 passed, 0 failed
     (12 from phenotype-manifest + 5 from phenotype-port-adapter-shim; ffi_utils is alias-only with no tests)

## Companion changes in pheno

- `pheno/Cargo.toml` [workspace].members now includes `crates/phenotype-manifest`,
  `crates/phenotype-port-adapter-shim`, `crates/ffi_utils`.
- `pheno/Cargo.lock` regenerated; +23 transitive deps (schemars 0.8, jsonschema 0.17, thiserror 1/2,
  base64, etc.).
- `pheno/schemas/odin.nvms.schema.json` committed (regenerated from `dump-schema` bin).
- Each absorbed crate's `Cargo.toml`: repository URL repointed from `KooshaPari/phenotype-shared` to
  `KooshaPari/pheno` (subpath `crates/...`).

## Registry updates

- `catalog/registry.yaml` row `phenotype-shared` ADDED with `status: absorbed`, `tier: pheno-lib`,
  `archetype: library`, `language: rust`, `role: shared`, `boundary: docs/boundary/phenotype-shared.md`.
- `disposition-index.json` row `repo-phenotype-shared` ADDED with `disposition: ABSORB`,
  `fsm: absorbed`, `target: pheno (crates/phenotype-manifest + crates/phenotype-port-adapter-shim + crates/ffi_utils)`,
  `absorbing_repo: KooshaPari/pheno`, `archive_reason: successful absorption`.
- `disposition-index.json` version bumped 1.6.27 → 1.6.28.

## GitHub archival

- `gh repo archive KooshaPari/phenotype-shared -y` confirmed `isArchived:true`,
  `archivedAt:2026-07-17T20:05:00Z`.
- Source remains at `repos/phenotype-shared/` for forensic retention; pre-archive tarball at
  `repos/_archive/phenotype-shared-2026-07-17/`.

## Commits (pheno)

- Branch `absorb/pheno-plugins-2026-07-17` — primary absorption commit (registered as the original
  shared branch slot).
- Branch `absorb/phenotype-shared-2026-07-17` — secondary explicit-name branch (also pushed, points
  at the same absorption commit).

## Commits (phenotype-registry)

- (this commit) on branch `absorb/phenotype-shared-2026-07-17` — registry spine update.

## Reactivation path

If `KooshaPari/phenotype-shared` is restored from GitHub's unarchive queue:

1. Pull latest from `origin/main` of the restored repo.
2. The 3 absorbed crates in `pheno` are the canonical home; the source repo becomes an upstream mirror.
3. Add a forward-pointer README in the restored repo pointing at the 3 pheno sub-paths.
4. Update this manifest + the disposition-index row to remove `archived:true` and `archived_at`.

## Authoritative Org ADRs (Upstream Cross-Reference)

- ADR-008 — consolidation over proliferation
- ADR-039 — monorepo preference for SDK-layer code
- ECO-022 — compute/infra subtree registry correction
- ADR-035A — pheno-capacity substrate extraction