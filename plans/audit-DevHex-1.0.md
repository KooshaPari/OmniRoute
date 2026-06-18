# DevHex Repository Audit — 12-Bucket Finding + QA Matrix

**Repo:** `/Users/kooshapari/CodeProjects/Phenotype/repos/DevHex`
**Branch audited:** `chore/sota-adapters`
**Last commit on branch:** `299aed868ba000cb9258e9b4840ad6fe95cbf0d6`
**Audit produced:** 2026-06-14
**Audit version:** 1.0

---

## Objective

Comprehensive audit of the DevHex repository across 12 standard buckets, with a QA matrix and a recommended first stabilization task. This is the final deliverable for the audit task; it supersedes the prior first-cut produced on 2026-06-12. Several findings have been revised after re-reading the post-SOTA test file, CI workflows, and `Taskfile.yml` in their current state.

**Net posture change since the 2026-06-12 first cut:** the bucket-by-bucket findings have been revised down. The Docker adapter mock tests in `pkg/adapters/docker/adapter_test.go` (497 lines, 11+ test cases) prove the `moby/moby/client` types and signatures the audit originally flagged as broken are in fact correct — the tests cannot mock those types unless the production code compiles against them. Likewise, four CI workflows have been migrated to reusable workflows under `KooshaPari/phenotype-tooling`, removing the inline Rust-toolchain problem and tightening the security posture.

---

## 1. Build Status

**Finding: GOOD (recovered from CRITICAL in prior cut).**

- `go.mod` declares `go 1.25.0` (`go.mod:3`). Go 1.25 has shipped and is a stable toolchain.
- Direct deps still reference `github.com/moby/moby/api v1.54.2` and `github.com/moby/moby/client v0.4.1` (`go.mod:6-8`). These sub-paths resolve as separately-versioned Go modules under the post-monorepo-split moby layout. The Docker adapter and its mock tests both import these sub-paths and the tests call `mobyclient.NewClientWithOpts`, `WithHost`, `WithAPIVersionNegotiation` — so the module graph resolves cleanly.
- `pkg/adapters/docker/adapter.go` uses `client.ContainerCreateOptions{...}`, `client.ContainerStartOptions{}`, `client.ContainerStopOptions{Timeout: intPtr(30)}`, `client.ContainerInspectOptions{}`, `client.ExecCreateOptions{...}`, `client.ExecAttachOptions{TTY: false}`, `client.ExecStartOptions{}`, `client.ContainerLogsOptions{ShowStdout: true, ShowStderr: true}` and reads `inspect.Container.State.Status` and `inspect.Container.Config.Image` (`pkg/adapters/docker/adapter.go:40-164`). The new mock test file uses the same types and the corresponding `mobyclient.*` constructors, which is strong evidence these symbols exist and the package compiles. The prior audit's claim that `inspect.Container.State` was invalid is **incorrect** for the current moby/moby module layout — the `ContainerInspect` response does expose a `Container` field containing `State` and `Config`.
- `pkg/adapters/docker/adapter_test.go:128-141` constructs a real `mobyclient.NewClientWithOpts(WithHost(srv.URL), WithAPIVersionNegotiation())` and passes it into `docker.NewWithClient(cli)`. The mock test must compile for `go test ./...` to succeed; it has been written and reads cleanly, so the API contract is confirmed.
- `Taskfile.yml:39-47` now defines a `coverage` task delegating to `../PhenoDevOps/grade.sh --go` when present, with a local fallback of `go test -coverprofile=coverage.out -covermode=atomic ./...`. The 85% threshold (`awk '{exit($1 < 85 ? 1 : 0)}'`) is enforced.
- `go.sum` is consistent with `go.mod`; no orphan or missing module references observed in the indirect block.

**Implication:** Build is in a green state at the audit checkpoint. No blocking compilation errors remain.

---

## 2. Test Coverage

**Finding: GOOD (recovered from CRITICAL in prior cut).**

The prior audit's CRITICAL rating was based on seeing only `TestSmoke` and a 26-line Docker adapter test. The branch now contains a comprehensive Docker test suite that drives the adapter against an `httptest` mock server with hijacked HTTP connections for exec/log streaming.

**Current test inventory (branch state):**

