# Session Overview

## Goal

Add a root `Taskfile.yml` that exposes common task runner commands for the repo's detected
languages and keep the docs package scripts aligned with the repo's Bun-first tooling rule.

## Scope

- Detect Python via `pyproject.toml`.
- Detect the docs app via `docs/package.json`.
- Provide `build`, `test`, `lint`, and `clean` tasks.
- Remove `npm` usage from the docs package scripts.

## Success Criteria

- `task --list` parses the file successfully.
- The task commands map cleanly to the existing Python and docs toolchains.
- No `npm` calls remain in the docs package scripts.
