# Polyglot Architecture Decisions — 2026-06-15

**Date:** 2026-06-15
**Lane:** L5 (Architecture)
**Wave:** v6
**Subagent:** D (subagent-D-polyglot-result.md)

## Executive summary

Confirmed `phenoVessel` and `phenoTypes` are already deleted by upstream (404). `sharecli` (Rust) and `thegent-sharecli` (Python) are **complementary, not duplicates** — they sit at different abstraction layers.

## Pattern name: PRCP (Process Rust, Coordination Python)

The Phenotype org is converging on a **Rust core + Python wrapper** polyglot pattern:

- **Rust handles OS-level concerns** (process pool, sysinfo, low-level bindings)
- **Python handles higher-level coordination** (locks, queues, merge semantics)

This is the same pattern observed across `pheno-otel` / `ObservabilityKit`, `pheno-config` / `phenotype-python-sdk/phenotype-config`, and the proposed `pheno-profiling`.

## Polyglot pairs

| Rust | Python | Alignment |
|---|---|---|
| `pheno-config` | `phenotype-python-sdk/phenotype-config` | Field-name parity gap (Rust has url/port/log_level/db_path/feature_flags; Python has environment/debug/service_name) — fix in PR-9 |
| `sharecli` | `thegent-sharecli` | PRCP pattern (different layers, not duplicates) |
| `pheno-profiling` (proposed) | `pheno-profiling` (core) | Python core + Rust pprof-rs bridge (proposed in Profila migration) |
| `pheno-otel` | `ObservabilityKit/performance_kit` | Rust for OTel SDK bindings, Python for performance analysis |

## Disposition of audited repos

| Repo | LoC | Status | Successor |
|---|---:|---|---|
| `phenoVessel` | 0 | DELETED (404) | `PhenoPlugins/crates/pheno-plugin-vessel/` (6,434 LoC: 3,687 prod + 2,747 tests) |
| `phenoTypes` | 0 | DELETED (404) | `HexaKit/python/` (9,543 LoC across 8 sub-packages) |
| `sharecli` (Rust) | 1,583 | KEEP | Process-level manager. OS process pool via sysinfo. |
| `thegent-sharecli` (Python) | 1,014 + 109 tests | KEEP | Coordination-level manager. Locks, queue, Mergiraf, HLC. |

## ADRs proposed (write-only, low priority)

- **ADR-D1:** phenoVessel deprecation complete
- **ADR-D2:** phenoTypes deprecation complete
- **ADR-D3:** PRCP pattern (sharecli vs thegent-sharecli)

## Future hardening (out of scope for this subagent)

- `sharecli`: add `/tests/` directory (currently 1 inline test in `runtime.rs`)
- `thegent-sharecli`: rename `LockStatus`/`QueuePriority` collision (defined twice each)
- `thegent-sharecli`: test ratio 10.7% (109/1014) — below org standards (~30%)

## Evidence

- `worklogs/L5-098-POLYGLOT-v6-2026-06-15.json`
- `findings/2026-06-15-DAG-V6-FINAL-v1.md` (section 4)
- `/tmp/subagent-D-polyglot-result.md`
