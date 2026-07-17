# Specifications

## Acceptance Criteria

- `Taskfile.yml` exists at the repo root.
- `build`, `test`, `lint`, and `clean` are available.
- Each task detects real language surfaces from repo manifests before running commands.
- Scaffold-only surfaces do not cause failures.

## Assumptions

- Rust workspace commands run from `rust/`.
- Python commands only run when the submodule is checked out.
- TypeScript commands only run if the workspace grows into a real package with `tsconfig.json`.
