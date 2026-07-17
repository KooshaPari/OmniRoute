# phenotype-infrakit — Absorption Justification

**Status:** QUEUED 2026-07-17 (batch2 refresh)
**Source:** `KooshaPari/phenotype-infrakit` (49 KB, last push 2026-07-15, remote-only)
**Target:** `KooshaPari/phenotype-tooling` at `infrakit/`
**Disposition:** ABSORB

## Confidence

**0.75** — MEDIUM. Shared infra crates converge with phenotype-tooling's role; needs clone before transfer.

## Rationale

- Last activity: 2026-07-15 (≈ 2 days stale)
- Language: Rust
- "shared infra crates (cost-core, policy-…)" — fits tooling spine
- Requires `git clone` first since not local

## Restore procedure

```sh
gh repo unarchive KooshaPari/phenotype-infrakit
# In phenotype-tooling spine:
git rm -r infrakit/
git commit -m "revert: undo phenotype-infrakit absorption"
```

## Cross-references

- Disposition row: search `"KooshaPari/phenotype-infrakit"` in `registry/disposition-index.json`
