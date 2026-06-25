# Deferred Absorption-Justification Audits

This list tracks repos that are scheduled for absorption-justification audit but
have not yet been authored at the required 14/14 (L4) bar. Each entry includes
the reason for deferral and the planned authoring batch.

| Repo | Status | Deferred Reason | Planned Batch |
|---|---|---|---|
| `KooshaPari/Tracera` | deferred | Orchestrator stub only — 5/14 L1. Reactive-messaging framework; candidate for next manual batch | Batch D (manual) |
| `KooshaPari/AuthKit` | deferred | Orchestrator stub only — 5/14 L1. Successor to Authvault per PR #365. Needs manual audit + AuthKit bootstrap inventory | Batch D (manual) |
| `KooshaPari/pheno-specs` | deferred | Orchestrator stub only — 5/14 L1. Spec-only repo, low source content. Need to confirm whether a 7-pillar audit applies to docs-only repos | Batch D (manual, scope clarification needed) |
| `KooshaPari/Eidolon` | deferred | Orchestrator stub only — 5/14 L1. Eidolon + Eidolon-work split. Needs cross-repo ABSORPTION_MATRIX | Batch D (manual) |

## Why these are deferred

The `bin/absorption-justification.py` orchestrator (commit `71a01c5` on
`phenotype-tooling`) currently produces a low-quality template that:

1. Includes the inventory scaffold but no actual `ABSORPTION_MATRIX` (P2 fails)
2. Has no `BRANCH_INVENTORY` enumeration (P3 fails)
3. Has no `Last-Resort-Exceptions` (P4 fails)
4. Has no project card (P6 fails)
5. Often has no source-code or branch content (P1 partial)

**Hardening needed before the orchestrator produces L4 audits:**

- A. Auto-detect target repos by walking `registry/catalog/registry.yaml` (currently `--repos` is a manual flag)
- B. Auto-derive the ABSORPTION_MATRIX from the inventory + target list
- C. Auto-derive the BRANCH_INVENTORY from `gh api repos/<repo>/branches --paginate`
- D. Auto-derive Last-Resort-Exceptions from the inventory gaps
- E. Auto-create the project card on first audit (currently `--create-card` flag is not implemented)
- F. Re-grade via the existing `grade.sh` after each auto-fill step

**Estimated effort:** ~3 hours of orchestrator hardening + 30 min/repo of
human-in-the-loop validation. Until then, the next 5 audits should be authored
manually following the same pattern as the 8 audited repos.

## Reference

- Audit rubric: `registry/audit-absorption-justification/schema.json` (7 pillars)
- Grader: `registry/audit-absorption-justification/grade.sh`
- Template: `phenotype-tooling/bin/ABSORPTION_TEMPLATE.md` (5 mandatory headings)
- Orchestrator: `phenotype-tooling/bin/absorption-justification.{sh,py}`
- Fleet state: `audits/absorption-justifications/GRADES.json` (8 audits, 100%, L4)
