# WorldSphereMod — Absorption Justification

**Status:** QUEUED 2026-07-17 (batch2 refresh)
**Source:** `KooshaPari/WorldSphereMod` (204 MB, 15 branches, last push 2026-07-03)
**Target:** `KooshaPari/phenotype-legacy-collection`
**Disposition:** ABSORB

## Confidence

**0.70** — MEDIUM. Large (204 MB) backup of a deleted repo. Safe to bundle — no active maintenance expected.

## Rationale

- Last activity: 2026-07-03 (≈ 14 days stale)
- Language: C#
- "Backup of deleted WorldSphereMod repo (100% recovered)" — forensic snapshot, not active work
- 204 MB footprint wastes remote space if left active

## Restore procedure

```sh
gh repo unarchive KooshaPari/WorldSphereMod
# In legacy-collection spine:
git rm -r games/worldspheremod/
git commit -m "revert: undo WorldSphereMod absorption"
```

## Cross-references

- Disposition row: search `"KooshaPari/WorldSphereMod"` in `registry/disposition-index.json`