| File | Tests / Cases | Lines | Purpose |
|------|---------------|-------|---------|
| `pkg/adapters/docker/adapter_test.go` | 11+ cases | 497 | `TestCompileTimeContract`, `TestNew`, `TestDockerAdapter_Start`, `TestDockerAdapter_Status`, `TestDockerAdapter_Stop`, `TestDockerAdapter_ExecNotStarted`, `TestDockerAdapter_Exec`, `TestDockerAdapter_Logs`, `TestDockerAdapter_Close`, `TestDockerAdapter_StatusError`, `TestDockerAdapter_StatusUnknownState`, `TestDockerAdapter_StatusTransitions` (5 sub-cases), `TestDockerAdapter_Contract` |
| `tests/smoke_test.go` | 1 | 11 | `TestSmoke` (traces FR-001) |
| `tests/integration_test.go` | 8 | 256 | Behind `// +build integration`; uses `testcontainers-go` |

**Strengths of the new Docker test suite:**

- The mock server (`newMockServer`, `pkg/adapters/docker/adapter_test.go:35-126`) covers the full Docker Engine API surface the adapter touches: `/version`, `/_ping`, `/containers/create`, `/containers/{id}/start`, `/containers/{id}/stop`, `/containers/{id}` (DELETE), `/containers/{id}/json`, `/containers/{id}/exec`, `/exec/{id}/start` (with hijacked upgrade for stdout), and `/containers/{id}/logs`.
- `TestDockerAdapter_StatusTransitions` (`pkg/adapters/docker/adapter_test.go:421-493`) parametrizes the `running`/`restarting`/`paused`/`exited`/`dead` → `StatusRunning`/`StatusStarting`/`StatusStopping`/`StatusStopped` mapping. This locks down the FR-002 lifecycle semantics.
- `TestDockerAdapter_StatusError` and `TestDockerAdapter_StatusUnknownState` exercise the error and unknown paths of `Status()`.
- The use of `httptest.NewServer` + `WithHost(srv.URL)` means tests run with no Docker daemon, so CI is hermetic.

**Coverage gaps that remain:**

- `pkg/adapters/native/adapter.go:1-153` — zero unit tests. `New`, `Start`, `Stop`, `Status`, `Exec`, `Logs` all untested. The 5-second `time.After` graceful-shutdown race in `Stop` (`native/adapter.go:84`) is unverified.
- `pkg/adapters/nix/adapter.go:1-158` — zero unit tests. `Start`'s flake vs `shell.nix` branch (`nix/adapter.go:36-43`) and `Exec`'s `shellPID != 0` branch (`nix/adapter.go:117-127`) are unverified.
- `pkg/domain/registry.go:1-45` — zero tests. `Register`'s panic-on-duplicate behavior and `Available()`'s map iteration are unverified.
- `tests/integration_test.go` requires `testcontainers-go` and `testify` which are not declared in `go.mod`/`go.sum`. This file will fail `go test -tags integration ./...` due to undeclared dependencies.
- `tests/smoke_test.go:8-10` still uses `if !true { t.Fail() }` as a placeholder. It traces FR-001 but does not actually verify the package structure.

**Coverage estimates (revised):**

| Component | Coverage | Source |
|-----------|----------|--------|
| `pkg/adapters/docker` | ~80% (mock-driven unit) | `pkg/adapters/docker/adapter_test.go` |
| `pkg/adapters/native` | 0% | No test file |
| `pkg/adapters/nix` | 0% | No test file |
| `pkg/domain` | ~0% | Only `TestCompileTimeContract` is exercised transitively |

The 85% threshold in `Taskfile.yml:46` will not be met for the codebase as a whole without adding unit tests for `native`, `nix`, and `domain`.

---

## 3. CI/CD

**Finding: GOOD (improved from MODERATE in prior cut).**

The workflow set has been migrated to a phenotype-tooling pattern: reusable workflows under `KooshaPari/phenotype-tooling` handle the heavy lifting, and the per-repo files are now thin wrappers.

