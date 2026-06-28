# v24 — 71-Pillar Cycle 14, P0 Reduction Round 1 (2026-06-29)

**Cycle type:** P0 reduction (vs v23's P1 reduction)
**Target org mean lift:** +0.31 (vs v23's +0.05 — 6x)
**Critical path:** T1 → T2 → T3 (all must land before v25)

## Why this cycle is different

v17-v23 averaged 3.4 tracks/cycle, each scoping to "add one new file" or "fix one workflow" — i.e., shape was constrained to "MacBook-runnable, ≤2h." v24 inverts: scope is "every repo that needs this fix gets this fix, in this cycle." Tracks are wider; the per-repo work is still small (≤1h each, often 1-2 files); but the *number of repos touched per track* is the unit of progress.

Per `findings/71-pillar-2026-06-20-weekly-2.md`:
- 8 substrate repos (pheno-*)
- 4 have NO CI workflows (L29 gap)
- 8 have NO `pheno-tracing` wiring (L57 gap)
- 0 have branch protection rulesets (L46 gap)
- 0 have SSOT-meta-bundle (L65 gap)

| Pillar | Gap | Lift/track | Repos affected | Total lift |
|--------|-----|-----------|----------------|------------|
| L29 CI matrix | 4 repos × 4 workflows each = 16 missing workflows | +0.04/repo | 4 | +0.16 |
| L57 pheno-tracing wiring | 8 repos × 2-line dep + init | +0.04/repo | 8 | +0.32 |
| L46 branch protection | 8 rulesets, fleet-wide | +0.05/each | 8 | +0.40 (cap +0.10) |
| L65 SSOT meta-bundle | CHANGELOG.md + VERSION + AGENTS.md per repo | +0.02/repo | 8 | +0.16 |
| L38 llms.txt | 1-line file per repo | +0.02/repo | 8 | +0.16 |
| L29 codespell | 1 workflow per repo | +0.02/repo | 8 | +0.16 |

**Total ceiling if all 6 tracks land:** +1.04 org mean (cap at 1.0). Realistic target: **+0.31** (close the highest-leverage gaps; defer L46 cap until v25).

## Track breakdown (6 tracks, 2-week critical path)

### T1: L29 CI matrix for 4 substrate repos (highest-leverage, 16h seq / 4h parallel)

**Repos:** pheno-config, pheno-context, pheno-events, pheno-flags (4 with no CI)

**Per repo, 4 workflows:**
- `ci.yml` — test + clippy + fmt + check (path-filtered to skip `*.md`)
- `cargo-deny.yml` — license + ban + source audit
- `cargo-audit.yml` — security CVE scan
- `governance-drift.yml` — pheno-drift-detector weekly run (per ADR-049)

**Patterns:** mirror `phenotype-tooling/templates/reusable-quality-gate.yml` (canonical reference for SHA pins + step ordering). All workflows use `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (verified, L5-131 SHA fix). Each repo gets the same 4-workflow set; manual review is per-workflow, not per-repo.

**Sequencing:** 4 repos × 4 workflows = 16 files. Can be parallelized across 4 worktrees (one per repo) for 4h instead of 16h.

**Per-repo org mean lift:** +0.04. **Total:** +0.16.

### T2: L57 pheno-tracing wiring in 8 substrate repos (4h, parallel)

**Repos:** all 8 pheno-* crates.

**Per repo, 2-line change:**
1. Add `pheno-tracing = { path = "../pheno-tracing" }` to `[dependencies]`.
2. Add a `tracing_init()` call in `lib.rs` (or `main.rs` if binary).

**Why 2 lines, not 20:** `pheno-tracing` is designed to be a 1-line wire-up (per ADR-012). The heavy lifting (OTLP export, span batching, attribute propagation) is in the substrate crate, not the consumer.

**Per-repo org mean lift:** +0.04. **Total:** +0.32.

### T3: L65 SSOT meta-bundle for 8 substrate repos (4h, parallel)

**Repos:** all 8 pheno-* crates.

**Per repo, 3 files:**
- `CHANGELOG.md` — minimal "Keep a Changelog" stub with current version section.
- `VERSION` — single-line semver (`0.1.0` for new crates, derived from `Cargo.toml` otherwise).
- `AGENTS.md` — per-repo AGENTS.md that includes the meta-bundle pointers (WORKLOG.md, llms.txt, LICENSE-MIT, CHANGELOG.md, CODEOWNERS).

**Per-repo org mean lift:** +0.02. **Total:** +0.16.

### T4: L38 llms.txt for 8 substrate repos (1h, parallel)

**Repos:** all 8 pheno-* crates.

**Per repo, 1 file:**
- `llms.txt` — agent-discoverable metadata (per ADR-024 Factory AI crosswalk): name, version, install command, test command, primary docs, key entry points.

**Per-repo org mean lift:** +0.02. **Total:** +0.16.

### T5: L46 branch protection rulesets (8h, on KooshaPari/* org)

**Repos:** 8 substrate repos as the pilot.

**Per repo, 1 ruleset:**
- Default branch = `main`
- Require 1 approving review on PR
- Dismiss stale reviews on new push
- Require linear history
- Require signed commits (optional, phase 2)
- Block force-pushes
- Block branch deletion

**Per-repo org mean lift:** +0.05. **Total:** +0.40 (cap at +0.10 due to org mean saturation).

### T6: L29 codespell workflow for 8 substrate repos (1h, parallel)

**Repos:** all 8 pheno-* crates.

**Per repo, 1 file:**
- `.github/workflows/codespell.yml` — runs codespell on push + PR with `ignore-words-list` from `phenotype-ops/templates/codespell-ignore.txt` (the canonical list).

**Per-repo org mean lift:** +0.02. **Total:** +0.16.

## Critical path

```
Week 1: T1 (4h parallel via 4 worktrees) + T2 (4h parallel)
Week 2: T3 + T4 + T6 (6h parallel) + T5 (8h, but on heavy-runner via gh API)
End of W2: v24 closure worklog + PRs + adoption doc
```

Total: **2 weeks, 24h actual work, +0.31 org mean lift**.

## Anti-patterns to avoid (per v23 retrospective)

1. **No new infrastructure files** (no `pheno-*-tools`, no `phenotype-ops/templates/`). T1-T6 all wire existing infrastructure into existing repos.
2. **No planning docs.** Each track's deliverable is code/config, not markdown.
3. **No "v24 closure" findings doc.** The worklog entry is sufficient.
4. **No per-track "design session."** The patterns are already in `phenotype-tooling/templates/` and `phenotype-ops/governance/`; we copy + customize.

## Acceptance criteria

- 8 substrate repos have all 6 tracks' deliverables (some may already have a few)
- 4 of those repos gain their FIRST CI workflows (L29)
- 8 of those repos gain `pheno-tracing` wiring (L57)
- 8 rulesets live on `KooshaPari/{repo}` main branches (L46)
- Per-repo org mean moves from current ~1.50 to ~1.80

## Cross-references

- `findings/71-pillar-2026-06-20-weekly-2.md` — gap table this cycle closes
- ADR-012 — pheno-tracing as canonical substrate
- ADR-024 — Factory AI cross-cutting standard
- ADR-029 — pheno-drift-detector origin story
- ADR-040 — test coverage gates per tier
- ADR-041 — audit + security cadence
- ADR-048 — substrate graduation path
- ADR-049 — drift detector
- `phenotype-tooling/templates/reusable-quality-gate.yml` — canonical CI template
- `phenotype-ops/governance/lefthook.yml` — pre-push enforcement
- `phenotype-ops/templates/codespell-ignore.txt` — fleet spell-check baseline
- `phenotype-ops/templates/deny.toml` — fleet deny policy
