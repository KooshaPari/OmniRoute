# substrate-adapters-bundle — Absorption Justification

**Status:** QUEUED 2026-07-17 (batch2 refresh)
**Source:** `KooshaPari/substrate-adapters-bundle` (216 KB, 2 branches, last push 2026-06-25)
**Target:** `KooshaPari/pheno` at `crates/substrate-adapters/`
**Disposition:** ABSORB

## Confidence

**0.80** — HIGH. Substrate is a known pheno concept. Bundle the meta-repo into the pheno workspace as a single crate.

## Rationale

- Last activity: 2026-06-25 (≈ 22 days stale)
- Language: Rust
- "Meta-repo of standalone substrate adapter crates" — natural fit for pheno workspace
- Will be added as a workspace member to pheno's `Cargo.toml`

## Restore procedure

```sh
gh repo unarchive KooshaPari/substrate-adapters-bundle
cd /Users/kooshapari/CodeProjects/Phenotype/repos/pheno
git rm -r crates/substrate-adapters/
# Edit Cargo.toml: remove workspace member
git commit -m "revert: undo substrate-adapters-bundle absorption"
```

## Cross-references

- Disposition row: search `"KooshaPari/substrate-adapters-bundle"` in `registry/disposition-index.json`
- Target repo: https://github.com/KooshaPari/pheno
