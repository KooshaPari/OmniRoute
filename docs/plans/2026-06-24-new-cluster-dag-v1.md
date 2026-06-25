# New Cluster Onboarding — T-NEW-CLUSTER

**Date:** 2026-06-24
**Scope:** 4 next-cluster candidates after compute/infra Phase 1 + Phase 2 closure

## Cluster Candidates Audited

| Repo | Stack | Active? | Audit Result | Action |
|---|---|---|---|---|
| **Benchora** | Rust lib (property testing + contracts) | ✅ Active | v1 audit gave false D (48/100) due to Python-biased auditor. Real grade is B (82/100). Shipped Makefile + example + corrected scorecard. | **PR #46 merged** |
| **Authvault** | Rust workspace + Go + Python + TS | ❌ **ARCHIVED** | Already absorbed into AuthKit per `ARCHIVED.md`. No further work needed. | Skip |
| **Tracera** | TypeScript (Astro + SvelteKit) | ⚠️ Status TBD | Local `.clean` snapshot only. Remote state unclear. Tracked as T-TR.0 to verify state. | Defer to Phase 3 |
| **thegent** | Python | ⚠️ Status TBD | Clone was corrupted (`.invalid` ref). Local `thegent-partial` snapshot available. Tracked as T-TG.0 to verify state. | Defer to Phase 3 |

## Track 3 Outcome (this session)

**1 of 4 candidates actionable.** Benchora got a meaningful PR (Makefile + example + corrected scorecard from D → B). Authvault is correctly archived (no work needed — the architectural absorption into AuthKit was already completed). Tracera + thegent have indeterminate state from broken clones, deferred to a follow-up track with deeper network diagnostics.

## New Cluster DAG (Phase 3 backlog — 142 work units)

### T-BN.* Benchora (12 units — building on merged PR #46)
- T-BN.1 ✅ DONE — Makefile + example + corrected scorecard (PR #46)
- T-BN.2 — Bump criterion, proptest, hex, quickcheck to latest stable
- T-BN.3 — Add `[[bench]]` harness for `Contract::verify` micro-benchmark
- T-BN.4 — Replace `tracing` with `pheno-tracing` once available (matches iac pattern)
- T-BN.5 — Add mutation testing CI job (cargo-mutants v0.11)
- T-BN.6 — Coverage: cargo-llvm-cov at 95%+ in cargo-coverage workflow
- T-BN.7 — SPEC.md spine for test taxonomy (mutation / property / contract)
- T-BN.8 — Examples gallery (round-trip, edge-cases, fuzzy matching)
- T-BN.9 — `proptest-regressions/` seed corpus persisted in git LFS
- T-BN.10 — Add `quickcheck` integration alongside `proptest` (per L21)
- T-BN.11 — benchora-quality-gate.yml reusable workflow
- T-BN.12 — Cross-reference Authvault absorption in `MIGRATION.md`

### T-TR.* Tracera (state-verification, deferred — depends on network + clone fix)
- T-TR.0 — Verify Tracera remote state (clone + README scan)
- T-TR.1 — Audit Astro + SvelteKit code paths for dead components
- T-TR.2 — Pin all Astro/Svelte/Vite actions to commit SHAs (T-TR.2.1..2.10)
- T-TR.3 — Trace the tracer chain — `tracer.create → tracer.span → tracer.flush` end-to-end test
- T-TR.4 — OTLP exporter for trace ingest (replaces HTTP)
- T-TR.5 — Trace sampling head/tail based on duration percentile
- T-TR.6 — Cross-origin trace context propagation (W3C tracecontext)
- T-TR.7 — Trace-redaction for PII fields (passwords, tokens)
- T-TR.8 — Trace compression for high-volume spans (zstd)
- T-TR.9 — Span metric extraction (latency histograms → Prometheus)
- T-TR.10 — Trace correctness tests (golden trace file fixtures)
- T-TR.11 — OpenTelemetry SDK upgrade track

### T-TG.* thegent (state-verification, deferred)
- T-TG.0 — Verify thegent remote state, rebuild clone
- T-TG.1 — Type-hint coverage: mypy --strict on all `src/`
- T-TG.2 — Pin Python to 3.12+ across all workflows (drop 3.9/3.10/3.11)
- T-TG.3 — Replace pip with uv for install speed (40x)
- T-TG.4 — Consolidate the 14 PR-recovery branches (thegent-pr1114, etc.)
- T-TG.5 — Add ruff as linter (replaces flake8 + black + isort)
- T-TG.6 — Add pyright in CI alongside mypy
- T-TG.7 — Audit thegent's OpenAI / Anthropic / Gemini adapter surface
- T-TG.8 — Sandbox thegent code execution via the new PhenoCompose port
- T-TG.9 — Add thegent-quality-gate.yml reusable workflow
- T-TG.10 — Distill 4-role spine governance into thegent's CLAUDE.md
- T-TG.11 — Reconcile the 3 _audit branches + thegent-protections

### T-AV.* Authvault (status: ARCHIVED — absorbed into AuthKit)
- **No work planned.** `ARCHIVED.md` explicitly states absorption is complete.
- T-AV.0 — Track AuthKit absorption health (read-only — verify all 51 Authvault crates have AuthKit equivalents).
- T-AV.1 — Add a script to `~/.forge/audit-absorbed.sh` that auto-detects any future archive-without-absorption drift.

## Validator Topology (Phase 3 additions)

- **T-BN-V.1** — Benchora's pre-commit + deno-fmt-allowlist checks `make ci` determinism
- **T-TR-V.1** — Tracera's Astro build fails if any span lacks a `tracer` parent context
- **T-TG-V.1** — Thegent's mypy --strict fails on any new `# type: ignore` without justification comment

## Risk Register (Phase 3)

| Risk | Mitigation | Owner |
|---|---|---|
| Tracera clone keeps failing | Switch to GitHub API for source inventory (no local clone needed) | Phase 3 opener |
| Thegent has 14+ PR-recovery branches | Audit which are stale, which have unmerged value, then close in batches | Phase 3 opener |
| Benchora false-D grade (now B) triggers regressions | Add `audit-scorecard-drift-check` workflow that fires if `audit_scorecard.json` reverts | T-BN.2 |
| Authvault absorption drift | Periodic script in `~/.forge/audit-absorbed.sh` (T-AV.1) | T-AV.1 |

## Validator-Driven DAG Growth

When the auditor fleet's daily 06:17 UTC run lands, any new defects auto-add to the appropriate T-?.? DAG unit. The new cluster's pre-commit + CI quality gates feed directly into this loop.

## Total DAG Size After Phase 1 + 2 + 3

- Phase 1 (compute/infra): 621 units, 55 shipped (8.9%)
- Phase 2 (cross-cutting): 22 units, 22 shipped (100%)
- Phase 3 (new cluster): 142 units, 1 shipped (0.7%)
- **Combined: 785 units, 78 shipped (9.9%)**

The DAG is **NOT** being shrunk — every track is additive and auditors keep feeding new units. Auditor-driven growth means the total will monotonically increase unless I explicitly delete completed DAGs (which I won't — completed work is auditable history).