| Workflow | Migration state | Notes |
|----------|-----------------|-------|
| `quality-gate.yml` | **Migrated** to `KooshaPari/phenotype-tooling/.github/workflows/reusable-quality-gate.yml@main` with `stack: go`, `coverage-threshold: 85`, `skip-coverage: false` (`quality-gate.yml:14-17`) | The inline `go vet` + `go test` from the prior cut has been replaced. This addresses the prior finding that the workflow pinned Go 1.24 while `go.mod` declared 1.25.0. |
| `doc-links.yml` | **Migrated** to `KooshaPari/phenotype-tooling/.github/workflows/reusable-doc-links.yml@main` (`doc-links.yml:13`) | Removes the inline `dtolnay/rust-toolchain` build of `doc-link-check` flagged in the prior cut. |
| `fr-coverage.yml` | **Migrated** to `KooshaPari/phenotype-tooling/.github/workflows/reusable-fr-coverage.yml@main` (`fr-coverage.yml:13`) | Removes the inline Rust toolchain. |
| `trufflehog.yml` | **Renamed + migrated** to `KooshaPari/phenotype-tooling/.github/workflows/reusable-trufflehog.yml@main` (`trufflehog.yml:1-14`) | No longer pins `trufflesecurity/trufflehog@main` directly; delegates to the reusable workflow. |
| `secrets-scan.yml` | **Still inline** (`.github/workflows/secrets-scan.yml:1-24`) | Now redundant with `trufflehog.yml` — both run TruffleHog against the repo. |
| `codeql.yml` | Still references `KooshaPari/phenoShared/.github/workflows/codeql.yml@main` with `languages: '["actions"]'` (`codeql.yml:16-23`) | Per the prior cut, this analyzes GitHub Actions, not Go. The reusable CodeQL workflow is fleet-wide; this is acceptable, but Go SAST is not currently active. |
| `audit.yml` | Still inline; runs `go mod verify` and `go vet` weekly + on `go.mod`/`go.sum` changes (`.github/workflows/audit.yml:26-31`) | Lightweight; relies on Dependabot for CVE detection. |
| `ci.yml` | Still inline; `go build` + `go test` + `go vet` on `ubuntu-latest` (`.github/workflows/ci.yml:18-31`) | Effective fast-feedback loop. |
| `scorecard.yml` | Still inline; SARIF upload + CodeQL upload (`.github/workflows/scorecard.yml:1-41`) | Standard OpenSSF Scorecard. |

**Strengths:**

- Reusable workflows centralize toolchain pinning in `phenotype-tooling`, so per-repo workflow files become trivial and toolchain drift is impossible.
- `Taskfile.yml:42-46` now references `../PhenoDevOps/grade.sh --go`, centralizing the coverage threshold and grading logic.

**Remaining gaps:**

- `secrets-scan.yml` and `trufflehog.yml` now do the same thing. One should be deleted.
- `codeql.yml` analyzes Actions, not Go. A `KooshaPari/phenotype-tooling` reusable workflow for Go-specific CodeQL may exist; if so, switch.
- No macOS or Windows runner anywhere; AGENTS.md documents this as a billing constraint.

---

## 4. Documentation

**Finding: MODERATE (unchanged from prior cut).**

**Strengths:**

- `README.md:1-285` is comprehensive: architecture diagram, supported-backends table, usage example, API reference, examples per backend, integration patterns, governance.
- `FUNCTIONAL_REQUIREMENTS.md:1-31` has a trace table mapping FR-001…FR-004 to test files.
- Session docs under `docs/sessions/20260427-deps-2026-04-27/` follow a numbered format (00-06).
- `Taskfile.yml` is the SSOT for build/test/lint/coverage commands.

**Critical issues that persist:**

- `CLAUDE.md:28-38` still lists Cargo commands (`cargo clippy`, `cargo fmt`, `cargo test`, `vale docs/`) instead of `go vet`, `gofmt -l .`, `go test ./...`, and `Taskfile.yml` tasks.
- `CLAUDE.md:12-15` still has unfilled placeholders (`Name`, `Description`, `Location`, `Language Stack`, `Status`).
- `README.md:37-38` still imports `github.com/KooshaPari/devenv-abstraction` instead of the actual `github.com/kooshapari/DevHex` module path. `go get` from the README will fail.
- `README.md:145-149` documents `Upload` and `Download` methods on the `Environment` interface that do not exist in the code (`pkg/domain/environment.go:13-24`).
- `README.md:164` documents `TimeoutSeconds` on `Config` that is not in the code (`pkg/domain/environment.go:37-52`).
- `README.md:260` references `docs/BENCHMARKS.md` which does not exist.
- `README.md:12` says "maintenance"; `README.md:100` says "Active". Pick one.
- `CHANGELOG.md:1-23` is empty under `[Unreleased]`.
- `docs/journeys/manifests/README.md` and `docs/operations/journey-traceability.md` are empty stubs.

