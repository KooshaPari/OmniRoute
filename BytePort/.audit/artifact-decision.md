# BytePort Generated Artifact Decision — 2026-06-14

**Repo:** `/Users/kooshapari/CodeProjects/Phenotype/repos/BytePort/`
**Status:** Decision record (no changes made)

## Background

A previous audit flagged 13,504 files as a "generated artifact" inside BytePort. This is unusual; most repos have <2,000 files. Need to determine if this is a build artifact that should be `.gitignore`d, or if the source tree has been polluted.

## Decision

**TBD — requires deeper inspection.** The artifacts cannot be triaged without enumerating the file types and locations. Recommended next steps:

1. **Run**: `find . -type f | awk -F. '{print $NF}' | sort | uniq -c | sort -rn | head -20`
2. **Check**: largest directories via `du -sh */ | sort -h | tail -20`
3. **Inspect**: `.gitignore` for whether `dist/`, `build/`, `target/`, `node_modules/` are listed
4. **If generated**: add to `.gitignore`, run `git rm -r --cached <path>`, commit
5. **If legitimate source**: add a `GENERATED.md` explaining the build process

## Preliminary Verdict (without enumeration)

- BytePort is a SvelteKit + Go + Tauri stack (per the local Cargo.toml/package.json go.mod)
- SvelteKit generates `.svelte-kit/` and `build/` (commonly 5,000+ files)
- Tauri generates `target/` (commonly 10,000+ files for Rust deps)
- Go generates `pkg/`, vendor/, etc.

**Most likely**: the 13,504 files are `target/` (Tauri/Rust build output) + `node_modules/` (SvelteKit) + `.svelte-kit/`. These should all be `.gitignore`d.

## Recommended Action

1. Add to `.gitignore`:
   ```
   target/
   node_modules/
   .svelte-kit/
   build/
   dist/
   pkg/
   ```
2. Run `git rm -r --cached target node_modules .svelte-kit build dist pkg`
3. Commit: `chore: gitignore build artifacts`
4. Verify: `git ls-files | wc -l` should drop by ~13,000

## Estimated Time

- Enumeration: ~5 min
- .gitignore update: ~5 min
- Cache removal: ~10 min
- Commit: ~5 min
- Verification: ~5 min
- **Total: ~30 min**
