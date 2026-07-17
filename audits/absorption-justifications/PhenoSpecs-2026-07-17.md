# PhenoSpecs — Absorption Justification

**Status:** QUEUED 2026-07-17 (batch3 refresh)
**Source:** `KooshaPari/PhenoSpecs` (Python)
**Target:** phenotype-registry at `docs/specs/phenotype-specs/`
**Disposition:** ABSORB

## Confidence

**0.85** — HIGH. Phenotype Specification Registry.

## Rationale

- Last activity tracked in disposition-index
- Language: Python
- Natural fit for proposed target based on ecosystem definitions in `phenotype-registry/docs/rationalization`

## Restore procedure

```sh
gh repo unarchive KooshaPari/PhenoSpecs
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry
# Edit registry/disposition-index.json: change fsm from "absorbed" back to "active"
# Restore projects/PhenoSpecs.json from git history (revert to queued status)
```

## Cross-references

- Disposition row: search `"KooshaPari/PhenoSpecs"` in `registry/disposition-index.json`
- Target repo path: `docs/specs/phenotype-specs/`
