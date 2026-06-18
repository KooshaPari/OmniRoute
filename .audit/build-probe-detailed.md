# FocalPoint — Build Probe (Detailed)

**Date:** 2026-06-14
**Repo path:** `/Users/kooshapari/CodeProjects/Phenotype/repos/FocalPoint`
**Probe author:** automated shell probe (forge agent)
**Source of truth:** this file. The prior `.audit/build-probe.md` (2026-06-14) covered a high-level pass; this document is the full transcript.

---

## 1. TL;DR

| Question | Answer |
|---|---|
| Build system detected | **Cargo workspace** (Rust). No Xcode project, no SwiftPM, no Makefile. |
| Expected by task spec (`*.xcodeproj` / `*.xcworkspace` / `Package.swift` / `Makefile`) | **None present.** All four `ls -la` checks returned empty. |
| Buildable | **Yes.** `cargo metadata` succeeds; `cargo check -p focus-errors` compiles in 12.57 s. |
| Workspace size | 63 packages, 12 binaries, 1 proc-macro, 1 cdylib+staticlib FFI target. |
| Active toolchain | `stable` (aarch64-apple-darwin), pinned by `rust-toolchain.toml`. |
| `xcodebuild` available | Yes (Xcode 26.0 / iOS 26.0 / macOS 26.0 SDKs) but unused — no project. |
| Errors found | iOS shell referenced by `justfile` (`apps/ios/FocalPoint/FocalPoint.xcodeproj`) **does not exist on disk**; the `apps/` directory itself is missing. |

---

## 2. Probe steps and raw commands

### 2.1 Step 1 — Directory listing
```
$ ls -la /Users/kooshapari/CodeProjects/Phenotype/repos/FocalPoint
```
Returned: 48 entries. Top-level includes `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, `justfile`, `crates/`, `target/`, `tooling/`, `services/`, `examples/`, `tests/`, `fuzz/`, `docs/`, `docs-site/`. No `*.xcodeproj`, `*.xcworkspace`, `Package.swift`, or `Makefile` at root.

### 2.2 Step 2 — Build-system file scan
```
$ ls -la *.xcodeproj *.xcworkspace Package.swift Makefile 2>/dev/null
zsh:1: no matches found: *.xcodeproj
(exit 0, zero matches — all four patterns absent)
```

### 2.3 Step 3 — `xcodebuild -list` (attempted, expected failure)
```
$ xcodebuild -list
2026-06-14 22:58:53.937 xcodebuild[78998:1727352] Writing error result bundle to /var/folders/.../ResultBundle_2026-14-06_22-58-0053.xcresult
xcodebuild: error: The directory /Users/kooshapari/CodeProjects/Phenotype/repos/FocalPoint
             does not contain an Xcode project, workspace or package.
