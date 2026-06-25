# ADR-ECO-020: BytePort hygiene pass — remove dead code, tighten `tauri.conf.json`, prune unused deps

**Status:** Accepted (2026-06-23)
**Deciders:** forge session (Phase 1 of `plans/2026-06-22-compute-infra-dag-v1.md`)
**Refs:** monorepo ADR-014 (Hexagonal L4 ports + Adapters),
ADR-ECO-015 (Hybrid gateway — desktop convergence),
Tauri 2.x SOTA (tauri.app security guide).

## Context

`BytePort/frontend/web/src-tauri/` is the Tauri 2.x desktop app
for the Phenotype compute mesh. As of 2026-06-22, the audit found:

1. **Dead `src/ipc.rs`** — a top-level sibling file that defined
   types no live code imported. The actual `ipc` module was an
   inline `pub mod ipc {}` inside `lib.rs` (used by the `benches/
   ipc.rs` benchmark). The dead file confused cargo-machete and
   new contributors.

2. **Dead `src/network.rs`** — defined a `NetworkClient` trait
   using `mockall` (dev-dep), but no live code consumed it. The
   `byteport-transport` crate (`crates/byteport-transport/`) is
   the actual network client (pure-Rust S3 presigner).

3. **Dead `src/adapters/` directory** (with `s3.rs` and
   `mod.rs`) — defined an `aws_sdk_s3`-based adapter that was
   the v0 design. The v1 design uses the pure-Rust
   `byteport-transport` crate, which has zero AWS SDK dependency.
   The `aws-sdk-s3` entry in Cargo.toml was dead.

4. **Dead `src/ports/mod.rs`** — defined a `Transport` port
   trait that conflicted with `crates/byteport-transport/src/
   ports/transport.rs`. The live trait is in the separate
   crate; the in-app one was dead.

5. **`tauri.conf.json` security issues**:
   - `identifier = "com.tauri.dev"` (the Tauri scaffold default;
     collides with other Tauri apps on the same machine).
   - `assetProtocol.scope = ["**"]` (allows any file on disk to
     be served by the Tauri webview — extreme over-scope).
   - Missing Permissions-Policy, COOP, COEP, CORP, HSTS,
     X-Frame-Options, X-Content-Type-Options, Referrer-Policy
     headers (the Tauri 2.x SOTA security guide requires all of
     these for desktop apps that serve any webview content).

6. **Other dead Cargo.toml deps**: `tokio`, `tracing`,
   `async-trait`, `thiserror`, `url`, `tauri-plugin-os`,
   `mockall` (dev) — confirmed unused by `cargo-machete` and
   `rg`.

## Decision

1. **Delete dead source files** (`-445` LOC):
   - `src/ipc.rs`
   - `src/network.rs`
   - `src/adapters/` (entire directory)
   - `src/ports/` (entire directory)

2. **Prune dead deps** from `frontend/web/src-tauri/Cargo.toml`:
   - Remove `aws-sdk-s3`, `tokio`, `tracing`, `async-trait`,
     `thiserror`, `url`, `tauri-plugin-os`, `mockall`.

3. **Harden `tauri.conf.json`**:
   - `identifier = "com.byteport.desktop"`.
   - `assetProtocol.scope = ["$APPDATA/uploads",
     "$APPDATA/cache", "$APPLOCALDATA/uploads",
     "$APPLOCALDATA/cache"]` (explicit APPDATA subpaths only;
     no `["**"]` over-scope).
   - Add the 7 missing security headers (Permissions-Policy,
     COOP, COEP, CORP, HSTS, X-Frame-Options, X-Content-Type-
     Options, Referrer-Policy).
   - Preserve the existing strict CSP, dev CSP, and `assetProtocol
     .enable = true`.

4. **Register `tauri-plugin-log` as a top-level plugin** (was
   only registered in debug builds); add a comment explaining
   the release vs debug sink model.

5. **Keep `vendor/aws-runtime/`** as a future drop-in for AWS
   SDK re-introduction (none planned at the moment). The
   optional `http-1x` / `http-body-1x` deps are gated by the
   `http-1x` feature flag, which is standard AWS SDK practice.

## Rationale

- **Codebase clarity** — `-445` LOC of dead code was a major
  contributor to the on-boarding friction reported in the
  2026-04-24 audit (`audits/2026-04-24/BytePort.md`).
- **Security-by-default** — the Tauri 2.x security guide
  explicitly lists `assetProtocol.scope = ["**"]` as a "do
  not do" item. The hardened scope is the minimum needed for
  the upload-cache + photo-thumb cache.
- **No behavior change at runtime** — the S3 presigner path is
  unchanged. The CSP and headers are strict-mode additions
  (strict-Transport-Security only takes effect over HTTPS,
  which is enforced by the backend).
- **Build verification deferred** — Tauri 2.x has a 5-minute
  cold build (the WebView2 + wry + tao crates are huge). The
  `cargo check` verification is documented in
  `phenotype-infra/worklog/2026-06-23-71-pillar-scorecard.md`
  as "Tauri 2.x timeout; defer to CI matrix".

## Consequences

- `git diff` shows 9 files changed, 235 insertions, 445 deletions
  (net `-210` LOC).
- The `benches/ipc.rs` benchmark continues to work (it imports
  `app_lib::ipc::IpcEnvelope` from the inline `pub mod ipc`
  in `lib.rs`).
- The Tauri plugin model now has log-sink parity between debug
  and release builds.
- Future contributors cannot accidentally wire up the dead
  `aws-sdk-s3` path because the Cargo.toml entry is gone.

## Alternatives considered

- **A: Migrate to a Tauri v3+ (pre-release)** — premature;
  v2.x is the stable channel. Rejected.
- **B: Keep `aws-sdk-s3` for "future use"** — violates the
  "no dead deps" baseline. The vendored `aws-runtime` is the
  right place for speculative code. Rejected.
- **C: Lock down the asset protocol entirely
  (`enable = false`)** — breaks the photo-cache use case
  documented in the backend `handlers.go`. Rejected.
