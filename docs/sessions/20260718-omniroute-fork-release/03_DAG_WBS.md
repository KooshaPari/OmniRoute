# Release DAG and Work Breakdown

```text
checkout inventory + dirty-state audit
  -> immutable preservation refs
  -> candidate deduplication (stable patch-id)
  -> gated reconciliation branch
  -> release-green + artifact/security checks
  -> review/merge to fork main
  -> package + SBOM + provenance
  -> registry publish
  -> deployment health/protocol smoke
  -> clean-prefix install smoke
  -> Scorecard/governance A+ audit
```

## Work breakdown

| ID | Work | Depends on | Evidence |
| --- | --- | --- | --- |
| R1 | Enumerate all local worktrees and remote candidate classes | — | topology ledger |
| R2 | Preserve dirty, detached, and clean tips immutably | R1 | ref/SHA table |
| R3 | Deduplicate and admit candidates in dependency order | R2 | merge ledger + checks |
| R4 | Stabilize combined branch and run release-green | R3 | test/build reports |
| R5 | Review and merge the release branch | R4 | merged PR/SHA |
| R6 | Pack, sign, attest, and publish package/SBOM | R5 | registry/release metadata |
| R7 | Deploy and smoke test runtime protocols | R6 | target health evidence |
| R8 | Install globally from registry and verify CLI | R6 | clean-prefix transcript |
| R9 | Close Scorecard/governance gaps and rerun audit | R5, R6 | Scorecard + settings evidence |

R7 and R8 can run in parallel after R6. R9 may begin during R4 but cannot be
closed until the final release and repository settings are observable.
