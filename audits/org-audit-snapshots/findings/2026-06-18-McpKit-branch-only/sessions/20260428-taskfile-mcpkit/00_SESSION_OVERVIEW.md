# Session Overview

- Goal: add a root `Taskfile.yml` that routes `build`, `test`, `lint`, and `clean` by detected repo manifests.
- Scope: preserve unrelated worktree changes, especially the existing `rust/Cargo.toml` modification.
- Success: the task file reflects the real repository surfaces and can be published in a PR.
