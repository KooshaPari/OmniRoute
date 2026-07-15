# PROPOSAL: Authvault final CHANGELOG entry + git tag

Source: 01-AUTH-TRIAGE.md + 05-MIGRATION-CHECKLIST.md Phase 1
Author: parent agent audit, 2026-07-05
Status: PROPOSED -- parent will apply per controlled step

## Action 1: append CHANGELOG.md to Authvault/

Create `Authvault/CHANGELOG.md` (currently absent -- `ls Authvault` shows
`_typos.toml ADR.md AGENTS.md ARCHIVED.md authkit` only) with the entry:

```markdown
# Changelog

## authvault-final -- 2026-07-05

**Status:** final tag. This repository is now archived.

### What happened

The FRs and runtime code that lived in this repository have been
absorbed into **AuthKit** (the canonical Rust auth boundary in
the Phenotype ecosystem, per the AuthKit README). The umbrella,
the worktrees, the hexagonal-auth-framework material, and the
TypeScript client (`typescript/phenotype-auth-ts/`) are all
intentionally abandoned; no migration is required because:

- AuthKit's README explicitly designates itself as the successor.
- This repo's own git history marks the archive transition
  (`c7994b9`: "chore: mark Authvault as archived -- absorbed into
  AuthKit").
- All call sites that previously imported from Authvault have
  been migrated (verified by caller scan in
  `docs/sessions/20260705-fork-reqwrite-audit/01-AUTH-TRIAGE.md`).

### How to migrate

If you arrived here looking for the canonical home, see:

- **AuthKit** -- the Rust crate. `https://github.com/KooshaPari/AuthKit`
- Migration guide: `AuthKit/migrations/from-authvault.md` (added in
  the corresponding AuthKit commit; the toml/git snippet below is
  also documented there).

#### Cargo.toml

```toml
[dependencies]
authkit = { git = "https://github.com/KooshaPari/AuthKit", tag = "authkit-sota-v1" }
```

Replace every `use authvault::...` import with the matching
`use authkit::...` import. The 1:1 mapping is documented in
`AuthKit/migrations/from-authvault.md`.

### Final tag

```
git tag authvault-final
git push origin authvault-final
```

The tag is the stable ref for any external dependency that
pinned to this repo. After the GitHub archive flag is set,
the URL will still resolve to this snapshot.

### No further commits

No code changes. No PRs. No agent work. No re-open.
```

## Action 2: tag

```
cd Authvault
git add CHANGELOG.md
git commit -m "chore: final CHANGELOG entry (authvault-final, 2026-07-05)"
git tag authvault-final
git push origin main   # the CHANGELOG commit
git push origin authvault-final   # the tag
```

## Action 3: GitHub archive (out of local scope)

After the tag is pushed:

```
gh repo edit KooshaPari/Authvault --enable-issues=false
# Then GitHub web UI: Settings -> Danger Zone -> Archive this repository.
```

The `gh repo archive` command does not exist; the web UI is the
only path. The AuthKit README does not need to change; it already
documents the migration.

## Open follow-up

- The 6 worktree copies (Authvault-2nd, Authvault-3rd, etc.) are
  intentionally left untouched per the auth-triage plan. They are
  inert backups. Do not delete.
- AuthKit still needs `migrations/from-authvault.md` written and
  the FR traceability table extended. That is a separate PR
  inside AuthKit; tracked in 05-MIGRATION-CHECKLIST.md Phase 1.
