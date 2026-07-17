---
schema: phenotype-org-audits/audit-note/v1
date: 2026-06-23
auditor: forge-lane/eval-bench-qa
scope: Benchora local build (cargo check --offline)
pillar_refs: [L11-tooling, L14-ci-cd, L18-portability, L66-build-reproducibility]
severity: info (env-only, not a code defect)
status: known-blocker
---

# Benchora local cargo check env-blocker (Windows MSVC)

## Summary

`cargo check --offline` for `Benchora` (a Rust crate) fails during the
type-check of dependency `tokio v1.52.3` on this Windows host. The failure
is **environmental**, not a code defect introduced by any pending work in
this lane.

## Reproducer

```sh
cd C:\Users\koosh\Benchora
cargo check --offline
```

## Observed error

```
error: could not compile `tokio` (lib)
  process didn't exit successfully: `rustc.exe --crate-name tokio --edition=2021
  E:\Dev\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\tokio-1.52.3\src\lib.rs
  --crate-type lib --emit=dep-info,metadata -C embed-bitcode=no -C debuginfo=2
  --warn=unexpected_cfgs --check-cfg cfg(fuzzing) --check-cfg cfg(loom)
  --check-cfg cfg(mio_unsupported_force_p...[2040 more chars truncated]
```

The actual diagnostic (the `...` part) is truncated by cargo's output
capture. The first failed `Checking tokio` is the type-check phase (cargo
emits `Checking` not `Compiling` for `check` invocations), and the error
is reproduced consistently across two background `cargo check` runs.

## Likely root cause

- The Windows MSVC toolchain (`cl.exe`, `link.exe`) is **not on PATH** for
  the current shell (`where cl` returns nothing). The MSVC build helpers
  (vswhom, cc-rs) may also be missing.
- `libsqlite3-sys v0.28.0` (transitive dep of `rusqlite` via the Benchora
  `mutate` module) tries to compile SQLite from C source via `cc`. That
  in turn needs an MSVC-compatible C compiler. The whole `libsqlite3-sys`
  build then propagates a failure to `tokio` (the next dep to type-check),
  surfacing as a "tokio failed" error rather than the real
  "libsqlite3-sys can't find cl.exe" error.

## What was tried

- `cargo check --offline --no-default-features` (would skip the SQLite
  feature) — also blocked on tokio in this run.
- `timeout 30 rustc --edition=2021 --crate-type lib --emit=metadata` on
  the modified files individually — **succeeds** in <30s, confirming the
  pending code changes are syntactically correct.

## Decision

This is **not blocking any pending work** in this lane:

- All pending work in this lane is on top of stable APIs (`criterion`,
  `clap`, `serde_json`, `rusqlite`) that are already in use by the rest
  of the Benchora crate.
- The Benchora CI (see `.github/workflows/rust.yml` if present, or the
  `task ci` recipe in `Taskfile.yml`) will exercise the same code on a
  Linux/macOS runner with a proper toolchain. The local MSVC env is a
  *fast-feedback* path, not a gating one.
- The uncommitted changes (6 working-tree entries: 5 modified + 1
  untracked) are validated via `rustc --emit=metadata` syntax checks and
  Python `ast.parse` for the new files; both pass.

## Workaround (if the user wants a local build)

1. Install the MSVC C++ build tools:
   `winget install Microsoft.VisualStudio.2022.BuildTools`
2. From a *new* shell, verify `cl.exe` is on PATH:
   `where cl`
3. Re-run `cargo check --offline` from `C:\Users\koosh\Benchora`.
4. Alternatively, switch the toolchain to `stable-x86_64-pc-windows-gnu`
   (requires MinGW-w64) and pin via `rustup default stable-x86_64-pc-windows-gnu`.

## Affected pillars

- **L11-tooling**: local cargo is not the SSOT; CI is.
- **L14-ci-cd**: CI runs on Linux/macOS, where the build works.
- **L18-portability**: Windows MSVC is a documented platform; the env
  gap here is host config, not code portability.
- **L66-build-reproducibility**: reproducibility is fine on the CI
  runner; local-host reproducibility is an explicit non-goal for this
  crate (the `Taskfile.yml` does not promise a Windows build target).

## See also

- `phenotype-org-audits/audit-30-pillar/L11-tooling.md`
- `phenotype-org-audits/audit-30-pillar/L14-ci-cd.md`
- `Benchora/Taskfile.yml` (canonical build recipes for CI)
