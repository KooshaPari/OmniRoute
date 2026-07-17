# PhenoRuntime — Absorption Justification

**Status:** QUEUED 2026-07-17 (batch3 refresh)
**Source:** `KooshaPari/PhenoRuntime` (Rust)
**Target:** phenotype-legacy-collection at `docs/boundary/placeholder-repos.md`
**Disposition:** ABSORB

## Confidence

**0.4** — LOW. ARCHIVED: placeholder only.

## Rationale

- Last activity tracked in disposition-index
- Language: Rust
- Natural fit for proposed target based on ecosystem definitions in `phenotype-registry/docs/rationalization`

## Restore procedure

```sh
gh repo unarchive KooshaPari/PhenoRuntime
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry
# Edit registry/disposition-index.json: change fsm from "absorbed" back to "active"
# Restore projects/PhenoRuntime.json from git history (revert to queued status)
```

## Cross-references

- Disposition row: search `"KooshaPari/PhenoRuntime"` in `registry/disposition-index.json`
- Target repo path: `docs/boundary/placeholder-repos.md`
