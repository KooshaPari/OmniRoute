# SOC2 Evidence Collection Runbook

**Owner:** SOC2 working group · **Cadence:** monthly + on-demand audit-prep
**Source:** [`scripts/soc2-evidence.py`](../scripts/soc2-evidence.py) (v25-T1)
**Authority:** AICPA Trust Services Criteria 2017 (rev. 2022) — Common Criteria CC1-CC9

## Why this exists

The Phenotype fleet ships ~50+ repositories under `KooshaPari/*` and a
top-level monorepo. SOC2 Type II audits require evidence that controls
operated effectively over the audit period (typically 6-12 months). Manual
evidence collection across this fleet is impossible at audit cadence. This
runbook describes the automated collector that runs locally against the
monorepo and emits a structured evidence bundle.

## What it collects

| Control | Title | Primary artifact | Fallback |
|---|---|---|---|
| CC1 | Control Environment | `CHARTER.md`, `CODEOWNERS`, `CONTRIBUTING.md` | — |
| CC2 | Communication and Information | `AGENTS.md`, `README.md`, `STATUS.md`, `SSOT.md` | — |
| CC3 | Risk Assessment | `docs/adr/**/*.md`, `SECURITY.md` | `findings/` |
| CC4 | Monitoring Activities | `WORKLOG.md`, `findings/71-pillar-*.md` | `worklogs/*.json` |
| CC5 | Control Activities | `.github/workflows/`, `.githooks/`, `deny.toml`, `lefthook.yml` | — |
| CC6 | Logical and Physical Access | `git log --pretty=%G?` + `gh api branch protection` | — |
| CC7 | System Operations | OTel-instrumented workflows, `dashboards/` | — |
| CC8 | Change Management | Lockfiles (`Cargo.lock`, `go.sum`, …), Conventional Commits | — |
| CC9 | Risk Mitigation | `trufflehog.yml`, security-audit workflows, SBOM | `.slsa/attestation.json` |

## How to run

### Local dry-run (no I/O)

```bash
python3 scripts/soc2-evidence.py --dry-run
```

Lists the nine controls it would collect. Useful in CI linting or to verify
the script still parses after a refactor.

### Full run (default — local-only mode)

```bash
python3 scripts/soc2-evidence.py
```

Writes `findings/soc2/evidence.json` + `evidence.md`. CC6 branch-protection
check is **SKIPPED** because `--repo` was not given; everything else runs.

### Full run with branch-protection (recommended for audits)

```bash
gh auth login --scopes repo,read:org
python3 scripts/soc2-evidence.py \
    --repo KooshaPari/phenotype-monorepo \
    --since "12 months ago" \
    --out-dir findings/soc2/$(date +%Y%m)
```

This includes the GitHub branch-protection check (CC6) for the specified
repo. Adjust `--repo` for each `KooshaPari/*` repo in scope.

## Reading the output

The `evidence.json` schema (top-level):

```json
{
  "generated_at": "2026-06-22T19:30:00Z",
  "repo": "KooshaPari/phenotype-monorepo",
  "since": "12 months ago",
  "summary": {"pass": 6, "partial": 3, "fail": 0, "skipped": 0, "total": 9},
  "evidence": [
    {"control": "CC1", "title": "Control Environment",
     "status": "PASS", "summary": "...",
     "artifacts": ["CHARTER.md", "CODEOWNERS"],
     "metrics": {}, "remediation": ""},
    ...
  ]
}
```

The `evidence.md` file renders the same data with a posture summary table
and per-control detail including remediation hints for any non-PASS status.

## Status semantics

- **PASS** — control objective fully met; auditor can accept the evidence as-is.
- **PARTIAL** — some evidence present; auditor will request the gap items.
- **FAIL** — objective not met; remediation required before audit window closes.
- **SKIPPED** — collector could not run (tool missing / no network / no scope).

A POSTURE of `0 FAIL` is the acceptance gate for the cycle. Anything `>0 FAIL`
must be remediated or formally accepted in writing by the SOC2 working group.

## Remediation playbook

When a control emits a remediation hint, the action is usually one of:

1. **Create the missing artifact** — e.g. `SECURITY.md` for CC3, `dashboards/`
   for CC7. Tracked under the next 71-pillar cycle.
2. **Strengthen existing evidence** — e.g. require signed commits on the
   default branch via branch protection (CC6).
3. **Adopt a policy-as-code file** — e.g. add `deny.toml` (CC5) or
   `trufflehog.yml` (CC9) from a sister repo's template.

Every remediation lands as its own PR with the `soc2-evidence` label and a
single-line commit message in the form:

```
fix(soc2-CC{n}): <one-line description>
```

## Integration with the 71-pillar audit

L51 in the 71-pillar framework tracks SOC2 evidence automation. The weekly
Monday 09:00 PDT `findings/71-pillar-*.md` refresh (per ADR-041) consumes
the `evidence.json` summary field as the L51 score input. A posture of
`9 PASS` or `8 PASS + 1 PARTIAL` lifts L51 from 2.5 → 3.0 per cycle-15
goal (T1 in `plans/2026-06-22-v25-71-pillar-cycle-15-p1.md`).

## Failure modes

- **`gh api returns 403`** — token lacks `repo` scope; re-authenticate with
  the right scope.
- **`gh not found`** — CC6 emits SKIPPED; all other controls run normally.
- **`git log` returns empty** — usually means the `--since` window is too
  narrow; widen to "12 months ago" or "all".
- **Submodule pointers dirty** — script ignores submodules; safe to run on
  a partially-synced worktree.

## References

- AICPA Trust Services Criteria 2017 (rev. 2022): <https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2>
- Phenotype 71-pillar framework: `findings/71-pillar-2026-06-17-schema.md` (L51 definition)
- Cycle-15 plan: `plans/2026-06-22-v25-71-pillar-cycle-15-p1.md` (T1)
- ADR-041: 71-pillar refresh cadence (weekly Monday 09:00 PDT)
- ADR-024: 71-pillar audit framework

## Change log

- 2026-06-22 — Initial version (v25 cycle-15 T1).
