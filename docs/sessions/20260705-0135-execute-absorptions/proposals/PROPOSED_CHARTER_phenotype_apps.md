# PROPOSAL: spine charter block for phenotype-apps/README.md

Source: 03-APPS-PLAN.md (polyrepo root)
Author: parent agent audit, 2026-07-05
Status: PROPOSED -- parent will apply per controlled step

## Where it goes

Insert immediately AFTER the AI-DD-META block at the top of
`phenotype-apps/README.md`, BEFORE any other content. The AI-DD-META
block stays as-is (it is the project's own marker; the spine charter
is the polyrepo-level marker).

## Exact text to insert

```markdown

---

## SPINE: phenotype-apps

**ROLE:** apps-catalog spine (meta-portfolio)
**OWNS:**
  - The catalog of every Phenotype app
  - The thin runtime that can launch any catalogued app
  - Per-app source-of-truth lives in the app's own repo; this spine
    only owns the catalog metadata and the launcher
**DEPENDS-ON:**
  - Every per-app repo (one-way pull; catalog refs, not code copies)
  - `launcher/` (Rust + Go binary, lives here)
  - `phenotype-org-audits` (consumes its registry to know which apps exist)
**DEPENDED-ON-BY:**
  - Human operator (one-stop "what apps exist")
  - BytePort control plane (proposed: `byteport apps pull phenotype-apps:catalog/apps.toml`)
  - substrate dispatch (reads catalog to know which apps can run on what compute)
**RELEASE-CADENCE:** continuous (catalog updates on app merge); launcher
  releases on tagged schedule
**SUCCESS-METRIC:**
  - 100% of Phenotype apps have an entry here
  - zero `*-Nth` duplicates older than 90 days
  - every app has a working `byteport apps install <name>` path

## Catalog

The machine-readable source of truth lives at `catalog/apps.toml`.
The catalog is regenerated on every merge that touches the apps/ tree.
See `catalog/apps.toml.schema.md` for the field reference.

## Launcher

The apps launcher (Rust + Go) lives in `launcher/`. It is a thin
wrapper that reads `catalog/apps.toml`, resolves the per-app git URL
and ref, and either:
  (a) clones + builds + runs locally, or
  (b) hands off to BytePort (via `byteport apps install <name>`).

The launcher is intentionally a small binary (target <= 500 lines of
runtime glue; the heavy lifting is delegated to the per-app repos).

---

```

## Verification

After insertion:
```
grep -c 'SPINE: phenotype-apps' phenotype-apps/README.md
# expect: 1
wc -l phenotype-apps/README.md
# expect: original_lines + 41 lines
```

## Push

Commit inside phenotype-apps:
```
cd phenotype-apps
git add README.md catalog/apps.toml launcher/
git commit -m "chore: add spine charter + machine-readable catalog (phenotype-apps, 2026-07-05)"
git push origin <branch>  # likely 'apps-extract' or 'main' -- verify with sponsor
```

## Open follow-up

- The 324+ top-level entries (AtomsBot-Nth, Agentora-Nth, etc.) are
  the prune Phase 3b work. Gated on apps-extract branch coordination.
- The BytePort integration (proposed) requires a separate
  `byteport apps pull` command, owned by the BytePort surface.