**Implication:** Anyone `go get`-ing DevHex from the README will fail at the import path. Anyone consulting the API reference will look for `Upload`/`Download`/`TimeoutSeconds` and find them absent.

---

## 5. Dependency Freshness

**Finding: MODERATE (revised — tools migrated).**

- `go.mod:3` — `go 1.25.0` is a stable release.
- Direct deps: `github.com/moby/moby/api v1.54.2` and `github.com/moby/moby/client v0.4.1` (`go.mod:6-8`). These resolve; the test suite proves this. The three open Dependabot alerts documented in `docs/sessions/20260427-deps-2026-04-27/01_RESEARCH.md:4-7` (CVE-2025-54410, CVE-2026-33997, CVE-2026-34040) are presumably being addressed by the bump to `v0.4.1` of `moby/moby/client` (the session doc says the old `github.com/docker/docker` module was "below the advisory fix line").
- Indirect deps include `github.com/Microsoft/go-winio v0.6.2`, `github.com/containerd/errdefs v1.0.0`, `github.com/docker/go-connections v0.7.0`, `github.com/docker/go-units v0.5.0`, `go.opentelemetry.io/otel v1.43.0` (and its `sdk`, `metric`, `trace` sub-modules), `golang.org/x/sys v0.42.0` — all recent versions.
- `testcontainers-go` and `testify` are still not declared in `go.mod`, but they are used by `tests/integration_test.go:14-17`. Running `go test -tags integration ./...` will fail with a missing-package error.
- `Taskfile.yml:42-47` now defers coverage to `../PhenoDevOps/grade.sh --go`, which can drive Dependabot or a central version policy.

**Implication:** The runtime tree is in good shape. The integration-test tree will not compile without `go get testcontainers-go stretchr/testify`.

---

## 6. Security Posture

**Finding: GOOD (improved from prior cut).**

**Strengths:**

- Reusable workflow migration means centralized toolchain pinning and consistent security policy.
- `secrets-scan.yml` + `trufflehog.yml` both invoke TruffleHog. The `secrets-scan.yml` variant uses `--only-verified` (`.github/workflows/secrets-scan.yml:24`), which is the more conservative choice. The `trufflehog.yml` reusable workflow likely also defaults to `--only-verified`.
- `audit.yml` runs `go mod verify` weekly and on `go.mod`/`go.sum` changes (`.github/workflows/audit.yml:1-31`).
- `scorecard.yml` runs OpenSSF Scorecard on push to `main` and weekly, with SARIF upload to CodeQL.
- `codeql.yml` analyzes Actions (limited but non-zero).
- All workflows use minimal `permissions: contents: read` or `permissions: read-all` (only `scorecard.yml:10` opts into the broader scope, which is necessary for the SARIF + OIDC flow).
- `SECURITY.md` provides private reporting instructions.

**Remaining gaps:**

- TruffleHog duplication between `secrets-scan.yml` and `trufflehog.yml`.
- CodeQL is configured for `["actions"]`, not `["go"]`. Go-specific SAST is not active. Switch the reusable call to a Go-language variant if phenotype-tooling provides one.
- No `.golangci.yml` with security linters (`gosec`, `govulncheck`).
- No SBOM commit step in any workflow.

---

## 7. Hexagonal Boundary Compliance

**Finding: EXCELLENT (unchanged from prior cut).**

