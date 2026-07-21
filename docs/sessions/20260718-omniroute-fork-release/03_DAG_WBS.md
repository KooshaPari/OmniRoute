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

| ID  | Work                                                       | Depends on | Evidence                      |
| --- | ---------------------------------------------------------- | ---------- | ----------------------------- |
| R1  | Enumerate all local worktrees and remote candidate classes | —          | topology ledger               |
| R2  | Preserve dirty, detached, and clean tips immutably         | R1         | ref/SHA table                 |
| R3  | Deduplicate and admit candidates in dependency order       | R2         | merge ledger + checks         |
| R4  | Stabilize combined branch and run release-green            | R3         | test/build reports            |
| R5  | Review and merge the release branch                        | R4         | merged PR/SHA                 |
| R6  | Pack, sign, attest, and publish package/SBOM               | R5         | registry/release metadata     |
| R7  | Deploy and smoke test runtime protocols                    | R6         | target health evidence        |
| R8  | Install globally from registry and verify CLI              | R6         | clean-prefix transcript       |
| R9  | Close Scorecard/governance gaps and rerun audit            | R5, R6     | Scorecard + settings evidence |

R7 and R8 can run in parallel after R6. R9 may begin during R4 but cannot be
closed until the final release and repository settings are observable.

## Reconciliation admission ledger (2026-07-18)

Integration HEAD is `85422a797096b2840a35502ade3699ba8ab780db`. It records the
sync merge of `origin/main` at `4a12a49106649ad7a02f3a652bef00d6f810bbd8`;
the remote-tracking ref has since advanced to `9272e9ad1210a12785619c1f030b47d1a125dde1`,
so the branch must be refreshed before final release admission.

| Candidate                                                       | SHA            | Decision             | Evidence                                                                        |
| --------------------------------------------------------------- | -------------- | -------------------- | ------------------------------------------------------------------------------- |
| `preserve/.../main-9b1927a2c868`                                | `9b1927a2c868` | contained            | ancestor of `HEAD`                                                              |
| `preserve/.../feature-dispatch-bifrost-2026-07-17-e0ddbed7b396` | `e0ddbed7b396` | contained/integrated | merge commit `150aa02e7`                                                        |
| `preserve/.../restore-dispatch-binding-tiers-26e34d296fd2`      | `26e34d296fd2` | contained            | ancestor of `HEAD`                                                              |
| `preserve/.../5218-mcp-auth-a59f05f114da`                       | `a59f05f114da` | held                 | 130 conflicts: 65 content, 41 modify/delete, 23 add/add, 1 rename collision     |
| `preserve/.../5452-tls-options-packaging-e2e00647805d`          | `e2e00647805d` | held                 | 413 conflicts: 197 content, 200 modify/delete, 15 add/add, 1 rename collision   |
| `preserve/.../bailian-quota-a77910d89663`                       | `a77910d89663` | held                 | 107 conflicts: 56 content, 40 modify/delete, 11 add/add                         |
| `preserve/.../fix-5211-mcp-auth-1a6308f4e25f`                   | `1a6308f4e25f` | held                 | 128 conflicts: 62 content, 41 modify/delete, 24 add/add, 1 rename collision     |
| `preserve/.../issue-agent-5980-261ca3e4bc43`                    | `261ca3e4bc43` | held                 | 666 conflicts: 379 content, 199 modify/delete, 71 add/add, 17 rename collisions |

Counts come from fresh read-only `git merge-tree --write-tree origin/main <ref>`
probes, each returning exit `1`. The held tips remain recoverable through the
immutable refs and were not force-merged. Any temporary merge attempt was
aborted; `git status --porcelain` is empty, confirming no conflict stages or
source changes remain in this worktree.
