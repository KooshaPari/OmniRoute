# NVMS Service — Spec & Architecture Plan

**Phase 1b of BytePort Evolution — companion service to `byteport-engine` NVMS adapter.**

| Field                | Value                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Spec version         | v1 (2026-07-06)                                                                                   |
| Status               | Draft → Review                                                                                    |
| Owner                | BytePort backend team                                                                             |
| Repo target          | `nanovms` (or new sibling `nvms-service` if scope warrants split)                                 |
| Companion            | `BytePort/crates/byteport-engine/src/adapters/nvms/http.rs`                                       |
| Spec source-of-truth | [`plans/2026-07-04-byteport-evolution-v1.md`](plans/2026-07-04-byteport-evolution-v1.md) Phase 1b |

---

## 1. Purpose & Scope

### 1.1 Problem

`byteport-engine` (Rust control plane) cannot directly invoke Firecracker / gVisor /
Wasmtime to run a user workload. Three problems block this:

1. **Kernel access.** Rust compiled for the `byteport` host user does not have
   permissions to invoke `KVM_CREATE_VM`, mount namespaces, or load kernel modules.
2. **Privilege boundary.** Running workloads in-process with the control plane
   collapses the blast radius of a bug or exploit.
3. **Wasmtime runtime.** The BytePort control plane should not bundle a 15 MB
   Wasmtime runtime; it belongs in a dedicated sandbox service.

### 1.2 Solution

**NVMS** = **NanoVM Service**. A long-running Go daemon (the
`cmd/nanovms/main.go` binary, extended with an HTTP front) that:

- Owns the privileged operations (KVM, mount, unshare, seccomp, landlock).
- Exposes a JSON-over-HTTP control plane on a UDS socket.
- Is invoked by `byteport-engine` (Rust) over the UDS — no TCP loopback.

### 1.3 Non-Goals

- ❌ Replacing Firecracker / gVisor — NVMS **calls into** them via `nanovms/internal/ports`.
- ❌ Becoming an orchestrator — that's `byteport-engine`'s job.
- ❌ WebSocket / streaming responses — JSON request/response only in v1;
  v2 can add NDJSON streaming for `Logs(follow=true)`.

---

## 2. Why Go (not Rust)

ADR-032 says **Rust > Go > Zig > Mojo** for optimality, but the
existing `nanovms/` codebase is **Go** (3,900+ LOC, established
domain model, ports). Re-implementing in Rust would be:

- A 3-month rewrite of `internal/domain/sandbox.go`, `internal/ports/`,
  all adapters (`lima`, `bwrap`, `gvisor`, `firecracker`, `seccomp`, etc.).
- A new async runtime split (tokio vs goroutines).
- A new error-handling split (`Result<T,E>` vs `(T, error)`).

**Decision:** NVMS stays **Go** in v1. The polyglot binding tier is
**T2 UDS RPC** — fast local IPC, zero network code, zero
serialization cost beyond JSON. ADR-032's `nmemory-rust/tokn`
substrate references `nanovms` as the canonical Go VM/sandbox layer.

If/when `nanovms/` is rewritten in Rust (a 12-month project tracked
separately), the NVMS service just re-binds to the new binary. The
Rust `byteport-engine` adapter does not need to change because the
JSON-over-HTTP contract is the abstraction boundary.

---

## 3. Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  BytePort control plane (Rust)                                │
│                                                               │
│  ┌─────────────────┐                                          │
│  │ byteport-engine │   POST /v1/sandboxes                     │
│  │  (Rust)         ├──────────────────────────────┐           │
│  │                 │  $XDG_RUNTIME_DIR/byteport/  │           │
│  │  T2 UDS RPC     │  nvms.sock                   │           │
│  └─────────────────┘                              │           │
└────────────────────────────────────────────────┼───────────┘
                                                 │
                                                 │  HTTP/1.1 over UDS
                                                 │  (net.Dial("unix", ...))
                                                 ▼
