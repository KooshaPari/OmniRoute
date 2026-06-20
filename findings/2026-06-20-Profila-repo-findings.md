# Profila — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `Profila/` — **DEPRECATED** (archived 2026-06-20)
**Status:** ARCHIVED — functionality superseded by ObservabilityKit

---

## 1. Overview

Profila was a unified shell-and-Python profiling toolkit for the Phenotype agent ecosystem. It collected system-level resource metrics (memory, CPU, network, disk I/O), measured code complexity, generated CSV output, and produced visual charts — all from a single entry-point script targeting a named process or codebase.

The repo was **deprecated on 2026-06-20**, with all functionality superseded by [ObservabilityKit](https://github.com/KooshaPari/ObservabilityKit) — a multi-language SDK workspace providing OpenTelemetry-native traces, metrics, structured logging, and health probes.

## 2. Repository Structure

```
Profila/
├── bin/
│   ├── profiler.sh                # Main entry-point dispatcher
│   ├── all_metrics.sh             # Core metrics (memory, CPU, FDs)
│   ├── full_system_audit.sh       # Comprehensive system audit
│   ├── network_profiler.sh        # Network I/O profiling
│   ├── disk_profiler.sh           # Disk I/O profiling
│   ├── complexity_analyzer.py     # Python/Rust code complexity analysis
│   ├── continuous_profiler.py     # Live CSV monitoring
│   ├── system_metrics.py          # psutil-based system metrics
│   ├── generate_charts.py         # matplotlib chart generation
│   ├── build_for_profiling.sh     # Build with profiling symbols
│   └── profiler_setup.sh          # Tool installation
├── config/                        # Configuration files
├── docs/                          # Documentation
├── kitty-specs/                   # Kitty terminal specs
├── .claude/                       # Claude agent configs
├── .codex/                        # Codex agent configs
├── .cursor/                       # Cursor agent configs
├── .gemini/                       # Gemini agent configs
├── .kilocode/                     # KiloCode agent configs
├── .kittify/                      # Kittify configs
├── profiler.sh                    # Root convenience launcher (symlink-like wrapper)
├── README.md                      # Quick-start guide
├── PRD.md                         # Product requirements
├── ADR.md                         # Architecture decision records (6 ADRs)
├── BOUNDARY.md                    # Boundary lock definition
├── DEPRECATED.md                  # Deprecation notice
├── MOVED_TO_OBSERVABILITYKIT.md   # Migration mapping
├── CLAUDE.md                      # Claude agent instructions (34K!)
├── AGENTS.md                      # Agent instructions (111K!)
├── FUNCTIONAL_REQUIREMENTS.md     # Traceable FRs
├── Taskfile.yml                   # Build/test/lint automation
└── VERSION                        # Version file
```

## 3. Architecture — Bash Entry Point with Python Subcommand Delegation

```
                 ┌────────────────────────┐
                 │    profiler.sh         │
                 │  (Bash entry point)    │
                 └──────┬────────────────┘
                        │ dispatches
        ┌───────────────┼───────────────────────┐
        │               │                       │
        ▼               ▼                       ▼
┌────────────┐ ┌────────────────┐ ┌────────────────────────┐
│ Bash tools │ │ Python tools   │ │ System-level           │
│ (system    │ │ (complexity,   │ │ (ps, lsof, netstat,    │
│  metrics)  │ │  charts, cont.)│ │  pgrep)                │
└────────────┘ └────────────────┘ └────────────────────────┘
```

### ADR-001 rationale: Bash for fast OS metrics (ps, lsof, pgrep), Python for AST-based analysis and matplotlib visualization.

## 4. CLI Commands

| Command | Description | Implementation | ADR Ref |
|---------|-------------|----------------|---------|
| `quick` | RSS, CPU, threads, FDs, network | `bin/all_metrics.sh` | ADR-001 |
| `full` | Detailed system metrics | `bin/all_metrics.sh` + `bin/full_system_audit.sh` | ADR-001 |
| `network` | Connections + bandwidth | `bin/network_profiler.sh` | ADR-001 |
| `disk` | I/O rates + file usage | `bin/disk_profiler.sh` | ADR-001 |
| `audit` | Complete system audit | `bin/full_system_audit.sh` | ADR-001 |
| `complexity` | Code complexity (Python/Rust) | `bin/complexity_analyzer.py` | ADR-003 |
| `continuous` | Live CSV + charts | `bin/continuous_profiler.py` | ADR-004 |
| `charts` | PNG chart generation from CSV | `bin/generate_charts.py` | ADR-005 |

## 5. Architecture Decision Records

| ADR | Decision | Key Rationale |
|-----|----------|---------------|
| ADR-001 | Bash entry + Python subcommand delegation | Speed for OS metrics, Python for complexity/charts |
| ADR-002 | Timestamped reports in flat output dir | Chronological sorting, no overwrites |
| ADR-003 | Python `ast` module for complexity analysis | Zero external deps; `radon`/`lizard` for optional enhancements |
| ADR-004 | CSV as continuous monitoring wire format | Human-readable, machine-parseable, appendable without locking |
| ADR-005 | matplotlib-only chart generation | No JS runtime; static PNGs for PRs/CI |
| ADR-006 | `pgrep -f` for PID resolution | Cross-platform (macOS + Linux) |

## 6. Key Features

| Feature | Status | Evidence |
|---------|--------|----------|
| System resource profiling (memory, CPU, FDs) | Done | `bin/all_metrics.sh` |
| Network profiling (connections, bandwidth) | Done | `bin/network_profiler.sh` |
| Disk I/O profiling | Done | `bin/disk_profiler.sh` |
| Full system audit | Done | `bin/full_system_audit.sh` |
| Python code complexity (AST-based) | Done | `bin/complexity_analyzer.py` |
| Rust code complexity (regex-based) | Done | `bin/complexity_analyzer.py` (RustComplexity class) |
| Continuous monitoring to CSV | Done | `bin/continuous_profiler.py` |
| Chart generation from CSV (matplotlib) | Done | `bin/generate_charts.py` |
| Instrumented build support | Done | `bin/build_for_profiling.sh` |
| Cross-platform (macOS + Linux) | Done | ADR-006 (pgrep) |

## 7. Complexity Analyzer Details

**Python analysis** (`ComplexityAnalyzer`):
- Uses stdlib `ast` module to walk Python AST
- Counts: `If`, `While`, `For`, `AsyncFor`, `BoolOp` as complexity contributors
- Detects recursion via function self-calls in `ast.Call` nodes
- Generates formatted report with distribution histogram and worst-function ranking

**Rust analysis** (`RustComplexity`):
- Regex-based heuristic: counts `fn `, `impl `, `trait `, `struct ` declarations
- Does not compute cyclomatic complexity (requires a proper Rust parser)
- Provides file/function/impl/trait/struct counts

## 8. Metrics Tracked

| Category | Metrics |
|----------|---------|
| Memory | RSS, VMS, VmPeak, VmData, VmStk, VmExe, VmLib, memory maps |
| CPU | CPU%, thread count, context switches, per-thread time |
| Files | FD count, types (pipe, socket, anon), open files |
| Network | TCP/UDP connections, bandwidth (rx/tx) |
| Disk | Read/write bytes, I/O rates |
| Complexity | Cyclomatic complexity, recursion detection, loop count |

## 9. Target Metrics

| Metric | Codex (current) | Target |
|--------|----------------|--------|
| RSS | ~150MB idle | <20MB |
| CPU | 0.1% idle | 0% idle |
| FDs | 25 | <10 |
| Growth | 50MB/hr | 0 |

## 10. Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| psutil | Python | Cross-platform system metrics |
| matplotlib | Python | Chart generation (Agg backend) |
| ps, pgrep, lsof, netstat | System | Low-level OS metrics (via Bash) |
| perf, samply, heaptrack | Optional | Deep CPU/memory profiling |

## 11. Deprecation Mapping (to ObservabilityKit)

| Profila | ObservabilityKit Equivalent |
|---------|---------------------------|
| `profiler.sh` (root) | `python/performance_kit/scripts/profiler.py` |
| `bin/profiler.sh` (system) | `rust/phenotype-health-runtime/` |
| `bin/all_metrics.sh` | `python/performance_kit/scripts/profiler.py` + `rust/phenotype-metrics/` |
| `bin/system_metrics.py` | `python/performance_kit/scripts/profiler.py` |
| `bin/full_system_audit.sh` | `rust/phenotype-health-runtime/` |
| `bin/disk_profiler.sh` | `rust/phenotype-observability-client/` (via OTEL) |
| `bin/network_profiler.sh` | `rust/phenotype-observability-client/` (via OTEL) |
| `bin/complexity_analyzer.py` | `python/performance_kit/scripts/analyze_complexity.py` |
| `bin/generate_charts.py` | `python/performance_kit/scripts/benchmark.py` |
| `bin/continuous_profiler.py` | `python/performance_kit/scripts/profiler.py` |

## 12. Key Observations

1. **Dual-language architecture**: Bash for fast OS-level metric scraping (ps, lsof), Python for analysis and visualization — pragmatic separation that avoids Python startup overhead for quick checks.
2. **Solid ADR documentation**: 6 ADRs covering all major decisions with alternatives considered and consequences documented — a model for early-stage tooling.
3. **Agent config density**: Contains configurations for 6 different AI agent platforms (Claude, Codex, Cursor, Gemini, KiloCode, Kittify) — suggesting the repo was a testbed for multi-agent development practices.
4. **Pragmatic simplicity**: CSV for continuous monitoring (`/proc` filesystem scraping style), matplotlib for charts, argparse for Python CLIs — no over-engineering.
5. **Obsolete by adoption**: The migration to ObservabilityKit makes sense — Profila's scraping-based approach is superseded by OpenTelemetry-native instrumentation with structured tracing, metrics, and logs.
6. **Archived cleanly**: DEPRECATED.md, MOVED_TO_OBSERVABILITYKIT.md with full script mapping — a model deprecation process.

## 13. Recommendations (Historical — repo is archived)

1. **Preserve as reference**: The ADR-003 approach (stdlib `ast` for Python complexity) and ADR-006 (cross-platform `pgrep`) are useful patterns for future tooling.
2. **No code changes needed**: The repo is properly archived with migration documentation — the only action needed is ensuring the `findings/` directory captures the fact that the boundary lock has moved to `PhenoObservability/profiling/`.
