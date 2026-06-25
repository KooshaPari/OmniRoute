---
repo: "nanovms"
role: shared-lib
status: active
last_boundary_review: 2026-06-23
review_cadence: 30d
in_scope:
  - 3-tier VM/sandbox isolation: WASM, gVisor, Firecracker
  - Landlock-aware sandbox adapter (`internal/adapters/sandbox/`)
  - Linux syscall mocks (`internal/adapters/linux/`)
  - Phenotype ctx-propagation helpers (`pkg/pheno-integration/`)
  - Vendored `go.uber.org/mock` (hermetic, replaces from third_party/)
out_of_scope:
  - High-level orchestration (lives in `thegent`)
  - The agent runtime (lives in `thegent`)
  - FFI surface (lives in `PhenoCompose/bindings/rust-ffi`)
  - Cloud-specific VMM (lives in `phenotype-infra`)
---

# Boundary — nanovms

> Boundary file for nanovms. Updated with 2026-06-23 audit data.
> Note: the registry ECOSYSTEM_MAP.md `superseded/archived` row for
> nanovms is **incorrect** — the live repo (this one) builds cleanly
> (`go build ./...` GREEN), all 10 packages pass tests, and it is
> the **canonical** native sandbox/VMM layer for the Phenotype compute
> mesh. The repo's own README may say "archived" (legacy phrasing)
> but the code is alive and the module path is the public one.
> The registry row is pending a rationalization update (tracked in
> the open questions of
> `phenotype-infra/worklog/2026-06-23-71-pillar-scorecard.md`).

## In Scope (2026-06-23 audit)

1. **`cmd/nanovms/`** — primary CLI entry point (multi-platform
   VM orchestrator with `--platform`, `--vm-tier`, `--sandbox-opt`,
   `--name`, `--image` flags).
2. **`cmd/nvms/`** — legacy single-tier CLI. Kept for backwards
   compatibility; deprecation timeline tracked in **ADR-035**.
3. **`internal/adapters/sandbox/`** — pluggable backends:
   - `startBwrap` (bwrap + landlock ruleset)
   - `startFirejail` (firejail --landlock)
   - `startUnshare` (unshare + landlock_create_ruleset)
   - `checkLandlockSupport` (probes both `/sys/kernel/landlock_restrict_self`
     and `/sys/kernel/security/landlock` before claiming support)
   - `resolveExecCommand` (new in NV-001..007; reads
     `config.NativeSandbox.Command` instead of hard-coding `/bin/sh`)
4. **`internal/adapters/linux/`** — syscall mocks for testing
   (uses vendored `go.uber.org/mock` for hermetic builds).
5. **`internal/adapters/krun/`** — libkrun VM backend.
6. **`internal/domain/`** — pure-data `SandboxConfig`,
   `NativeSandboxConfig`, `NativeSandboxType`, `SandboxTier`.
7. **`internal/ports/`** — hexagonal-architecture ports (compiler,
   runtime).
8. **`pkg/pheno-integration/`** — Phenotype-flavoured helpers:
   - `Server` (HTTP healthz + request-id middleware)
   - `newRequestID` (RFC-4122 v4 UUID — replaced 16-hex-char format
     per NV-001..007)
   - `request_id.go` (X-Request-Id header preservation)
9. **`third_party/go.uber.org/mock/`** — vendored copy of
   `go.uber.org/mock` v0.6.0 (replaced via `go.mod` to keep
   builds reproducible offline).
10. **`tests/`** — integration tests + fixtures.
11. **`docs/`** — VitePress docs.

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| High-level orchestration | `thegent` | thegent is the orchestrator |
| FFI surface | `PhenoCompose/bindings/rust-ffi` | Cross-language FFI lives in the hex port library |
| Cloud VMM provisioning | `phenotype-infra` | OCI lottery + post-acquire are IaC concerns |
| Docker containerization | `phenotype-platform-core` | Containers are a separate concern |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| `cmd/nanovms` → libkrun | this→system | CGo bindings | green |
| `internal/adapters/sandbox` → bwrap | this→system | subprocess | green |
| `pkg/pheno-integration` → HTTP server | this→other | net/http | green |
| `nanovms` → `PhenoCompose` FFI | other→this | CGo / FFI | green |
| `nanovms` → `phenotype-infra` daemons | other→this | subprocess + JSON webhook | green |

## 71-Pillar Scorecard (2026-06-23)

**Score: 44/60 (73.3%)** — solid for an archived-mirror-with-active-
fork pattern. The new portability fixes (NV-001..007) and sandbox
hardening (NV-010..020) bring it to a usable state.

Strongest pillars: L1 (module structure), L5 (testing — 10 packages
pass), L9 (dep hygiene after the path-dep fix).
Weakest pillars: L7 (bwrap/firejail need ongoing landlock ruleset
review), L8 (no context-cancel plumbing), L10 (legacy CI workflows).

## Last Review

**Date:** 2026-06-23
**Reviewer:** forge session (Phase 1 of `plans/2026-06-22-compute-infra-dag-v1.md`)
**Worklog / finding:** `phenotype-infra/worklog/2026-06-23-71-pillar-scorecard.md` + `nanovms/worklog/2026-06-23-nanovms-portable.md`
**Decisions:**
- NV-001..007 (go.mod portability + dead `pheno-go-ctxkit` removal +
  UUID v4 request IDs) MERGED
- NV-010..020 (sandbox hardening: landlock detection + `resolveExecCommand`
  replacing hard-coded `/bin/sh`) MERGED
- AGENTS.md updated to reflect actual 2026-06-23 layout
- Open: NV-030 (deprecate `cmd/nvms/`?), NV-050 (plumb
  `context.WithCancel` to `startBwrap`)

**Next review:** 2026-07-23