┌───────────────────────────────────────────────────────────────┐
│  NVMS service (Go)                                            │
│                                                               │
│  ┌─────────────────┐                                          │
│  │ cmd/nanovms/    │   HTTP router                            │
│  │  main.go (new)  │   (chi / gorilla/mux)                    │
│  └────────┬────────┘                                          │
│           │                                                   │
│  ┌────────▼────────┐                                          │
│  │ internal/api/   │   JSON handlers                          │
│  │  (new pkg)      │   maps HTTP → SandboxPort                │
│  └────────┬────────┘                                          │
│           │                                                   │
│  ┌────────▼────────┐                                          │
│  │ internal/ports  │   SandboxPort, VMFlavorPort,             │
│  │  (existing)     │   SandboxIsolationPort, ImagePort        │
│  └────────┬────────┘                                          │
│           │                                                   │
│  ┌────────▼────────┐                                          │
│  │ internal/adapters│  lima, bwrap, firecracker, gvisor,     │
│  │  (existing)      │  seccomp, landlock, sandbox-exec        │
│  └────────┬────────┘                                          │
│           │                                                   │
│           ▼                                                   │
│  ┌──────────────────────────────────────────┐                │
│  │  Kernel: KVM_CREATE_VM, mount,           │                │
│  │  unshare(CLONE_NEWUSER), seccomp(2),     │                │
│  │  landlock_create_ruleset, sandbox-exec   │                │
│  └──────────────────────────────────────────┘                │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Wire Protocol — JSON over UDS

The HTTP server listens on `$XDG_RUNTIME_DIR/byteport/nvms.sock`
(default). Port 80/TCP is **never** used — UDS only, for two reasons:

1. **Privilege.** UDS respects filesystem ACLs (`chmod 0660`,
   `chown root:byteport`); TCP would require a network firewall.
2. **Performance.** UDS avoids the kernel TCP stack entirely. With
   `unix(7)` on Linux 5.10+, JSON-over-UDS is ~3× faster than
   JSON-over-loopback.

### 4.1 Endpoints (v1)

| Method   | Path                         | Maps to port method        | Notes                             |
| -------- | ---------------------------- | -------------------------- | --------------------------------- |
| `POST`   | `/v1/sandboxes`              | `SandboxPort.Create`       | Body: `SandboxConfig` JSON        |
| `POST`   | `/v1/sandboxes/{id}/start`   | `SandboxPort.Start`        | Empty body                        |
| `POST`   | `/v1/sandboxes/{id}/stop`    | `SandboxPort.Stop`         | Body: `{ "force": bool }`         |
| `DELETE` | `/v1/sandboxes/{id}`         | `SandboxPort.Delete`       | Empty body                        |
| `GET`    | `/v1/sandboxes`              | `SandboxPort.List`         | Returns `[]Sandbox`               |
| `GET`    | `/v1/sandboxes/{id}`         | `SandboxPort.Get`          | Returns `Sandbox`                 |
| `GET`    | `/v1/sandboxes/{id}/logs`    | `SandboxPort.Logs(follow)` | v2: NDJSON streaming              |
| `POST`   | `/v1/sandboxes/{id}/exec`    | `SandboxPort.Exec`         | Body: `{"cmd": ["sh","-c","ls"]}` |
| `GET`    | `/v1/sandboxes/{id}/metrics` | `SandboxPort.Metrics`      | Returns `SandboxMetrics`          |
| `GET`    | `/healthz`                   | (no port)                  | Liveness probe                    |
| `GET`    | `/readyz`                    | (no port)                  | Readiness: ports.IsAvailable()    |

### 4.2 Headers

| Header                  | Required | Example                                                              |
| ----------------------- | -------- | -------------------------------------------------------------------- |
| `Authorization`         | yes      | `Bearer nvms-7e4d…` (NVMS issues its own short-lived token at start) |
| `Content-Type`          | for POST | `application/json`                                                   |
| `X-BytePort-Request-Id` | optional | UUID for log correlation                                             |

### 4.3 Error model

```json
{
  "error": {
    "code": "sandbox_not_found",
    "message": "no sandbox with id sb-9d3e",
    "details": { "sandbox_id": "sb-9d3e" }
  }
}
```

Error codes follow the existing `nanovms` convention
(`sandbox_not_found`, `image_pull_failed`, `vm_create_failed`,
`permission_denied`, `unsupported_platform`, `internal`).

### 4.4 Example: Create a Firecracker microVM

