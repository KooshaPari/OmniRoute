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
