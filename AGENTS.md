# AGENTS.md — Agent Operating Manual

This file is the canonical entry-point for any AI agent (Codex, Claude Code, Ghostty, or otherwise) operating inside this repository. **Read this before touching code.**

## Project

**omniroute-rust** — Unified AI proxy/router ported to Rust. Tier-1 router (Bifrost), tier-2 routing engine, MCP server, A2A JSON-RPC, observability stack, 13-crate workspace, multi-provider support (231 entries).

## Repo layout

```
omniroute-rust/
├── Cargo.toml              workspace manifest (13 members)
├── crates/                tier-1 router + tier-2 routing
├── omniroute-rt/          runtime
├── open-sse/              streaming SSE engine
├── docs/                  ADRs, governance, ops
└── .github/workflows/     CI matrix (lint, test, sbom, codeql, scorecard, deny, audit-ratchet)
```

## Build / lint / test

```bash
cargo check --workspace --all-features
cargo clippy --workspace -- -D warnings
cargo test --workspace --all-features
cargo fmt --all -- --check
```

## Conventions

- Rust 2021 edition; clippy lints enforced
- Each crate has its own README and CHANGELOG entry
- Public APIs documented with `///` rustdoc; tests for every public function
- No `unwrap()` outside tests
- Errors via `thiserror::Error`; no panic for expected failure modes
- Workspace-level deps pinned in root `Cargo.toml`; no per-crate overrides

## Spec-first workflow

Before implementing: write the SPEC change in `SPEC.md` or open an ADR (`docs/adr/NNNN-title.md`, MADR format). Then write code. Then write tests.

## Commit conventions

Conventional Commits: `feat(scope): description`, `fix(scope): description`, `chore(scope): description`. PR title mirrors commit subject.

## PR process

1. Branch from `main`
2. Make focused change (one logical concern)
3. `cargo test` + `cargo clippy` clean
4. PR description: link to issue / ADR / SPEC section
5. CI must pass: lint, test, deny, sbom, codeql, scorecard

## Where to find things

- `docs/SPEC.md` — v8/v3.9.0 spec (architecture, FRs, NFRs, ADR list)
- `docs/adr/` — architecture decision records (MADR format)
- `docs/TRACEABILITY.md` — FR-N → tests → renders mapping
- `docs/operations/` — operator-facing runbooks
- `AGENTS.md` — this file
- `CLAUDE.md` — Claude-specific overrides (e.g., voice guide)

## Forbidden

- `cargo install` of unmaintained crates (check `deny.toml`)
- New `unsafe` blocks without `// SAFETY:` justification
- Direct upstream commits without rebasing on `upstream/main`
- Force pushes to shared branches

## Agent protocol

When working in this repo as an agent:

1. Read `AGENTS.md`, `CLAUDE.md`, `SPEC.md`, and any ADRs relevant to your task
2. If the change has architectural implications, write the ADR first
3. If the change has user-visible behavior, link to FR-N in commit body
4. Don't add emoji to source files unless the user explicitly requests them
5. Don't create README/CHANGELOG entries inside the repo unless explicitly requested
6. Prefer `cargo` over external scripts
