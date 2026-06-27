# ADR-095: pheno-context canonical location — standalone repo (with new pheno-runtime-config for L37 hot-reload)

**Status:** ACCEPTED
**Date:** 2026-06-23
**L5:** L5-201 (pheno-context resolution + L37 unblock)
**Context:** `findings/2026-06-22-v25-T3-BLOCKED.md` (v25 cycle-15 T3 halt)
**Decides:** where `pheno-context` (HTTP request context) lives; what crate hosts the L37 hot-reload capability; what happens to the meta-repo `pheno-context/` orphan.

## Context

The v25 cycle-15 T3 track (L37 hot-reload) halted with a **plan-vs-reality crate mismatch**:

| Path | What it is | Buildable? |
|---|---|---|
| `repos/pheno-context/src/oidc.rs` | Single-file OIDC helper, tracked on HEAD | No — no `Cargo.toml`, no `lib.rs` |
| `repos/pheno-context/src/hot_reload.rs` (orphan) | 6,687 B SIGHUP-based `Reloadable` trait prototype | No — same reason |
| `phenotype-apps-L39-wt/pheno-context/` (worktree) | Proper `pheno-context` crate: HTTP request context (`Context`, `ContextBuilder`, `ContextError`) on branch `chore/L39-clap-ext-2026-06-22` HEAD `e73535a535` | Yes — full `Cargo.toml`, AGENTS.md, WORKLOG.md, llms.txt, tests |

The name "pheno-context" is being asked to mean **two different things**:

1. **HTTP request context** — request_id, span_id, trace_id, user_id, org_id, metadata bag. This is what the worktree crate already implements well (used as the substrate for `pheno-tracing`, `pheno-mcp-router`, `phenotype-hub`).
2. **Runtime config context** — hot-reloadable configuration values (env, file, RPC) with a `Reloadable` trait and file watcher. This is what L37 needs and what the orphan `hot_reload.rs` prototype implements.

Two concepts. One name. The conflict is the root cause of the T3 halt.

## Decision

**Three crates, three jobs.** Split the namespace along the conceptual seam:

| Crate | Repo | Responsibility | Status |
|---|---|---|---|
| **`pheno-context`** | `KooshaPari/pheno-context` (standalone) | HTTP request context — request_id, span_id, trace_id, user_id, org_id, metadata bag | **CANONICAL** — already exists at worktree `phenotype-apps-L39-wt/pheno-context/`; promote worktree to standalone repo |
| **`pheno-runtime-config`** | `KooshaPari/pheno-runtime-config` (NEW) | Hot-reloadable runtime configuration values — `Reloadable` trait, `notify`-based file watcher, SIGHUP fallback, atomic swap | **NEW** — L37 target; v26 T9 deliverable |
| **`pheno-context::oidc`** | (module inside `pheno-context`) | OIDC header validation helper | **MOVED** — relocate `repos/pheno-context/src/oidc.rs` content into the standalone crate as a `pheno_context::oidc` module |

### Where the meta-repo `pheno-context/` orphan goes

- `repos/pheno-context/` is **deprecated** as a meta-repo location.
- Its tracked `src/oidc.rs` (1 file, ~80 LOC) is **moved** into the standalone `pheno-context` crate as `src/oidc.rs` (the crate gains an `oidc` module, gated behind the `oidc` cargo feature flag).
- Its untracked orphan `src/hot_reload.rs` (6,687 B SIGHUP prototype) is **moved** to the new `pheno-runtime-config` crate as `src/reloadable.rs` (the SIGHUP design is preserved; `notify` is layered on top in v26 T9).
- The untracked `tests/`, `Cargo.lock`, etc. orphans are dropped (already superseded by worktree equivalents).

### Why standalone, not meta-repo

Per ADR-023 (App-substrate placement), `pheno-context` is a **`pheno-*-lib`** — a pure reusable library with a single concern. The meta-repo is a meta-repo for cross-cutting governance, not a polyglot monorepo of Rust crates. The worktree pattern (standalone repo checked out as a worktree into the meta-repo) is the canonical way to consume such crates in this monorepo. Trying to bootstrap `pheno-context` as a meta-repo top-level crate would:

- duplicate the worktree's crate (real risk of divergent versions and CI)
- introduce a `Cargo.toml` member that's invisible to the standalone repo's CI
- conflict with ADR-023 Rule 1 ("no random `phenoShared` placements")

### Why a new `pheno-runtime-config` crate, not a feature on `pheno-context`

Three reasons:

