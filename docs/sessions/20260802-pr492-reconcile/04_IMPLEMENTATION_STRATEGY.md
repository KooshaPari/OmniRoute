# Implementation Strategy

- Preserve the PR branch history by adding one bounded reconciliation commit.
- Keep renderer and backend readiness contracts explicit and fail closed on backend timeout.
- Reuse existing normalization and test fixtures; do not introduce compatibility shims.
- Keep heavy packaged-app validation separate because it requires a staged `.app` contract and macOS
  runner evidence.
- Preserve `.trunk/*` generated artifacts as untracked and excluded.

## Final state

The reconciliation is represented by `93c5e5973b` on live base `f7709a87ab`. The implementation was
validated only to the extent supported by the host: 11 checks passed and 39 SQLite-driver checks
remain host-blocked. The Airlock snapshot is `wip/20260803T0636-18c83820dca03348`; no PR push,
merge, force-push, or branch-protection bypass was used.
