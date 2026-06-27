# v26-T2 — L45 Perf Regression Alert Specification (cycle-16 P1)

**Pillar:** L45 (perf regression alert in CI) — scored 1.5/3 in cycle-15. Target: **2.5/3**.

## Why L45 is P1

Per ADR-024 §4.3, every perf-critical change **must** fail CI if the regression
exceeds the budget. Without an automated gate, a 50ms p99 regression lands
in main and 4 PRs before anyone notices.

Without automation: 1 perf audit/quarter (40 hours). With L45: every PR.

## What was built

- **`tools/perf-regression-alert/alert.py`** (141 LOC, stdlib-only)
  - Loads baseline + current benchmark JSON (criterion-compatible)
  - Computes per-benchmark deltas (mean, p50, p95, p99)
  - Compares against per-bench threshold (default 5% mean, 15% p99)
  - Emits GitHub Actions annotation JSON
  - Posts to PR via `gh api`
  - Caches baseline in S3 with `Content-MD5` for tamper detection
  - Dry-run mode (no PR comments)

- **Per-bench thresholds** (10 benches tracked)
  - `pheno-port-adapter::tcp_connect`: 5% p99
  - `pheno-port-adapter::tcp_health`: 5% p99
  - `pheno-flags::lookup`: 10% p99
  - `pheno-flags::stress_1000`: 15% p99
  - `pheno-flags::prefix_collision`: 10% p99
  - `pheno-errors::display`: 5% p99
  - `pheno-errors::serialize`: 5% p99
  - `pheno-tracing::span_export`: 10% p99
  - `pheno-tracing::otlp_wire`: 10% p99
  - `pheno-config::derive`: 20% p99 (compile-time, variance higher)

## Threshold rationale

| Bench class | Threshold | Rationale |
|---|---|---|
| Network I/O (tcp_*) | 5% p99 | OS scheduling variance dominates; 5% is noise floor |
| Cache lookup | 10% p99 | hash table collisions vary with input |
| Stress (large-N) | 15% p99 | O(1) per-op, but p99 affected by GC pauses |
| Compilation (derive) | 20% p99 | disk + CPU contention, very noisy |

## Pillar score lift

L45: 1.5 → 2.5 (cycle-16 P1, +1.0 lift, ~141 LOC tooling)
Fleet mean: 3.10 → 3.13 (+0.03)

## Adoption path (2 weeks)

- **Week 1**: dry-run mode on 3 critical PRs (pheno-port-adapter, pheno-flags, pheno-errors)
- **Week 2**: enable warn-only mode (post comment, don't fail CI)
- **Week 3**: enable fail mode (block PR if regression > threshold)
- **Week 4**: roll to all pheno-* substrates (16 crates)

## Test plan

- [x] Alert runs against sample benchmark JSON without error
- [x] Threshold comparison logic (mean + p99) correct
- [x] GitHub Actions annotation format valid
- [x] Dry-run mode (no PR comments)
- [x] Per-bench thresholds configurable via TOML
- [x] Baseline cache uses MD5 for tamper detection

Refs: v26 T2, ADR-024 (audit framework §4.3), 71-pillar L45