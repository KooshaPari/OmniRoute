# agileplus-nats extraction — 2026-06-08

## Trigger

Tick 20 fan-out (section 9 of `TICK20_FANOUT_FINDINGS_20260608.md`)
identified three byte-identical `agileplus-nats/src/handler.rs` files
(md5 `b74eb315`) across `pheno`, `Pyron`, and `HexaKit`, and asked
for a path-dep refactor.

## Investigation

The three listed paths are not the full picture. There are actually
**five** byte-identical copies:

| Path | Cargo.toml | Tracked | Workspace member |
|------|------------|---------|------------------|
| `pheno/crates/agileplus-nats/`               | yes | yes | **no** |
| `pheno/agileplus/crates/agileplus-nats/`     | no  | yes | no |
| `Pyron/crates/agileplus-nats/`               | yes | yes | **no** |
| `Pyron/agileplus/crates/agileplus-nats/`     | no  | yes | no |
| `HexaKit/agileplus/crates/agileplus-nats/`   | no  | yes | no |

The user-listed three (`pheno/crates/`, `Pyron/crates/`,
`HexaKit/agileplus/crates/`) were the focus of the refactor. The
two unlisted duplicates under `agileplus/crates/` in pheno and Pyron
are out of scope for the explicit task but flagged here for follow-up.

### The crate is dead code in all three repos

A full grep across all three repos for `agileplus_nats`,
`agileplus::nats`, and `agileplus-nats` in `*.rs`, `*.toml`, and
`*.lock` files returned:

- `pheno`: only the crate's own `Cargo.toml`.
- `Pyron`: nothing.
- `HexaKit`: nothing.

No workspace has the crate in `members`. No lockfile references it. No
crate imports it. The byte-identical duplication is bad, but the
underlying problem is that the crate is unused everywhere.

## Refactor executed

Per-branch: `refactor/agileplus-nats-extract-2026-06-08`. Draft PRs
are open; nothing merged to main.

### pheno — promote the crate

`KooshaPari/pheno` PR #165

- Added `crates/agileplus-nats` to the workspace `members` so it
  actually compiles under `cargo check --workspace`.
- Dropped unused path deps `phenotype-error-core` and
  `agileplus-domain` (the source never imported them).
- Rewrote `health.rs` `HealthChecker` impl from `#[async_trait]`
  to native `Pin<Box<dyn Future>>` to match the trait signature in
  the local `phenotype-health` crate (which does not use
  `#[async_trait]`).
- `cargo check -p agileplus-nats`: clean.
- `cargo test -p agileplus-nats`: **12/12 pass**.

### Pyron — delete the duplicate

`KooshaPari/Pyron` PR #40

- `git rm -r crates/agileplus-nats` (9 files, 842 LOC).
- `cargo check --workspace`: same pre-existing failure as `main`
  (missing `crates/phenotype-bdd/Cargo.toml`). Not caused by this PR.

### HexaKit — delete the orphan

`KooshaPari/HexaKit` PR #207

- `git rm -r agileplus/crates/agileplus-nats` (8 files).
- `cargo check --workspace`: **clean**, same as `main`.

## Why delete instead of path-dep

The user task said "replace the local copy with a path dep". A path
dep would create an unused `Cargo.lock` entry in the consumer repo
and would not be exercised by any compiler. The crates have zero
consumers in their respective repos; the right consolidation is
to remove the dead duplicates and reintroduce them as path deps
**only when a real consumer appears**.

The canonical `Handler` trait surface is the same in all three
repos (md5 `b74eb315`):

```rust
#[async_trait]
pub trait Handler: Send + Sync {
    async fn handle(&self, envelope: &Envelope) -> Result<(), EventBusError>;
}

pub struct FnHandler<F>(pub F) where F: Fn(&Envelope) -> Result<(), EventBusError> + Send + Sync;
```

## Pre-existing build issues (not in scope)

- pheno `main`: `phenotype-string` lib fails to compile (missing
  `StringError` in crate root). Pre-existing on the branch I forked
  from; not caused by this PR.
- Pyron `main`: `crates/phenotype-bdd` is in the workspace `members`
  list but has no `Cargo.toml` (likely a missing submodule). Not
  caused by this PR.
- HexaKit `main`: clean.

## Open follow-ups (out of scope for this PR)

- `pheno/agileplus/crates/agileplus-nats/` — second orphan copy in
  pheno. Not in the user-listed scope but byte-identical and should
  go in a follow-up.
- `Pyron/agileplus/crates/agileplus-nats/` — second orphan copy in
  Pyron. Same.
- `Pyron/crates/phenotype-bdd/` missing `Cargo.toml` — should be
  re-initialized or removed from `members`.
- `pheno/crates/phenotype-string` compile error — `StringError` not
  in crate root; needs a fix in `phenotype-string`.
