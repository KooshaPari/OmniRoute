# Plan: Migrate `phenotype-router` from HexaKit to Substrate

**Date**: 2026-07-07
**Author**: Audit agent
**Status**: Draft

## Audit Summary

All four HexaKit crates investigated:

| Crate                         | Dispatch-specific? | Move to Substrate? | Rationale                                                                                                                                                    |
| ----------------------------- | ------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `phenotype-router`            | **YES**            | **YES**            | ComboVariant routing, model alias resolution, multimodal detection, SSE passthrough, `/v1/*` delegate to cliproxy. Has a standalone HTTP binary (`[[bin]]`). |
| `phenotype-port-traits`       | No                 | No                 | Foundation-level port trait definitions. Pure library.                                                                                                       |
| `phenotype-ports-canonical`   | No                 | No                 | Near-empty scaffold for canonical port implementations. Pure library.                                                                                        |
| `phenotype-contract-adapters` | No                 | No                 | In-memory test doubles for hexagonal ports. Pure library.                                                                                                    |

**Only `phenotype-router` overlaps with Substrate.** The Substrate crate
`routing-phenotype-router` is an adapter that depends on `phenotype-router`
(via git dependency). Moving `phenotype-router` into Substrate as a workspace
member converts this to a local path dependency.

---

## Why This Migration

1. **Dispatch-specific content**: `phenotype-router` contains combo-variant routing,
   model alias resolution, multimodal detection, SSE streaming — all dispatch-spine
   concerns, not foundation library code.
2. **Zero internal consumers in HexaKit**: No crate within HexaKit depends on
   `phenotype-router`. `phenotype-core` does not re-export it.
3. **Only consumer is Substrate**: `routing-phenotype-router` in Substrate is the
   sole consumer (currently via git dependency).
4. **Has a `[[bin]]` target**: Runs as a standalone HTTP service — belongs in
   the dispatch spine, not the foundation library.
5. **Dependencies align with Substrate**: Already depends on `axum`, `reqwest`,
   `tokio` — all present as workspace dependencies in Substrate.

---

## Migration Steps

### Step 1: Move source code

Copy `HexaKit/crates/phenotype-router/` → `Substrate/crates/phenotype-router/`.

```bash
cp -r /path/to/HexaKit/crates/phenotype-router /path/to/Substrate/crates/phenotype-router
```

This includes:

- `src/lib.rs` and all submodules (`alias.rs`, `delegate.rs`, `multimodal.rs`, `rate_limit.rs`, `sse.rs`)
- `src/bin/phenotype-router.rs` — the standalone binary
- `Cargo.toml`
- `README.md`

### Step 2: Update Substrate workspace members

In `Substrate/Cargo.toml`, add `"crates/phenotype-router"` to the `[workspace] members` list:

```toml
[workspace]
members = [
    # ... existing members ...
    "crates/routing-phenotype-router",
    "crates/phenotype-router",   # <-- NEW
    # ...
]
```

### Step 3: Update `routing-phenotype-router` dependency

In `Substrate/crates/routing-phenotype-router/Cargo.toml`, change the git dependency to a path dependency:

```toml
# WAS:
phenotype-router = { git = "https://github.com/KooshaPari/phenotype-router" }

# NOW:
phenotype-router = { path = "../phenotype-router" }
```

### Step 4: Remove `phenotype-router` from HexaKit workspace

In `HexaKit/Cargo.toml`, remove `"crates/phenotype-router"` from the `[workspace] members` list.

Delete the directory:

```bash
rm -rf /path/to/HexaKit/crates/phenotype-router
```

### Step 5: Update any workspace dependency entries in HexaKit

If `phenotype-router` appears in `HexaKit/Cargo.toml` under `[workspace.dependencies]`, remove that entry. (It does NOT currently appear there — only the crate's own `Cargo.toml` exists.)

### Step 6: Verify builds

```bash
# In Substrate:
cargo build -p phenotype-router
cargo build -p routing-phenotype-router
cargo test -p phenotype-router
cargo test -p routing-phenotype-router

# In HexaKit:
cargo build        # confirm no broken references
cargo test         # confirm all tests pass
```

### Step 7: Fix any path/crate-name collisions

If `Substrate/crates/` already has a `phenotype-router` directory, rename to
`phenotype-router-core` or another disambiguated name. (The current listing
shows no such collision — `routing-phenotype-router` is a distinct crate.)

### Step 8: Update external consumers (if any)

Search for other repos that depend on `phenotype-router` via git:

```bash
grep -r "phenotype-router" /path/to/repos/*/Cargo.toml | grep -v "routing-phenotype-router"
```

The audit found `phenotype-router-monitor` in `Agentora/`, `pheno/`, and
`pheno-cockpit-registry-bracket/` — these are separate crates with a different
purpose (monitoring), not the routing crate. No action needed unless they
also import the routing `phenotype-router` crate.

---

## Risk Assessment

| Risk                                                               | Likelihood                                          | Mitigation                                    |
| ------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------- |
| HexaKit `phenotype-core` or other crate silently depends on router | Low (confirmed zero via grep)                       | Double-check with `grep -rn` before deletion  |
| Another external repo depends on router directly                   | Low (only Substrate found)                          | Search all repos per Step 8                   |
| Binary name collision with existing Substrate binaries             | Low (no `phenotype-router` bin exists in Substrate) | Verify with `ls Substrate/crates/*/src/bin/`  |
| Cargo.lock drift between workspaces                                | Low                                                 | Run `cargo generate-lockfile` after migration |

---

## Not Moving (Confirmation)

These crates were audited and correctly remain in HexaKit:

| Crate                         | Reason                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `phenotype-port-traits`       | Pure library — defines port trait interfaces. Dispatch-agnostic.                        |
| `phenotype-ports-canonical`   | Pure library — canonical port implementations (currently scaffold).                     |
| `phenotype-contract-adapters` | Pure library — in-memory test doubles (Repository, CachePort, EventBus, SecretManager). |

No overlap with Substrate's `omniroute-adapter` (which is an OmniRoute HTTP proxy
adapter) or `dispatch-bridge` (A2A/Wave envelope transport).