```bash
curl --unix-socket $XDG_RUNTIME_DIR/byteport/nvms.sock \
  -H 'Authorization: Bearer nvms-7e4d…' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "hello-world",
    "image": "ghcr.io/byteport/hello-world:latest",
    "vm_type": "microvm",
    "sandbox_type": "vm",
    "resources": { "cpu": 2, "memory": 512, "disk": 1024 },
    "network": { "type": "nat", "ports": [{"host_port": 8080, "container_port": 80, "protocol": "tcp"}] }
  }' \
  http://localhost/v1/sandboxes
```

Returns `201 Created`:

```json
{
  "id": "sb-9d3e",
  "name": "hello-world",
  "status": "pending",
  "vm_flavor": "microvm",
  "type": "vm",
  "ip_address": "",
  "ports": [{ "host_port": 8080, "container_port": 80, "protocol": "tcp" }],
  "created_at": "2026-07-06T12:34:56Z"
}
```

---

## 5. Process Model

### 5.1 Launch

The NVMS service is launched by **systemd** (Linux) or `launchd` (macOS)
under a dedicated `nvms` user with the following caps:

- `CAP_SYS_ADMIN` (mount, unshare)
- `CAP_NET_ADMIN` (bridge/veth)
- `CAP_KVM` (Firecracker)
- `CAP_SYS_PTRACE` (gVisor runsc)

The systemd unit:

```ini
[Unit]
Description=NVMS — BytePort sandbox daemon
After=network.target

[Service]
Type=simple
User=nvms
Group=nvms,byteport
ExecStart=/usr/local/bin/nanovms serve --listen=$XDG_RUNTIME_DIR/byteport/nvms.sock
Restart=on-failure
RestartSec=5s
AmbientCapabilities=CAP_SYS_ADMIN CAP_NET_ADMIN CAP_KVM CAP_SYS_PTRACE
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=/var/lib/byteport

[Install]
WantedBy=multi-user.target
```

### 5.2 Lifecycle

```
   ┌─────────┐
   │  serve  │  (foreground, sigterm-aware)
   └────┬────┘
        │
   ┌────▼─────────────────────┐
   │ load config             │
   │ start HTTP server (UDS) │     /healthz returns 200 immediately
   │ announce readiness      │     /readyz returns 200 once
   │                         │     SandboxPort.IsAvailable passes
   │ accept connections      │
   │   ↓                     │
   │  router                 │
   │   ↓                     │
   │  port handler           │
   │   ↓                     │
   │  adapter                │
   │   ↓                     │
   │  kernel call            │
   └─────────────────────────┘
```

Graceful shutdown: `SIGTERM` → stop accepting new connections, drain
in-flight requests (max 30s), close UDS, exit 0. `SIGINT` = same.

### 5.3 Concurrency

- One goroutine per HTTP request (Go net/http standard).
- Adapter calls are blocking; per-adapter timeouts are 30s by default,
  configurable via `NanovmsConfig.AdapterTimeoutMs`.
- No background goroutines except the UDS accept loop. (`Logs(follow=true)`
  is the only streaming path and is deferred to v2.)

---

## 6. Configuration

NVMS reads `~/.config/nanovms/config.yaml` (XDG) or
`/etc/nanovms/config.yaml` (system):

```yaml
listen:
  socket: "$XDG_RUNTIME_DIR/byteport/nvms.sock"
  mode: 0660

auth:
  # NVMS issues a token at startup, printed to stdout AND placed in
  # /etc/byteport/nvms.token (mode 0440, group byteport).
  token_ttl: "24h"

adapters:
  timeout_ms: 30000
  preferred:
    macos: ["sandbox-exec"]
    linux: ["microvm", "gvisor", "bwrap"]
    windows: ["wsl"]

logging:
  level: info
  format: json # json | text

limits:
  max_concurrent_sandboxes: 64
  max_cpu_per_sandbox: 8
  max_memory_per_sandbox_mb: 16384
```

### 6.1 Env-var overrides

| Env                   | Overrides                         |
| --------------------- | --------------------------------- |
| `NVMS_LISTEN_SOCKET`  | `listen.socket`                   |
| `NVMS_LOG_LEVEL`      | `logging.level`                   |
| `NVMS_MAX_CONCURRENT` | `limits.max_concurrent_sandboxes` |

---

## 7. Security Model

### 7.1 Trust boundary

