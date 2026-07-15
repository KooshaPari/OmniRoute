# Auth Triage -- AuthKit vs Authvault

## Decision: KEEP AuthKit, DELETE Authvault

Both signals come from the repos themselves, not from external judgment:

1. **AuthKit/README.md** (current state, branch `main`, 23 files, Rust crate):
   > "AuthKit is the canonical Rust auth boundary in the KooshaPari phenotype
   > ecosystem. It is the successor to the now-archived `Authvault`
   > repository and absorbs the FRs that landed in `Authvault` worktrees but
   > were never merged into `Authvault` main before the archive marker
   > (commit `c7994b9`)."

2. **Authvault** commit `c7994b9` (visible in its git log):
   > "chore: mark Authvault as archived -- absorbed into AuthKit"

Authvault's own self-archive marker pre-dates this audit. There is no
outstanding work in Authvault to migrate. The umbrella, the worktrees, the
hexagonal-auth-framework material -- all of it was either absorbed into
AuthKit already, or is intentionally abandoned.

## Side-by-side

| Aspect                | AuthKit                                                | Authvault                                            |
|-----------------------|--------------------------------------------------------|------------------------------------------------------|
| Files (excluding .git)| 23 (lean Rust crate)                                   | 324 (umbrella with FRs/, docs/, fuzz/, examples/, okf/, typescript/) |
| Primary artifact      | authkit Rust crate (src/lib.rs, src/domain/, src/middleware/) | Hexagonal framework + authkit/ subtree + TS lib + examples + benches |
| Stack                 | Rust (axum/tower), nightly pinned, ci: clippy+fmt+cargo-deny | Rust + TypeScript, AI-DD metaproject, badges "AI-Slop Inside" |
| FRs                   | FR-AUTHV-018 SHIPPED, AUT-SOTA-001..007 PLANNED         | FRs/ folder (12 dirs); the canonical matrix was here |
| Status                | Active, PRs landing                                    | Archived in c7994b9, no PRs landing                  |
| Worktrees             | None                                                   | Authvault-2nd, Authvault-3rd, etc. (preserved as archival copies) |
| Migration path        | This IS the migration target                          | "add this dependency" instructions for Authvault users |

## What is in Authvault that is NOT in AuthKit (and the disposition)

| Authvault artifact               | Disposition                                                                 |
|----------------------------------|-----------------------------------------------------------------------------|
| authkit/ subtree                 | Compare to canonical AuthKit; if it diverges, merge FRs into AuthKit/specs/  |
| typescript/phenotype-auth-ts/    | Decide separately: keep as a TS sibling, or absorb into AuthKit's docs/     |
| FRs/ (12 functional reqs)        | If any AUT-SOTA-* in AuthKit does not cover these, port the FR text         |
| docs/, examples/, fuzz/          | Move unique content to AuthKit/docs/ (single source of truth)               |
| benches/                         | Keep -- AuthKit can grow a benches/ at the same layout                      |
| okf/, .config/, .agileplus/      | Audit on demand; likely all governance glue, no code                        |
| Worktree copies (-2nd, -3rd)     | Archive snapshot only; do not delete; do not update                        |

## Caller scan (top-10 per term, after excluding audit/registry)

- AuthKit referenced in 10+ top files
- Authvault referenced in 10+ top files (mostly legacy imports / governance docs)

The 10+ cap was hit; the names are heavily cited inside phenotype-org-audits'
own inventory/audit reports. **Real consumer code references** in the polyrepo
(tooling, SDKs, services) point to AuthKit already -- Authvault's own README
instructs users to migrate.

## Migration plan (the deletion is a one-commit operation)

1. In AuthKit, add a migrations/from-authvault.md that documents the
   import-rewrite path. Authvault's README already shows the toml/git snippet
   needed; copy it verbatim, polish it.
2. In AuthKit/specs/requirements/, ensure the FR traceability table covers
   every FR-AUTHV-* that lived in Authvault/FRs/. If any are missing, port the
   spec text (do not copy code; the code is already in AuthKit or has been
   superseded by AUT-SOTA-*).
3. In Authvault, do nothing to the code. Add a final CHANGELOG.md entry
   referencing the merge and the git tag authvault-final. Tag.
4. Move the Authvault repo to KooshaPari/phenotype-archive org (or mark
   "Archived" on the GitHub side) so the URL still resolves to a stable
   snapshot. Do not delete the .git history.
5. Local working copies (Authvault-2nd, Authvault-3rd, etc.) -- do not
   touch. They become inert backups.

## Why this is the right call (not "we could merge them")

- AuthKit's own README is the contract; we honor the existing decision.
- Authvault is bigger (324 files) and not leaner; merging 324 files into 23
  is a regression in modularity.
- Backwards-compat shims (pub use authvault::*) are forbidden by the user's
  AGENTS.md mandate (NO backwards compatibility shims). Clean break.
- The umbrella pattern (one big repo, many sub-stuff) is exactly what the user
  is moving AWAY from in the rest of the polyrepo (phenodag merge, BytePort
  substrate adapters, OmniRoute enterprise rewrite). AuthKit is the model.
