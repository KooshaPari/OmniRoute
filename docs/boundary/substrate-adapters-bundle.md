# Boundary: substrate-adapters-bundle

**Status:** Archived 2026-07-17 (redundant-shims)
**Origin:** `KooshaPari/substrate-adapters-bundle`
**Disposition:** ARCHIVE_ONLY — no physical transfer
**Canonical source:** `KooshaPari/substrate` (AFFIRM, active)

## Purpose (was)

The bundle was one of three distribution surfaces of the substrate ecosystem:

| Surface | Audience | Status |
|---------|----------|--------|
| `KooshaPari/substrate` | internal + integrators | AFFIRM (active) |
| `KooshaPari/substrate-adapters-bundle` (this) | OSS consumers wanting one version pin | ARCHIVED (redundant) |
| `KooshaPari/phenotype-router-spec` | implementers of substrate-compatible routers | absorbed into phenotype-registry |

## Why archived

The bundle contained 8 thin re-export shims (one per substrate adapter crate). Each shim's body was a single `pub use <canonical_crate>::*;` line. The 216 KB footprint was dominated by metadata and Cargo.toml files — no production code lived in the bundle.

Since `KooshaPari/substrate` (the canonical source) is active and AFFIRM, and the 8 canonical crates (`engine-agentapi`, `engine-claude`, `engine-codex`, `engine-forge`, `omniroute-adapter`, `cliproxy-adapter`, `context-budget`, `substrate-trace`) all exist there with the **same crate names**, the bundle provided:

- ❌ No unique code
- ❌ No unique behavior
- ❌ No unique identity
- ✅ A redundant single-version-pin surface (relevant only to OSS consumers, not to in-workspace usage)

For in-workspace usage within `pheno`, the canonical `substrate` repo is consumed directly via path dependencies or git. The shims added an unnecessary indirection.

## What lives where now

| Crate | Canonical location | Status |
|-------|--------------------|--------|
| `engine-agentapi` | `KooshaPari/substrate/crates/engine-agentapi` | AFFIRM |
| `engine-claude` | `KooshaPari/substrate/crates/engine-claude` | AFFIRM |
| `engine-codex` | `KooshaPari/substrate/crates/engine-codex` | AFFIRM |
| `engine-forge` | `KooshaPari/substrate/crates/engine-forge` | AFFIRM |
| `omniroute-adapter` | `KooshaPari/substrate/crates/omniroute-adapter` | AFFIRM |
| `cliproxy-adapter` | `KooshaPari/substrate/crates/cliproxy-adapter` | AFFIRM |
| `context-budget` | `KooshaPari/substrate/crates/context-budget` | AFFIRM |
| `substrate-trace` | `KooshaPari/substrate/crates/substrate-trace` | AFFIRM |

## Restore procedure

```sh
gh repo unarchive KooshaPari/substrate-adapters-bundle
# In registry spine:
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry
# Edit registry/disposition-index.json: change fsm from "absorbed" back to "active"
# Restore projects/substrate-adapters-bundle.json from git history (revert to queued status)
```

There is no `pheno/` change to revert because no physical transfer occurred.

## Cross-references

- Absorption record: `audits/absorption-justifications/substrate-adapters-bundle-2026-07-17.md`
- Disposition row: `registry/disposition-index.json` → `"KooshaPari/substrate-adapters-bundle"`
- Canonical source: `KooshaPari/substrate` (AFFIRM)
- Source repo (now archived): https://github.com/KooshaPari/substrate-adapters-bundle
