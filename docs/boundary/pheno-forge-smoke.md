---
id: boundary-pheno-forge-smoke
project: pheno-forge-smoke
status: absorbed
absorbed_into: pheno (crates/pheno-forge-smoke)
absorbed_at: 2026-07-17
disposition: ABSORB
fsm: absorbed
adr: ADR-096
wave: 2026-07-17-queue-refresh-batch4
tags: [rust, smoke-test, forgecode, ffi, cdylib, dlopen]
---

# Boundary — pheno-forge-smoke (absorbed)

**Status:** Absorbed 2026-07-17 into `pheno` monorepo as `crates/pheno-forge-smoke/`.

## Identity

- **Source:** `KooshaPari/pheno-forge-smoke` (Rust single-purpose CLI; lib + bin; 1 branch; v0.1.0)
- **Canonical home:** `KooshaPari/pheno` (`crates/pheno-forge-smoke/`)
- **Crate name:** `pheno-forge-smoke`
- **Library output:** `libpheno_forge_smoke.rlib` (thin Rust facade over the bridge)
- **Binary output:** `pheno-forge-smoke` (CLI smoke binary)
- **Workspace member:** yes (Rust monorepo `pheno`)
- **Path-deps:** none — the bridge is loaded at RUNTIME via `libloading` (no compile-time dep on `pheno-cdylib-bridge`)

## Role

End-to-end smoke test for the **4-PR forgecode improvement stack** (ADR-096, accepted 2026-06-23).
The binary is the **single check-point** that sits at the top of the forgecode memory stack and
verifies every layer below the user-facing CLI works:

```
user (forge CLI)
  -> pheno-forge-plugins sidecars (supermemory, letta, cognee, mem0, config, tracing)
  -> pheno-cdylib-bridge (C-ABI shared lib)         <-- crate/pheno-cdylib-bridge (sibling)
  -> thegent-memory v2 polyglot facade (MemoryPort trait + CompositeAdapter)
  -> forge_pheno_memory (upstream forgecode workspace crate)
         \-- this smoke binary sits at the bridge entry-point and verifies
              every layer below the user-facing CLI works.
```

The smoke binary is the **first PR in the post-merge follow-up wave** (ADR-097 + ADR-098).
The eval harness (ADR-097) consumes this smoke binary as its entry point for per-run
regression detection; ADR-098 (additional adapters) uses this smoke as its regression
baseline.

## Architecture

Two halves in one crate:

1. **`pheno_forge_smoke` (lib)** — Pure-Rust facade in `src/lib.rs`. Defines the typed
   wrappers (`Provider`, `Scope`, `MemoryValue`, `MemoryHandle`, `Bridge`) that
   marshal calls across the cdylib boundary. The `Bridge::load(path)` constructor
   `dlopen`s `libpheno_bridge.{so,dylib,dll}`, resolves 8 `pheno_*` symbols via
   `libloading`, and stores typed `unsafe extern "C" fn(...)` pointers.

2. **`pheno-forge-smoke` (bin)** — Tokio-driven CLI in `src/main.rs`. Runs 7
   checks (bridge_load, bridge_version, sidecar_health*, scope_episodic,
   scope_identity, scope_project_knowledge, scope_fallback, composite_construct)
   and emits a JSONL or human-readable report.

## What it checks

1. **`bridge_load`** — `libpheno_bridge.{so,dylib,dll}` is dlopen-able; the resolved path is reported.
2. **`bridge_version`** — `pheno_bridge_version()` returns the expected semver.
3. **`sidecar_health`** — (live-sidecar mode only) probes `:3030/health`, `:8283/health`, `:8000/health`.
4. **`scope_episodic`** — store + recall + forget through `CompositeAdapter(scope=Episodic)`.
5. **`scope_identity`** — same, `scope=Identity`.
6. **`scope_project_knowledge`** — same, `scope=ProjectKnowledge`.
7. **`scope_fallback`** — same, `scope=Fallback`.
8. **`composite_construct`** — `CompositeAdapter` opens and closes cleanly.

## Modes

| Mode | What it does | Use case |
|---|---|---|
| `--mode=mock` *(default)* | Loads the bridge; route calls are expected to fail (no sidecars running); passes if errors surface correctly. | CI dry-runs, dev machines without sidecars. |
| `--mode=sidecar` | Loads the bridge; probes sidecar health; route calls must succeed. | Pre-flight check before a real forge session. |

Exit codes:
- `0` — all required checks passed.
- `1` — one or more required checks failed.
- `2` — bridge not loadable (cdylib missing).

## Out of scope

- **Sidecar adapters** (Supermemory, Letta, Cognee, Mem0) — live in `thegent-memory` v2
- **The bridge itself** — `pheno-cdylib-bridge` is a sibling crate in this workspace
- **`pheno-sidecar-stub`** — `sidecars/` sub-workspace is preserved **as a non-workspace
  sub-crate** under `crates/pheno-forge-smoke/sidecars/`. Not a `pheno` workspace
  member (kept isolated because the smoke binary spawns it as an external process
  in `--mode=sidecar`). It is a separate sub-crate for stub servers, not part of
  the smoke binary itself.
- **`scripts/run-smoke.sh`** — helper script that builds the bridge and sets
  `DYLD_LIBRARY_PATH` / `LD_LIBRARY_PATH`. **Absorbed as-is** into
  `crates/pheno-forge-smoke/scripts/run-smoke.sh`. The script's
  `$REPO_ROOT/../pheno-cdylib-bridge` path is correct as-shipped — the bridge crate
  is a sibling in the monorepo (`crates/pheno-cdylib-bridge`), so the relative
  path resolves correctly.

## Consumers

- **`antinomyhq/forgecode`** (upstream) — primary CI consumer; runs the smoke binary
  before a forge session to verify the memory stack is healthy
- **ADR-097 eval harness** — uses the smoke binary as its entry point for per-run
  regression detection

## References

- Absorption record: `docs/absorption/pheno-forge-smoke/README.md`
- Audit: `audits/absorption-justifications/pheno-forge-smoke-2026-07-17.md`
- Disposition: `registry/disposition-index.json` row `repo-pheno-forge-smoke-batch4`
- Absorbed branch: `pheno@origin/absorb/pheno-forge-smoke-2026-07-17`
- ADR: **ADR-096** (forgecode improvement — the locked stack this smoke tests)
- Related: **ADR-097** (eval harness, consumes this smoke), **ADR-098** (additional adapters)
- Sibling crate: `crates/pheno-cdylib-bridge` (the cdylib this binary dlopens)
- Upstream: `KooshaPari/pheno-forge-smoke` (now archived)