The BytePort control plane (Rust) is **untrusted by NVMS**. Every
request is authenticated via the NVMS-issued bearer token. The token
is rotated every 24 hours and replaced atomically (new file + rename).

### 7.2 Capability surface

NVMS **only** does what its adapters allow. The `bwrap` adapter
cannot create a KVM-backed VM; the `microvm` adapter cannot mount
arbitrary host paths. Each adapter declares its capability set in
`internal/adapters/<name>/capabilities.go`.

### 7.3 Audit log

Every API call is logged to `~/.local/share/nanovms/audit.jsonl` with:

```json
{
  "ts": "...",
  "request_id": "...",
  "method": "POST",
  "path": "/v1/sandboxes",
  "actor": "byteport-engine",
  "status": 201,
  "duration_ms": 42,
  "sandbox_id": "sb-9d3e"
}
```

`actor` is derived from the bearer token's `sub` claim.

### 7.4 No network egress

NVMS binds to a UDS only — `socket.Listen("tcp", ...)` is **never**
called. A linter rule in `internal/api` forbids `net.Listen` outside
the `internal/listen/` package.

---

## 8. File Layout

```
nanovms/                                  # existing Go repo (root)
├── cmd/
│   ├── nanovms/
│   │   ├── main.go                       # existing CLI — add `serve` subcommand
│   │   └── serve.go                      # NEW: HTTP server entrypoint
│   └── nvms/                             # existing — keep as-is
├── internal/
│   ├── domain/                           # existing — no changes
│   ├── ports/                            # existing — no changes
│   ├── adapters/                         # existing — no changes
│   ├── api/                              # NEW pkg
│   │   ├── router.go                     # chi router
│   │   ├── sandboxes.go                  # /v1/sandboxes* handlers
│   │   ├── errors.go                     # JSON error model
│   │   ├── auth.go                       # bearer token middleware
│   │   ├── request_id.go                 # X-BytePort-Request-Id middleware
│   │   ├── audit.go                      # audit.jsonl writer
│   │   └── *_test.go                     # 12+ handler tests
│   ├── listen/
│   │   └── uds.go                        # UDS-only listener (forbids net.Listen)
│   └── token/
│       ├── token.go                      # NVMS token issuance + rotation
│       └── token_test.go
├── docs/
│   ├── nvms-service.md                   # NEW: operator guide
│   └── api/nvms-v1.md                    # NEW: endpoint reference (OpenAPI 3.1)
└── tests/
    └── integration/
        └── byteport_to_nvms_test.go      # NEW: end-to-end via byteport-engine NVMS adapter
```

---

## 9. Testing Strategy

### 9.1 Unit tests (per package)

- `internal/api/*_test.go`: HTTP handler tests using `httptest` and a
  mock `SandboxPort`.
- `internal/token/*_test.go`: token rotation, expiry, ACL.
- `internal/listen/uds_test.go`: UDS bind, permission check.

### 9.2 Integration tests

`tests/integration/byteport_to_nvms_test.go` — spins up a real NVMS
daemon on a temp UDS, calls every endpoint via `byteport-engine`'s
`NvmsHttpAdapter`, asserts the round-trip. Mirrors the
`byteport-engine` wiremock tests but on the live wire.

### 9.3 Contract test

A golden test that reads every `byteport-engine` NVMS adapter
request and asserts NVMS still parses it after a future schema
change. Lives in both repos; CI runs on both sides.

---

## 10. Rollout Plan

### 10.1 Phase 1b.1 — Foundation (2 weeks)

- [ ] `internal/api/router.go` — chi router, error model
- [ ] `internal/listen/uds.go` — UDS-only listener
- [ ] `internal/token/token.go` — token issuance + rotation
- [ ] `cmd/nanovms/serve.go` — wire everything together
- [ ] 6 unit tests across `api/`, `listen/`, `token/`
- [ ] `docs/nvms-service.md` operator guide

### 10.2 Phase 1b.2 — Sandboxes (2 weeks)

- [ ] `internal/api/sandboxes.go` — all 7 sandbox endpoints
- [ ] Map HTTP body ↔ `domain.SandboxConfig` (use existing struct)
- [ ] Audit log writer
- [ ] 8 handler tests
- [ ] `docs/api/nvms-v1.md` OpenAPI 3.1 spec

### 10.3 Phase 1b.3 — Integration (1 week)

