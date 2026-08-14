# Known Issues and Residuals

| ID    | Severity | Issue                                                                          | Mitigation / owner                                                         | Status |
| ----- | -------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------ |
| KI-01 | medium   | `.i18n-state.json` is absent in current `main`                                 | optional by ADR-0005; require explicitly when needed                       | open   |
| KI-02 | medium   | `open-sse` and `electron` versions differ from root                            | intentionally undeclared; add a manifest source only with release decision | open   |
| KI-03 | low      | `.trunk/*` artifacts are dirty in this worktree                                | preserved untouched per handoff                                            | open   |
| KI-04 | low      | Airlock snapshots preserve uncommitted work separately from feature branch     | parent must use exact snapshot/stash evidence                              | open   |
| KI-05 | medium   | `check:test-discovery` reports 37 current-main drift/orphan findings           | parent triage; this test is collected and adds no new orphan               | open   |
| KI-06 | medium   | `check:env-doc-sync` misses `CIRCUIT_BREAKER_OPOSSUM_SHADOW` in `.env.example` | unrelated baseline repair lane                                             | open   |

No known issue authorizes deleting, resetting, pruning, merging, or pushing the
canonical primary checkout.

## Reconstruction Boundary

The reviewed patch is reconstructed cleanly on
`reconcile/release-contract-i18n-20260809b` at `b47472ed0f`; its focused
docs-sync and contract-test checks pass. That evidence does not establish a
repository-wide release-green result, whose baseline remediation remains a
separate unresolved lane.
