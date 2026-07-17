# audit-tool Absorption

## Wave

`2026-07-17-queue-refresh-2`

## What was absorbed

**audit-tool v2** (single-file Python repo-quality audit scorecard)
absorbed from `KooshaPari/audit-tool` into
`phenotype-registry/scripts/audit.py` on branch
`absorb/audit-tool-2026-07-17`.

## Why this target

audit-tool measures pillar scores from actual repo state — it's a
**registry/governance utility**, not application code. phenotype-registry
is the spine that maintains repo state across the org, so the audit
scorecard naturally lives there as a `scripts/` companion to the other
governance scripts (`incident-purge-readiness.py`, `validate-catalog.py`,
`resolve-collision.py`, etc.).

## Content

- `audit.py` — 496 LOC, single-file
- 30 pillar scorecard (L1-L30)
- v2 with broader signal coverage
- CLI: `python3 audit.py <repo_dir> [kind]`

## Verification

```
$ python3 scripts/audit.py /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry
{
  "repo": "phenotype-registry",
  "kind": "rust",
  "overall": 15.0,
  "grade": "F",
  ...
}
```

(Produces valid JSON output for any local repo dir)

## Source repo

`KooshaPari/audit-tool` archived on GitHub 2026-07-17.

## Disposition

- `repo-audit-tool` row updated in disposition-index to `fsm=absorbed`,
  `archived=true`
- Absorption branch: `absorb/audit-tool-2026-07-17` (pushed to
  phenotype-registry-fork)