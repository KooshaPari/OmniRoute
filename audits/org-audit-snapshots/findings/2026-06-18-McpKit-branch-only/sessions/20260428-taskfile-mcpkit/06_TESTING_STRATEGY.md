# Testing Strategy

- Prefer `task build`, `task test`, `task lint`, and `task clean` as the validation surface.
- For this repo snapshot, expect Rust tasks to run and scaffold-only surfaces to be skipped.
- Confirm the edited files are the only staged changes before commit.
