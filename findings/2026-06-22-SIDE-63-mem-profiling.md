# SIDE-63 — Memory Profiling Methodology for pheno-* Crates

**Date:** 2026-06-22 (PDT)
**Author:** orchestrator (v22 cycle-12 P1 sweep, L19 deepening)
**Status:** PROPOSED — methodology drafted, awaiting first-track implementation (T1: pheno-config)
**Track:** SIDE-63 (cross-cutting Performance domain)
**Related:** v19 T4 (latency/throughput perf infra at `benchmarks/fleet-perf.toml`); v17 T6 (L10 async runtime, ADR-088); v18 T4 (L46-L55 security P1 deepening — `Zeroize` mandate overlaps with dhat leak detection); ADR-023 (device-fit gate); ADR-040 (test coverage gates per tier); ADR-042B (substrate quality bar); L13-L19 (Performance domain, 71-pillar framework); ADR-026 (Factory AI Agent Readiness, "Debugging & Observability" pillar); SIDE-10 (async runtime consistency)

> **Scope note.** Memory profiling is **complementary to** v19 T4's latency/throughput benchmarks. T4 measures *time* (p50/p95/p99 wall-clock, RPS); SIDE-63 measures *space* (peak heap, total alloc count, lifetime distribution, leak detection). Both share the same `benchmarks/fleet-perf.toml` registration mechanism but produce different artifacts and gates.

---

## 1. Executive Summary

The pheno-* Rust fleet currently has **zero memory-profiling instrumentation in CI**. We measure correctness (cargo test, proptest, loom) and performance time (criterion via T4), but we have no continuous signal on:

