# UnityDoorstop-NexusPatched — Absorption Justification

**Status:** QUEUED 2026-07-17 (batch2 refresh)
**Source:** `KooshaPari/UnityDoorstop-NexusPatched` (1.1 MB, 8 branches, last push 2026-06-22)
**Target:** `KooshaPari/phenotype-legacy-collection` (new aggregator spine for non-phenotype legacy repos)
**Disposition:** ABSORB

## Confidence

**0.65** — MEDIUM. Game modding utility with no clear phenotype linkage; safe to bundle into a legacy collection spine so it stops cluttering the active remote.

## Rationale

- Last activity: 2026-06-22 (≈ 25 days stale)
- Language: C (Unity Mono runtime loader)
- No overlap with any active phenotype ecosystem spine
- Not currently tracked in `registry/disposition-index.json` prior to this batch
- Fits the legacy-collection pattern alongside Compound-Spheres-3D-Backup and WorldSphereMod

## Restore procedure

```sh
gh repo unarchive KooshaPari/UnityDoorstop-NexusPatched
# In legacy-collection spine:
git rm -r games/unity-doorstop-nexus-patched/
git commit -m "revert: undo UnityDoorstop-NexusPatched absorption"
```

## Cross-references

- Disposition row: `registry/disposition-index.json` search `"KooshaPari/UnityDoorstop-NexusPatched"`
