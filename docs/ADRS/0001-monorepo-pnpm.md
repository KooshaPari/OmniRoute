# ADR-0001: Monorepo layout — pnpm workspaces + Cargo workspace

**Status**: Accepted (2026-07-04)
**Deciders**: argismonitor core

## Context

v4 ships a SvelteKit web app, a Tauri 2 desktop shell, two shared TS packages, and a Rust gateway crate. We need a toolchain that handles both ecosystems without duplicating install/cache work.

## Decision

- pnpm 10.33.2 for JS workspaces; `pnpm-workspace.yaml` lists `apps/*`, `packages/*`, `tools/*`.
- Cargo workspace at root with `[workspace.dependencies]` so crates/gateway and apps/desktop/src-tauri share versions.
- `package.json` engines pin Node 22.10.0, pnpm 10.33.2, bun 1.3.10.
- `rust-toolchain.toml` pins rustc 1.85 + rustfmt + clippy.

## Consequences

- Single `pnpm install` covers the entire JS surface; `cargo build` covers Rust.
- `tsgo -b` handles project refs; `tsc --noEmit` is the typecheck loop.
- No `turborepo`/`nx`; their pipelines are too opaque for a 5-package workspace.

## Alternatives

- npm workspaces — rejected (no composite TS project refs).
- bun workspaces — considered for v4.1 once bun's linker matures.
