# DAG and WBS

```text
R0 current-main audit
 ├─> R1 manifest/schema
 ├─> R2 checker implementation ─┐
 ├─> R3 concern-based tests      ├─> R4 focused gates
 └─> R5 session traceability  ───┘       └─> R6 review handoff
```

| WBS | Work                                  | Status  | Dependency | Evidence                               |
| --- | ------------------------------------- | ------- | ---------- | -------------------------------------- |
| R0  | Audit current package/ADR/i18n state  | done    | -          | `01_RESEARCH.md`                       |
| R1  | Add release manifest                  | done    | R0         | `config/release/release-contract.json` |
| R2  | Implement strict scoped checker       | done    | R1         | checker source; direct exit 0          |
| R3  | Add release-contract regression cases | done    | R1/R2      | test source; 11/11                     |
| R4  | Run targeted tests and quality checks | partial | R2/R3      | focused/prettier green; baseline red   |
| R5  | Maintain seven session docs           | done    | R0         | this directory                         |
| R6  | Parent integration review             | pending | R4/R5      | parent cockpit                         |

Critical path: R0 -> R1 -> R2/R3 -> R4 -> R6.

R4 is complete for lane-local evidence. Repository-wide discovery and env-doc
checks remain pre-existing baseline failures for parent triage.

## Current Reconstruction Evidence

The reviewed release-contract/i18n patch was cleanly reconstructed from current
`origin/main` on `reconcile/release-contract-i18n-20260809b` at `b47472ed0f`.
`git diff --check HEAD^ HEAD`, `node scripts/check/check-docs-sync.mjs --scope all`,
and `node --import tsx --test tests/unit/docs-sync-contract.test.ts` passed.
This is focused lane evidence only; repository-wide release-green baseline work
remains distinct and unresolved.