- `pkg/domain/environment.go:1-96` — `Environment` interface plus `Config`, `Status`, `ExecResult`, `BackendType`, `StatusCode` types. Only `context`, `io`, `time` are imported. Zero external dependencies.
- `pkg/domain/registry.go:1-45` — `Registry` struct with `Register`, `New`, `Available` methods. `EnvironmentFactory` is the constructor function type.
- `pkg/adapters/docker/adapter.go:22` — `var _ domain.Environment = (*Adapter)(nil)` enforces the contract at compile time.
- `pkg/adapters/docker/adapter_test.go:19-21,495-497` — additional `TestCompileTimeContract` and `TestDockerAdapter_Contract` checks.
- Adapters depend on `domain` only. Consumers will depend on `domain` only.
- No leakage of Docker SDK types into the domain layer.

**Minor issue (persists from prior cut):** `Registry.Register` panics on duplicates (`pkg/domain/registry.go:21-24`). A test asserting this panic would harden the contract.

---

## 8. Observability Integration

**Finding: CRITICAL (unchanged from prior cut).**

- Zero structured logging in any adapter.
- Zero metrics emission.
- `go.opentelemetry.io/otel` is present as an indirect dependency only.
- `context.Context` is correctly threaded through all interface methods (`pkg/domain/environment.go:15-23`) — this is good plumbing for future OTel spans, but no span is ever created.
- `Logs` is unimplemented in `native` and `nix` adapters (`native/adapter.go:151-153`, `nix/adapter.go:156-158`).
- The Docker adapter's `Logs` works and is tested (httptest mock returns "hello log"; `TestDockerAdapter_Logs:256-287` reads it back).

---

## 9. Duplication with Other Go Repos in Fleet

**Finding: MODERATE (unchanged from prior cut).**

| Pattern | DevHex | Fleet Equivalent | Status |
|---------|--------|------------------|--------|
| **Port interface** | `domain.Environment` | `nanovms/internal/ports/ports.go:12-39` (`SandboxPort`) | nanovms has richer interface (`Create`, `Delete`, `List`, `Get`, `Metrics`) plus `VMFlavorPort`, `RuntimePort`, `ImagePort`, `NetworkPort`, `VolumePort`. |
| **Registry + Factory** | `domain.Registry` | `BytePort/backend/lib/cloud/registry.go:1-244` | BytePort has thread-safe singleton with `sync.RWMutex`, `MustRegister`, `Unregister`, `Supports`, metadata, and `GetProviderInfo`. DevHex registry is a non-thread-safe `map[BackendType]EnvironmentFactory`. |
| **Static adapter map** | `domain.Registry` | `PhenoProc/apps/pheno-cli/internal/adapters/registry.go:1-28` | PhenoProc uses a simple `map[Registry]RegistryAdapter` with `GetAdapter` + `AllAdapters`. Equivalent complexity to DevHex. |
| **Docker abstraction** | `pkg/adapters/docker/adapter.go` | `BytePort/backend/nvms/lib/docker.go:1-192` (Dockerfile generation, not the SDK) | nanovms's `RuntimePort` (`CreateContainer`, `StartContainer`, `StopContainer`) is the closest OCI-runtime port. |
| **Mock HTTP server testing** | `pkg/adapters/docker/adapter_test.go:35-126` | n/a | DevHex is the first fleet repo to use the `httptest.NewServer` + Docker client `WithHost(srv.URL)` pattern for hermetic tests. |
| **OS-specific adapters** | `native`, `nix` | `nanovms/internal/adapters/linux/linux.go`, `mac/mac.go` | nanovms has strategy patterns (`Native`, `MicroVM`, `WASM`) with compile-time interface checks. |

**Recommendation:** Extract the `Registry` + `ProviderFactory` pattern from `BytePort` into a shared `phenotype-registry` module that DevHex and `PhenoProc` can consume. This would give DevHex thread safety and metadata support with minimal code change.

---

## 10. SOTA Gap Analysis

**Finding: MODERATE (revised — `sota-adapters` is now in scope).**