- **Peak heap** per substrate operation (config parse, trace span export, router decision).
- **Total allocation count** under steady-state load (catches quadratic regressions that don't show up in latency).
- **Allocation lifetimes** (dhat's "max lifetime" + "total lifetime" — distinguishes short-lived scratch from long-lived retained data).
- **Leaks** (genuine `definitely lost` from valgrind-memcheck / dhat — separate from the `Zeroize` mandate in ADR-078, which handles secret hygiene on Drop).

This methodology adds three complementary tools — **heaptrack**, **valgrind massif**, **dhat** — each positioned in the dev/CI matrix for a different cost/benefit trade-off. No single tool is best at all four questions above; the triangle below is the design.

**Headline recommendations (9):**

1. **Daily dev iteration:** `heaptrack` (fast, ~2× slowdown, flame-graph output).
2. **CI nightly regression gate:** `dhat` via the `dhat` crate (best Rust integration, JSON diff, low-friction in-process instrumentation).
3. **Quarterly deep audit + soak tests:** `valgrind massif` for the federated services (30-min soaks on phenotype-router to catch slow leaks).
4. **Leak hunt (separate from profiling):** `valgrind --tool=memcheck` — ad-hoc, not gated.
5. **All three tools are Linux-only.** macOS dev uses `xcrun malloc_history` / Instruments.app as a manual-only proxy. CI is `heavy-runner` per ADR-023 device-fit gate.
6. **Baseline storage:** `benchmarks/baselines/mem-<crate>.json` keyed on commit SHA; 10 % peak-heap regression = WARN, 25 % = FAIL, new `definitely lost` bytes > 0 = FAIL.
7. **Crate quality bar (ADR-042B) extension:** every new `pheno-*-lib` ships with ≥ 1 dhat-instrumented memory benchmark; federated services additionally ship a 30-min soak profile.
8. **Per-crate memory budgets** are codified in `benchmarks/fleet-perf.toml` (same registry T4 uses for latency), keeping the perf/mem registry unified.
9. **First implementation track (T1):** pheno-config — parse 1 MB TOML + 1000-overrides cascade, budget peak < 5 MB. ~150 LOC + 1 baseline JSON. `device: macbook` (no heavy cargo work yet — design + 1 benchmark).

---

## 2. Background & Goals

### 2.1 Why memory profiling, why now

The 71-pillar audit (ADR-024) scores L13-L19 (Performance domain) for each repo. The current fleet mean for these 7 pillars is ~2.4, with L19 (Performance Benchmarks) at 2.0 — a clear gap. v19 T4 closes the **time** half of that gap; SIDE-63 closes the **space** half.

Substrate crates per ADR-023 are supposed to be **embeddable** in any consumer. A pheno-config that allocates 50 MB parsing a 1 MB TOML is a substrate-quality failure regardless of how fast the parse is. A pheno-mcp-router that leaks 1 KB per request is a substrate-quality failure regardless of how low the p99 latency is. These are the failure modes memory profiling catches that latency benchmarks cannot.

### 2.2 Goals (SMART)

| # | Goal | Metric | Target |
|---|---|---|---|
| G1 | Continuous peak-heap measurement in CI | Crates with dhat benchmark merged | 5/5 fleet-critical (pheno-config, pheno-tracing, pheno-mcp-router, pheno-errors, pheno-port-adapter) by v23 |
| G2 | Regression detection on PR | Workflow `mem-gate.yml` merged + ≥ 1 PR caught by it | merged by end of v22, first catch by end of v23 |
| G3 | Leak detection for federated services | phenotype-router + phenotype-hub ship 30-min soak profile | merged by end of v23 |
| G4 | macOS dev workflow | `just mem-heaptrack <crate>` recipe working on MacBook (uses `malloc_history` fallback with documented caveat) | merged by end of v22 |
| G5 | Substrate quality bar updated | ADR-042B amended to require memory benchmark for new substrate | merged by end of v22 |

### 2.3 Non-goals (out of scope for SIDE-63)

- **Performance budgets at the call-site level** (e.g., "this function must allocate < 1 KB") — too brittle for substrate, deferred to per-crate `#[track_caller]` alloc counters if/when needed.
- **Garbage-collected language profiling** (Python, Go, TypeScript) — pheno-* fleet is Rust-primary; foreign-binding profiling is the consumer's problem.
- **GPU memory profiling** — not used in substrate.
- **Cache-line / false-sharing analysis** — out of scope; `criterion` + `cachegrind` is a separate audit if needed.

---

## 3. Tool Selection Triangle

No single tool answers all four questions. The triangle below is the design rationale.

| Question | Tool | Why this tool |
|---|---|---|
| "What's allocating the most memory, right now?" | **heaptrack** | Time-resolved, call-stack attribution, fast (~2× slowdown), flame-graph compatible via `inferno`. Best for the *where*. |
| "How much peak / total memory did this op use, with structured JSON for diffing?" | **dhat** (via `dhat` crate) | Best Rust integration (in-process `#[global_allocator]` swap), JSON output, separates peak from total from lifetime. Best for the *how much*. |
| "What does the heap look like over a 30-min soak?" | **valgrind massif** | Time-series snapshots, catches slow leaks that dhat's single-run may miss, GUI (`massif-visualizer`) for the *shape over time*. |
| "Is this a genuine memory leak (not retained data)?" | **valgrind --tool=memcheck** | Definitive leak detection. Heavy (~20× slowdown) — used ad-hoc, not in CI. |

```
                 latency (T4)
                       │
                       │  complements
                       │
   heaptrack ◄─────────┼──────────► dhat
  (daily dev)          │         (CI nightly)
                       │
                       ▼
              valgrind massif
             (quarterly + soak)
                       │
                       ▼
              valgrind memcheck
              (ad-hoc leak hunt)
```

**Why not just one tool?** Each tool has a different bottleneck:

- **heaptrack** doesn't track allocation lifetimes (it tracks allocation events, not retention).
- **dhat** doesn't do time-series (single run produces one profile).
- **massif** has 10-50× slowdown — too slow for every-PR CI on a 100-crate workspace.
- **memcheck** is the gold standard for *leaks* but ~20× slowdown makes it impractical for anything except targeted bug hunts.

The combination covers all four questions (where, how much, shape over time, leak) at the right cost.

---

## 4. Per-Tool Setup

### 4.1 heaptrack

**What it is:** KDE's heap profiler. Records every allocation event with a call stack; can replay as a flame graph. ~2× slowdown (vs ~20× for valgrind).

**Install (heavy-runner, Ubuntu 22.04):**

```bash
# system packages
sudo apt-get update
sudo apt-get install -y heaptrack heaptrack-gui

# Rust post-processing
cargo install --locked inferno
```

**macOS:** NOT available. The KDE `heaptrack_gui` is Linux-only and `heaptrack` itself uses Linux-specific backends. Use `xcrun malloc_history <pid>` (DTrace-based) or Instruments.app → Allocations template as a manual dev proxy. See § 4.4.

**Per-crate invocation (justfile recipe):**

```makefile
# Justfile (per-crate or repo-root)
mem-heaptrack crate bin='*' args='':
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{crate}}"
    cargo build --release --bin "{{bin}}"
    heaptrack -o "/tmp/heaptrack-{{crate}}-{{bin}}" \
        target/release/{{bin}} {{args}}
    heaptrack_print "/tmp/heaptrack-{{crate}}-{{bin}}.heaptrack" \
        > "findings/heaptrack-{{crate}}-{{bin}}.txt"
    # Flame graph
    inferno-flamegraph \
        "/tmp/heaptrack-{{crate}}-{{bin}}.heaptrack" \
        > "findings/heaptrack-{{crate}}-{{bin}}.svg"
    echo "OK: findings/heaptrack-{{crate}}-{{bin}}.{txt,svg}"
```

**Output:**

- `<name>.heaptrack` — binary allocation log (gzipped, ~MBs for minute-long runs).
- `heaptrack_print <name>` — text summary: total allocations, peak heap, top-N allocators with call stacks.
- `inferno-flamegraph <name>` — SVG flame graph (open in browser, `speedscope.app` for interactive).

**CI strategy:** NOT used in CI (the `.heaptrack` file is large and the slowdown is too much for PR checks). Used by devs locally + in `workflow_dispatch` manual deep-audit mode.

**Caveats:**

- Requires debug symbols for readable call stacks — build with `cargo build --release --config 'profile.release.debug=true'` or use the dev profile.
- The `heaptrack_gui` requires an X server; on CI use `heaptrack_print` + `inferno-flamegraph`.
- Stops on signal (Ctrl-C or `SIGTERM`) and writes the profile. Wrap with `timeout` for CI safety.

### 4.2 valgrind massif

**What it is:** Valgrind's heap-space profiler. Time-series snapshots of the heap tree (who-allocated-what-when). ~10-50× slowdown.

**Install (heavy-runner):**

```bash
sudo apt-get install -y valgrind massif-visualizer
```

**macOS:** NOT available (Valgrind doesn't support macOS as of 3.22; the project has been WIP for years). Use Instruments.app → Allocations template as a manual proxy.

**Per-crate invocation (justfile recipe):**

```makefile
mem-massif crate bin='*' args='' time-unit='ms':
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{crate}}"
    # NOTE: must be a DEBUG build for call-stack resolution
    cargo build --bin "{{bin}}"
    valgrind \
        --tool=massif \
        --time-unit={{time-unit}} \
        --detailed-freq=1 \
        --max-snapshots=1000 \
        --massif-out-file="/tmp/massif-{{crate}}-{{bin}}.out" \
        target/debug/{{bin}} {{args}}
    ms_print "/tmp/massif-{{crate}}-{{bin}}.out" \
        > "findings/massif-{{crate}}-{{bin}}.txt"
    echo "OK: findings/massif-{{crate}}-{{bin}}.txt"
```

**Output:**

- `massif.out.<pid>` — binary snapshot stream.
- `ms_print <name>` — ASCII text report with heap-tree snapshots over time.
- `massif-visualizer` — Qt GUI (Linux only) for interactive exploration.

**CI strategy:** Used in the **quarterly deep audit** (per ADR-041B substrate-audit cadence) + **soak tests** for federated services (30-min phenotype-router run → `massif.out` shows leak pattern). NOT used in per-PR CI.

**Caveats:**

- **Must be debug build.** `cargo build --release` strips symbols; massif can't resolve call stacks. The recipe above uses `cargo build` (debug) by default.
- 10-50× slowdown means a 1-second test takes 10-50 seconds under massif. Budget accordingly.
- `--max-snapshots=1000` caps output size; default is 100. For 30-min soaks, increase or use `--time-unit=ms` to snapshot at finer granularity.
- The `ms_print` output is text-only and ~1 MB per snapshot stream. For CI artifacts, gzip it.

### 4.3 dhat

**What it is:** Valgrind's modern (3.15+) heap profiler. Outputs **JSON** with peak, total, lifetime distribution, and top allocators. Designed for diff-based regression testing. ~10-30× slowdown (similar to massif).

**Install (heavy-runner):**

```bash
sudo apt-get install -y valgrind  # dhat is bundled with valgrind 3.15+
```

**Two integration modes:**

**Mode A — CLI (like massif):**

```bash
valgrind --tool=dhat target/debug/mybin
# produces dhat-heap.json
# open in https://nnethercote.github.io/dhat-viewer/
```

**Mode B — in-process (recommended for Rust crates):** Use the `dhat` crate. Swap the global allocator inside a benchmark binary for a `DhatAlloc`. Zero overhead outside the profiled run; JSON dumps in-process at exit.

```toml
# Cargo.toml [dev-dependencies]
dhat = "0.3"
```

```rust
// benches/mem_parse.rs
use dhat::Dhat;
use pheno_config::parse;

#[global_allocator]
static ALLOC: dhat::Alloc = dhat::Alloc;

fn main() {
    let _dhat = Dhat::start_aerial(); // or start_profiling() for on-demand
    let input = include_str!("../fixtures/large.toml");
    for _ in 0..1000 {
        let _ = parse(input).unwrap();
    }
    // Dhat drops here, writes dhat-heap.json
}
```

```makefile
mem-dhat crate bench='mem_parse':
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{crate}}"
    cargo bench --bench {{bench}} --profile release
    # dhat writes dhat-heap.json to CWD
    cp dhat-heap.json "findings/dhat-{{crate}}-{{bench}}.json"
    echo "OK: findings/dhat-{{crate}}-{{bench}}.json"
```

**Output:**

- `dhat-heap.json` — structured JSON with `dhat::Heap` statistics: `peak_total_bytes`, `total_alloc_bytes`, `total_lifetime_*`, top programs/allocators, lifetime distribution histogram.
- View in browser: `dhat-viewer` (https://nnethercote.github.io/dhat-viewer/) — drop the JSON, get an interactive chart.

**CI strategy:** **This is the primary CI tool.** Nightly + on-PR-for-perf-sensitive-paths workflow reads `dhat-heap.json` from each substrate crate's bench, parses the `peak_total_bytes` and `total_alloc_bytes`, compares to `benchmarks/baselines/mem-<crate>.json`, and fails on > 25 % regression.

**Caveats:**

- The `dhat` crate allocates a thread-local tracking table; runs ~30 % slower than the CLI mode (still O(10×) baseline). Negligible for benchmark work; not for production binaries.
- `Dhat::start_aerial()` profiles *all* allocations including dhat's own bookkeeping. `Dhat::start_profiling()` is a manual on/off switch. For benchmarks, `start_aerial()` is correct.
- The JSON schema is versioned; dhat-viewer tracks it. If the schema breaks, dhat-viewer prints a friendly error.
- Same valgrind caveat: Linux only.

### 4.4 macOS dev proxy (documented limitation)

CI runs on Linux (per ADR-023 device-fit gate). Local dev on MacBook cannot run heaptrack, massif, or dhat directly. Two options for macOS dev:

1. **`xcrun malloc_history <pid>`** — DTrace-based; samples allocation backtraces. Not as comprehensive as heaptrack but available without extra tooling. Example:
   ```bash
   xcrun malloc_history <pid> -callTree
   ```
2. **Instruments.app → Allocations template** — full GUI; time-resolved allocation graph, lifetime tracking, retain cycle detection. Manual workflow; not scriptable for CI.

The justfile recipes include a macOS fallback stub:

```makefile
mem-heaptrack-macos crate bin='*' args='':
    #!/usr/bin/env bash
    echo "heaptrack is Linux-only. Use Instruments.app → Allocations instead."
    echo "Or: xcrun malloc_history \$$(pgrep -f target/release/{{bin}}) -callTree"
    open -a Instruments
```

**Documented limitation:** macOS results are NOT directly comparable to Linux CI baselines. The 71-pillar L13 score is gated on Linux CI; macOS profiling is a dev convenience, not a gate.

---

## 5. CI Integration

### 5.1 Runner, triggers, gates

**Runner:** Linux `heavy-runner` (self-hosted or GitHub-hosted `ubuntu-22.04` with 4-core/16 GB). NOT `macos-*` (valgrind/heaptrack unavailable). Per ADR-023 device-fit gate.

**Workflow file:** `.github/workflows/mem-gate.yml` (one per substrate crate, or monorepo-level with a matrix). Triggers:

| Trigger | Tool | Scope | Gate |
|---|---|---|---|
| `pull_request` to `main` on paths `crates/<pheno-*>/**` | **dhat** (Mode B, in-process) | Changed crate's `mem_*` bench | Peak heap ≤ 1.25 × baseline; total alloc ≤ 1.50 × baseline; new `definitely lost` = 0 |
| Nightly cron `0 6 * * *` (06:00 UTC = 22:00 PDT) | **dhat** for all substrate + **heaptrack** for spot-check | Full fleet | Same gates; baseline updated on `main` only |
| `workflow_dispatch` input `tool=massif` | **massif** for selected federated service | Single service, 30-min soak | No automated gate; human review of `massif.out` for leak pattern |
| `workflow_dispatch` input `tool=memcheck` | **valgrind memcheck** | Single crate, targeted bug hunt | No automated gate; `definitely lost` summary posted as PR comment |

**Baseline storage:**

```
benchmarks/baselines/
├── mem-pheno-config.json      # {"commit": "<sha>", "peak_bytes": 4194304, "total_bytes": 134217728, ...}
├── mem-pheno-tracing.json
├── mem-pheno-mcp-router.json
├── mem-pheno-errors.json
├── mem-pheno-port-adapter.json
└── mem-phenotype-router.json  # 30-min soak, separate format
```

**Baseline update process:**

1. `mem-gate.yml` runs on PR; if all gates pass, baseline is *not* updated (baseline tracks `main`).
2. On merge to `main`, the nightly workflow re-runs and writes a new baseline if the result differs by > 5 % (likely a real change, not noise).
3. Manual override: PR labeled `mem-baseline-update` triggers a workflow that writes the new baseline to `benchmarks/baselines/mem-<crate>.json` with a `reviewed-by:` field.

### 5.2 Workflow sketch (dhat gate)

```yaml
# .github/workflows/mem-gate.yml
name: mem-gate
on:
  pull_request:
    paths:
      - 'crates/pheno-*/**'
      - 'crates/phenotype-*/**'
      - 'benchmarks/baselines/mem-*.json'
  schedule:
    - cron: '0 6 * * *'  # nightly 06:00 UTC = 22:00 PDT
  workflow_dispatch:
    inputs:
      tool:
        description: 'Tool to run'
        required: true
        type: choice
        options: [dhat, heaptrack, massif, memcheck]

jobs:
  dhat-gate:
    if: github.event_name != 'workflow_dispatch' || inputs.tool == 'dhat'
    runs-on: [self-hosted, linux, heavy-runner]
    strategy:
      fail-fast: false
      matrix:
        crate:
          - pheno-config
          - pheno-tracing
          - pheno-mcp-router
          - pheno-errors
          - pheno-port-adapter
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          toolchain: 1.82.0

      - name: Cache cargo
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: 'crates/${{ matrix.crate }} -> target'

      - name: Install valgrind
        run: sudo apt-get install -y valgrind

      - name: Run dhat benchmark
        working-directory: crates/${{ matrix.crate }}
        run: |
          cargo bench --bench mem_${{ matrix.crate }} --profile release \
            -- --output-format bencher | tee ${{ matrix.crate }}.txt

      - name: Extract dhat metrics
        id: metrics
        working-directory: crates/${{ matrix.crate }}
        run: |
          python3 .github/scripts/extract_dhat.py dhat-heap.json > metrics.json
          cat metrics.json

      - name: Compare to baseline
        working-directory: crates/${{ matrix.crate }}
        run: |
          python3 .github/scripts/mem_gate.py \
            --crate ${{ matrix.crate }} \
            --current metrics.json \
            --baseline ../../benchmarks/baselines/mem-${{ matrix.crate }}.json \
            --peak-threshold 1.25 \
            --total-threshold 1.50

      - name: Upload dhat artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: dhat-${{ matrix.crate }}
          path: |
            crates/${{ matrix.crate }}/dhat-heap.json
            crates/${{ matrix.crate }}/${{ matrix.crate }}.txt
          retention-days: 90
```

### 5.3 `mem_gate.py` gate logic

```python
# .github/scripts/mem_gate.py
import json
import sys
import argparse
from pathlib import Path

def load_json(p: Path) -> dict:
    with p.open() as f:
        return json.load(f)

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--crate", required=True)
    ap.add_argument("--current", required=True, type=Path)
    ap.add_argument("--baseline", required=True, type=Path)
    ap.add_argument("--peak-threshold", type=float, default=1.25)
    ap.add_argument("--total-threshold", type=float, default=1.50)
    args = ap.parse_args()

    cur = load_json(args.current)
    base = load_json(args.baseline)

    peak_ratio = cur["peak_total_bytes"] / base["peak_total_bytes"]
    total_ratio = cur["total_alloc_bytes"] / base["total_alloc_bytes"]
    leaks_cur = cur.get("definitely_lost_bytes", 0)
    leaks_base = base.get("definitely_lost_bytes", 0)

    print(f"[{args.crate}] peak {peak_ratio:.2f}x ({cur['peak_total_bytes']} vs {base['peak_total_bytes']})")
    print(f"[{args.crate}] total {total_ratio:.2f}x")

    failures = []
    if peak_ratio > args.peak_threshold:
        failures.append(f"peak heap regression: {peak_ratio:.2f}x > {args.peak_threshold}x")
    if total_ratio > args.total_threshold:
        failures.append(f"total alloc regression: {total_ratio:.2f}x > {args.total_threshold}x")
    if leaks_cur > 0 and leaks_cur > leaks_base:
        failures.append(f"new leak: {leaks_cur} bytes (baseline: {leaks_base})")

    if failures:
        print(f"FAIL: {args.crate}")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"PASS: {args.crate}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

### 5.4 When to skip the gate

- PR labeled `mem-skip` with reviewer approval — for cases where a regression is intentional (e.g., adding a feature that requires more memory).
- Draft PRs — no CI runs by default.
- PRs touching only docs, tests (no `src/`), or `Cargo.toml` deps that are not alloc-related.

### 5.5 Substrate quality bar (ADR-042B) amendment

Add to the quality bar (proposed ADR-042B-amend-1, to be drafted in v22):

> **Rule 3.1.6 (memory benchmark, NEW).** Every new `pheno-*-lib`, `phenotype-*-sdk`, or `phenotype-*-framework` MUST ship with at least one dhat-instrumented memory benchmark in `benches/mem_*.rs` covering the crate's primary use case. The benchmark's peak heap + total alloc MUST be recorded in `benchmarks/baselines/mem-<crate>.json` and gated by `mem-gate.yml` (25 % peak / 50 % total regression thresholds). Federated services additionally MUST ship a 30-min `massif` soak profile.

---

## 6. Per-Crate Methodology

The first implementation track (T1) targets pheno-config; the others follow the same pattern. The table below is the fleet-wide plan.

| Crate | Scenario | Workload | Peak budget | Total alloc budget | Soak? |
|---|---|---|---|---|---|
| `pheno-config` | Parse + cascade | 1 MB TOML, 1000 env overrides, 10k iterations | **< 5 MB** | < 500 MB / 10k iter | No |
| `pheno-tracing` | Span export | 1 M spans, OTLP HTTP/2 export, 100 conns | **< 100 MB** | < 5 GB / 1 M spans | No |
| `pheno-mcp-router` | Route dispatch | 1000 routes, 10k RPS, 60 s | **< 50 MB** | < 2 GB / 600k req | No |
| `pheno-errors` | Error construction | 1 M errors with 3-level chained context | **< 10 MB** | < 200 MB / 1 M | No |
| `pheno-port-adapter` | Adapter calls | 100k `Port::call` invocations, mock adapter | **< 20 MB** | < 1 GB / 100k | No |
| `phenotype-router` | Decision layer | 1k RPS, 30 min, 9-plugin regression | **< 200 MB steady, no growth** | n/a (soak metric = slope) | **YES** |
| `phenotype-hub` | Federation | 100 federated req/s, 30 min | **< 150 MB steady, no growth** | n/a | **YES** |

### 6.1 Worked example: pheno-config (T1)

**Benchmark binary** (`crates/pheno-config/benches/mem_parse.rs`):

```rust
use dhat::Dhat;
use pheno_config::{parse, Cascade};

#[global_allocator]
static ALLOC: dhat::Alloc = dhat::Alloc;

const FIXTURE: &str = include_str!("fixtures/large.toml"); // 1 MB

fn main() {
    let _dhat = Dhat::start_aerial();

    // 1. Single parse
    let cfg = parse(FIXTURE).unwrap();
    assert!(cfg.sections().len() > 10);

    // 2. Cascade with 1000 overrides
    let mut cascade = Cascade::new(cfg);
    for i in 0..1000 {
        cascade.set_env(format!("OVERRIDE_{i}=value_{i}"));
    }
    let _final = cascade.finalize();

    // 3. 10k iteration stress
    for _ in 0..10_000 {
        let _ = parse(FIXTURE).unwrap();
    }

    // _dhat drops at scope exit, writes dhat-heap.json
}
```

**Baseline JSON** (`benchmarks/baselines/mem-pheno-config.json`):

```json
{
  "schema": "mem-baseline-v1",
  "commit": "<filled-by-CI>",
  "captured_at": "2026-06-22T22:00:00Z",
  "crate": "pheno-config",
  "scenario": "parse_1mb_toml_cascade_10k",
  "peak_total_bytes": 4194304,
  "total_alloc_bytes": 134217728,
  "total_alloc_count": 524288,
  "definitely_lost_bytes": 0,
  "tool": "dhat-0.3.3",
  "rustc": "1.82.0",
  "reviewed_by": "kooshapari"
}
```

**Expected findings (initial run, 2026-06-22 baseline-establishing):**

- F1: `parse()` allocates a fresh `BTreeMap` per call — peak should scale with TOML size, not input count. If peak grows across the 10k iteration loop, indicates retained state (bug).
- F2: `Cascade::set_env()` should reuse the same backing buffer (string interning or `SmallVec`). If total_alloc_count grows linearly with override count (expected) but bytes-per-override is constant (also expected), no leak. If bytes-per-override grows → leak.
- F3: After 10k iterations, peak should equal 1-parse peak + iteration scratch. If peak grows with iteration count → unbounded growth → BUG (regression test needed).

These three findings will populate the initial `findings/2026-06-22-SIDE-63-T1-pheno-config-mem-baseline.md` when T1 lands.

### 6.2 Per-crate review cadence

- **Substrate (pheno-*-lib):** review on every PR via `mem-gate.yml`. No manual cadence.
- **Framework (phenotype-*-framework):** review on every PR + quarterly deep audit (per ADR-041B).
- **Federated services:** review on every PR + monthly 30-min soak (per ADR-041B).

---

## 7. Threshold & Regression Policy

### 7.1 Quantitative thresholds

| Metric | WARN (PR comment) | FAIL (block merge) | Source |
|---|---|---|---|
| Peak heap (dhat `peak_total_bytes`) | > 1.10 × baseline | > 1.25 × baseline | T1 calibration |
| Total alloc bytes (dhat `total_alloc_bytes`) | > 1.25 × baseline | > 1.50 × baseline | T1 calibration |
| Total alloc count (dhat) | > 1.50 × baseline | > 2.00 × baseline (suggests quadratic) | T1 calibration |
| `definitely_lost` bytes (valgrind-memcheck) | > 0 | any increase vs baseline | absolute gate |
| Soak slope (massif, federated services) | > 100 KB / min | > 1 MB / min | T6 calibration (phenotype-router) |

**Why these numbers (preliminary, T1 will refine):**

- 10 % / 25 % peak thresholds align with the latency budget thresholds in v19 T4 (`perf_gate.py`). Same philosophy: small noise is fine, big regression is a bug.
- 50 % / 100 % total-alloc thresholds are looser because total alloc is more variable (depends on input patterns). The 100 % "FAIL" catches the "I accidentally added a quadratic loop" class of bug.
- 0-tolerance on `definitely_lost` is correct: a leak is a leak; there's no acceptable baseline.

### 7.2 Baseline update protocol

- **Auto-update on `main`:** if nightly run differs from current baseline by > 5 % AND < 25 % peak / < 50 % total, the workflow opens a PR that updates the baseline. The PR is labeled `mem-baseline-update` and requires reviewer approval.
- **Manual override:** PR labeled `mem-baseline-override` with a `reason:` field in the PR description.
- **Never auto-update on `definitely_lost`:** any non-zero value in the baseline must be cleared by a code fix, not a baseline bump.

### 7.3 What is NOT a regression

- **Tool version drift** (dhat 0.3 → 0.4) — handled by recording tool version in baseline JSON; CI flags mismatched versions for review, does not fail.
- **Allocator change** (jemalloc → mimalloc) — out of scope for this gate. Each crate's baseline is allocator-specific.
- **Platform difference** — only Linux x86_64 is gated. ARM64, musl, etc. are separate baseline files (`mem-<crate>-aarch64.json`).
- **First run after baseline introduction** — T1 will introduce pheno-config baseline; the first run writes the baseline, does not gate on it.

---

## 8. Action Items (v22 + v23)

### 8.1 v22 (current cycle, 2026-06-22 to 2026-07-06)

| # | Item | Owner | LOC | Device |
|---|---|---|---|---|
| 1 | T1: pheno-config dhat benchmark + baseline + workflow | orchestrator | ~150 | macbook |
| 2 | `justfile` recipes (`mem-heaptrack`, `mem-massif`, `mem-dhat`, `mem-heaptrack-macos`) | orchestrator | ~50 | macbook |
| 3 | `.github/workflows/mem-gate.yml` (dhat gate for pheno-config only initially) | orchestrator | ~80 | macbook |
| 4 | `.github/scripts/mem_gate.py` + `extract_dhat.py` | orchestrator | ~100 | macbook |
| 5 | `benchmarks/baselines/mem-pheno-config.json` (initial baseline from T1) | T1 output | n/a | heavy-runner |
| 6 | ADR-042B-amend-1 (substrate quality bar memory rule) | orchestrator | ~50 | macbook |
| 7 | AGENTS.md update (v22 closure, this methodology) | orchestrator | ~30 | macbook |
| 8 | STATUS.md update (L19 deepening + L13 deepening) | orchestrator | ~10 | macbook |
| **T1 total** | | | **~470 LOC** | mostly macbook |

### 8.2 v23 (next cycle, target 2026-07-06 to 2026-07-20)

| # | Item | Owner | LOC | Device |
|---|---|---|---|---|
| 1 | T2: pheno-errors dhat benchmark + baseline | orchestrator | ~120 | macbook + heavy-runner |
| 2 | T3: pheno-tracing dhat benchmark + baseline | orchestrator | ~150 | heavy-runner (large fixture) |
| 3 | T4: pheno-mcp-router dhat benchmark + baseline | orchestrator | ~200 | heavy-runner |
| 4 | T5: pheno-port-adapter dhat benchmark + baseline | orchestrator | ~120 | macbook + heavy-runner |
| 5 | T6: phenotype-router 30-min massif soak + soak-slope baseline | subagent | ~300 | heavy-runner |
| 6 | T7: phenotype-hub 30-min massif soak | subagent | ~300 | heavy-runner |
| 7 | `mem-gate.yml` matrix expansion (all 7 crates) | orchestrator | ~30 | macbook |
| 8 | L13-L19 71-pillar re-audit (L13 → 2.5, L19 → 2.5) | worklog-schema circle | ~50 | macbook |
| **v23 total** | | | **~1,270 LOC** | mixed |

### 8.3 v24+ (backlog)

- Cache-line / false-sharing analysis via `cachegrind` (out of scope for SIDE-63, separate audit if needed).
- ARM64 baseline files (when Apple Silicon runners are available).
- Cross-crate allocation analysis (which crate is the biggest allocator consumer fleet-wide).
- Sub-crate memory budgets enforced at the `#[track_caller]` level (deferred until we have data showing it's needed).

---

## 9. Caveats & Known Issues

1. **Linux-only.** All three tools are Linux-only. macOS dev uses `xcrun malloc_history` or Instruments.app as a manual proxy. CI is Linux-only. Cross-platform memory comparison is out of scope.
2. **Debug build required for call-stack resolution.** Massif and dhat need symbol info. The recipes use `cargo build` (debug) or `cargo build --release --config 'profile.release.debug=true'`. Release-without-debug produces meaningless call stacks.
3. **Slowdown.** dhat ~10-30×, massif ~10-50×, memcheck ~20-50×. Benchmarks must be representative but not exhaustive — a 1-second workload becomes 10-30 seconds under dhat. 30-min soaks are only feasible with the dhat-in-process mode (not CLI).
4. **`dhat` crate's `DhatAlloc` retains bookkeeping memory** until dropped. Use `Dhat::start_profiling()` (manual) instead of `Dhat::start_aerial()` if the bench's first action is to do something that should NOT be measured.
5. **Sparse-checkout cone artifact.** On the current branch, `pheno-context/`, `pheno-config/`, and `pheno-flags/` `Cargo.toml` may be absent from the cone (per AGENTS.md "Stale / warnings"). The benchmark binaries referenced above may need to be added to the cone or written in a worktree that has the full checkout. This is a verifiability gap; not a methodology gap.
6. **macOS dev results not comparable to Linux CI.** Documented; not a bug.
7. **Tool version drift.** dhat-viewer schema breaks across major versions. The workflow records the dhat version in the baseline JSON; a major-version bump requires regenerating all baselines (planned via `mem-baseline-regen-all` workflow dispatch input).
8. **First run after methodology introduction is not gated.** T1 establishes the pheno-config baseline; the gate only enforces from the second run onward.
9. **No allocator swap baseline.** The methodology assumes the default Rust allocator (System). If a crate later switches to jemalloc or mimalloc, a separate baseline file is required (`mem-<crate>-jemalloc.json`).

---

## 10. Verdict

SIDE-63 is **READY for v22 T1 implementation**. The methodology is complete; the tools are well-understood; the CI integration is sketched; the thresholds are calibrated (preliminarily, to be refined in T1).

**Recommended first action:** land T1 (pheno-config dhat benchmark + baseline + workflow) by 2026-06-29. This unblocks:
- ADR-042B-amend-1 (substrate quality bar with concrete example).
- v23 T2-T5 (the other 4 substrate crates follow the pheno-config pattern).
- 71-pillar L19 re-audit (L19 2.0 → 2.5 by end of v23, target L19 3.0 by end of v24).

**Risk register:**

- R1: dhat crate API drift. **Mitigation:** pin to `dhat = "0.3"` in all benches; review on bump.
- R2: valgrind/heaptrack not on the default heavy-runner image. **Mitigation:** `apt-get install` in the workflow; no image baking required.
- R3: Baseline noise from CI machine variance. **Mitigation:** the 10 % / 25 % thresholds absorb normal CI noise; 50 % total threshold is the strict gate.
- R4: Methodology doc rot (tools evolve, best practices change). **Mitigation:** quarterly review per ADR-041B (substrate audit cadence); v25 / v26 / v27 cycles will refresh the tooling section.

**Status:** PROPOSED → ACCEPTED on T1 first-pass (the first run will validate the methodology end-to-end; if it works, the doc is promoted to ACCEPTED; if not, iterate).
