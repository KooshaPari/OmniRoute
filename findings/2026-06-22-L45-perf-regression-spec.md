# L45 — Performance Regression Alert Spec

**Date:** 2026-06-22
**Track:** v25 cycle-15 T4 (P1 reduction)
**Branch:** `chore/v25-71-pillar-cycle-15-p1-2026-06-22`
**Owner:** orchestrator (macbook-safe; no heavy cargo)
**Status:** SPEC LANDED — workflow scaffold committed

---

## Problem

Fleet-wide perf regressions currently land silently. The existing `perf-gate.yml`
(`.github/workflows/perf-gate.yml:1`) only checks budget *existence* on PR — it
does not detect regressions against historical baseline. Combined with
`benchmarks/perf-budgets.toml:1` (v12 T9 L57 closure, drift above 1.5x budget
fails CI), the fleet lacks a continuous regression detector that compares each
PR's bench output to the last release baseline.

**L45 (per `findings/71-pillar-refresh-template.md:93`)** is "First-run
experience" in the formal 71-pillar schema, but this turn reuses the L45 slot
in the cycle-15 P1 reduction table to track **perf regression alerting** — the
gap surfaced by the v22/v23 cycle-12/13 probes as the highest-leverage missing
observability pillar between L57 (perf budget) and L60 (OTel histogram).

## Goal

On every PR labeled `perf-regression`, run the full fleet bench suite, persist
the result to `bench-history/` on the `gh-pages` branch, compare against the
last `main` baseline, and fail the workflow on any benchmark regressing by >5%.
Post the delta table as a PR comment so reviewers see the impact inline.

## Tooling

| Layer | Tool | Notes |
|---|---|---|
| Harness | `cargo bench` | Nightly toolchain (stable lacks stable `-Z` features used by some crates) |
| Output format | `bencher` | Pipe-to-file via `tee` for diff stability |
| History | `cargo-bench-history` | Save + compare subcommands; persists JSON to `bench-history/` |
| Diff baseline | `main` branch last successful run | Latest green from `gh-pages/bench-history/main/` |
| OTel export | `pheno-otel` (L60) | Histogram metrics emitted alongside bench results |

## Gate

**Threshold: alert + fail on >5% regression** in any single benchmark.

| Δ%        | Severity | Action                                       |
|-----------|----------|----------------------------------------------|
| ≤ +2%     | OK       | Comment "no significant change"              |
| +2% to +5% | INFO    | Comment "+X% slower, within noise floor"     |
| > +5%     | FAIL     | Exit 1, comment regression table, block merge |
| ≤ −2% (improvement) | OK  | Comment "−X% faster"                  |
| New bench | OK       | Comment "baseline established"               |
| Removed bench | OK   | Comment "no longer measured"                 |

The 5% threshold is the cycle-15 default. ADR-030 (perf budget) is the
canonical home for threshold policy; this workflow reads the threshold from
`benchmarks/perf-budgets.toml` `[history]` section when present, falling back
to 5% otherwise.

## Storage

- **Branch:** `gh-pages`
- **Path:** `bench-history/<bench-name>.json`
- **Schema:** One JSON file per benchmark; `cargo-bench-history` writes
  `{timestamp, commit_sha, branch, samples: [...]}` per file.
- **Retention:** Last 100 runs per benchmark (older entries pruned on save).
- **Pages:** Optional GitHub Pages index at `bench-history/index.html` for
  trend charts (out of scope for v25; tracked as v26 follow-up).

## Diff strategy

```
1. checkout PR head
2. cargo bench -- --output-format bencher | tee current.txt
3. cargo-bench-history save --branch $HEAD_BRANCH
   → writes bench-history/<bench>.json, commits to gh-pages via bot
4. cargo-bench-history compare main --threshold 5%
   → exits 0 if no regression >5%, exits 1 otherwise
5. github-script comments on PR with delta table (markdown)
```

`compare main` reads the most recent `bench-history/main/*.json` (last green
run on main) and diffs against `bench-history/<head-branch>/*.json`. New
benchmarks without a main baseline are recorded but do not block.

## Reuse

| Capability | Existing substrate | File |
|---|---|---|
| OTel histogram for bench timings | `pheno-otel` (L60, ADR-012/036B) | `pheno-otel/src/metrics.rs` |
| Perf budget SSOT | `benchmarks/perf-budgets.toml` | `benchmarks/perf-budgets.toml:1` |
| Existing bench gate (presence check) | `perf-gate.yml` | `.github/workflows/perf-gate.yml:1` |
| Cargo cache | `Swatinem/rust-cache@v2` | (used by `perf-gate.yml:14`) |