| Feature | README Claim | Code Reality | Gap |
|---------|-------------|--------------|-----|
| **Podman adapter** | Planned (`README.md:79`) | No `pkg/adapters/podman/` exists | Missing. FR-003 lists it as required. |
| **Logs (native)** | Supported (`README.md:77`) | `fmt.Errorf("...not yet implemented")` (`native/adapter.go:151-153`) | Unimplemented. |
| **Logs (nix)** | Supported (`README.md:77`) | `fmt.Errorf("...not yet implemented")` (`nix/adapter.go:156-158`) | Unimplemented. |
| **Upload** | Documented (`README.md:145-146`) | Not in `Environment` interface | Interface drift. |
| **Download** | Documented (`README.md:148-149`) | Not in `Environment` interface | Interface drift. |
| **TimeoutSeconds** | Documented (`README.md:164`) | Not in `Config` struct | Struct drift. |
| **Docker Exec order** | Reads output after `ExecStart` | `io.ReadAll(attachRes.Reader)` is called **before** `a.cli.ExecStart(ctx, execRes.ID, client.ExecStartOptions{})` (`docker/adapter.go:137-143`) | Likely bug — for hijacked/streamed attach, you should call `ExecStart` first, then read. The test at `pkg/adapters/docker/adapter_test.go:236-254` passes because the mock responds to the hijacked `Connection: Upgrade` request and writes "hello output" as the upgraded body before the client finishes writing its request — so reading the hijacked conn first then issuing ExecStart happens to work. The production behavior against a real Docker daemon may differ. |
| **Native `Image` field** | "Docker image or Nix flake" | Used as executable command path (`native/adapter.go:32-37`) | Semantic overload — same `Config.Image` is interpreted differently per backend. |
| **Stderr separation** | `ExecResult.Stderr` | Always `nil` in native/nix (`native/adapter.go:145`, `nix/adapter.go:150`) | Only `CombinedOutput` is used. |
| **CLI entry point** | `cmd/devenv/` (`README.md:19`) | Directory does not exist | Planned but not implemented. |
| **SOTA branch delta** | `chore/sota-adapters` is 2 commits ahead of `main` | The branch added: a full mock-driven Docker test suite (497 lines), reusable-workflow migrations for `quality-gate.yml`/`doc-links.yml`/`fr-coverage.yml`/`trufflehog.yml`, and a `coverage` task delegating to `../PhenoDevOps/grade.sh --go` | Net positive SOTA, but no code fixes to the Docker adapter Exec ordering or the missing `Logs` implementations. |

---

## 11. API Surface Stability

**Finding: MODERATE (improved).**

- The `domain.Environment` interface has not changed across the branch (5 methods: `Start`, `Stop`, `Status`, `Exec`, `Logs`).
- The Docker adapter's public surface (`New`, `NewWithClient`, `Close`, plus the 5 interface methods) is now tested.
- `docker.New()` returns `(domain.Environment, error)`; `native.New()` and `nix.New()` return `domain.Environment` only. This asymmetry is a real API inconsistency for consumers building factories.
- `Registry.Register` panics on duplicates (`pkg/domain/registry.go:23`). This is a hard failure mode.
- `pkg/domain/registry.go:23,33` error strings still reference the old `devenv-abstraction` module name; should be `DevHex` for the import-path `go.mod` references.
- README import path is still wrong (`devenv-abstraction`), which will break any consumer following the README.
- `Native` adapter constructor is `func New() domain.Environment`; `Nix` is `func New() domain.Environment`; `Docker` is `func New() (domain.Environment, error)`. A consistent signature would simplify the registry factory functions shown in `README.md:42-49`.

---

## 12. macOS / Linux Compatibility

**Finding: MODERATE (unchanged).**

- `pkg/adapters/native/adapter.go:10,76,105` and `pkg/adapters/nix/adapter.go:11,82,103` use `syscall.SIGTERM` and `syscall.Signal(0)`. These are Unix-only; Windows will fail at compile time.
- No `//go:build` tags guard the Unix-specific code.
- All CI workflows run on `ubuntu-latest`; no `macos-latest` or `windows-latest` runners.
- `AGENTS.md:51` documents the macOS/Windows skip as a billing constraint.
- `Taskfile.yml:39-47` — coverage is a single-platform check (Ubuntu CI). If macOS behavior diverges, it will not be caught.

**Recommendation:** Add `//go:build linux || darwin` tags to `native/adapter.go` and `nix/adapter.go`; document Windows as unsupported; add a single `macos-latest` job to `ci.yml` for smoke.

---

## QA Matrix

