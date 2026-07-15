# phenotype-apps -- Spine Plan

## Decision: KEEP as the apps-catalog spine (do NOT fold into another repo)

The user wrote: "phenotype-apps, the same" -- i.e. same treatment as
phenotype-org-audits. The literal reading is "make it a spine". The
evidence supports that reading.

## Why not fold

phenotype-apps is structurally different from phenotype-org-audits but the
conclusion is the same: do not fold.

- 2753 files (substantially larger than org-audits at 594).
- 324+ top-level entries, mostly symlinks/copies of other repos in the polyrepo
  (e.g. AtomsBot-2nd, AtomsBot-3rd, ..., AtomsBot-5th; AgilePlus-2nd;
  Agentora-2nd; KlipDot; etc.). This is a meta-portfolio.
- The Cargo.toml + go.mod + bun.lock at the top of the dir hint that there is
  also a thin "app-of-apps" runtime (a workspace that knows how to launch
  every other app), but the dominant pattern is meta-portfolio.
- Branch is apps-extract, suggesting an ongoing push to extract apps
  out of the meta-repo into their own homes. That is the opposite of
  folding it into something bigger.

## Spine charter (to be added to README)

```
SPINE: phenotype-apps
ROLE: apps-catalog spine (meta-portfolio)
OWNS: the catalog of every Phenotype app, plus a thin runtime that can
      launch any catalogued app. Per-app source-of-truth lives in the app's
      own repo; this spine only owns the catalog metadata and the launcher.
DEPENDS-ON: every per-app repo (one-way pull), the apps launcher (Rust+Go).
DEPENDED-ON-BY: human operator (one-stop "what apps exist"), the
                BytePort control plane (proposed: BytePort could query this
                catalog to know what to deploy).
RELEASE-CADENCE: continuous (catalog updates on app merge); the launcher
                 releases on a tagged schedule.
SUCCESS-METRIC: 100% of Phenotype apps have an entry here; zero
                *-Nth duplicates older than 90 days.
```

## Concrete actions

1. Add the spine charter block (above) to the top of phenotype-apps/README.md.
2. Prune the AtomsBot-Nth, Agentora-Nth, AgilePlus-Nth duplicates that
   are older than 90 days. Keep at most one canonical entry per app. Move
   the pruned copies under phenotype-org-audits/archive/<app>/ so the
   history is preserved.
3. Move the apps-launcher (the Cargo.toml+go.mod part) into a dedicated
   launcher/ subdir so the meta-portfolio and the launcher are clearly
   separated.
4. Add a catalog/apps.toml (or similar) that is the machine-readable
   source of truth. Today the catalog is implicit in the directory
   structure; a TOML/JSON file makes it queryable.
5. Open an issue/PR against BytePort documenting the proposed
   "byteport apps pull phenotype-apps:catalog/apps.toml" integration.

## Risks and open questions

- **Risk:** 324+ top-level entries means any find or ls over the polyrepo
  hits this dir first. The fact that several entries are empty
  (AtomsBot/, GDK/, etc. all show 0 files) means they are intentional
  placeholders for archived slots. Confirm with sponsor: keep the empty
  placeholders (so the slot name is reserved) or remove them entirely.
- **Risk:** The branch is apps-extract. The work already in flight on this
  branch may be moving apps out of the meta-repo. Coordinate with that work
  before pruning duplicates -- do not double-up on deletions.
- **Open question:** Should the apps-launcher be its own repo (e.g. appsd),
  or stay embedded in phenotype-apps? Lean toward keeping it embedded for
  now (single source of truth for the catalog + the launcher), but flag
  for re-evaluation when the launcher exceeds 500 lines.
