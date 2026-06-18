# FocalPoint Build Probe — 2026-06-14

**Repo:** `/Users/kooshapari/CodeProjects/Phenotype/repos/FocalPoint/`

## Findings

**Language:** Rust (despite AGENTS.md saying "Objective-C"). Evidence:
- `Cargo.lock` (197KB) at root
- `Cargo.toml` at root
- `crates/` directory with 62 subdirs
- No `.xcodeproj`, no `.swift`, no `.m`/`.h` source

**Build System:** Cargo workspace
- Root `Cargo.toml` defines the workspace
- 62 crates in `crates/` (focus-* and phenotype-*)

**Tooling:**
- `.githooks/` present
- `.github/` present
- `.gitignore`, `.gitattributes` present
- `deny.toml`, `clippy.toml` present
- `.pre-commit-config.yaml` present

**Docs:**
- `00_START_HERE.md`, `ADR.md`, `AGENTS.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `CLAUDE.md`, `CODEOWNERS`, `CONTRIBUTING.md`
- `docs/`, `docs-site/` directories

**State:**
- `.agileplus/` dir present (AgilePlus DB)
- `.audit/` dir present (from prior audits)
- `Cargo.lock` modified on 2026-06-14 (recent build)

## Verdict

FocalPoint is a **Rust workspace** (not Objective-C as AGENTS.md claims). The AGENTS.md is stale and should be updated. Build system is standard Cargo. The repo is in good shape — no critical errors detected at the top level.

## AGENTS.md Update Needed

The file `AGENTS.md` says:
> "Language: Objective-C (per GitHub language detection)"
> "Platform: macOS (AppKit)"

This is **incorrect**. The actual language is Rust. The build system is Cargo, not Xcode. Either:
- (a) The repo migrated from ObjC to Rust and AGENTS.md was never updated
- (b) There's a separate ObjC macOS app somewhere not at root

## Recommended Actions

1. **Update `AGENTS.md`** to reflect Rust + Cargo
2. **Update `.github/` workflows** to use `actions/setup-go`-style rust-cache
3. **Run `cargo check --workspace`** to verify the workspace compiles
4. **Run `cargo test --workspace`** to verify tests pass
5. **Update `ARCHITECTURE.md`** to describe the 62-crate workspace

## Estimated Time

- AGENTS.md update: ~10 min
- Workspace compile verification: ~10 min
- Test verification: ~30 min (depending on crate count)
- **Total: ~50 min**
