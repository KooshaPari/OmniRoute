# ADR-012 Compliance Audit — pheno-tracing duplication

**Date:** 2026-06-15
**Lane:** L5 (Architecture)
**Wave:** v6 closure
**ADR reference:** `docs/adr/2026-06-15/ADR-012-pheno-tracing-canonical.md`

## Finding

ADR-012 (Accepted 2026-06-15) mandates that `pheno-tracing` be the canonical tracing crate across all pheno-* repos. There are **TWO** `pheno-tracing` crates in the monorepo:

### 1. `crates/pheno-tracing/` (CANONICAL, per ADR-012)

- Listed in root `Cargo.toml` workspace members
- Has the `Port` trait pattern per ADR-014 (port.rs + adapters.rs)
- 2 integration test files: `tests/port_integration.rs`, `tests/adapter_tests.rs`
- Dependencies: `async-trait`, `serde`, `serde_json`, `thiserror`, `tokio`, `tracing`, `tracing-subscriber`, `chrono`
- Implements `TracePort` trait (TraceId, SpanId, SpanKind, TraceOperation, TraceResult, TraceStatus)
- 2+ adapters: `InMemoryAdapter`, `StdoutAdapter` (likely 5+ total)

### 2. `pheno-tracing/` (DUPLICATE, top-level)

- NOT a workspace member (would fail `cargo check` per error: "current package believes it's in a workspace when it's not")
- No `port.rs` or `adapters.rs` directory
- 2 inline tests in `lib.rs` (not in `tests/`)
- Dependencies: `tracing`, `tracing-subscriber`, `tracing-appender`
- Has 3 init functions: `init()`, `init_json()`, `init_with_file(dir)` — simple init helpers
- No `TracePort` trait, no adapters, no hexagonal pattern

## Why both exist

- `crates/pheno-tracing/` was created as the "proper" hexagonal L4 implementation per PhenoRust 1.0 plan
- `pheno-tracing/` (top-level) was created as a simple init helper for older focus-rules/focus-observability consumers
- ADR-012 supersedes the simple init pattern in favor of the L4 hexagonal one
- The top-level `pheno-tracing/` should have been deleted when `crates/pheno-tracing/` was created

## Action required

**Delete the top-level `pheno-tracing/` directory** so that ADR-012 has only one canonical crate.

This is a **simple, low-risk deletion** similar to PR-1/2/3 of the ADR-012 config consolidation:
1. Verify zero `Cargo.toml` references to the top-level `pheno-tracing` (outside of crates that use it)
2. `git rm -r pheno-tracing` (in the parent monorepo)
3. Move any orphaned consumers to `crates/pheno-tracing`
4. Commit with `chore(root): delete duplicate pheno-tracing/ (ADR-012 compliance)`

## Verification needed

Need to confirm:
- All focus-* / pheno-* Rust crates that depend on `pheno-tracing` (top-level) are migrated to `crates/pheno-tracing`
- Or that the top-level `pheno-tracing/` is in fact unused (in which case deletion is safe)

## LoC impact

- Top-level `pheno-tracing/src/lib.rs`: 190 LoC
- Tests (inline): 80 LoC
- **Total: 270 LoC** to remove (similar magnitude to the ADR-012 PR-1/2/3 deletions)

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `pheno-tracing/` is consumed by some focus-* crate | Low | Medium (broken build) | `cargo metadata` query before deletion |
| Sparse-checkout cone may hide references | Low | Low | Use `git grep` across the index, not the working tree |

## Next steps

1. Run `git grep "pheno-tracing" -- "Cargo.toml" "*.toml"` to find consumers
2. If 0 consumers → safe to delete top-level `pheno-tracing/`
3. If >0 consumers → migrate them to `crates/pheno-tracing` first
4. Commit deletion
5. Update ADR-012 references if needed

## Evidence

- `crates/pheno-tracing/src/port.rs:1-54` (TracePort trait per ADR-014)
- `crates/pheno-tracing/src/adapters.rs:1-53` (InMemory + Stdout adapters)
- `crates/pheno-tracing/tests/port_integration.rs` (per ADR-014 pattern)
- `crates/pheno-tracing/tests/adapter_tests.rs`
- `pheno-tracing/src/lib.rs:1-190` (simpler init helper, no port pattern)
- Root `Cargo.toml:21` includes `crates/pheno-tracing` as workspace member
- Top-level `pheno-tracing/Cargo.toml` is a self-contained crate (would fail `cargo check` from monorepo root due to workspace inclusion)