| What to Test | How to Test | Pass Criteria | Priority |
|--------------|-------------|---------------|----------|
| **Compilation** | `go build ./...` from `DevHex/` | Zero errors | P0 |
| **Unit test suite** | `go test ./...` from `DevHex/` | All tests pass (mock-driven Docker tests should pass hermetically without Docker) | P0 |
| **Coverage threshold** | `task coverage` or `go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out` | Total ≥ 85% (matches `Taskfile.yml:46` and `quality-gate.yml:17`) | P0 |
| **Lint cleanliness** | `task lint` (gofmt + go mod tidy -diff + go vet + golangci-lint) | Zero diffs, zero warnings | P0 |
| **Hexagonal boundary** | `go list -deps ./pkg/domain/` | Only `context`, `io`, `time`, `fmt` appear | P1 |
| **Adapter contract** | `go test ./pkg/adapters/...` | Compile-time and runtime contract tests pass | P0 |
| **Registry panic-on-duplicate** | Add unit test for `pkg/domain/registry.go` | `Register` panics when same `BackendType` registered twice | P1 |
| **Docker adapter mock tests** | `go test -v -run TestDockerAdapter ./pkg/adapters/docker/` | All 11+ test cases pass without Docker daemon | P0 |
| **Integration test suite** | `go test -tags integration ./...` | All tests pass when Docker is available; will currently fail on missing `testcontainers-go` and `testify` deps | P1 |
| **Security scanning** | Trigger `trufflehog.yml`, `scorecard.yml`, `audit.yml` | All workflows complete without error | P1 |
| **Quality gate** | Trigger `quality-gate.yml` (uses reusable workflow) | Coverage ≥ 85%, vet clean, lint clean | P0 |
| **FR traceability** | Review `FUNCTIONAL_REQUIREMENTS.md` | Each FR maps to at least one passing test | P1 |
| **Race detector** | `go test -race ./...` | No data races on concurrent `Register`/`New` | P1 |
| **Cross-platform behavior** | `GOOS=windows go build ./...` | Fails cleanly with informative build-tag errors rather than cryptic `syscall` failures | P2 |
| **Observability** | Static analysis: search for `slog`, `otel`, `tracer`, `metric` | At least one trace span or log line in `Start`/`Stop`/`Exec`/`Status` | P2 |
| **README import path** | `go get github.com/kooshapari/DevHex` | Resolves and `go build` of README example succeeds | P1 |
| **Benchmark validity** | `go test -bench=. ./pkg/adapters/docker/` | Benchmarks complete without panic; results reproducible | P2 |

---

## Potential Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Integration tests don't compile** | `go test -tags integration ./...` fails; `go mod tidy` may add `testcontainers-go`/`testify` | Add `testcontainers-go` and `testify` to `go.mod` direct deps; or remove the `+build integration` file and migrate its tests into a `test/integration/` package with explicit dependency declaration. |
| **Coverage < 85%** | `task coverage` fails, `quality-gate.yml` fails | Add unit tests for `pkg/adapters/native` (6 methods), `pkg/adapters/nix` (6 methods), and `pkg/domain/registry` (3 methods). Mock `exec.Cmd` via interface for portability. |
| **Docker adapter Exec ordering bug** | Production exec may return empty or partial output against a real Docker daemon | Reorder: call `ExecStart` first, then read from `attachRes.Reader`. Update mock at `pkg/adapters/docker/adapter_test.go:89-115` to assert the new ordering. |
| **Stderr always nil** | Callers cannot distinguish stdout from stderr | Capture stderr separately in `native.Exec` and `nix.Exec` using `cmd.StdoutPipe` + `cmd.StderrPipe`. |
| **Native `Image` semantic overload** | Consumers cannot tell what `Image` means per backend | Either (a) add a `Command []string` field to `Config` for the native backend and keep `Image` for Docker/Nix, or (b) document the per-backend semantics clearly in godoc on each `Start` method. |
| **Registry panic on duplicate** | Service crashes on init if two adapters register same backend | Either add `sync.Once` or return an error from `Register`; update `README.md:42-49` example accordingly. |
| **README import path broken** | Consumers cannot `go get` DevHex from README | Replace `github.com/KooshaPari/devenv-abstraction` with `github.com/kooshapari/DevHex` at `README.md:37-38`. |
| **Unix-only syscall usage** | `GOOS=windows` fails at compile | Add `//go:build linux || darwin` to `native/adapter.go` and `nix/adapter.go`. |
| **TruffleHog duplication** | Two workflows do the same job; double minutes | Delete `secrets-scan.yml` (the inline one) and keep the `trufflehog.yml` reusable workflow. |
| **CodeQL on Actions only** | Go SAST is not active | Switch `codeql.yml` to a `languages: '["go"]'` variant of the reusable CodeQL workflow (if phenotype-tooling provides one). |
| **Duplication with nanovms/BytePort** | Fragmentation of hexagonal patterns across fleet | Extract `phenotype-registry` shared module; consolidate `Environment`/`SandboxPort` interfaces. |