1. **Single responsibility.** `pheno-context` carries per-request identity (immutable for request lifetime). `pheno-runtime-config` carries per-process configuration (mutable, versioned, hot-swappable). Mixing them conflates two lifecycles.
2. **Dependency hygiene.** `pheno-context` is a leaf crate with only `thiserror` + `http`. `pheno-runtime-config` will need `notify`, `arc-swap`, `tokio::sync::watch`, and probably `tracing` — a 10x dep expansion. Keeping them separate means `pheno-context` consumers don't pay the hot-reload cost.
3. **Future substrate graduation.** `pheno-runtime-config` is a candidate to become the substrate for all hot-reloadable fleet configuration (currently scattered: env-only in `pheno-config`, file-watched in `Configra`, in-memory in `pheno-mcp-router`). Having it as a standalone crate makes that future consolidation easier.

## Consequences

### Positive

- **v25 T3 BLOCKED unblocked.** L37 hot-reload retry (v26 T9) has a clean target: `pheno-runtime-config` crate, no API confusion.
- **L31 perf regression** (v26 T5) also gated on this ADR — it depends on `pheno-runtime-config`'s atomic-swap primitives to avoid TOCTOU in benchmark config. ADR-095 closes the gate for both L31 and L37.
- **`pheno-context` stays lean** — the worktree's clean HTTP-context API is preserved unchanged; no feature-flag gymnastics.
- **Meta-repo stays governance-only** — no orphan Rust crates; meta-repo remains a documentation + worktree-management substrate.

### Negative

- **One new crate to bootstrap.** `pheno-runtime-config` requires AGENTS.md, WORKLOG.md, llms.txt, CHANGELOG.md, LICENSE-MIT, 80%+ test coverage, CI gate per ADR-023 Rule 3.1. Net new: ~2 days of glue work, but the design is straightforward.
- **`oidc` feature flag.** Adding an `oidc` module to `pheno-context` adds a feature axis. Mitigated: the OIDC content is small (~80 LOC) and the feature defaults to off (zero cost to current consumers).
- **Orphan cleanup delay.** The meta-repo `pheno-context/` directory is left in place until both PRs merge. After merge, the directory is removed in a follow-up commit (separate PR for traceability).

### Neutral

- The orphan `hot_reload.rs` SIGHUP design is **preserved** in `pheno-runtime-config/src/reloadable.rs`. The `notify` watcher is layered on top, not a rewrite. The SIGHUP path stays as a "manual nudge" fallback for environments without `inotify` (some sandboxes, CI runners).

## Implementation steps (v26 T0 + T9)

### T0 (this week, 2 hrs wall)

1. Create `KooshaPari/pheno-runtime-config` repo with scaffold (AGENTS.md, Cargo.toml, README, LICENSE-MIT, src/lib.rs skeleton)
2. Open `KooshaPari/pheno-context#1` — PR promoting worktree to standalone repo; moves `oidc.rs` content in as feature-gated module
3. Open `KooshaPari/phenotype-apps#148` (or whichever meta-repo PR) — PR removing meta-repo `pheno-context/` orphan after standalone is canonical
4. Update `phenotype-registry` disposition: meta-repo `pheno-context` → `fsm: relocated`, target `KooshaPari/pheno-context`
5. Update `phenotype-registry` row: `KooshaPari/pheno-context` → `fsm: active`, owner = worktree maintainer

### T9 (week 2, 3 days wall, gated on T0)

1. Move orphan `repos/pheno-context/src/hot_reload.rs` content to `KooshaPari/pheno-runtime-config/src/reloadable.rs`
2. Implement `Reloadable<T>` trait (`fn reload(&self) -> Result<T, ReloadError>` + `fn current(&self) -> &T` + `fn watch(&self)`)
3. Add `notify` v6 backend + SIGHUP fallback
4. Add `arc-swap` for lock-free reads + `tokio::sync::watch` for async fan-out
5. 80%+ test coverage gate; integration test against `Configra`-style file (real TOML config swap, observable effect)
6. Update `findings/2026-06-23-v25-T3-BLOCKED.md` with closure note + cross-ref to T9 PR
7. L37 score: 2.5 → 3.0

## Refs

- ADR-023 (app-substrate placement)
- ADR-040 (test coverage gates per tier — 80% lib)
- ADR-041 (71-pillar refresh cadence)
- ADR-092 (cycle cadence)
- v25 closure: `findings/2026-06-22-v25-71-pillar-cycle-15-closure.md`
- v25 T3 BLOCKED: `findings/2026-06-22-v25-T3-BLOCKED.md`
- v26 plan: `plans/2026-06-23-v26-71-pillar-cycle-16-p0.md` (T0 + T9)
- cycle-16 probe: `findings/2026-06-23-71-pillar-cycle-16-probe.md`
