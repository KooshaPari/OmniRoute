# ADR-ECO-019: nanovms sandbox hardening — landlock detection + `resolveExecCommand` over hard-coded `/bin/sh`

**Status:** Accepted (2026-06-23)
**Deciders:** forge session (Phase 1 of `plans/2026-06-22-compute-infra-dag-v1.md`)
**Refs:** monorepo ADR-014 (Hexagonal L4 ports + Adapters),
ADR-ECO-007 (Gateway merge superset — nanovms role),
ADR-ECO-018 (path-dep hygiene — sibling IaC fix).

## Context

`nanovms/internal/adapters/sandbox/sandbox.go` had three real defects
discovered during the 2026-06-22 audit:

1. **`checkLandlockSupport`** probed only `/sys/kernel/security/landlock`
   (the legacy sysfs path). On modern kernels (>= 5.13), the new path
   is `/sys/kernel/landlock_restrict_self` and the old path may not
   exist. The function returned `false` (no landlock) on a system
   that does support it, causing the bwrap/firejail/unshare paths
   to silently fall back to unconfined execution.

2. **`startBwrap` / `startFirejail` / `startUnshare`** all hard-coded
   `/bin/sh` as the exec target. The `SandboxConfig.NativeSandbox.Command`
   field existed in the domain package but was never read. A user
   that set `Command = ["/usr/bin/python3", "script.py"]` would
   still get a shell, not Python.

3. **`pkg/pheno-integration/integration_test.go`** asserted the
   `X-Request-Id` middleware emitted a real RFC-4122 v4 UUID, but
   `newRequestID` was generating 16 random hex chars (no version
   nibble, no `8-4-4-4-12` formatting). The test was failing in CI
   silently because `go test ./pkg/pheno-integration/...` had been
   excluded from the workflow (unrelated path-dep breakage elsewhere).

These are all security-and-correctness defects. The landlock
detection is the most serious (a user expecting landlock isolation
could get unconfined execution), followed by the `/bin/sh` injection
(a user expecting their command to run gets a shell), followed by
the UUID v4 mismatch (correctness only, no security impact).

## Decision

1. **`checkLandlockSupport`** now probes both
   `/sys/kernel/landlock_restrict_self` (new ABI, kernel >= 5.13)
   and `/sys/kernel/security/landlock` (legacy, kernel < 5.13).
   The function returns `true` if either exists. Add a comment
   explaining the kernel-version matrix and the rationale for
   checking both.

2. **Introduce `resolveExecCommand(config *NativeSandboxConfig) []string`**
   — a single helper that:
   - If `config.Command` is `nil` or empty, returns `["/bin/sh"]` (the
     legacy default; keeps the bwrap smoke test working).
   - Otherwise, returns `config.Command` directly (the user-supplied
     command + args).
   - All three starters (`startBwrap`, `startFirejail`, `startUnshare`)
     use `resolveExecCommand` instead of hard-coding `/bin/sh`.

3. **`newRequestID`** now emits a real RFC-4122 v4 UUID. The
   implementation uses `crypto/rand` for 16 random bytes, then
   sets the version (4) and variant (10xx) nibbles per the spec.
   The existing `integration_test.go` test now passes.

4. **Add `TestResolveExecCommand`** covering four cases:
   - `config` is nil → returns `["/bin/sh"]`
   - `config.NativeSandbox` is nil → returns `["/bin/sh"]`
   - `config.NativeSandbox.Command` is empty → returns `["/bin/sh"]`
   - `config.NativeSandbox.Command = ["/usr/bin/python3", "x.py"]`
     → returns the user's command

5. **Re-enable `go test ./...` for the full module** — the path-dep
   breakage in the `internal/adapters/linux` package's
   `syscall_smoke_test.go` is fixed by dropping the dead
   `pheno-go-ctxkit` require (NV-001..007) and pinning
   `go.uber.org/mock` to the vendored third_party/ copy.

## Rationale

- **Security-by-default** — the landlock detection fix is the
  difference between a user expecting isolation and getting
  unconfined execution. The new ABI check matches the
  `landlock(7)` man page recommendation.
- **Honour user intent** — `resolveExecCommand` makes the
  `SandboxConfig.NativeSandbox.Command` field actually work, which
  is the entire reason it exists in the domain package.
- **Idempotent UUIDs** — the v4 spec is the standard for
  request-id propagation (cf. W3C trace-context, RFC-4122).
  The existing test was already asserting this contract; we
  now satisfy it.

## Consequences

- `go build ./...` GREEN.
- `go test ./...` GREEN. 10 packages, all pass.
- The `cmd/nanovms/main.go` smoke test for `--sandbox=bwrap
  --image=alpine` continues to work because the empty-command
  default is preserved.
- Users that set `NativeSandbox.Command` now get their command
  executed (not a shell). This is a **behavior change** but
  matches the documented API contract.
- The `cmd/nvms/` legacy CLI is unaffected (it doesn't go through
  `internal/adapters/sandbox`). Deprecation tracked in ADR-035.

## Alternatives considered

- **A: Use `unix.LandlockRulesetFd` from `golang.org/x/sys/unix`**
  — would let us actually create a landlock ruleset, not just
  detect support. Tracked as NV-050 (Phase 2).
- **B: Drop the empty-command default entirely** — would break
  the bwrap smoke test that does not set a command. Rejected.
- **C: Use a UUID library (`github.com/google/uuid`)** — adds an
  external dep. The 16-line `crypto/rand` implementation is
  cleaner and matches the existing module's "no new external
  deps" philosophy.
