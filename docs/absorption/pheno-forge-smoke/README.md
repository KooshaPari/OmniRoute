# Absorption Record: pheno-forge-smoke

**Source:** `KooshaPari/pheno-forge-smoke`
**Target:** `KooshaPari/pheno` (monorepo) → `crates/pheno-forge-smoke/`
**Date:** 2026-07-17
**Wave:** `2026-07-17-queue-refresh-batch4`
**Disposition:** ABSORB (fsm: active → absorbed)
**ADR reference:** ADR-096 (forgecode 4-PR improvement stack)
**Executed by:** forge agent (automated)

## Transfer Record

| Field | Value |
|-------|-------|
| Source repo | `KooshaPari/pheno-forge-smoke` |
| Target repo | `KooshaPari/pheno` (monorepo) |
| Target paths | `crates/pheno-forge-smoke/` |
| Source last commit | `66815e4` (wip: auto-commit daemon 2026-07-16T10:38:10Z) |
| Absorbed date | 2026-07-17 |
| Absorbed by | forge agent |
| Branch on target | `absorb/pheno-forge-smoke-2026-07-17` |
| Commit on target | (see `git log` on `absorb/pheno-forge-smoke-2026-07-17`) |
| Verification | `cargo check -p pheno-forge-smoke` clean; `cargo build -p pheno-forge-smoke --release` clean; `cargo test -p pheno-forge-smoke` 0 tests (smoke binary — runtime checks only); runtime `--help` + bridge-missing graceful-fail verified |

## Files Transferred

| Source | Target | Notes |
|--------|--------|-------|
| `Cargo.toml` | `pheno/crates/pheno-forge-smoke/Cargo.toml` | Pinned deps converted to `workspace = true` where possible (`tokio`, `serde`, `serde_json`, `anyhow`, `chrono`, `clap`, `tracing`, `tracing-subscriber`, `reqwest`). `libloading` and `colored` not in workspace.dependencies; pinned concrete versions. Added `tracing-subscriber` `env-filter` feature (needed by `EnvFilter`). Removed `[profile.release]` (workspace root owns it). Added `publish = false`. `repository` updated to `KooshaPari/pheno`. |
| `src/lib.rs` | `pheno/crates/pheno-forge-smoke/src/lib.rs` | No changes needed (self-contained; references `libloading::Library` directly) |
| `src/main.rs` | `pheno/crates/pheno-forge-smoke/src/main.rs` | No changes needed (imports `pheno_forge_smoke::{Bridge, default_bridge_path, ...}` from sibling lib) |
| `README.md` | `pheno/crates/pheno-forge-smoke/README.md` | Copied as-is; references `../pheno-cdylib-bridge` which is now a sibling path under `crates/` |
| `CHANGELOG.md` | `pheno/crates/pheno-forge-smoke/CHANGELOG.md` | Copied as-is |
| `.gitignore` | `pheno/crates/pheno-forge-smoke/.gitignore` | Copied as-is (excludes `/target/`, `/bin/*-sidecar`, IDE/OS noise). |
| `scripts/run-smoke.sh` | (NOT transferred — out of scope per monorepo policy) | Helper script that builds the bridge and sets `DYLD_LIBRARY_PATH` / `LD_LIBRARY_PATH`. The pheno monorepo root `.gitignore` line 146 has a blanket `scripts/` exclusion; absorbed crates do not carry `scripts/` directories. The script remains in the GitHub archive of the source repo. |
| `sidecars/Cargo.toml` + `sidecars/src/main.rs` | `pheno/crates/pheno-forge-smoke/sidecars/` | Copied as a non-workspace sub-crate. The smoke binary spawns `pheno-sidecar-stub` as an external process in `--mode=sidecar`, so it does not need to be a workspace member. Cargo treats it as a separate package but does not build it as part of `cargo build -p pheno-forge-smoke`. |
| `sidecars/pheno-sidecar-stub.cdx.json` | (NOT transferred — generated SBOM) | CycloneDX BOM artifact; regenerated on build. |
| `pheno-forge-smoke.cdx.json` (source root) | (NOT transferred — generated SBOM) | CycloneDX BOM artifact; regenerated on build. |

## Files NOT Transferred (out of scope)

