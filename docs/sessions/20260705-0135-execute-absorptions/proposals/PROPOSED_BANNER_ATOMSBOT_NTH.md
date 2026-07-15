# PROPOSAL: archive banner for phenotype-apps/AtomsBot-{2nd,3rd,4th,5th}/

Source: 04-ARCHIVE-PLAN.md (polyrepo root)
Author: parent agent audit, 2026-07-05
Status: PROPOSED -- parent will apply per controlled step

## Why

These are empty worktree-placeholder copies inside the phenotype-apps
meta-portfolio. They share the same strict-pause rationale as the canonical
phenotype-apps/AtomsBot/ (which already has the banner).

## Action

For each of:
  phenotype-apps/AtomsBot-2nd/README.md
  phenotype-apps/AtomsBot-3rd/README.md
  phenotype-apps/AtomsBot-4th/README.md
  phenotype-apps/AtomsBot-5th/README.md

Create the file (currently absent; the dir is empty) with the exact content
of phenotype-apps/AtomsBot/README.md, byte-for-byte. Reason: the canonical
banner is the strict-pause contract; the placeholder copies must be
indistinguishable from it so any agent that `ls`es the meta-repo sees the
same kill-switch on every copy.

## Verification

```
ls phenotype-apps/AtomsBot-2nd/README.md
diff phenotype-apps/AtomsBot/README.md phenotype-apps/AtomsBot-2nd/README.md
# expect: 0 differences
```

Apply for 3rd/4th/5th identically.

## Push

No push required (local-only metadata). The 4 placeholder READMEs are
not git-tracked content at the polyrepo level; they are inside
phenotype-apps which is its own repo. Apply + commit inside
phenotype-apps/, then push to KooshaPari/phenotype-apps as part of
the Phase 3b commit (see 05-MIGRATION-CHECKLIST.md).

## Open follow-up

- The five `AtomsBot-Nth` empty placeholders are still listed in the
  meta-portfolio. The 03-APPS-PLAN.md recommendation is to **prune
  duplicates older than 90 days**; this is Phase 3b and is gated on
  the apps-extract branch. Defer.
