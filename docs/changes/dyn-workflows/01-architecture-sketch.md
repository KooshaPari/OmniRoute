# Dynamic Workflows on sharecli — Architecture Sketch

**Lane owner:** dyn-workflows (teammate, recon-only, 2026-06-30)
**Status:** PROPOSAL — not committed, not codex-dispatched yet
**Repo:** `KooshaPari/sharecli` at `origin/main` (`a3e308e` — PR #16: build-contention throttle)
**Worktree:** `/Users/kooshapari/CodeProjects/Phenotype/repos/.claude/worktrees/dyn-workflows` (branch `chore/dyn-workflows-recon`)

---

## 1. What exists today (verified by direct read, not memory)

| Surface | Path | LOC | What it actually is |
|---|---|---|---|
| CLI subcommands | `src/main.rs`, `src/commands/mod.rs` | 298+388 | `ps` / `start` / `stop` / `status` / `config` / `project` / `optimize` / `prune` / `pool` / `run` / `health` / `limits` / `check` — **single-process lifecycle only** |
| Process runtime | `src/runtime.rs` | 597 | `ProcessPool` over `substrate::ProcessPort` + `runtime-process::CommandGroupProcess`. No DAG. |
| Config | `src/config.rs` | 408 | TOML at `config/sharecli.toml`; `[projects]`, `[runtime]`, `[defaults.<harness>]`, `[pool]`. No `[workflows]`. |
| Spawn policy | `src/spawn_policy.rs` | 388 | `SpawnPolicy` wraps the Zig `ZigSemaphore`. `is_build_harness()` matches `cargo|rustc|build|make|cmake|ninja|bazel`. |
| Zig hot core | `crates/spawn-core/src/spawn_core.zig` | 351 | Exports 8 C-ABI fns: `spc_semaphore_*` (5) + `spc_spawn` + `spc_waitpid` + (build helper). Plain `posix_spawn`/`fork+exec` + POSIX mutex+condvar + `setpriority(PRIO_DARWIN_BG)`. |
| Zig FFI | `crates/spawn-core-sys/src/lib.rs` | 233 | `extern "C"` decls + safe `ZigSemaphore` RAII + `zig_spawn`/`zig_waitpid`. |
| IPC | `crates/sharecli-ipc/src/{main,handler}.rs` | 80+ (handler) | NDJSON over Unix socket. Methods: `process.list/kill/kill_all`, `health.status`, `config.get/set`, `monitoring.report`. **No `workflow.*` methods.** |
| FFI (Swift) | `crates/sharecli-ffi/src/lib.rs` | 80+ | Lifecycle + `sharecli_health_json`. **No workflow methods.** |
| Strategies (per-cmd) | `crates/harness-native/src/strategies/{13 files}.rs` | varied | `passthrough / coalesce / cache / queue / priority_queue / debounce / retry / incremental / circuit_breaker / resource_throttle / jobserver / load_balance / speculative / proactive_warm / batch / causal_order` — **each wraps ONE command, not a DAG**. |
| FR coverage | `docs/specs/FR.md` + `TRACEABILITY.md` | — | Only FR-001..FR-005. **No FR-006+ drafted.** |
| PLAN | `PLAN.md` | 19 lines, 4 phases | Phase 3 says "agent registration / task distribution / load balancing" but contains no spec. |

### Confirmed gaps (searched the tree)

- `grep -rE "workflow|wf |dag|pipeline|task.?graph"` over the whole worktree: **zero source hits** (only the spec/traceability doc itself uses "workflow" in the meta-sense of "spec+test+traceability workflow").
- No `src/pipeline/`, no `src/dag/`, no `src/workflow/`, no `src/wf/`.
- No `Wf` / `Dag` / `Pipeline` / `Task` types in `src/`.
- No `wf` or `dag` or `pipeline` variant in `Commands::`.
- No YAML/JSON schema for any multi-step orchestration.

**Verdict:** dynamic workflows is a **greenfield** lane on top of ready-made primitives. The Zig core is the perfect host: it already does counting-semaphore throttling, fork+exec, and `setpriority`. All that is missing is a `Workflow` type, a `WorkflowStep` enum, a topological executor, a YAML/JSON loader, and a `wf` subcommand.

---

## 2. What "dynamic workflows" should mean (target shape)

> A workflow = a DAG of `Step` nodes. Each `Step` is either a `Command` (run a process through the existing `ProcessPool` + `SpawnPolicy` + Zig semaphore) or a `Control` (`gate`, `loop`, `fork`, `join`, `when`). Steps declare `needs: [step_id, ...]`; executor topsorts and runs ready steps in parallel up to a `concurrency` cap. Each step carries `retry { max, backoff_ms, jitter }`, `timeout_ms`, `on_error { fail | continue | goto }`. A run is a `Run { id, workflow, state, started_at, finished_at, step_states }` persisted to SQLite via a new `src/lib/db/` domain module (sharecli doesn't have one yet — that's its own prerequisite).

### Why this is the right decomposition

1. **Reuses what we just paid for.** PR #16's Zig semaphore + spawn + waitpid + setpriority are *exactly* the primitives a workflow executor needs to throttle concurrent steps. Zero new hot-core code.
2. **Reuses `harness-native` strategies per-step.** A `Step { kind: Command, strategy: "retry", opts: { retry_max: 3, ... } }` is a 1-line wiring of an existing strategy.
3. **Reuses `ProcessPool`.** Steps produce `ProcessInfo`; the pool records them under the run-id `project` tag, so `sharecli ps --project run-<id>` shows live progress.
4. **Reuses IPC.** A new `workflow.run/list/status/cancel` method set on the existing NDJSON server — no new transport.
5. **Reuses FFI.** A new `sharecli_workflow_run_json()` lets the Swift tray submit a workflow and show progress without changing the data path.
6. **Zig stays scoped to primitives.** No DAG logic in Zig — that's a Rust-only concern. Zig stays at "give me a counting semaphore, give me a fork+exec, give me a waitpid".

### What dynamic workflows is NOT

- **Not a CI server.** No SCM polling, no PR/issue integration, no secrets vault. The operator is the user, the trigger is `sharecli wf run <file>`.
- **Not a workflow-as-a-service.** No remote scheduler, no webhooks, no API auth. Local CLI + IPC + FFI only.
- **Not a DAG-visualizer.** No React/SVG/canvas in this PR. Markdown tree-print from `wf status` is the only UX surface (matches the existing `ps` table style).
- **Not a state-machine engine.** No BPMN, no Petri nets, no durable timers. Steps are pure (in-degree 0 → exec → out-degree) plus `when` (condition-only gates).
- **Not a generic compute platform.** No Kubernetes, no nomad, no lambda. Process-port only.

---

## 3. Target architecture (5 layers)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 5 — CLI surface                                              │
│  `sharecli wf run <file.yaml>`, `wf list`, `wf status <id>`,        │
│  `wf cancel <id>`, `wf validate <file.yaml>`, `wf graph <id>`       │
│  (new subcommand variant, hooked into Commands:: enum)              │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 4 — Schema (YAML + JSON, both via serde_yaml + serde_json)   │
│  src/wf/schema.rs   — Workflow, Step, StepKind, Retry, Timeout,     │
│                       OnError, Concurrency                           │
│  src/wf/loader.rs   — load(file: &Path) -> Result<Workflow, Error>  │
│  src/wf/validate.rs — acyclic check, dep-closure, type checks       │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 3 — Executor                                                 │
│  src/wf/executor.rs — async, topsort, wave-based dispatch:          │
│    1. ready_set = [s for s in steps if needs ⊆ done]                │
│    2. while ready_set: take min(concurrency, ready_set)              │
│    3. each: tokio::spawn step_run(s) → wait sem (Zig)               │
│    4. on completion: mark done, push results, emit on_error routing │
│  src/wf/state.rs   — Run, StepState (Pending/Running/Done/Failed/   │
│                       Skipped/TimedOut), run_id (uuid v4)            │
│  src/wf/persist.rs — SQLite via new src/lib/db/wf.rs (NEW module)   │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 2 — Step execution (per step)                                │
│  src/wf/step.rs    — step_run(Step) -> StepResult                   │
│    1. applies Retry{...} via harness-native::strategies::retry      │
│    2. applies Timeout via tokio::time::timeout                       │
│    3. acquires Zig permit (ZigSemaphore::acquire via spawn_blocking)│
│    4. dispatches through existing ProcessPool::spawn                │
│    5. maps ProcessInfo back to step state                           │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 1 — Primitives (existing, unchanged)                         │
│  crates/spawn-core-sys  (Zig FFI: semaphore + spawn + waitpid)      │
│  src/spawn_policy.rs    (Rust: SpawnPolicy + BuildPermit)           │
│  src/runtime.rs         (Rust: ProcessPool + substrate::ProcessPort)│
│  crates/harness-native  (Rust: per-command strategies)              │
│  crates/sharecli-ipc    (NDJSON, add `workflow.*` methods)          │
│  crates/sharecli-ffi    (C-ABI, add `sharecli_workflow_*` fns)      │
└──────────────────────────────────────────────────────────────────────┘
```

### Sample schema (YAML, the canonical form)

```yaml
# my-workflow.yaml
name: build-and-test
version: 1
concurrency: 4        # max in-flight steps
defaults:
  retry: { max: 2, backoff_ms: 500, jitter: 0.25 }
  timeout_ms: 60_000
  on_error: fail      # fail | continue | goto
steps:
  - id: fmt
    run: { cmd: ["cargo", "fmt", "--all", "--", "--check"] }

  - id: build
    needs: [fmt]
    run: { cmd: ["cargo", "build", "--release"] }
    retry: { max: 1, backoff_ms: 1000 }
    timeout_ms: 300_000
    spawn_policy: { nice_delta: 5 }   # build-contention: PR #16

  - id: test-unit
    needs: [build]
    run: { cmd: ["cargo", "test", "--lib"] }
    concurrency_group: tests

  - id: test-integration
    needs: [build]
    run: { cmd: ["cargo", "test", "--tests"] }
    concurrency_group: tests

  - id: report
    needs: [test-unit, test-integration]
    run: { cmd: ["./scripts/emit-report.sh"] }
    on_error: continue
```

### Sample JSON (the IPC form, also stored in SQLite)

```json
{
  "id": "uuid-v4",
  "workflow": { "name": "...", "version": 1, "steps": [...] },
  "state": "Running",
  "started_at": "2026-06-30T12:00:00Z",
  "step_states": {
    "fmt":      { "state": "Done",   "pid": 12345, "exit": 0, "took_ms": 1240 },
    "build":    { "state": "Running", "pid": 12350 },
    "test-unit":{ "state": "Pending" }
  }
}
```

---

## 4. Gaps vs. what we have

| Need | Status | Action |
|---|---|---|
| Counting semaphore | ✅ Have (Zig) | Reuse. |
| `posix_spawn` / `fork+exec` + `setpriority` | ✅ Have (Zig) | Reuse. |
| `waitpid` | ✅ Have (Zig) | Reuse via `tokio::task::spawn_blocking`. |
| Per-step strategy (retry/timeout/breaker) | ✅ Have (`harness-native`) | Wire 1-line per step. |
| `ProcessPool` integration | ✅ Have | Reuse `pool.spawn_with_metadata`. |
| `Workflow` type + serde | ❌ Missing | New `src/wf/schema.rs`. |
| YAML loader | ❌ Missing | `serde_yaml = "0.9"` (no `unsafe`, no proc-macro). |
| DAG topsort + cycle check | ❌ Missing | New `src/wf/validate.rs` — petgraph optional, hand-rolled DFS is ~50 LOC. |
| Wave-based executor | ❌ Missing | New `src/wf/executor.rs` — ~250 LOC. |
| Run state persistence | ❌ Missing | **sharecli has no `src/lib/db/` yet** — this is the *real* gap. Must add `src/lib/db/{core,wf,migrations/}.rs` before persisting. |
| `wf` subcommand | ❌ Missing | Add `Commands::Wf { cmd: WfCmd }` in `src/main.rs` + `src/commands/wf.rs`. |
| `workflow.*` IPC methods | ❌ Missing | Extend `crates/sharecli-ipc/src/handler.rs`. |
| `sharecli_workflow_*` FFI | ❌ Missing | Extend `crates/sharecli-ffi/src/lib.rs`. |
| Tests | ❌ Missing | New `tests/fr006_workflow_*` files; wire into `docs/specs/FR.md` as **FR-006** (Workflow Lifecycle), **FR-007** (Step DAG), **FR-008** (Retry/Timeout/OnError), **FR-009** (Persistence), **FR-010** (IPC), **FR-011** (FFI). |
| Migration to a host crate | ⚠️ Decision | `src/wf/` is fine for now; promote to `crates/wf-core` only if a second consumer appears. |

---

## 5. Top 5 risks / open questions

1. **No DB layer in sharecli today.** The substrate SDK is in use but no `src/lib/db/` exists. This is the single biggest hidden prerequisite. Two options:
   - **(a)** Add `src/lib/db/{core.rs,wf.rs,migrations/0001_wf_init.sql}` — follow the pattern in `OmniRoute/src/lib/db/`.
   - **(b)** Use plain JSON files under `~/.local/share/sharecli/runs/<id>.json` — simpler, no migration cost, but loses atomicity on crash. **Pick (a)**; file-based loses Run durability across power-cut, which is a hard requirement for any workflow run > 10s.
2. **Workflow file size cap.** A 10k-step DAG (likely in codegen scenarios) would stress the in-memory topsort. Mitigation: enforce a hard cap of 1024 steps in the validator; reject larger with a clear error. No streaming executor.
3. **Step `on_error: goto <id>` introduces cycles.** Must reject at validate-time or convert to a state-machine. **Pick**: reject `goto` for v1; defer to v2.
4. **`harness-native` strategy opts vs. workflow step opts naming collision.** `retry_max` / `retry_backoff_ms` exist in both. Reuse directly (no rename) but document the precedence: step-level wins.
5. **Live progress without a TTY.** Markdown tree-print works in pipes; the Swift tray will read the same `Run` JSON over IPC and animate it. The IPC + FFI are additive, not required for v1.

---

## 6. Phase plan (5 phases, all additive, all opt-in)

| # | Phase | FRs | Wall clock (per CLAUDE.md timescale: agent-led, 1-3 min trivial / 3-8 min small / 8-20 min cross-stack) |
|---|---|---|---|
| 0 | **Prereq** — add `src/lib/db/{core,wf,migrations}` + zed-pool | none | 1 codex-exec (~6 min) |
| 1 | **Schema + loader + validate** — `src/wf/{schema,loader,validate}.rs` + 8 unit tests | FR-006 | 1 codex-exec (~5 min) |
| 2 | **Executor + state + persist** — `src/wf/{executor,state,persist}.rs` + 12 unit + 4 integration tests | FR-007, FR-008, FR-009 | 1 codex-exec (~12 min) |
| 3 | **CLI surface** — `Commands::Wf` + `src/commands/wf.rs` (run/list/status/cancel/validate/graph) + 6 acceptance tests | FR-006 | 1 codex-exec (~6 min) |
| 4 | **IPC + FFI** — `workflow.{run,list,status,cancel}` methods + `sharecli_workflow_*` FFI + 4 IPC contract tests | FR-010, FR-011 | 1 codex-exec (~5 min) |
| 5 | **Docs** — `docs/journeys/dyn-workflows.md` + extend `docs/specs/FR.md` (FR-006..011) + `TRACEABILITY.md` + this sketch archived to `docs/changes/archive/` | none | 1 cheap-llm call (~2 min) |

**Total estimate: 5 codex-exec workers + 1 cheap-llm, ~36 min wall clock sequentially / ~10 min with phases 1, 3 parallel after 0 lands.**

---

## 7. Codex-exec prompt (Phase 2, the meaty one)

This is the prompt to hand to a codex exec worker after Phase 0 (DB layer) and Phase 1 (schema) are merged. Already includes hard guardrails (worktree, base branch, no `git reset`, TDD, no schema renames, no test deletion).

```text
You are implementing **Phase 2 of the sharecli dynamic-workflows lane** in an
isolated worktree. Repo: `KooshaPari/sharecli`. Base branch: `main` (commit
a3e308e, includes PR #16 build-contention throttle).

# Setup
1. `git fetch origin main`
2. `git worktree add ../.claude/worktrees/dyn-workflows-phase2 -b feat/dyn-workflows-executor origin/main`
3. `cd ../.claude/worktrees/dyn-workflows-phase2`
4. Symlink node_modules: `ln -s "$(git -C ../../sharecli rev-parse --show-toplevel)/node_modules" node_modules` (sharecli is pure Rust, this is a no-op).
5. Read `docs/changes/dyn-workflows/01-architecture-sketch.md` from origin/main (already on the worktree).
6. Read `src/lib/db/wf.rs` and `src/lib/db/core.rs` (added in Phase 0).
7. Read `src/wf/{schema,loader,validate}.rs` (added in Phase 1).

# Pre-implementation (TDD)
8. Write `tests/fr007_dag_executor.rs` and `tests/fr008_step_retry_timeout.rs`
   FIRST, with **failing** assertions covering:
   - topsort order on a 3-step linear DAG
   - wave-based dispatch on a 2-fan-out DAG
   - `on_error: fail` halts the run and marks downstream Pending→Skipped
   - `on_error: continue` lets downstream run
   - `retry { max: 2 }` re-runs on non-zero exit, succeeds on attempt 3
   - `timeout_ms: 100` kills a long-running step and marks TimedOut
   - concurrency cap is respected (no more than N parallel steps)
   - cycle detection rejects A→B→A at validate time
9. Run `cargo test --test fr007_dag_executor --test fr008_step_retry_timeout`
   and confirm **all red**. Capture the output.

# Implementation
10. Create `src/wf/executor.rs` with:
    - `pub async fn run(workflow: Workflow, opts: RunOpts) -> Result<Run, Error>`
    - Wave-based dispatch using `tokio::sync::Semaphore` as the in-process
      concurrency cap (do NOT use the Zig semaphore here — that's for
      build-harness OS-level throttling, not for workflow step concurrency).
    - Per-step timeout via `tokio::time::timeout(step.timeout_ms)`.
    - Per-step retry via the existing `harness_native::strategies::retry`
      — but adapted to async (the existing impl uses `std::thread::sleep`).
      Wrap it in a `tokio::time::sleep` shim.
    - Acquire the Zig `ZigSemaphore` only when `step.spawn_policy.is_some()`
      (build harnesses). Use `tokio::task::spawn_blocking` for the blocking
      `acquire`. Release on drop.
11. Create `src/wf/state.rs` with:
    - `pub struct Run { pub id: Uuid, pub workflow: Workflow, pub state: RunState, pub started_at: DateTime<Utc>, pub finished_at: Option<DateTime<Utc>>, pub step_states: BTreeMap<StepId, StepState> }`
    - `pub enum RunState { Pending, Running, Done, Failed, Cancelled }`
    - `pub enum StepState { Pending, Running { pid: u32 }, Done { exit: i32, took_ms: u64 }, Failed { exit: i32, took_ms: u64, attempts: u32 }, TimedOut { after_ms: u64 }, Skipped }`
12. Create `src/wf/persist.rs` with:
    - `pub async fn save_run(db: &Db, run: &Run) -> Result<()>`
    - `pub async fn load_run(db: &Db, id: Uuid) -> Result<Option<Run>>`
    - `pub async fn list_runs(db: &Db, limit: u32) -> Result<Vec<RunSummary>>`
    - Use the `src/lib/db/wf.rs` from Phase 0.
13. Add `pub mod wf;` in `src/lib.rs` and the `mod executor; mod state; mod persist;` lines in `src/wf/mod.rs` (which Phase 1 created).

# Verification (must pass before you declare done)
14. `cargo build --release` — must compile with no warnings (clippy::all = deny in CI).
15. `cargo test` — ALL tests must pass, including the new ones from step 8.
16. `cargo clippy --all-targets -- -D warnings` — must be clean.
17. `cargo fmt --check` — must be clean.
18. End-to-end smoke: create `examples/wf-smoke.yaml` with the sample from
    `docs/changes/dyn-workflows/01-architecture-sketch.md`, then
    `cargo run --bin sharecli -- wf run examples/wf-smoke.yaml` (this is the
    Phase 3 subcommand — stub it locally as a `cargo run --example` if Phase 3
    isn't merged yet).

# Hard rules
- DO NOT touch `src/spawn_policy.rs`, `crates/spawn-core/`, or
  `crates/spawn-core-sys/` — they are frozen at origin/main.
- DO NOT add new crate dependencies unless absolutely required; prefer
  reusing `tokio`, `serde`, `uuid`, `chrono`, `harness-native`, `substrate`,
  `runtime-process`.
- DO NOT modify the Zig FFI boundary (`SpawnParams`, `spc_*` symbols).
- DO NOT delete tests; if a test is wrong, fix the test, not the assertion.
- DO NOT `git push` or open a PR. The parent will cherry-pick after
  verifying the diff and running the project's own quality gates.

# Deliverable
Reply with: the diff summary (`git diff --stat origin/main`), the test
result table (test name | status | took_ms), the smoke-test output, and
ONE-sentence summary of the design decision you would change if you had
to redo this PR.
```

---

## 8. Lane state to return to parent

- **DAG = greenfield.** No existing `wf` / `dag` / `pipeline` code. The dynamic-workflows lane has zero overlap with current sharecli.
- **Primitives = ready.** PR #16's Zig hot core gives us everything the executor needs (semaphore, spawn, waitpid, setpriority). `harness-native` strategies give us per-step retry/timeout. `ProcessPool` gives us live process tracking.
- **One real prerequisite: SQLite persistence layer.** Sharecli has no `src/lib/db/`. Phase 0 must add it, or the executor state is lost on `Ctrl-C`. **Block on this** before any codex dispatch.
- **6 FRs to write (FR-006..FR-011)** in `docs/specs/FR.md` and wire into `TRACEABILITY.md`.
- **5 codex-exec workers + 1 cheap-llm = ~36 min wall clock** for the full lane.
- **No PRs to land yet** — this is recon. Parent green-lights the codex dispatches.
