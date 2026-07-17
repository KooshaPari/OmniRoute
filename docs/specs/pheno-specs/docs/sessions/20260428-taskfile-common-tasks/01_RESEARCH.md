# Research

- Root repo is a documentation/spec registry, not an application build tree.
- Root identity is driven by `registry.yaml`, `specs/`, and `adrs/`.
- Repo-local guidance says there is no code build; validation is markdown plus registry consistency.
- The detected stack for this checkout is `docs`, so the Taskfile should use `markdownlint` and `yamllint`.
