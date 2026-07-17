# phenotypeActions — Absorption Justification

**Status:** QUEUED 2026-07-17 (batch2 refresh)
**Source:** `KooshaPari/phenotypeActions` (last push 2026-07-15, remote-only)
**Target:** `KooshaPari/phenokits-commons` at `actions/`
**Disposition:** ABSORB

## Confidence

**0.80** — HIGH. Shared GitHub Action definitions fit the phenokits-commons aggregator pattern.

## Rationale

- Last activity: 2026-07-15 (≈ 2 days stale)
- Language: Shell
- "shared GitHub Action definitions" — collection aggregator fit
- Requires `git clone` first

## Restore procedure

```sh
gh repo unarchive KooshaPari/phenotypeActions
# In phenokits-commons spine:
git rm -r actions/
git commit -m "revert: undo phenotypeActions absorption"
```

## Cross-references

- Disposition row: search `"KooshaPari/phenotypeActions"` in `registry/disposition-index.json`
