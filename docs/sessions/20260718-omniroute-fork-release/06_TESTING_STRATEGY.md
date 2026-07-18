# Testing and Acceptance Strategy

## Before merge

- Validate the checkout/ref ledger and stable patch-id deduplication.
- Run targeted tests for each admitted candidate, then
  `npm run check:release-green -- --with-build` (or the repository's current
  equivalent) on the combined branch.
- Run package artifact policy, unit/Vitest suites, type checks, lint, and
  security scans relevant to changed surfaces.

## Release artifact

- Run `npm pack --dry-run` and verify the allowlist, executable, README,
  licenses, and absence of secrets or workspace-only files.
- Generate and validate SBOM, checksum, provenance/attestation, and GitHub
  release metadata against the same commit and version.

## Post-publish acceptance

- Install the published package in a clean temporary prefix; assert the CLI
  version and a basic command.
- Deploy the exact artifact and assert health, OpenAI-compatible completion,
  MCP HTTP/SSE, logs, and rollback readiness.
- Rerun Scorecard, CodeQL, dependency review, secret scanning, and workflow
  policy checks. Verify live branch protection and required checks.

## Completion bar

The release is complete only when every DAG item has direct evidence, every
held checkout has a preservation reference and reason, and no acceptance gate
is represented solely by intent or a documentation claim.

## Current reconciliation evidence

- `git merge --no-ff` was attempted for each divergent preserved tip.
- The `5218-mcp-auth` historical tip produced conflicts across workflows,
  i18n, provider code, tests, and package metadata; it was aborted cleanly.
- The integration worktree currently has a clean index and no unresolved merge
  state. Contained tips require no additional tests beyond the combined branch
  release-green gate.

## Security/release evidence (2026-07-18)

- `actionlint .github/workflows/dependency-review.yml .github/workflows/gitleaks-fleet.yml`
  passed after action-SHA and permission hardening.
- `npm run check:workflows -- --strict` remains red with 88 pre-existing
  findings across 68 workflows; `zizmor` was not installed, so no ratchet
  measurement was available. The strict failures include unrelated shellcheck
  diagnostics plus existing YAML errors in `flamegraph.yml` and `qgate.yml`.
- GitHub code-scanning API: 2,708 open, 130 fixed; secret-scanning API: three
  open and zero resolved/revoked. These are release blockers, not test skips.

## Latency workflow regression guard (2026-07-18)

- The comparator step initializes `regression-output.txt` and pipes stderr into
  the report, preserving the original non-zero comparator status.
- The PR comment step checks for the report before reading it and emits a
  diagnostic fallback instead of replacing the comparator failure with an
  `ENOENT` error.
- Validation: `actionlint .github/workflows/latency-budget.yml` passed.
