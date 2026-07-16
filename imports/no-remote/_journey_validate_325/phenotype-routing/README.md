# phenotype-routing (alias)

This directory is the **alias entry point** for the canonical Rust
routing substrate described by:

- **ADR-001** (OmniRoute as canonical routing project) — accepted
  2026-05-30. The `Tokn` repo migrates into `OmniRoute/crates/tokn/`.
- **ADR-009** (naming collision resolution) — the old
  `phenoRouterMonitor/crates/bifrost-routing` stub is deprecated.
  Its path is preserved as `@deprecated` until the upstream projects
  catch up.

The actual crate lives at `crates/tokn/`. This README is the pointer
document for cross-repo discoverability.

## Why two names?

- `Tokn` is the upstream repo name (KooshaPari/Tokn) and the
  historical brand for the cost-ledger substrate.
- `phenotype-routing` is the Phenotype-org-wide name for the
  routing cluster, which now lives inside the OmniRoute workspace.

Both names are valid; new code should import from `crates/tokn/`.