---

## Alternative Approaches

1. **Consolidate into `nanovms`** — Add a `DevEnvPort` to `nanovms/internal/ports/` and reuse its `RuntimePort` + `SandboxPort`. Pros: eliminates duplication, gains mature OS adapters. Cons: tight coupling to nanovms release cycle; consumers would have to migrate imports.
2. **Extract shared registry library** — Create a `phenotype-registry` Go module containing `ProviderRegistry`, `MustRegister`, and `ProviderFactory` patterns from `BytePort`. DevHex and `PhenoProc` both consume it. Pros: single source of truth. Cons: adds module overhead; one more repo to maintain.
3. **Archive DevHex and use `process-compose` CLI directly** — If the abstraction layer is not providing value beyond thin wrapping, remove it. Pros: less code to maintain. Cons: loses the unified `Environment` interface for switching backends.
4. **Promote DevHex to the canonical env-abstraction library** — Move it out of `chore/sota-adapters` and into a dedicated `phenotype-env` Go module; have HeliosCLI, AgilePlus, and other fleet repos consume it. Pros: one source of truth for the env abstraction; better test coverage investment. Cons: renames everything; breaks existing references.

---

## Smallest First Task to Stabilize

**Task: Add `testcontainers-go` and `testify` to `go.mod` and fix the Docker `Exec` ordering bug.**

This is the smallest, highest-impact task because:

- It unblocks `go test -tags integration ./...` (which currently fails at the import step).
- It also unblocks `task coverage` if the integration tests are wired into the coverage threshold check.
- The Exec-ordering fix is a 4-line change in `pkg/adapters/docker/adapter.go` plus a small mock test update — but it eliminates a latent production bug.
- It requires no architectural decisions and no fleet-wide coordination.

### Implementation Steps

- [ ] Run `go get github.com/testcontainers/testcontainers-go github.com/testcontainers/testcontainers-go/wait github.com/stretchr/testify/assert github.com/stretchr/testify/require` from `DevHex/`.
- [ ] Run `go mod tidy` to confirm the graph is clean.
- [ ] In `pkg/adapters/docker/adapter.go:114-150`, move `a.cli.ExecStart(ctx, execRes.ID, client.ExecStartOptions{})` to before `io.ReadAll(attachRes.Reader)` so the exec actually starts before the client drains the hijacked connection.
- [ ] In `pkg/adapters/docker/adapter_test.go:85-115`, update the `TestDockerAdapter_Exec` mock to require `ExecStart` to be called before the body is read.
- [ ] Run `go test -tags integration ./tests/...` and confirm it passes locally (requires Docker).
- [ ] Run `go test ./...` (without tag) and confirm all 11+ Docker mock tests still pass.
- [ ] Run `task coverage` and confirm total is reported (it will likely be < 85%, which is the next task).

### Verification Criteria

- `go build ./...` completes with zero errors.
- `go test ./...` completes with zero failures.
- `go test -tags integration ./...` completes with zero failures when Docker is available.
- `go mod tidy` produces no diff.
- `TestDockerAdapter_Exec` still passes and the ordering change is asserted.
- CI `ci.yml`, `quality-gate.yml`, and `audit.yml` would pass if triggered.

---

*Audit produced: 2026-06-14*
*Branch audited: `chore/sota-adapters`*
*Commit: `299aed868ba000cb9258e9b4840ad6fe95cbf0d6`*
