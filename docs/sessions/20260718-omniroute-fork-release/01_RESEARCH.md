# Research and Audit Evidence

## Checkout and ref topology

The 2026-07-18 audit observed three Git worktree records: the canonical
`OmniRoute` checkout on `main`, this reconciliation worktree, and a prunable
detached `/private/tmp/dispatch-restore` worktree whose gitdir no longer
exists. The reconciliation worktree was clean (`git status --porcelain` had
no entries).

The remote-tracking inventory contained 830 refs, including 62 `origin/koosha`
branches, 8 `origin/preserve/20260717` refs, 14
`origin/airlock-archive/wave10/omniroute-wt` refs, 33 `origin/wip` refs, 3
release refs, and 27 upstream-PR refs. These are inventory classes, not a
claim that every ref should be merged.

## Existing immutable preservation refs

The prior local-checkout sweep already published these preservation anchors:

| checkout family | ref tip |
| --- | --- |
| `5218-mcp-auth` | `a59f05f114da937269ee812167f64f68cb9f470d` |
| `5452-tls-options-packaging` | `e2e00647805de4a41279518f8c573476a5f04411` |
| `fix-5211-mcp-auth` | `1a6308f4e25fa78adeb320adfafb13ff1f60aad9` |
| `issue-agent-5980` | `261ca3e4bc43319bedcafc78d3b885f13bcebc9a` |
| `feature-dispatch-bifrost-2026-07-17` | `e0ddbed7b396ab7e6f1e65106524fa2d5cad5760` |
| `restore-dispatch-binding-tiers` | `26e34d296fd2675f36174c6dd36bfb795f3b7eba` |
| `main` | `9b1927a2c8683756562bf644855b1105cc986d04` |

## Dirty-diff artifact and hash

The previously dirty `5218-mcp-auth` checkout is represented by the
immutable commit `a59f05f114da937269ee812167f64f68cb9f470d`; its parent is
`0c412af27295ddf69453bacf34aadd981ff3f64a`. The commit changes one file and
deletes 26 lines. The stable patch-id is
`883f1fe1679441480a638e09b97a6d4bcb6c7014`. The corresponding
`fix-5211-mcp-auth` preservation tip has the same patch-id, so it is a
duplicate patch and must not be applied twice.

The `5452-tls-options-packaging` recovery artifact is commit
`e2e00647805de4a41279518f8c573476a5f04411` (15 insertions over one file),
with stable patch-id `c33e3b19629024d39b8e9a89e2287c78fb2f773c`.

## Reconciliation evidence refresh (2026-07-18)

The active reconciliation branch is `85422a797096b2840a35502ade3699ba8ab780db`.
Its sync merge used `origin/main` at
`4a12a49106649ad7a02f3a652bef00d6f810bbd8`; the fetched remote-tracking ref
now points at `9272e9ad1210a12785619c1f030b47d1a125dde1` and must be refreshed
before release merge. Reachability checks confirm that the `main`,
`feature/dispatch-bifrost-2026-07-17`, and `restore/dispatch-binding-tiers`
preservation tips are already contained. Five preservation refs remain held;
fresh merge-tree probes report 130, 413, 107, 128, and 666 conflict records
respectively (full breakdown and reasons are in `03_DAG_WBS.md`). The probes
were aborted without writing a merge, and the final index/status is clean.

## Repository precedents

- `docs/ops/RELEASE_GREEN.md` and `scripts/quality/validate-release-green.mjs`
  define the release gate.
- `.github/workflows/scorecard.yml`, `security-scan.yml`, and `codeql.yml`
  provide the existing security automation.
- `docs/ops/BRANCH_PROTECTION_MAIN.md` records the expected governance state.
- `docs/ops/RELEASE_CHECKLIST.md` requires a real, npm-installed package and
  a build from a worktree with real dependencies.