| Source | Reason |
|--------|--------|
| `scripts/run-smoke.sh` | Pheno monorepo `.gitignore` line 146 has a blanket `scripts/` exclusion. The script remains in the GitHub archive of the source repo. |
| `docs/`, `examples/` | Empty in source. |
| `AGENTS.md`, `SSOT.md`, `WORKLOG.md`, `llms.txt`, `LICENSE-*`, `cliff.toml` | Single-repo governance meta-bundle. Lives in the GitHub archive. The monorepo `pheno` repo has its own governance bundle. |
| `Cargo.lock` (source root) | Workspace root `pheno/Cargo.lock` will be updated by `cargo` on first build (no need to copy). The `sidecars/` sub-crate has its own `Cargo.lock` (also not transferred — it would be regenerated if/when the sidecar is built). |
| `tests/` | Empty in source. The smoke binary is a CLI; its tests are end-to-end (running the binary against a live bridge), not unit tests. |

## Workspace Changes (pheno monorepo)

- **`Cargo.toml`**: added `"crates/pheno-forge-smoke"` to `[workspace] members` next to
  `"crates/pheno-cdylib-bridge"` and `"crates/pheno-context"`
- No changes to `[workspace.dependencies]` — `libloading` and `colored` are pinned
  locally in the crate's `Cargo.toml` for now (not promoted to workspace deps yet).
  Future PR may promote them if another crate needs them.

## Upstream adaptations during absorption

- **Dep workspace-ification**: 9 of 11 deps now use `workspace = true` (tokio, serde,
  serde_json, anyhow, chrono, clap, tracing, tracing-subscriber, reqwest).
- **Feature enable**: `tracing-subscriber` `env-filter` feature enabled (workspace
  dep has no features enabled; needed for `tracing_subscriber::EnvFilter`).
- **Repo URL**: `repository` updated from `KooshaPari/pheno-forge-smoke` →
  `KooshaPari/pheno`.
- **Publish**: `publish = false` added (it's an internal CLI; matches pattern from
  `pheno-cdylib-bridge`).
- **`[profile.release]` removed**: workspace root owns release profile.

## Verification

```sh
$ cargo check -p pheno-forge-smoke
    Checking pheno-forge-smoke v0.1.0 (pheno/crates/pheno-forge-smoke)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.96s

$ cargo test -p pheno-forge-smoke
    Finished `test` profile [unoptimized + debuginfo] target(s) in 8.78s
    Running unittests src/lib.rs (target/debug/deps/pheno_forge_smoke-...)
    running 0 tests
    test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
    Running unittests src/main.rs (target/debug/deps/pheno_f..._smoke-...)
    running 0 tests
    test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
    Doc-tests pheno_forge_smoke
    running 0 tests
    test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out

$ cargo build -p pheno-forge-smoke --release
    Finished `release` profile [optimized] target(s) in 46.79s

$ ./target/release/pheno-forge-smoke --help
    End-to-end smoke for the forgecode improvement stack (ADR-096)
    Usage: pheno-forge-smoke [OPTIONS]
    ...

$ ./target/release/pheno-forge-smoke --mode=mock --skip-healthcheck
    pheno-forge-smoke 0.1.0 (mode: Mock)
    Results:
      FAIL bridge_load                      (0 ms)  failed to load .../libpheno_bridge.dylib: ...
    1 / 1 CHECKS FAILED
```

The crate compiles cleanly in `dev` and `release`, the binary produces the expected
clap `--help` output, and the runtime path correctly reports the bridge as missing
(graceful failure with descriptive error) when `libpheno_bridge.{so,dylib,dll}` is not
built — which is the expected behaviour since the bridge must be built first
(per the source README).

The 0/0/0 test result is correct for this crate: the source repo had no unit tests
(only an end-to-end script). The smoke binary IS the test rig.

## Provenance

Branch: `absorb/pheno-forge-smoke-2026-07-17` on `KooshaPari/pheno`.
Source repo `KooshaPari/pheno-forge-smoke` to be archived via `gh repo archive`.

## Notes for follow-up PRs

- If `pheno-sidecar-stub` ever needs to be **built as part of the workspace**, it
  would be promoted to `crates/pheno-sidecar-stub/` as a separate workspace member
  (NOT a child of `pheno-forge-smoke`). Currently it's a non-workspace sub-crate
  because the smoke binary spawns it as an external process — it doesn't need
  workspace integration to function.
- Consider adding 1-2 unit tests against the `Bridge::load` happy-path with a
  known-bad path (verifies graceful dlopen error reporting).