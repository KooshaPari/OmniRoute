# ADR-049 — App-substrate drift detector (3-pass algorithm)

**Status:** ACTIVE (governing section in AGENTS.md § "App-substrate drift detector")
**Date:** 2026-06-18 (last rebuilt 2026-06-21 after disk-loss event)
**Owner:** orch-w1-a (L5-114)
**Layer:** 71-pillar L74 (Predictive Architecture)
**Tool:** `KooshaPari/pheno-drift-detector` (L74)

> **Rebuilds note (2026-06-21):** This file was restored after a disk-loss event.
> Governance definition unchanged. Cross-references to ADR-023, ADR-035, ADR-036,
> ADR-044, ADR-048 and to AGENTS.md § "App-substrate drift detector" all preserved.

## Context

ADR-023 (app-substrate placement) establishes that **app-level repos
default to PAUSED** and any reusable capability must be extracted into a
substrate prime (`pheno-*-lib`, `phenotype-*-sdk`, `phenotype-*-framework`,
or federated service).

The practical problem: how do we **detect** when a PAUSED or CONDITIONAL
app has created a 2nd non-trivial capability that should be extracted?
Manual auditing is too slow (8+ apps × 71 pillars × weekly cadence).

This ADR codifies an automated drift detector and the 3-pass algorithm it
implements.

## Decision

The fleet runs `pheno-drift-detector` weekly on the heavy-runner (Wed
09:00 PDT per ADR-044). The detector implements a 3-pass algorithm:

### Pass 1 — Candidate identification
Scan all `bucket = PAUSED` or `bucket = CONDITIONAL` app repos (per the
AGENTS.md app-triage table). For each repo, identify candidate
capabilities:

- **A directory under `src/` (or `lib/`, `internal/`, `crates/`)
  containing non-trivial code** — defined as:
  - ≥ 500 LOC, OR
  - ≥ 3 sub-modules with distinct public APIs, OR
  - A documented public API surface (in README, SPEC, or rustdoc)

- **Candidate is excluded if:**
  - It's already declared as a substrate (`phenotype` or `pheno-` prefix in
    its directory path), OR
  - It's a known framework lock-in (engine, sim, render — see ADR-023
    CONDITIONAL table footnotes)

### Pass 2 — Drift scoring
For each candidate, compute a drift score across 4 criteria:

| Criterion | Weight | Pass condition |
|---|---|---|
| **Size** | 0.25 | ≥ 500 LOC (or 3 sub-modules with APIs) |
| **Cohesion** | 0.25 | Internal cohesion ≥ 0.5 (function-to-module ratio, low cross-module coupling) |
| **Reusability** | 0.30 | Module is used by ≥ 2 other modules in the app, OR has a documented "this is reusable" note |
| **Independence** | 0.20 | Module has ≤ 2 dependencies on app-specific state (config, types) |

Score = `sum(weight × (0|1|2|3))` per criterion, where 0=absent, 3=strong.
Max score = 3.0. **Threshold: score ≥ 1.5 → drift hit.**

### Pass 3 — Issue creation
For each drift hit:
- **Score ≥ 2.5 (critical):** auto-create GitHub issue on the app repo
  with `bucket-change` label and a recommended extraction target
  (`phenotype-*-lib` per default ADR-023 Rule 3 placement).
- **Score 1.5-2.4 (warning):** add to weekly rollup; no auto-issue.
- **Score < 1.5:** not reported.

The recommended extraction target is inferred from the candidate's
language and dependency surface:
- Pure Rust + no async → `phenotype-*-lib`
- Async Rust or polyglot consumers → `phenotype-*-sdk`
- IoC lifecycle + multiple ports → `phenotype-*-framework`
- Stateful long-running → federated service

## Anti-patterns (forbidden)

- **Suppressing hits manually** — the detector's output is the audit trail;
  suppressing a hit requires a one-line worklog entry with reason.
- **Extracting without consumer evidence** — a candidate scoring high on
  Size+Cohesion but low on Reusability is a "dead module", not a drift hit.
  The detector does not flag these.
- **Tier-skipping on extraction** — extracted primes follow ADR-048's
  tier-promotion gates; the detector does NOT auto-promote.
- **Ignoring CONDITIONAL bucket** — CONDITIONAL apps are scoped
  (engine-only, no UI), but capabilities within that scope still drift.

## Tooling

- **`KooshaPari/pheno-drift-detector`** — single-file Python CLI
  (stdlib-only). Implements the 3-pass algorithm. Output formats:
  - `--format json` — machine-readable (CI integration)
  - `--format md` — human-readable rollup
  - `--format gh-issues` — auto-creates GitHub issues via `gh` CLI
- **Cron:** heavy-runner, Wed 09:00 PDT per ADR-044
- **Output:** `findings/drift-hits-{date}.md` (weekly rollup)

## Workflow

```
1. Wed 09:00 PDT: pheno-drift-detector scan --root . --format md --out
   findings/drift-hits-{date}.md
2. Critical hits (≥ 2.5): gh issue create --label bucket-change on each
   affected app repo
3. Weekly rollup is appended to STATUS.md § "App-substrate drift"
4. Hits are tracked until either extracted (bucket_change worklog entry)
   or formally suppressed (with reason)
```

## Retroactive scoring (validation of the algorithm)

Running the detector against historical state confirmed 3 hits:

| App | Candidate | Score | Outcome |
|---|---|---|---|
| `HwLedger` | `capacity-math` lib | 2.8 | **EXTRACTED** as `KooshaPari/pheno-capacity` per ADR-036 (closed 2026-06-19); bucket_change HwLedger PAUSED→CONDITIONAL |
| `Dino` | engine primitives | 2.1 | Warning; not extracted yet (engine is CONDITIONAL-scope, deferred) |
| `AtomsBot` | agent-sim core | 1.7 | Warning; capstone, may be legally mined instead of extracted |

## Companion ADRs

- **ADR-023** — Agent-effort governance (PAUSED default; drift detector is
  the mechanism that surfaces extraction candidates)
- **ADR-035** — Configra migration gates (Configra was the first fleet
  extract; sets the precedent)
- **ADR-036** — pheno-capacity canonical (first successful extraction via
  this detector)
- **ADR-044** — Cron deployment (drift scan runs Wed 09:00 PDT)
- **ADR-047** — Predictive DRY (forward case: extract a prime before the 2nd consumer)
- **ADR-048** — Substrate graduation (post-extraction, the prime may be
  promoted per tier gates)

## References

- `findings/71-pillar-2026-06-17-schema.md` § 3.10 (PAX domain, L74 definition)
- `findings/2026-06-18-L8-009-app-substrate-drift.md` (decision log)
- `KooshaPari/pheno-drift-detector/README.md` (tool docs + algorithm)
- AGENTS.md § "App-substrate drift detector" (governance section)
- AGENTS.md § "App substrate placement" (extraction target taxonomy)