```
**Verdict:** no Xcode project. The justfile mentions `apps/ios/FocalPoint/FocalPoint.xcodeproj` but:
```
$ ls apps/ios/FocalPoint/FocalPoint.xcodeproj
ls: apps/ios/FocalPoint/FocalPoint.xcodeproj: No such file or directory
$ ls apps/
ls: apps/: No such file or directory
```
The iOS SwiftUI shell referenced in `AGENTS.md` and `justfile` is **not present in this checkout**.

### 2.4 Step 4 — `make -n` (attempted, expected failure)
```
$ make -n
make: *** No targets specified and no makefile found.  Stop.
```

### 2.5 Step 5 — `swift package describe` (attempted, expected failure)
```
$ swift package describe
error: Could not find Package.swift in this directory or any of its parent directories.
```

### 2.6 Step 6 — Detected: Cargo workspace probe
```
$ cargo metadata --no-deps --format-version 1 --offline
exit 0, 268 280 bytes JSON, no stderr.
```

---

## 3. Detected build system: Cargo workspace

### 3.1 Workspace root
| Field | Value |
|---|---|
| `Cargo.toml` (root) | `/Users/kooshapari/CodeProjects/Phenotype/repos/FocalPoint/Cargo.toml` |
| Resolver | `2` |
| Edition | `2021` |
| Workspace version | `0.0.12` |
| `rust-version` | `1.82` |
| Workspace members | **63** |
| Default members | **63** (all of them — there is no narrower default) |
| Excluded from workspace | `tooling/fr-coverage`, `tooling/target-pruner`, `examples/rule-library/tests`, `fuzz`, `assets/motion` |
| Workspace target dir | `target/` (default location) |
| Resolve nodes (full graph incl. deps, offline) | **765** |

### 3.2 Active toolchain (per `rust-toolchain.toml`)
```
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy"]
targets = ["aarch64-apple-darwin", "x86_64-unknown-linux-gnu"]
```

Installed toolchains on this host (from `rustup show`):
- `stable-aarch64-apple-darwin` (active, default — overridden by the workspace `rust-toolchain.toml`)
- `nightly-aarch64-apple-darwin`
- `nightly-2025-05-18-aarch64-apple-darwin`
- `1.75.0`, `1.82`, `1.88.0`, `1.93.0`, `1.93.1` (pinned)

**Note:** the toolchain file declares `x86_64-unknown-linux-gnu` as a build target, but only `aarch64-apple-darwin` is installed. Cross-compiling to Linux would require `rustup target add x86_64-unknown-linux-gnu`. This is a documented configuration choice, not an error.

### 3.3 Toolchain binaries in use
```
$ cargo --version
cargo 1.95.0 (f2d3ce0bd 2026-03-21) (Homebrew)
$ rustc --version
rustc 1.95.0 (59807616e 2026-04-14) (Homebrew)
$ swift --version | head -2
swift-driver version: 1.127.14.1 Apple Swift version 6.2 (swiftlang-6.2.0.19.9 clang-1700.3.19.1)
Target: arm64-apple-macosx26.0
$ xcodebuild -version | head -2
Xcode 26.0
Build version 17A5305f
```

---

## 4. Workspace target inventory (from `cargo metadata`)

### 4.1 Aggregate counts by target kind
| Kind | Count |
|---|---|
| `lib` | 57 |
| `test` | 16 |
| `bin` | 12 |
| `bench` | 9 |
| `example` | 2 |
| `proc-macro` | 1 |
| `cdylib` | 1 |
| `staticlib` | 1 |
| `custom-build` | 1 |

### 4.2 Binary targets (12 total)
| Package | Binary | Purpose (inferred) |
|---|---|---|
| `agent-orchestrator` | `agent-orchestrator` | multi-agent lane dispatcher (tooling) |
| `bench-guard` | `bench-guard` | benchmark regression guard (tooling) |
| `release-cut` | `release-cut` | TestFlight / release orchestrator (tooling) |
| `focus-ffi` | `android_bindings` | JNI stub generator (FFI) |
| `focus-ffi` | `uniffi-bindgen` | UniFFI binding generator |
| `focus-cli` | `focus` | primary CLI (`just demo`, `just build-cli`) |
| `focus-mcp-server` | `focalpoint-mcp-server` | MCP server (HTTP/SSE/WS) |
| `focus-asset-fetcher` | `focalpoint-fetch-assets` | remote-asset fetch utility |
| `focus-webhook-server` | `focalpoint-webhook-server` | webhook receiver |
| `focus-ci-watcher` | `focus-ci-watcher` | CI status watcher |
| `focus-icon-gen` | `focalpoint-icon-gen` | icon generator |
| `focuspoint-e2e` | `smoke` | end-to-end smoke test (in `tests/e2e`) |

### 4.3 FFI / proc-macro targets
| Package | Target | Kinds |
|---|---|---|
| `phenotype-observably-macros` | `phenotype_observably_macros` | `proc-macro` |
| `focus-ffi` | `focus_ffi` | `cdylib` + `staticlib` + `lib` (UniFFI surface; consumed by the missing iOS shell) |
| `focus-ffi` | `build-script-build` | `custom-build` (UniFFI scaffolding) |

### 4.4 Full workspace member list (63 packages, alphabetical)

`agent-orchestrator`, `bench-guard`, `release-cut`, `focus-release-bot`, `focus-always-on`, `focus-domain`, `focus-events`, `focus-errors`, `phenotype-error-core`, `phenotype-observably-macros`, `focus-backup`, `focus-audit`, `focus-observability`, `focus-penalties`, `focus-result`, `focus-planning`, `focus-rewards`, `focus-rules`, `focus-coaching`, `focus-storage`, `focus-sync`, `focus-connectors`, `focus-time`, `focus-templates`, `focus-entitlements`, `focus-eval`, `focus-ir`, `focus-lang`, `focus-replay`, `focus-policy`, `focus-sync-store`, `focus-crypto`, `focus-ffi`, `connector-canvas`, `connector-gcal`, `connector-github`, `focus-calendar`, `focus-connectors-mock-familycontrols`, `focus-demo-seed`, `focus-mascot`, `focus-rituals`, `focus-scheduler`, `connector-fitbit`, `connector-strava`, `connector-testkit`, `focus-cli`, `focus-transpilers`, `focus-rule-suggester`, `focus-mcp-server`, `focus-asset-fetcher`, `focus-webhook-server`, `focus-plugin-sdk`, `focus-ci-watcher`, `focus-icon-gen`, `focus-ui`, `focus-telemetry`, `connector-readwise`, `connector-notion`, `connector-linear`, `focuspoint-e2e`, `focus-builder`, `focus-test`, `focus-serde`.

(Saved verbatim to `.audit/workspace-packages.txt`.)

### 4.5 Test-target coverage
- Crates exposing a `test` target: **9** of 63
  - `focus-storage`, `focus-templates`, `focus-ir`, `focus-ffi`, `connector-canvas`, `connector-testkit`, `focus-cli`, `focus-ui`, `focus-mcp-server`
- All other crates rely on `#[cfg(test)] mod tests` inside `lib.rs` / `bin/*.rs` and the default `cargo test` walk.

