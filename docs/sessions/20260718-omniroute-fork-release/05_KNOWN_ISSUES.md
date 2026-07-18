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
- Five preserved archive tips are materially divergent from current `main` and
  produced conflicts when admitted as whole-history merges. They remain held
  with immutable refs; no conflict markers remain in the worktree.
- The latency regression workflow previously read `regression-output.txt` even
  when the comparator exited before creating it, masking the root failure with
  a comment-step file error. The workflow now initializes the report, captures
  comparator stderr, and uses an explicit fallback comment when the file is
  unexpectedly absent.

## Release risks

- Live GitHub audit on 2026-07-18 reports 2,708 open code-scanning alerts
  (130 fixed; 2,838 total in the API listing) and three open secret-scanning
  alerts (Stripe, AWS temporary access key ID, and Google API key). No alerts
  were dismissed. These findings block an A+ scorecard claim until triaged and
  remediated or explicitly accepted by the security owner.
- Dependabot security updates were enabled through the repository API. GitHub
  kept non-provider secret-pattern scanning disabled for this fork despite an
  enable request; verify account/plan eligibility before retrying.
- `main` was protected through the repository API with one approving review,
  stale-review dismissal, code-owner review, last-push approval, enforced
  admins, conversation resolution, and force-push/deletion disabled. No status
  checks were required because no stable check context was verified yet.
- `dependency-review.yml` and `gitleaks-fleet.yml` now pin third-party actions
  to immutable commit SHAs and use least-privilege workflow permissions.

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

- The fork package migration must remove any globally installed upstream
  `omniroute` package before installing `@kooshapari/omniroute`; otherwise npm
  can leave a stale unscoped executable earlier on `PATH`. The deploy workflow,
  CLI updater, and npm auto-update script now perform this uninstall explicitly.
