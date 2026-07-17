# phenoEvents — Absorption Justification

**Status:** QUEUED 2026-07-17 (batch2 refresh)
**Source:** `KooshaPari/phenoEvents` (664 KB, 17 branches, last push 2026-07-14)
**Target:** `KooshaPari/pheno` at `crates/pheno-events/`
**Disposition:** ABSORB

## Confidence

**0.85** — HIGH. EventBus port with hexagonal architecture; phenoEvents is a natural crate for the pheno workspace.

## Rationale

- Last activity: 2026-07-14 (≈ 3 days stale)
- Language: Rust
- "EventBus port with hexagonal architecture" — clean crate fit
- Will be added as a workspace member to pheno's `Cargo.toml`

## Restore procedure

```sh
gh repo unarchive KooshaPari/phenoEvents
cd /Users/kooshapari/CodeProjects/Phenotype/repos/pheno
git rm -r crates/pheno-events/
# Edit Cargo.toml: remove workspace member
git commit -m "revert: undo phenoEvents absorption"
```

## Cross-references

- Disposition row: search `"KooshaPari/phenoEvents"` in `registry/disposition-index.json`
- Target repo: https://github.com/KooshaPari/pheno
