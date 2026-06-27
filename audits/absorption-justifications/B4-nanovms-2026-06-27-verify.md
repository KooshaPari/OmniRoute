# B4 Verification — nanovms-2026-06-23 grade.sh re-run (2026-06-27)

**Unit ID:**    B4 (compute-infra DAG, Epic B — Cross-repo consolidation & L1 grading)
**Title:**      Run grade.sh on nanovms-archive (verify closure)
**Type:**       audit
**Repo:**       phenotype-registry
**Date:**       2026-06-27
**Auditor:**    Forge validator subagent #4 (validator-pool)
**Branch:**     audit/B4-nanovms-grade-verify

---

## Purpose

Re-run `registry/audit-absorption-justification/grade.sh` against the
`nanovms-2026-06-23.md` absorption-justification audit to verify that
the nanovms closure verdict recorded on 2026-06-23 still holds under
the current schema and grader.

## Scope

- **In scope:** grade the single audit `audits/absorption-justifications/nanovms-2026-06-23.md`
  against `registry/audit-absorption-justification/schema.json`.
- **Out of scope:** regenerate the fleet-wide `GRADES.json` /
  `GRADES.md` (other audits are graded by other DAG units).

## Environment

- Working directory: `C:\Users\koosh\phenotype-registry`
- Repo HEAD at run time: `e750cad` ("audit(absorption): register
  pheno-harness archived absorption (14/14 L4) + fleet regrade
  (15/15 L4 @ 100%)")
- Grader: `bash registry/audit-absorption-justification/grade.sh <audit>`
- Schema: `registry/audit-absorption-justification/schema.json`
  (7 pillars, weights 3/3/2/2/1/2/1, total 14)

## Result

The nanovms audit scored **14 / 14 (100.00%) → grade L4**. All seven
pillars pass.

| Pillar | Name                              | Status | Score | Detail |
|-------:|-----------------------------------|:------:|------:|--------|
|      1 | manifest-completeness             | pass   | 3 / 3 | all 5 mandatory sections present |
|      2 | parity-evidence                   | pass   | 3 / 3 | 10 / 10 matrix rows carry citations |
|      3 | branch-coverage                   | pass   | 2 / 2 | ABSORPTION_MATRIX + Restore-Command + Branch Inventory Summary present |
|      4 | last-resort-justification         | pass   | 2 / 2 | 13 rebuttal markers, 4 / 7 sub-question keywords covered |
|      5 | restore-command-validity          | pass   | 1 / 1 | mv .archive/ + git clone + sha-256 fingerprint present |
|      6 | registry-integration              | pass   | 2 / 2 | projects/nanovms.json: status=archived, disposition=ARCHIVE_ONLY, absorbed_into=phenotype-infra |
|      7 | deletion-gate-tooling-coverage    | pass   | 1 / 1 | audit references `phenotype-tooling/bin/repo-delete-gate.{sh,ps1}` |

**Verdict:** **CLOSURE VERIFIED**. The nanovms absorption-justification
audit continues to satisfy every L4 gate pillar at the current
`registry/audit-absorption-justification/schema.json` rubric. The
2026-06-23 audit's `DELETION_CANDIDATE_PROCEED` verdict, bundle backup
preconditions, and the registry project card
(`projects/nanovms.json` → status `archived`,
disposition `ARCHIVE_ONLY`, absorbed_into `phenotype-infra`) are
internally consistent and externally reviewable.

## Raw grader output

The full JSON output is preserved at
`.grade-reports/nanovms-2026-06-23.json` (gitignored; see
`.gitignore:35`). Below is the captured stdout:

```json
{
  "name": "nanovms-2026-06-23.md",
  "path": "audits/absorption-justifications/nanovms-2026-06-23.md",
  "score": 14,
  "max": 14,
  "percentage": 100.0,
  "grade": "L4",
  "pillars": [
    {"id": 1, "name": "manifest-completeness",          "status": "pass", "score": 3, "max": 3, "detail": "all 5 mandatory sections present"},
    {"id": 2, "name": "parity-evidence",                "status": "pass", "score": 3, "max": 3, "detail": "10/10 rows with citations"},
    {"id": 3, "name": "branch-coverage",                "status": "pass", "score": 2, "max": 2, "detail": "ABSORPTION_MATRIX + Restore-Command + branch inventory present"},
    {"id": 4, "name": "last-resort-justification",      "status": "pass", "score": 2, "max": 2, "detail": "13 rebuttal markers, 4 sub-question coverage"},
    {"id": 5, "name": "restore-command-validity",       "status": "pass", "score": 1, "max": 1, "detail": "mv=True clone=True sha=True"},
    {"id": 6, "name": "registry-integration",           "status": "pass", "score": 2, "max": 2, "detail": "card=nanovms.json status=archived disposition=ARCHIVE_ONLY absorbed_into=phenotype-infra"},
    {"id": 7, "name": "deletion-gate-tooling-coverage", "status": "pass", "score": 1, "max": 1, "detail": "references repo-delete-gate (sh=True, ps1=True)"}
  ]
}
```

## Artefacts

- **Grader:**     `registry/audit-absorption-justification/grade.sh`
                  (force-added; the file is `.gitignore`'d at line 35
                  for top-level `grade.sh` only, but the per-audit
                  `registry/audit-absorption-justification/grade.sh`
                  is a sibling of tracked `_grade-all.sh` and is
                  explicitly referenced by it).
- **Verification record:** `audits/absorption-justifications/B4-nanovms-2026-06-27-verify.md`
                          (this file).
- **Raw JSON output:**     `.grade-reports/nanovms-2026-06-23.json`
                          (gitignored runtime artifact).

## Notes for the validator / auditor loop

1. The previous fleet-wide regeneration with this stricter grader
   flags 3 audits (`Civis`, `pheno-harness`, `smart-mcp-go`) below L4
   on pillars P4 / P6 / P7. Those regressions are out-of-scope for
   B4 and should be addressed by their own DAG units (F-* / G-*) once
   the relevant audit content is updated.
2. `nanovms` itself remains L4 — closure is verified.
3. The grader is intentionally conservative on P4 (rebuttal coverage)
   and P6 (registry card); the previous grader likely used weaker
   heuristics.

## Reference

- Schema:         `registry/audit-absorption-justification/schema.json`
- Audit input:    `audits/absorption-justifications/nanovms-2026-06-23.md`
- Project card:   `projects/nanovms.json`
- DAG unit:       `_compute_infra_audit/dags/compute_infra_dag.yaml:110`
- Validator spec: `_compute_infra_audit/scaffolding/dispatch_all345/registry-pool/B4.md`

**End of B4 verification.**