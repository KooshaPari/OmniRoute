# Tier 2.7 — NVMS Firecracker Integration Test

**Target**: `nanovms/tests/integration/firecracker_test.go`  
**Depends**: `internal/adapters/firecracker/firecracker.go` (shipped, 179 lines)

## Gap

`internal/adapters/firecracker/firecracker.go` executes real Firecracker processes via `exec.Command`, but there is **no integration test** that actually creates a microVM end-to-end. The unit tests (if any) mock the command execution.

## Test plan

| Test name | What it validates | Commands |
|-----------|------------------|----------|
| `TestFirecrackerCreateVM` | Creates a minimal microVM (kernel+rootfs), pings the jailer PID | `firecracker --api-sock /tmp/firecracker.sock` |
| `TestFirecrackerExecCommand` | Runs a command inside the microVM, reads stdout | `echo "hello"` via jailer |
| `TestFirecrackerStopVM` | Sends SIGTERM, asserts process exits within 5s | `kill $PID` |

## Implementation approach

Two options:

### Option A: Real Firecracker (CI + Linux host required)
- Requires `firecracker` binary on `$PATH`
- Requires `sudo` for jailer + cgroup setup
- Runs only on Linux with KVM
- Cost: ~2 sessions

### Option B: Mock-based validation + optional real run (recommended)
- Wiremock the `jailer` process to assert command-line arguments
- On Linux+CI: run real Firecracker with `go test -tags=integration`
- On macOS: skip-real, validate only the command construction
- Cost: ~1 session

## Files to create

```bash
nanovms/tests/
├── integration/
│   ├── firecracker_test.go      # Option B mock + //go:build integration
│   ├── gvisor_test.go           # Same pattern for gVisor
│   └── setup_test.go            # Shared test helpers (socket dir, teardown)
├── mock/
│   └── jailer.go                # cmd.Run() intercept + argument assertion
└── TESTPLAN.md                  # Documentation
```

## Acceptance criteria

1. `go test ./tests/integration/ -tags=integration` starts a Firecracker microVM, runs a command, and stops it
2. `go test ./tests/integration/` (no tag) runs the mock-based validation only
3. CI workflow (`nvms-integration.yml`) runs with `-tags=integration` on Linux runners
4. All tests pass on macOS (mock path) and Linux (real path)
