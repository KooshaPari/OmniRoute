# Tauri Active Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Promote Tauri 2 to the active OmniRoute desktop shell, preserve Electron/Electrobun as inactive evidence, and close the desktop/API parity and traceability gates.

**Architecture:** `apps/desktop` will be a thin Tauri 2 wrapper around the existing SvelteKit frontend and Hono/API boundary. Runtime lifecycle and readiness will be explicit typed commands; routing, healing, Bifrost, and Rust FFI remain behind the existing API contract. Inactive desktop implementations remain present but are removed from active setup and release paths.

**Tech Stack:** Tauri 2, Rust, SvelteKit 5, Hono, Bun, Vitest, Playwright, existing OmniRoute TypeScript/Rust FFI workspace, GitHub Actions.

---

### Task 1: Establish the active desktop contract

**Files:**

- Create: `apps/desktop/package.json`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/capabilities/default.json`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/src/lifecycle.rs`
- Create: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/README.md`
- Test: `apps/desktop/src-tauri/src/lifecycle.rs` unit tests

- [ ] Define a Tauri application that serves the built Svelte app in production and proxies to the Svelte dev server in development.
- [ ] Expose commands `runtime_start`, `runtime_stop`, `runtime_readiness`, `runtime_data_dir`, and `dashboard_origin` with typed serializable responses and sanitized errors.
- [ ] Keep the shell thin: no provider selection, retry, response healing, or routing logic may be duplicated in Rust.
- [ ] Add unit tests for lifecycle state transitions and repeated start/stop calls.
- [ ] Run `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` and `bun --cwd apps/desktop run typecheck`.

### Task 2: Replace active desktop references with Tauri

**Files:**

- Modify: `apps/desktop/README.md`
- Modify: `docs/guides/SETUP_GUIDE.md`
- Modify: `docs/architecture/CODEBASE_DOCUMENTATION.md`
- Modify: `docs/architecture/REPOSITORY_MAP.md`
- Modify: `docs/adr/CODE_SIGNING.md`
- Modify: `package.json`
- Modify: `.github/copilot-instructions.md`
- Modify: `scripts/check/check-pr-test-policy.mjs`
- Modify: `scripts/audit/audit-sqlite-coupling.mjs`

- [ ] Add `tauri:dev`, `tauri:build`, and `tauri:smoke` scripts using the new app.
- [ ] Remove Electron/Electrobun from active setup and release instructions, replacing each with Tauri commands.
- [ ] Update source-root policy to include `apps/desktop/src-tauri` while retaining archived Electron policy for historical files.
- [ ] Add an explicit inactive-architecture note pointing to preserved Electron and Electrobun directories; do not delete files.
- [ ] Run repository documentation and symbol synchronization checks.

### Task 3: Add browser/Tauri parity fixtures

**Files:**

- Create: `apps/desktop/tests/parity-matrix.ts`
- Create: `apps/desktop/tests/desktop-smoke.test.ts`
- Create: `apps/web/src/lib/parity/workflows.ts`
- Create: `apps/web/src/lib/parity/workflows.test.ts`
- Modify: `apps/bff/src/routes/dashboard.ts`
- Modify: `apps/bff/src/routes/proxy.ts`

- [ ] Define shared workflow identifiers for login, provider setup, routing, streaming, health, resilience, settings, audit export, and recovery.
- [ ] Make the Svelte and Tauri tests consume the same fixture definitions and expected API contracts.
- [ ] Add a smoke harness that proves launch, readiness, dashboard rendering, and graceful shutdown.
- [ ] Run `bun --cwd apps/web test`, `bun --cwd apps/bff test`, and the desktop smoke suite.

### Task 4: Validate routing and response-healing parity

**Files:**

- Create: `tests/integration/desktop-routing-parity.test.ts`
- Create: `tests/integration/response-healing-matrix.test.ts`
- Modify: `docs/architecture/RESILIENCE_GUIDE.md`
- Modify: `docs/reference/RELAY_BACKEND_STRATEGY.md`
- Modify: `docs/traceability.md`

- [ ] Exercise provider failure, timeout, rate limit, quota exhaustion, malformed response, stream interruption, fallback, quality gate, and recovery paths through the public API.
- [ ] Assert bounded retries and no infinite fallback loops.
- [ ] Compare TypeScript relay and Bifrost fallback results for the same deterministic fixtures.
- [ ] Record test IDs and expected evidence locations in the parity matrix.

### Task 5: Make inactive desktop policy enforceable

**Files:**

- Create: `scripts/check/check-active-desktop.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/apps-quality.yml`
- Modify: `.github/workflows/cross-platform.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/dependabot.yml`

- [ ] Fail when active setup/release workflows reference Electron or Electrobun.
- [ ] Require Tauri source, config, capability, and smoke-test files to exist.
- [ ] Keep archived references allowed only under explicit historical paths.
- [ ] Add the check to local quality and hosted Apps Quality gates.

### Task 6: Restore machine-linked AgilePlus traceability

**Files:**

- Create: `.agileplus/tauri-active-desktop/meta.json`
- Create: `.agileplus/tauri-active-desktop/spec.md`
- Create: `.agileplus/tauri-active-desktop/plan.md`
- Create: `.agileplus/tauri-active-desktop/traceability.json`
- Modify: `docs/traceability.md`
- Modify: `docs/governance-audit-summary-2026-08.md`

- [ ] Record the approved intent, work packages, acceptance gates, exact files, and test commands.
- [ ] Link each gate to its eventual commit SHA and hosted run ID.
- [ ] Mark AgilePlus daemon status as unavailable until the canonical service is restored; do not synthesize live state from the SQLite file.
- [ ] Add a fallback ledger entry that makes the missing daemon an explicit blocker.

### Task 7: Prove release readiness and closeout

**Files:**

- Create: `docs/operations/tauri-release-runbook.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/ROUTING-CONVERGENCE-STATUS.md`
- Modify: `docs/operations/RUNBOOK.md`

- [ ] Run local parity, routing/healing, Svelte/Hono, Rust, documentation, and security checks.
- [ ] Open a focused PR, wait for all required hosted checks, and address bot/CI feedback.
- [ ] Validate a packaged Tauri artifact on macOS and record launch/readiness/shutdown evidence.
- [ ] Record upstream 53-commit disposition and final human acceptance.
- [ ] Declare idle only after the exact SHA has green required gates and no active owned backlog remains.
