# Implementation Strategy

## Checkout-first reconciliation

Operate from the existing reconciliation worktree. Fetch remote refs, inspect
each local checkout without modifying it, and use immutable `preserve/<date>`
refs for every non-clean or non-admitted tip. Merge only unique patches into
the reconciliation branch, in dependency order, with a ledger entry after
each attempt. Keep the canonical checkout and unrelated worktrees untouched.

## Release pipeline

Treat the repository's release-green validator and artifact-policy scripts as
the authoritative local gates. Build from a real dependency installation,
produce npm tarball/SBOM/checksums/provenance together, and publish only after
the exact commit, package version, and generated artifacts are recorded.

## Runtime verification

Use the published artifact—not workspace source—for the clean-prefix install.
Use the same release identity for container/VPS deployment and test health,
OpenAI-compatible requests, and MCP HTTP/SSE behavior. Capture failures as
known issues with a rollback reference.

## Security posture

Use existing pinned-action workflows and least-privilege patterns as the
baseline. Verify repository settings through GitHub APIs, not documentation
alone. Treat any missing branch protection, unresolved CodeQL alert, or
unsigned release as a gate failure requiring forward remediation.