L45 builds **on top of** the existing `perf-gate.yml`; it does not replace it.
`perf-gate.yml` continues to enforce budget ceilings on every PR; L45 adds
historical regression detection on labeled PRs.

## Workflow

File: `.github/workflows/perf-regression.yml`

Trigger: `pull_request: types: [labeled]` with label filter
`labels: ['perf-regression']`. Permissions: `contents: read`,
`pull-requests: write`. Jobs:

1. `actions/checkout@v4` (full history for `git log` on `gh-pages`)
2. `dtolnay/rust-toolchain@nightly`
3. `Swatinem/rust-cache@v2`
4. `cargo bench -- --output-format bencher | tee current.txt`
5. `cargo install cargo-bench-history --locked`
6. `cargo bench-history save --branch ${{ github.head_ref }}`
7. `cargo bench-history compare main --threshold 5` (or reads from
   `benchmarks/perf-budgets.toml [history] threshold_percent`)
8. `actions/github-script@v7` — posts/updates PR comment with delta table
9. On failure: `actions/github-script@v7` posts a sticky regression alert

The workflow is **opt-in** (label-gated) — it does not run on every PR, only on
those explicitly requesting a perf-regression check. This keeps the existing
fast-PR-feedback path intact.

## Acceptance criteria

- [x] Spec written (`findings/2026-06-22-L45-perf-regression-spec.md`, this file)
- [x] Workflow scaffold landed (`.github/workflows/perf-regression.yml`)
- [x] Branch: `chore/v25-71-pillar-cycle-15-p1-2026-06-22`
- [ ] Workflow tested on a real PR (downstream — macbook cannot run `cargo bench --workspace`)
- [ ] Threshold policy migrated to `benchmarks/perf-budgets.toml [history]` (v26)
- [ ] GitHub Pages trend charts (v26 follow-up)

## Cross-references

- **ADR-030** (perf budget) — threshold policy home (cycle-15+ work)
- **ADR-012 / ADR-036B** (pheno-tracing canonical) — OTel histogram substrate reused by L60
- **ADR-041** (71-pillar refresh cadence) — L45 audited weekly Mon 09:00 PDT
- **ADR-024** (71-pillar audit framework) — scoring rubric for L45
- **v12 closure (ADR-076)** — L57 perf-budget baseline; L45 is the next-layer
  regression detector on top of L57
- **`benchmarks/perf-budgets.toml`** — SSOT for bench budget ceilings (L57)
- **`.github/workflows/perf-gate.yml`** — sibling workflow (budget presence
  check); L45 adds historical diff

## Implementation notes

- `cargo-bench-history` is a third-party tool. Pin to a specific version in CI
  via `--locked` once `Cargo.lock` includes it (currently it does not — first
  install will populate the lock entry).
- The `bencher` output format is consumed by `cargo-bench-history` directly;
  no extra parsing layer required.
- OTel histogram emission (`pheno-otel`) is best-effort: if the OTel collector
  endpoint is unreachable, bench results are still saved and compared; only the
  histogram export is skipped (logged at `warn`).
- The PR comment uses `actions/github-script@v7` with idempotent comment
  matching (searches for a hidden `<!-- perf-regression -->` marker and updates
  rather than posting duplicates on re-runs).
- `gh-pages` branch writes use a separate PAT (`secrets.GH_PAGES_PUSH_TOKEN`)
  scoped to `gh-pages` only — never the default `GITHUB_TOKEN` (which cannot
  trigger downstream workflows on the same repo by default and has stricter
  write scopes).

## Non-goals (v25)

- Continuous (every-push) benchmarking — only labeled PRs for v25
- Cross-crate regression correlation (single-bench deltas only)
- Statistical significance testing (Welch's t-test etc.) — v26+
- Multi-language benches in one run (Rust only for v25; Python in v26 via
  `pytest-benchmark` storage adapter)

## Open questions

- Should the gate be +5% per-benchmark or +5% on a geometric mean across the
  suite? Per-benchmark is simpler and catches regressions a suite-mean could
  mask; suite-mean is more resistant to noise. ADR-030 should pick one. **v25
  default: per-benchmark.**
- Should we block merge on regression or just comment? **v25 default: comment
  only**, since the label is opt-in. Block-on-fail mode is a follow-up toggle.
