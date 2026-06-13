# Research

## Repo signals

- `pyproject.toml` defines the Python package, dev dependencies, Ruff, pytest, and mypy.
- `docs/package.json` defines the docs site scripts and tests.
- `docs/bun.lock` is present, which makes Bun the natural package runner for the docs app.

## Decisions

- Keep `build` and `test` language-aware by checking for `pyproject.toml` and `docs/package.json`.
- Keep `lint` focused on the available Python linter, since the repo does not define a JS lint script.
- Update the docs package scripts from `npm run ...` to `bun run ...` so task execution is internally consistent.
- Default Taskfile-driven `uv` commands to `${TMPDIR:-/tmp}/parpour-uv-cache` when `UV_CACHE_DIR`
  is not already set, because restricted worktrees may not be able to read the operator's home uv
  cache and repo-local caches can contaminate source distributions.
- `task build` needs to create `dist/` before `uv build`; otherwise hatchling can fail replacing
  `/private/tmp/.../dist/parpour-0.1.0.tar.gz` when `dist/` has not been created yet.
- `.uv-cache/` should stay ignored for safety if an operator overrides `UV_CACHE_DIR` into the
  repo root.
- `task clean` should also remove the common JavaScript `coverage/` directory because the repo has
  Node/VitePress targets in addition to Python coverage outputs.
