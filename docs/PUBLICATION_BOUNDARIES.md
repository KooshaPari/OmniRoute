# Publication Boundaries

## Runtime Topology

| Surface | Runtime | Package Manager | Distribution |
|---|---|---|---|
| Web app (`src/app/**`) | Next.js 15 App Router | pnpm | `pnpm run dev` / `pnpm start` |
| `open-sse/services/**` | Node.js 22-27 | pnpm | `pnpm run open-sse` |
| Rust crates (server-side) | stable | cargo | `cargo build --release` |
| CI | GitHub Actions | n/a | `.github/workflows/*.yml` |

## What is and isn't published

### ❌ Never published (no publishing artifacts exist)

| Surface | Reason |
|---|---|
| Electron app | **Zero deps.** No `electron`, `electron-builder`, or related. |
| Tauri app | **Zero deps.** No `tauri`, `@tauri-apps/*`. |
| React Native app | **Zero deps.** No `react-native`, `expo`, `metro`. |
| Flutter app | **Zero deps.** No `flutter`, `dart`. |
| Capacitor / Cordova | **Zero deps.** No `@capacitor/*`, `cordova*`. |
| ElectroBun | **Zero deps.** No `electrobun` (false positive match was `@opentelemetry/exporter-trace-otlp-http`). |

### ✅ What is published

| Surface | Mechanism |
|---|---|
| Web service | Docker image (Dockerfile in repo root) → deploys to internal infrastructure |
| open-sse workers | In-process to the Next.js server (`serverExternalPackages` in `next.config.mjs`) |
| Rust crates | Static binaries consumed by Next.js via `crates/omniroute-ffi/` |
| npm packages | **None.** This repo is an application, not a library. |

## What this means

1. **No desktop / mobile binary distribution.** The repository ships a web service only.
2. **No npm publish.** The package name `@kooshapari/omniroute` is the application name, not a published library.
3. **No Flutter / React Native / Electron pipeline.** New contributors should not attempt to add such runtimes without explicit architectural approval.
4. **The Rust crates are server-side support** for the web service. They are not standalone products.

## Audit timestamp

This document was generated as part of tooling modernization. See `.fork-identity.json` for the canonical fork identity SSOT.
