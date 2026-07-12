# ADR-003: Team Conventions — omniroute-rust

**Status:** Accepted (2026-07-12)  
**Drivers:** ADR-001 (Architecture), ADR-002 (Decision Records), CONTRIBUTING.md  
**Priority:** Foundational

## Context

The omniroute-rust workspace is a 13-crate workspace with multiple contributors,
a CI pipeline, and a release cadence. Without explicit conventions for code style,
git history, dependency management, and review workflow, the workspace will
accumulate inconsistencies that slow down development and increase review friction.

## Decision

### Code style

1. **Formatting.** `rustfmt` with default settings (tab = 4 spaces, 100-char width).
   Enforced via `just fmt` and CI (`cargo fmt --check`).
2. **Linting.** `clippy` with `#![deny(clippy::all, clippy::pedantic)]` at the
   workspace level. Individual crates may selectively `#[allow(...)]` with a
   comment explaining why. CI runs `cargo clippy --workspace -- -D clippy::all
   -D clippy::pedantic`.
3. **Unsafe.** Only permitted in `omni-crypto` (AES-GCM, Argon2) and `omni-sdk`
   (C-ABI FFI boundary). `#![deny(unsafe_code)]` is set at workspace root.
4. **Imports.** Grouped in blocks: `std` → external crates → `crate::` → `super::`.
   No `use crate::*` or `use super::*`. `rustfmt` merge-by-merge pass handles this.

### Git conventions

1. **Branch naming.** `feat/<description>`, `fix/<description>`,
   `chore/<description>`, `docs/<description>`. Hyphen-separated, lowercase.
   Examples: `feat/omni-core-executor`, `chore/gitignore-hardening`.
2. **Commit messages.** Conventional Commits (`type(scope): message`).
   Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `ci`.
   Scopes map to crate names or top-level files: `omni-core`, `omni-router`,
   `ci`, `docs`, `deps`.
3. **Linear history.** Rebasing preferred over merge commits. PRs are squash-merged.
   No `git push --force` on shared branches (except personal feature branches).
4. **Sign-off.** All commits must be signed with a GPG/SSH key. CI verifies
   commit signature.

### Dependency management

1. **`cargo-deny`** is enforced in CI (`deny.toml`). Bans: GPL-3.0, AGPL-3.0,
   SSPL, and unknown licenses. Allowed: MIT, Apache-2.0, BSD-2/3-Clause, ISC,
   Unlicense, CC0-1.0.
2. **No `[patch]`** in workspace `Cargo.toml` except for critical security
   patches, and only with explicit ADR documenting why.
3. **Dependency audits** are run weekly via CI (`cargo audit`). Critical
   vulnerabilities block the release pipeline.
4. **New dependencies** require review in the PR. Prefer `rustls` over `native-tls`.
   Avoid pulling in `openssl`-linked crates.

### Review workflow

1. Every PR requires at least **one approval** from a maintainer.
2. PRs modifying `omni-core`, `omni-protocol`, or `omni-server` require
   **two approvals**.
3. PRs must pass CI (fmt + clippy + test + deny + audit) before merging.
4. PR descriptions must include a **risk section** if the change touches
   security, storage schema, or public API.
5. No PR should exceed **800 lines** of changed code. Larger changes must be
   split into stacked PRs.

### Testing conventions

1. Every crate has a `tests/` directory with integration tests.
2. Unit tests are inline (`#[cfg(test)] mod tests { ... }`) at the bottom of
   each module.
3. Property-based tests (`proptest`) are required for serialization round-trips
   in `omni-protocol` and `omni-translator`.
4. Benchmarks live in `benches/` per crate and use `criterion` with HTML reports.
5. The `justfile` exposes `just test`, `just test-all`, `just bench`.
   CI runs `cargo test --workspace` on every push.

### Documentation

1. Every public item has a doc comment (`///`). Module-level docs (`//!`) describe
   purpose and entry points.
2. Crate-level docs in `src/lib.rs` include a usage example.
3. Top-level docs (`ARCHITECTURE.md`, `docs/adr/`, `docs/OPERATIONS.md`) are
   ASCII-constrained to <500 lines each; deeper content goes into `docs/adr/`.
4. README.md is kept concise — a crate map, quickstart, and license. It must
   never duplicate ARCHITECTURE.md.

## Consequences

### Positive

1. **Consistent codebase** — no formatting debates in reviews.
2. **Auditable git history** — every commit has a clear type, scope, and
   author attestation.
3. **Predictable CI** — all checks gate the merge button.

### Negative

1. **Strict conventions** can feel bureaucratic for minor changes. Mitigated
   by `chore` type for trivial commits (e.g., typo fixes).
2. **Two-approval rule** may slow down hotfixes. Mitigated by a documented
   emergency process (`docs/OPERATIONS.md#incident-response`).

### Risks

1. **Convention drift.** New team members may not be aware of all rules.
   **Mitigation:** CONTRIBUTING.md captures highlights; `justfile` recipes
   automate most checks locally.
2. **Branch-name enforcement.** CI can check branch names, but it's easy to
   bypass. **Mitigation:** lefthook pre-push hook enforces branch naming.

## ADR Cross-Reference

| ADR | Relation |
|-----|----------|
| ADR-001 (Architecture) | Workspace crate topology referenced by scope conventions. |
| ADR-002 (Decision Records) | ADR lifecycle and format rules referenced for doc conventions. |
