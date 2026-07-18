# Known Issues and Holds

## Active holds

- `/private/tmp/polyglot-restore` is a prunable detached worktree with a
  missing gitdir. It is evidence-only until independently recovered; do not
  prune it during this release.
- `5218-mcp-auth` was previously dirty. Its content is preserved at
  `a59f05f114da937269ee812167f64f68cb9f470d`; the working directory must not
  be overwritten. Its patch duplicates `fix-5211-mcp-auth` by stable patch-id.
- The reconciliation branch was observed one commit behind `origin/main` at
  audit time. Rebase/update only after checking that the source branch has not
  acquired new unpreserved local work.

## Release risks

- The current remote inventory is large (830 refs); not every historical or
  upstream ref is a merge candidate. Admission must be evidence-gated.
- A Scorecard A+ result cannot be claimed from local workflow files; branch
  protection, alerts, reviews, and release attestations require live evidence.
- Deployment credentials/targets and npm ownership are external prerequisites
  and must be verified without placing secrets in this repository.

## Resolution policy

Document each hold's owner, evidence, and next action in the reconciliation
ledger. Resolve by forward commits or explicit preservation; never force-reset,
delete, or silently discard a checkout.