- [ ] `tests/integration/byteport_to_nvms_test.go`
- [ ] CI workflow (`.github/workflows/nvms-integration.yml`)
- [ ] Manual soak test: 64 concurrent sandboxes for 1 hour
- [ ] Chaos test: kill NVMS mid-request, verify byteport-engine
      surfaces the error and does not crash

### 10.4 Phase 1b.4 — Hardening (1 week)

- [ ] `golangci-lint run ./...` clean
- [ ] `go test -race ./...` clean
- [ ] systemd unit + e2e install
- [ ] Security audit: token rotation, ACLs, capability drop
- [ ] Operator runbook (`docs/ops/nvms-runbook.md`)

### 10.5 Total effort: 6 weeks, 1 engineer

---

## 11. Open Questions

1. **NDJSON streaming for logs** — defer to v2, or land in v1? Current
   decision: v2 (v1 returns `Logs(follow=false)` only). Streaming over
   UDS needs custom framing; building the UDS chunker is a 3-day task.
2. **WebSocket support** — not needed; REST is sufficient. WebSocket
   adds `nhooyr.io/websocket` dep with little benefit.
3. **Token storage** — `chmod 0440 /etc/byteport/nvms.token` with
   `group byteport`. Alternative: hashicorp vault. Decision: file
   storage is fine for v1; vault integration tracked as a follow-up
   under `plans/2026-07-04-byteport-evolution-v1.md` Phase 5.
4. **Multi-host fan-out** — out of scope. NVMS is a single-host daemon.
   Multi-host coordination belongs in `byteport-engine` (which can
   call multiple NVMS instances).
5. **Schema versioning** — endpoints live under `/v1/`. When v2 ships
   (e.g., adding streaming), v1 endpoints stay frozen for 12 months.

---

## 12. Why UDS (not TCP / not gRPC)

| Option                   | Latency (avg) | Pros                                                                               | Cons                                                              |
| ------------------------ | ------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **HTTP over UDS** ✅     | ~80μs         | Zero network code, ACL-friendly, `byteport-engine` already speaks HTTP via reqwest | One extra JSON parse on each side                                 |
| gRPC over UDS            | ~70μs         | Schema-first, streaming native                                                     | New deps (`grpc-go`, `tonic`); byteport-engine doesn't speak gRPC |
| HTTP over loopback       | ~200μs        | Easy debugging with `curl`                                                         | Needs firewall config; larger attack surface                      |
| UDS with custom protocol | ~50μs         | Lowest latency                                                                     | Maintenance burden; no ecosystem tooling                          |

**Chosen:** HTTP over UDS — reuses byteport-engine's existing
reqwest stack, debuggable with `curl --unix-socket`,
zero new deps on the Rust side.

---

## 13. Migration Path (when nanovms gets rewritten in Rust)

ADR-031 / SPEC.md §13 establishes `Tokn::tokenledger::routing` as the
canonical substrate. When `nanovms/` is ported to Rust, NVMS becomes
either:

- **Option A:** A thin Rust binary (`nvms-service-rusted`) replacing
  the Go daemon. The JSON-over-UDS contract is unchanged.
- **Option B:** An in-process Rust library (`nvms-rust`) that
  `byteport-engine` consumes directly via the **T3-G `cgo` binding**
  from ADR-032 (zero-IPC, FFI), eliminating the UDS hop.

Option B is faster (~10μs vs ~80μs) but introduces a Rust dep into
the control plane. Decision: **defer to a separate ADR** when the
Rust port actually starts; v1 binds to UDS regardless.

---

## 14. References

- [`plans/2026-07-04-byteport-evolution-v1.md`](../2026-07-04-byteport-evolution-v1.md) — parent plan
- [`plans/2026-07-05-omniroute-rust-data-plane-v1.md`](../2026-07-05-omniroute-rust-data-plane-v1.md) — sibling spec (cross-references the same T2 binding pattern)
- `docs/adr/0032-polyglot-binding-tiers.md` — T2 UDS RPC definition
- `nanovms/internal/domain/sandbox.go` — domain types referenced by all handlers
- `nanovms/internal/ports/ports.go` — port interfaces all handlers consume
- `BytePort/crates/byteport-engine/src/adapters/nvms/http.rs` — consumer of this service
