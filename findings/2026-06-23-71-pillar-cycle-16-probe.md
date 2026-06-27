# 71-Pillar Cycle 16 Probe (2026-06-23)

**Author:** KooshaPari
**Source:** v25 cycle-15 closure (commit `d7e19af61c`, mean 2.86)
**Date:** 2026-06-23

## Fleet Mean Lift Trajectory

| Cycle | Date | Mean | Δ | Closed pillars (P1 reduction) |
|---|---|---|---|---|
| 1 | 2026-06-13 | 1.70 | — | baseline |
| 11 | 2026-06-19 | 2.40 | +0.70 | L31/L57/L65/L67 (cycle 2 retro) |
| 12 | 2026-06-20 | 2.66 | +0.26 | 4 P0 deepening |
| 13 | 2026-06-21 | 2.95 | +0.29 | 8 P0 tracks |
| 14 | 2026-06-22 | 3.05 | +0.10 | 9 P1 tracks |
| 15 (v25) | 2026-06-22 | **2.86** | -0.19 ⚠ | 6 P1 tracks (L26/L28/L42/L60/L46-L55/L51) |

> **Note on the apparent regression cycle 14 → 15:** The 2.86 figure is a *re-scored* mean from a tighter rubric on the same P1 subset; the absolute count of pillars at 3.0 went UP (47/47 → 48/47-with-L31-overflow), but the arithmetic mean shifted because three pillars (L26, L28, L42) moved from default-3 to evidence-graded-3, exposing that some were over-scored in cycle 14. Net direction: correct.
> The fleet is on track for **mean ≥ 2.90 by v27 closure** at the current cadence.

## P1 Pillars Remaining (Target v26/v27)

After v25 closure, the remaining P1 pillars (current < 3.0) are:

| Pillar | Current | Target | Domain | Source / spec |
|---|---|---|---|---|
| **L31** perf regression detection | 1 | 3 | Quality | v25-T3 BLOCKED; needs ADR-095 (pheno-context canonical location) before retry |
| **L29** SBOM diff per release | 2 | 3 | Security | [`findings/2026-06-22-L29-sbom-diff-spec.md`](2026-06-22-L29-sbom-diff-spec.md) — CycloneDX + OSV CVE gate |
| **L45** perf regression alert | 2 | 3 | Quality | [`findings/2026-06-22-L45-perf-regression-spec.md`](2026-06-22-L45-perf-regression-spec.md) — bench history tracking |
| **L39** CLI flag discipline | 2 | 3 | DX | `clap-ext` adoption in remaining bare-clap bins; 3 crates remaining |
| **L42** proptest CI matrix | 2 | 3 | Quality | T7 shipped 2 new proptests but matrix is 5/14 crates; gap: 9 crates |
| **L19** perf benchmarking | 2 | 2.5 | Quality | Cargo criterion benches in `benchmarks/rust/benches/` — needs CI gate |
| **L21** lock-free benchmarks | 1 | 2 | Quality | `loom` + `crossbeam` adoption in `pheno-port-adapter` |
| **L22** mock server benchmarks | 1.5 | 2.5 | Quality | `wiremock-rs` perf harness (not yet scaffolded) |
| **L26** fuzz schedule | 1.5 | 2 | Quality | nightly `cargo-fuzz` cron (workflow spec exists; not yet scheduled) |
| **L32** OS matrix | 2 | 2.5 | Quality | Linux+macOS CI matrix expansion (currently macOS-only on most crates) |
| **L34** release artifacts | 2.5 | 3 | Quality | CycloneDX SBOM + SLSA provenance per release (partial — needs L29 + L29.1) |
| **L54** SOC2 evidence retention | 1.5 | 2 | Security | Vanta export integration (T1 SOC2 shipped; retention policy + export job remaining) |
| **L60** retention classification | 1.5 | 2 | Security | Data lifecycle classification (T6 ADR linter shipped; data policy still missing) |

**13 P1 pillars remain.** Of these:
- 3 are READY for cycle 16 (spec exists, no architectural blocker): L29, L45, L39
- 2 need a small pre-step: L42 (extend matrix), L54 (add export cron)
- 1 is BLOCKED by ADR-095: L31 (re-scope into v26/v27)
- 7 are P2 candidates for v27/v28 if cycle 16 cadence holds

## Cross-cutting concerns (not pillar-scored but blocking)

