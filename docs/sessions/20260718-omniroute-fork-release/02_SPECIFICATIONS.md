# Fork Release Specifications

## Reconciliation contract

- Base the integration branch on the current KooshaPari `main` after a fresh
  fetch and record its exact SHA.
- Preserve every candidate tip before integration; never delete or rewrite
  an existing branch as part of this release.
- Admit a candidate only after a clean merge/cherry-pick and targeted checks.
- Deduplicate patches by stable patch-id. Record held candidates with the
  exact conflict, dirty-state, or failed-check reason.

## Release contract

- Keep the `omniroute` executable name stable.
- Publish the fork package under the Koosha namespace selected by the release
  owner, with a distinct prerelease version and npm channel/tag.
- Generate a provenance-backed package, SBOM, checksums, and matching GitHub
  release metadata from one commit SHA.
- Do not publish or deploy until release-green, artifact-policy, and security
  checks pass.

## Deployment and installation contract

- Deploy only from the verified release artifact and record target/version/SHA.
- Verify health, OpenAI-compatible completion, and MCP transport smoke tests.
- Install in a clean temporary prefix and verify the CLI version and package
  contents; do not treat a repository-local executable as install evidence.

## A+ scorecard contract

Require passing Scorecard, CodeQL, dependency/security scans, pinned workflow
actions, least-privilege token permissions, branch protection, review policy,
dependency update automation, secret scanning, and signed/provenance-backed
release evidence. Any failed pillar remains an explicit blocker; no score is
inferred from workflow presence alone.
