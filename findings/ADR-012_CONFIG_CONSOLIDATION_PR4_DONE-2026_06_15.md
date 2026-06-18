# ADR-012: Config consolidation — PR-4 executed (2026-06-15)

## Status

PR-4 from the subagent-B 11-PR plan is **executed** on branch
`chore/w5-adrs-sota-2026-06-15`, commit `d516bee625`.

## What was deleted

| Path | LoC | Reason |
|---|---|---|
| `repos/crates/phenotype-config/` | ~14k (Settly fork) | Orphaned — 0 consumers in the root monorepo; 0 in `pheno/`, 0 in `phenoShared/`, 0 in `Cargo.lock`. Settly is a settings-management library, superseded by `phenoShared/crates/phenotype-config-core`. |

The path was registered in the root monorepo's git index as a **gitlink**
(mode 160000), pointing at SHA `c559e133633015e0cbe59113f1cfb4801466f548`.
The gitlink was removed via `git update-index --force-remove` (the
`git rm` path failed with "could not lookup name for submodule"
because `.gitmodules` is absent from the sparse-checkout cone).

Physical cleanup:
- `rm -rf repos/crates/phenotype-config/` (working tree)
- Verified: no entry at `.git/modules/crates/phenotype-config/`
- `.git/config` had no `[submodule "crates/phenotype-config"]` section
  to remove (`.gitmodules` was already absent)

## Verification (zero consumers)

- `repos/Cargo.toml` `[workspace].members`: 0 references
- `repos/Cargo.toml` `[workspace.dependencies]`: 0 references
- `repos/Justfile`, `repos/justfile`: 0 references
- `repos/.github/CODEOWNERS`, `dependabot.yml`, `trufflehog.yml`: 0 references
- `repos/lefthook.yml`, `deny.toml`, `clippy.toml`: 0 references
- `repos/Cargo.lock`: 0 references
- `repos/crates/**/*.rs`: 0 source-level `use settly` / `extern crate settly`
  (only self-references inside the deleted `phenotype-config/src/lib.rs`)
- `repos/pheno/Cargo.toml`: 0 references
- `repos/phenoShared/Cargo.toml`: 0 references

## Net effect

- 1 submodule entry (gitlink) removed from the root index
- ~14k LoC of orphaned Settly fork code gone
- The replacement is `phenoShared/crates/phenotype-config-core`, already
  in active use across `PhenoDevOps`, `PhenoProc`, `phenotype-infrakit`

## Push state

The commit `d516bee625` is on the local branch `chore/w5-adrs-sota-2026-06-15`,
ready to be pushed when re-auth happens. Same `gh auth` gap as the rest of
the W5 lineage (Dmouse92 lacks write to the monorepo remotes).

## Companion to PR-1/2/3

PR-1/2/3 (executed in the `pheno` submodule at `bd5d807`) deleted
3 pheno-local config crates for 481 LoC. PR-4 (this commit) extends
the same scope to the root monorepo for ~14k LoC. After PR-4, the
config consolidation has removed ~14.5k LoC of orphaned code in 24 hours.

## Remaining subagent-B work (PR-5 through PR-11)

- **PR-5:** Settly deprecation PR (`#[deprecated]`, `ARCHIVED.md`) — needs ADR approval + Settly clone. N/A now that the root-level `phenotype-config/` gitlink is gone; the Settly fork is fully removed, not just deprecated
- **PR-6:** `pheno-config` v0.2.0 (add TOML, merge, combine) — small additive change, low risk. Unchanged scope
- **PR-7:** `phenoShared/phenotype-config-core` v0.3.0 (`CascadeLoader` port) — port from deleted `libs/phenotype-config-core`. Unchanged scope
- **PR-8:** Settly GitHub archive (admin action, no PR) — blocked by `gh auth` gap; still relevant for the upstream `phenotype-dev/settly` repo
- **PR-9:** `phenotype-python-sdk/phenotype-config` v0.2.0 (Rust parity) — add `url`/`port`/`db_path`/`feature_flags` fields
- **PR-10:** `pheno-config` v0.3.0 → crates.io publish — needs `pheno-config` repo remote access
- **PR-11:** ADR-012 (settly-archive) — doc only

## References

- `findings/ADR-012_CONFIG_CONSOLIDATION_PR1-3_DONE-2026_06_15.md` — PR-1/2/3 doc (pheno submodule deletions)
- `findings/2026-06-15-DAG-V6-FINAL-v1.md` (full consolidation report)
- `docs/adr/ADR-012-plugin-architecture.md`
- `pheno/CANONICAL.md` (parent redirect)
