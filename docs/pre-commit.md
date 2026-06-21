# Pre-commit hooks

The meta-repo uses [`pre-commit`](https://pre-commit.com/) to enforce tier-0 hygiene on every commit. Hooks are defined in `.pre-commit-config.yaml` and run on the **staged** changes plus the **always-run** entries.

## Install

```bash
pip install pre-commit        # or: brew install pre-commit
pre-commit install            # one-time, sets up .git/hooks/pre-commit
```

To run all hooks against every file (CI parity), use:

```bash
pre-commit run --all-files
```

To bypass a single commit (escape hatch; discouraged), use:

```bash
git commit --no-verify
```

## Hooks

| ID | Purpose | Pillar |
| --- | --- | --- |
| `justfile-verify` | Parses the meta-repo `Justfile` and evaluates all `set` / `export` variables via `just justfile-verify`. | L29.1 |
| `cargo-fmt` | `cargo fmt --all -- --check` on the staged Rust changes. | L29 |
| `cargo-deny` | CVE / ban / license / source advisories (invokes `cargo deny check`). | L20 |
| `gitleaks` | Secret-scan staged changes before they land. | L47 |
| `71-pillar-anchor` | Verifies `L<n>` pillar references in markdown resolve into `findings/71-pillar-2026-06-17.md`. | L64 |
| `validate-ssot` | Cross-ref + completeness check across the fleet via `scripts/validate-ssot.sh`. | L65 |

`pass_filenames: false` is set on every hook that runs against the whole repo, so they are not invoked per-file.

## Order

Hooks run in declaration order. Cheap hooks come first (format), then semantic gates (deny, justfile-verify, ssot). The `always_run: true` flag forces a full-repo scan for `validate-ssot` regardless of which files are staged.

## Adding a new hook

1. Append a new `id:` block under `repos: - repo: local` in `.pre-commit-config.yaml`.
2. If the hook is a tier-0 hygiene gate, also add a `just` recipe in `Justfile` (the meta-repo prefers `just <name>` over inline bash so the recipe can be invoked manually + from CI).
3. Update the table above.
4. Run `pre-commit run --all-files` locally before pushing.