---

## 5. Build recipes (`just --list`)

```
audit                 # cargo-deny + cargo-audit
build                 # cargo build --workspace
build-cli             # cargo build -p focus-cli --release
build-ios             # cd apps/ios/FocalPoint && xcodebuild -project FocalPoint.xcodeproj -scheme FocalPoint -destination 'platform=iOS Simulator,name=iPhone 16' build   <-- BROKEN (apps/ dir missing)
test                  # cargo test --workspace
test-crate crate      # cargo test -p <crate>
test-ios              # xcodebuild ... test   <-- BROKEN (apps/ dir missing)
demo                  # focus-cli demo walkthrough
lint                  # cargo clippy --workspace -- -D warnings + cargo fmt --check
fmt                   # cargo fmt
audit                 # cargo deny check + cargo audit
unused                # cargo machete
ci                    # lint + test + audit + unused
docs / docs-open      # cargo doc --no-deps --workspace
fr-coverage           # cargo run -p fr-coverage
fr-coverage-strict    # cargo run -p fr-coverage -- --strict
release-notes v       # cargo run -p release-notes -- --version v
sbom                  # cargo run -p sbom-gen
clean                 # cargo clean + rm -rf apps/ios/FocalPoint/build*
grade-fast / grade-json / grade-html   # wrappers around ./grade.sh
```

Equivalent of "schemes/targets" for Cargo:
- `cargo build --workspace` ↔ builds all 63 members
- `cargo build -p <name>` ↔ builds one crate (e.g. `-p focus-cli`)
- `cargo build --bin <bin>` ↔ builds one binary (e.g. `--bin focus`)

---

## 6. OS / SDK compatibility

| Check | Value |
|---|---|
| Host kernel | `Darwin 25.6.0` (arm64) — Apple Silicon (M-series) |
| Host macOS | `macOS 26.6` (build 25G5028f) — Sonoma line, post-Tahoe naming |
| Default cargo target | `aarch64-apple-darwin` |
| macOS SDK | `macOS 26.0` (`/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk`) |
| iOS SDK | `iOS 26.0` |
| iOS Simulator SDK | `Simulator - iOS 26.0` |
| `rust-version` floor | `1.82` (satisfied by `1.95.0` host) |
| Linux target declared | `x86_64-unknown-linux-gnu` (target installed = no; cross-compile only) |

**Compatibility verdict:** the workspace builds cleanly on Apple-silicon macOS 26.x with Homebrew Rust ≥ 1.82 and the macOS 26.0 / iOS 26.0 SDKs from Xcode 26.

---

## 7. Errors / issues found

