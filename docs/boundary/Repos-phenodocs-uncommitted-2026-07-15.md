# Boundary: Repos-phenodocs-uncommitted-2026-07-15

**Status:** Archived 2026-07-17 (off-machine snapshot of uncommitted local working tree)
**Origin:** `KooshaPari/Repos-phenodocs-uncommitted-2026-07-15`
**Disposition:** ARCHIVE_ONLY — read-only history; no canonical surface owned
**Canonical surface:** local working tree at `/Users/kooshapari/Repos/phenodocs` (uncommitted) and `KooshaPari/phenodocs` (canonical GitHub repo, AFFIRM)
**Archived at:** 2026-07-17T14:56:26Z
**Disk usage:** 514 KB

## Purpose (was)

One-shot off-machine snapshot of uncommitted + dirty files captured from
`/Users/kooshapari/Repos/phenodocs` on **2026-07-15** before a host-side
action that would have risked losing the dirty working tree. Created via
`git init` + `git add -A` + `git commit -m "snapshot"` + `gh repo create`
+ push.

Contents (per repo description on 2026-07-15):

- 28+ session docs under `docs/sessions/2026-02-26-cliproxy-*`
- Modified `agents.lock`, `agents.toml`, `check_docs_links.py`
- New `scripts/__init__.py`
- Modified `tests/`
- Branch `main` was **41 commits ahead** of `repos/phenodocs` (pushed as
  `backup/main-from-Repos-phenodocs-2026-07-15`)

## Why archived (not absorbed)

This repo is **not a Phenotype package or service**. It is an uncommitted
working-tree snapshot taken for disaster-recovery purposes. There is no
code to absorb, no crate identity to reconcile, and no consumer surface to
repoint. The content is intentionally duplicative with two canonical
homes:

| Canonical home | What it owns |
|----------------|--------------|
| `/Users/kooshapari/Repos/phenodocs` (local) | Live working tree (where uncommitted files actually belong) |
| `KooshaPari/phenodocs` (GitHub, AFFIRM) | Pushed `main` + `backup/main-from-Repos-phenodocs-2026-07-15` branches |

The 41-ahead branch was force-pushed from the snapshot as the
`backup/main-from-Repos-phenodocs-2026-07-15` ref on the canonical
`KooshaPari/phenodocs` repo. After the local working tree was reconciled
and pushed to `KooshaPari/phenodocs/main`, the snapshot repo's role
ended.

Per BOUNDARY_OWNERS.md delete-gate:

```text
DELETE archived repo  IFF:
  1. CANONICAL_OWNER is named in this doc or ECOSYSTEM_MAP ✓ (local + KooshaPari/phenodocs)
  2. All INBOUND_ABSORPTIONS merged or explicitly redirected ✓ (snapshot content already in canonical home)
  3. OUTBOUND_CONSUMERS repointed ✓ (no consumers — snapshot has no manifest)
  4. Scaffold hooks exist at owner ✓ (n/a — snapshot is not a substrate)
  5. No unique boundary slice remains only in source ✓ (snapshot content fully reproducible from local working tree + canonical repo)
```

All 5 conditions met. Archive (no delete) is the correct terminal state:
the snapshot preserves forensic evidence of the pre-2026-07-15 dirty
working tree without keeping an active repo.

## What lives where now

| Item | Canonical location | Status |
|------|--------------------|--------|
| 28+ session docs (`docs/sessions/2026-02-26-cliproxy-*`) | `/Users/kooshapari/Repos/phenodocs/docs/sessions/` + `KooshaPari/phenodocs` | active |
| `agents.lock`, `agents.toml` | `KooshaPari/phenodocs` (canonical repo) | active |
| `check_docs_links.py` | `KooshaPari/phenodocs` (canonical repo) | active |
| `scripts/__init__.py` | `KooshaPari/phenodocs` (canonical repo) | active |
| `tests/` (modified) | `KooshaPari/phenodocs` (canonical repo) | active |
| 41-ahead commits | `backup/main-from-Repos-phenodocs-2026-07-15` ref on `KooshaPari/phenodocs` | preserved |
| Pre-2026-07-15 working-tree evidence | `KooshaPari/Repos-phenodocs-uncommitted-2026-07-15` (this repo) | **archived** |

## Why not delete

The snapshot repo is private and archived. Deletion is **not** required
because:

1. Private archived repos have zero consumer blast radius.
2. The snapshot is the only forensic record of what the local working
   tree looked like at 2026-07-15 prior to the action that risked losing
   the dirty files.
3. Cost is negligible (514 KB, no CI, no collaborators).
4. Hard-delete would close the audit trail for the
   `backup/main-from-Repos-phenodocs-2026-07-15` push provenance.

## Restore procedure (if ever needed)

```sh
gh repo unarchive KooshaPari/Repos-phenodocs-uncommitted-2026-07-15
# Clone or fetch:
gh repo clone KooshaPari/Repos-phenodocs-uncommitted-2026-07-15 /tmp/restore-target
# Compare against canonical:
diff -ru /tmp/restore-target/ /Users/kooshapari/Repos/phenodocs/
# The 41-ahead commits live on:
git fetch origin backup/main-from-Repos-phenodocs-2026-07-15:backup-restore
```

## Cross-references

- Disposition row: `registry/disposition-index.json` → `"KooshaPari/Repos-phenodocs-uncommitted-2026-07-15"`
- Canonical phenodocs boundary: `docs/boundary/phenodocs.md`
- Source repo (now archived): https://github.com/KooshaPari/Repos-phenodocs-uncommitted-2026-07-15
- Canonical phenodocs repo (AFFIRM): https://github.com/KooshaPari/phenodocs
