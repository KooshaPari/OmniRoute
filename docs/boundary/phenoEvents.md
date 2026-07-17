# phenoEvents — Absorption Boundary

**Status**: `ABSORBED` (2026-07-17)  
**Source**: `github.com/KooshaPari/phenoEvents`  
**Target**: `github.com/KooshaPari/pheno` → `crates/pheno-events/`  
**Type**: Rust workspace crate absorption  

## Description

PhenoEvents is an EventBus port with hexagonal architecture (192KB, 2 crates: `pheno-events` + `phenoevents-observability`).

## Transfer Record

- `phenoevents-observability` was already present in pheno monorepo (`crates/phenoevents-observability/`)
- Main crate absorbed as `crates/pheno-events/` with nested workspace removed
- Dep path updated from `crates/phenoevents-observability` to `../phenoevents-observability`
- `cargo check -p pheno-events`: 0 errors
- `phenoevents-observability` already at workspace level; nested copy removed

## Verification

| Check | Result |
|-------|--------|
| Workspace member added | `"crates/pheno-events"` |
| `cargo check` | clean |
| Nested workspace removed | done |
| Duplicate crate removed | done (observability already existed) |

## Cleanup

- [x] Code transferred
- [x] Dep paths resolved
- [x] Source repo archived
