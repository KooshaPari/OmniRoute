# AGENTS.md — pheno-predict

**Status:** v0.1.0 (initial substrate-quality-bar release, 2026-06-19)
**Discipline:** L72 (Predictive DRY) — see `findings/71-pillar-2026-06-17-schema.md` §3.10
**ADR anchor:** ADR-047 (Predictive DRY discipline)

---

## What this repo is

`pheno-predict` is a fleet-wide similar-code scanner for predictive DRY.
It scans a target repository against a set of baseline fleet repos, finds code
blocks with high Jaccard similarity (5-token shingle based), and outputs a list
of **predictive-DRY candidates** — pairs of files across repos where similarity
is high enough that extracting a shared primitive *might* be warranted.

This is the **L72 (Predictive DRY discipline)** tool, one of three governance
tooling additions for the v8 sweep (2026-06-18). The other two:

- `pheno-drift-detector` — L74 (drift detection across app-level buckets)
- `pheno-framework-lint` — L73 (tier-convention enforcer for substrate types)

The three together form a closed loop: **predict** (L72) → **lint** (L73) →
**detect drift** (L74) → re-predict. The weekly heavy-runner cron runs all three
in sequence.

## Algorithm (1-paragraph)

Tokenize each code file into identifier+number tokens, shingle into 5-token
sliding windows hashed with SHA1, then compute pairwise Jaccard similarity
(`|A ∩ B| / |A ∪ B|`) across same-language file pairs. O(n) per file pair, no
model, no Python deps. See [`SPEC.md`](./SPEC.md) for the full spec.

## When to run this

- **Weekly cron (heavy-runner):** Mon 09:00 PDT — `phenotype-tooling/.github/workflows/reusable/python-ci.yml`
- **On-demand before a v8+ plan release:** run on the entire fleet to seed the
  ADR backlog with predictive candidates.
- **Before opening a new `pheno-*-lib` PR:** scan your repo against the fleet
  to confirm you're not duplicating an existing primitive.

## When NOT to run this

- On a single repo in isolation (always need a baseline of ≥ 1 sibling).
- For non-code repos (binary, data, docs-only).
- For finding **exact** duplicates — use `consume`/`dups` tools for that.
  `pheno-predict` is for *near-duplicates* (Jaccard 0.55-0.85), where the
  intent is "should we extract a shared primitive?".

## Install

```bash
pip install -e ".[test]"   # from clone
# or
pip install pheno-predict  # from PyPI (post-v0.1.0)
```

## Usage

```bash
pheno-predict scan --target ./pheno-config \
    --baseline ./pheno-port-adapter ./phenotype-config \
    --threshold 0.55 --format md
```

See [`README.md`](./README.md) for full examples and [`SPEC.md`](./SPEC.md)
for the algorithm spec.

## Quality bar (per ADR-023 Rule 3.1)

This repo meets the substrate quality bar:

- Spec ([`SPEC.md`](./SPEC.md)) — 1-page algorithm + heuristic spec
- Docs ([`README.md`](./README.md) + [`AGENTS.md`](./AGENTS.md)) — what, when, when not, 5-line quickstart
- Tests ([`tests/test_smoke.py`](./tests/test_smoke.py)) — 17 tests (12 in-process + 5 subprocess E2E)
- CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) — Python 3.10/3.11/3.12 matrix, pytest, pip-audit
- Coverage gate — ≥ 80% (substrate target)
- Worklog — see `WORKLOG.md` (v2.1 schema, ADR-015 / ADR-025)

## Related ADRs

- **ADR-023** (agent-effort governance, substrate quality bar) — defines the quality bar this repo meets
- **ADR-024** (71-pillar audit framework) — defines the L72 scoring rubric
- **ADR-025** (worklog schema v2.1, `device:` field) — governs `WORKLOG.md` format
- **ADR-047** (Predictive DRY discipline) — policy this tool enforces
- **ADR-015** (V2 10-column WORKLOG.md schema) — base worklog schema

## Companion tools

- `pheno-drift-detector` — L74 (drift detection)
- `pheno-framework-lint` — L73 (tier-convention enforcer)
- `phenotype-tooling` — reusable workflows (incl. `reusable/python-ci.yml`)
