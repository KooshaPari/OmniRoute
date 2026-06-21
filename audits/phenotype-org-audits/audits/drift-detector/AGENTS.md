# AGENTS.md — pheno-drift-detector

**Status:** v0.1.0 (initial substrate-quality-bar release, 2026-06-19)
**Discipline:** L74 (App-substrate drift detection) — see `findings/71-pillar-2026-06-17-schema.md` §3.10
**ADR anchor:** ADR-049 (App-substrate drift detection discipline), ADR-044 (Drift detection policy)

---

## What this repo is

`pheno-drift-detector` is a fleet-wide drift-detection scanner for PAUSED /
CONDITIONAL / CAPSTONE app repos. It scans each app-level repo for 2+ non-trivial
capabilities that match the substrate pattern (per ADR-023 Rule 3). When detected,
it outputs GitHub-issue-ready JSON for weekly cron → issue auto-creation.

This is the **L74 (App-substrate drift detection)** tool, one of three governance
tooling additions for the v8 sweep (2026-06-18). The other two:

- `pheno-predict` — L72 (predictive-DRY candidate scanner)
- `pheno-framework-lint` — L73 (tier-convention enforcer for substrate types)

The three together form a closed loop: **predict** (L72) → **lint** (L73) →
**detect drift** (L74) → re-predict. The weekly heavy-runner cron runs all three
in sequence.

## Algorithm (1-paragraph)

Walk the root directory for app repos matching ADR-023 buckets. For each candidate,
group source files by top-level directory. A "non-trivial capability" has ≥ 3 source
files, ≥ 5 KB total, and at least one file matching a Port trait pattern
(`trait Foo {`, `interface Foo {`, etc.). Drift score = weighted sum of capabilities,
ports, adapters, and tests. Threshold: 1.5. Hits above threshold get a suggested
substrate target and extraction path. See [`SPEC.md`](./SPEC.md) for the full spec.

## When to run this

- **Weekly cron (heavy-runner):** Mon 09:00 PDT — `phenotype-tooling/.github/workflows/reusable/python-ci.yml`
- **On-demand before a v8+ plan release:** scan the entire fleet to seed the
  ADR backlog with drift-extraction candidates.
- **After bucket changes:** re-run after reclassifying an app repo (e.g.,
  PAUSED → CONDITIONAL) to pick up any new drift.

## When NOT to run this

- On non-app repos (pheno-* libraries, phenotype-* SDKs, federated services).
- For finding exact duplicates — use `consume` / `dups` tools for that.
- For enforcement — that's `pheno-framework-lint`'s job (L73).
  `pheno-drift-detector` *detects* drift; it does not enforce a fix.

## Install

```bash
pip install -e ".[test]"   # from clone
# or
./pheno_drift_detector.py --help  # run directly (stdlib-only)
```

## Usage

```bash
./pheno_drift_detector.py scan \
    --root .. \
    --format gh-issues \
    --out drift-hits.md
```

See [`README.md`](./README.md) for full examples and [`SPEC.md`](./SPEC.md)
for the algorithm spec.

## Quality bar (per ADR-023 Rule 3.1)

This repo meets the substrate quality bar:

- Spec ([`SPEC.md`](./SPEC.md)) — 1-page algorithm + heuristic spec
- Docs ([`README.md`](./README.md) + [`AGENTS.md`](./AGENTS.md)) — what, when, when not, 5-line quickstart
- Tests ([`tests/test_smoke.py`](./tests/test_smoke.py)) — 4 subprocess E2E tests
- CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) — Python 3.11/3.12, pytest, lint
- Coverage gate — ≥ 80% (substrate target)
- License — MIT (per `pheno-*` fleet convention)

## Related ADRs

- **ADR-023** (agent-effort governance, substrate quality bar) — defines the quality bar this repo meets
- **ADR-024** (71-pillar audit framework) — defines the L74 scoring rubric
- **ADR-049** (App-substrate drift detection discipline) — policy this tool enforces
- **ADR-044** (Drift detection policy) — complements ADR-049 with operational guidance

## Companion tools

- `pheno-predict` — L72 (predictive-DRY candidate scanner)
- `pheno-framework-lint` — L73 (tier-convention enforcer)
- `phenotype-tooling` — reusable workflows (incl. `reusable/python-ci.yml`)