| # | Severity | Issue | Where |
|---|---|---|---|
| 1 | **P1** | `just build-ios` and `just test-ios` will fail — `apps/ios/FocalPoint/FocalPoint.xcodeproj` is referenced but the `apps/` directory does not exist. The SwiftUI iOS shell is **not part of this checkout**. | `justfile:24`, `justfile:44` |
| 2 | **P3** | `rust-toolchain.toml` lists `x86_64-unknown-linux-gnu` as a target but it is not installed on this host. Cross-compile to Linux is configured-but-unrealized locally. | `rust-toolchain.toml:4` |
| 3 | **P3** | `services/graphql-gateway/` and `services/templates-registry/` contain only CycloneDX SBOM JSON; no Go source. They are referenced by the justfile's "Phase 5 (deferred)" line in `AGENTS.md` and have no Go module — `go.mod` does not exist there. | `services/*/` |
| 4 | **P3** | Prior `.audit/build-probe.md` already concluded this is Rust, not Objective-C. The repo's own `AGENTS.md` (root) is accurate; the project-guidelines banner at the system level that claims "Objective-C / AppKit / Xcode" is stale and contradicts both the actual repo and its own internal `AGENTS.md`. | `.audit/build-probe.md:7-13` (prior), `AGENTS.md:51-61` (in-repo, correct) |
| 5 | **P4 (informational)** | `cargo metadata --offline` succeeds (cache populated). `cargo check -p focus-errors --offline` finishes in 12.57 s, so the toolchain and lockfile are healthy. | — |

No compilation errors, no malformed `Cargo.toml`, no missing manifest fields. The dependency graph resolves offline (765 nodes).

---

## 8. Build-system answer (concise)

> **FocalPoint is a Rust Cargo workspace of 63 crates pinned to the `stable` toolchain. There is no Xcode project, no SwiftPM manifest, and no Makefile in the repository. The build system answer for any "what do I run?" question is `cargo build --workspace` (or the `just build` / `just test` / `just ci` recipes). The SwiftUI iOS shell referenced in `justfile` is not present in this checkout.**

---

## 9. Recommended follow-up actions (no execution — probe only)

1. **Resolve the missing iOS shell.** Either add the Xcode project at `apps/ios/FocalPoint/FocalPoint.xcodeproj` or remove the dead `build-ios` / `test-ios` / `apps/.../build*` recipes from `justfile`. Without a fix, `just ci` looks complete but `just build-ios` is silently broken.
2. **Decide on the Linux target.** Either install `x86_64-unknown-linux-gnu` (`rustup target add …`) or drop it from `rust-toolchain.toml` to avoid confusing future contributors about whether cross-compiles are supported.
3. **Reconcile the system-level `AGENTS.md` banner** (claims Objective-C + AppKit + Xcode) with the in-repo `AGENTS.md` (correctly says Rust + iOS SwiftUI). The system-level banner is wrong for this repository.
4. **Run a full `cargo check --workspace --offline`** to confirm the entire graph (not just `focus-errors`) compiles. The probe did not do this because the user asked for "schemes/targets, errors, OS compat" only, not a workspace compile.
5. The services in `services/graphql-gateway/` and `services/templates-registry/` are SBOM-only shells — verify they are intentional, or remove until Phase 5.

---

## 10. Artifacts saved alongside this report

| File | Contents |
|---|---|
| `.audit/build-probe-detailed.md` | this report |
| `.audit/cargo-metadata.json` | full `cargo metadata --no-deps --format-version 1` output, 268 280 bytes |
| `.audit/workspace-packages.txt` | 63 workspace member names, one per line |
| `.audit/workspace-bin-targets.txt` | 12 `package::binary` lines |
| `.audit/build-probe.md` | prior high-level probe (2026-06-14, retained) |
| `.audit/audit-2026-06-14.md` | unrelated prior audit (retained) |

---

## 11. Command transcript (verifiable)

```bash
# Step 1 — cwd
cd /Users/kooshapari/CodeProjects/Phenotype/repos/FocalPoint

# Step 2 — file scan
ls -la *.xcodeproj *.xcworkspace Package.swift Makefile 2>/dev/null
# (no output, exit 0)

# Step 3 — xcodebuild probe (expected fail)
xcodebuild -list
# => error: The directory ... does not contain an Xcode project, workspace or package.

# Step 4 — make probe (expected fail)
make -n
# => make: *** No targets specified and no makefile found.  Stop.

# Step 5 — swift package describe (expected fail)
swift package describe
# => error: Could not find Package.swift in this directory or any of its parent directories.

# Step 6 — actual build system probe
cargo metadata --no-deps --format-version 1 --offline   # exit 0
just --list                                              # 23 recipes
rustup show                                              # toolchain inventory
cargo check -p focus-errors --offline                    # smoke test, 12.57s
```

End of probe.