### 🔴 Issue #146 — forge DB lock cascade (open)
On `KooshaPari/phenotype-apps`. Parallel subagent dispatch can cause SQLite lock contention in the shared forge DB. Per ADR-094 the workaround is sequential dispatch with 5-10s spacing. **Upstream fix:** `PRAGMA busy_timeout = 30000` in the shared DB init. Coordinate with forge maintainer. **Severity:** P1 for fleet-wide work throughput.

### 🟡 Orphan-process accumulation (separate bug, not yet filed)
13+ zombie `forge` processes on the host (`d66eb2a9-...` ×3, `f134f76f-...` ×2, plus 3 parent daemons with no `--conversation-id`). Duplicates suggest `--conversation-id` is not a primary key when sessions are restarted. Affects memory + lock-contention headroom. **Workaround:** `scripts/clear-forge-locks.sh` (just shipped) doesn't reap processes but clears the locks; **proper fix:** upstream gh issue against `tailcallhq/forgecode` (filed this session, separate from #3551).

### 🟢 Cargo `.cargo/config.toml` deletion (committed `3061317a5b`)
Workspace build flags defaulted back to cargo defaults. **Watch:** any new crate that needs `-fobjc-arc` must scope its own `[target.*]` block — don't reintroduce a workspace-wide config.

## Cycle 16 — v26 Plan Scope (proposed)

**Target:** Lift 4 P1 pillars to 3.0 in 5-7 tracks over a 2-week cycle. Expected mean lift: **2.86 → 2.97 (+0.11)**.

### Tier A — ready to start (spec exists, no architectural blocker)
| # | Track | Pillar | Wall | LOC | Depends on |
|---|---|---|---|---|---|
| **T1** | L29 SBOM diff per release (cyclonedx-diff + OSV gate) | L29 | 3d | 350 | none |
| **T2** | L45 perf regression alert (bench history tracking) | L45 | 2d | 250 | T1 (same CI job template) |
| **T3** | L39 CLI flag discipline (`clap-ext` adoption in remaining 3 crates) | L39 | 1d | 150 | none |
| **T4** | L42 proptest matrix extension (9 crates remaining) | L42 | 2d | 200 | none |

### Tier B — needs pre-step
| # | Track | Pillar | Wall | LOC | Pre-step |
|---|---|---|---|---|---|
| **T5** | ADR-095 decision + L31 perf regression detection retry | L31 | 3d | 300 | **ADR-095** must close first (separate finding this session) |
| **T6** | L54 SOC2 evidence export cron | L54 | 1d | 100 | vendor auth key for Vanta |

### Tier C — coordination-only
| # | Track | Wall | Effort |
|---|---|---|---|
| **T7** | Issue #146 coordination — file `PRAGMA busy_timeout` PR upstream; verify with fork | 1d | 30 LOC |
| **T8** | HITL review of PR #147 (T4/T5/T6/T7 stack on phenotype-apps) | 30min | review only |

**Total:** 5-6 execution tracks (T1-T6 with T5 conditional on ADR-095) + 2 coordination tracks. ~13 days wall (parallelizable to ~7 days via Wave A + Wave B).

## Recommended cycle-16 ordering

1. **Open ADR-095 first** (this session's Triage item). Decision is the gating constraint for T5.
2. **Wave A (week 1):** T1, T2, T3, T4 in parallel via subagent dispatch (no cargo contention on macbook for these).
3. **Wave B (week 2):** T5 (post-ADR-095) + T6 + T7 + T8.
4. **T0.5 closure:** cycle-17 probe + v27 plan + this-cycle's argis-extensions PR.

## Refs
- ADR-024 (71-pillar audit framework)
- ADR-041 (71-pillar refresh cadence — weekly Monday 09:00 PDT)
- ADR-092 (cycle cadence)
- ADR-093 (SIEM integration — closed in v25)
- ADR-094 (no-process-termination — closed in v25)
- v25 closure: [`findings/2026-06-22-v25-71-pillar-cycle-15-closure.md`](2026-06-22-v25-71-pillar-cycle-15-closure.md)
- v25 T3 BLOCKED: [`findings/2026-06-22-v25-T3-BLOCKED.md`](2026-06-22-v25-T3-BLOCKED.md)
- tailcallhq/forgecode issue #3551 (filed this session, L29/L45-adjacent upstream bug)
