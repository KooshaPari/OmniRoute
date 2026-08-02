# Implementation Strategy

- Preserve the PR branch history by adding one bounded reconciliation commit.
- Keep renderer and backend readiness contracts explicit and fail closed on backend timeout.
- Reuse existing normalization and test fixtures; do not introduce compatibility shims.
- Keep heavy packaged-app validation separate because it requires a staged `.app` contract and macOS
  runner evidence.
- Preserve `.trunk/*` generated artifacts as untracked and excluded.
