# SIDE-45: SPIFFE Workload Identity — Adoption Sketch

**Date:** 2026-06-22
**Status:** DRAFT (doc-only, no code)
**Scope:** 3 pheno-* crates; mTLS bootstrap; cert rotation
**Owns:** ADR-046 v20 cycle 10 T9 (`pheno-mtls` crate + 3 adoptions)
**Refs:** ADR-046 (federation mTLS+OIDC, ACCEPTED), ADR-014/ADR-038
(hexagonal L4 ports), ADR-040 (coverage gates), ADR-079 (OIDC consumer)

> **ID note.** `side-45` was used 2026-06-20 for *Reversible DB
> Migrations* (`findings/2026-06-20-AUDIT-side-45.md`). This sketch
> reuses the slot; the two are unrelated.

---

## 1. Context

ADR-046 (ACCEPTED 2026-06-19) commits the fleet to mTLS for
service-to-service auth, with **automatic rotation via SPIFFE/SPIRE**
(line 31). ADR-046 implementation plan (line 102) defers concrete
adoption to **v20 cycle 10 T9** (`pheno-mtls` crate + 3 adoptions).
This SIDE-45 sketch is the design intake for that track.

Stays within ADR-046's choices: **24h cert TTL**, SPIRE-based rotation,
federation via shared trust bundle. Out of scope: JWT-SVID (ADR-079),
authorization policy, federation config.
---

## 2. SPIFFE primer (5 lines)

- **SPIFFE ID** — URI: `spiffe://<trust-domain>/<workload-path>`.
- **SVID** — *SPIFFE Verifiable Identity Document*. We use X.509-SVID:
  a leaf X.509 cert whose URI SAN is the SPIFFE ID.
- **SPIRE** — runtime. *Server* issues SVIDs; *Agent* (per-node)
  attests workloads and serves SVIDs via the Workload API.
- **Workload API** — Unix domain socket per workload. Methods:
  `FetchX509SVID` (one-shot) and the streaming `X509SVIDUpdate`
  (rotation). Socket path: `SPIFFE_ENDPOINT_SOCKET` env var.
- **Trust bundle** — set of CA certs used to verify peer SVIDs;
  basis of cross-trust-domain federation.

---

## 3. Crate picks (3 adoptions)

| Crate                   | Lang   | SPIFFE role                                              |
|-------------------------|--------|----------------------------------------------------------|
| **pheno-port-adapter**  | Rust   | `WorkloadIdentityPort` trait + SPIRE adapter (the *port*) |
| **pheno-context**       | Rust   | Carries SPIFFE ID through the call chain (the *propagation*) |
| **pheno-mcp-router**    | Python | Consumes SPIFFE ID at MCP transport boundary (the *consumer*) |

Rationale: `pheno-port-adapter` is the canonical substrate-port home
per ADR-014/038; `pheno-context` is the canonical propagation substrate
(traceparent, baggage, deadline); `pheno-mcp-router` is the fleet's
first federated consumer per ADR-008 and the reference consumer named
in ADR-079 (line 44).

Deferred: `pheno-tracing`, `pheno-otel`, `pheno-events`, `pheno-config`
— they consume via `pheno-port-adapter`'s trait, not SPIRE directly.
Optional `pheno-mtls` substrate crate (ADR-046 T9) can be extracted
later if duplication warrants.

---

## 4. Per-crate integration sketch

### 4.1 `pheno-port-adapter` — the port

New module `src/identity.rs` (sketch, illustrative):

```rust
pub trait WorkloadIdentityPort: Send + Sync {
    fn workload_id(&self) -> &SpiffeId;
    fn trust_domain(&self) -> &TrustDomain;
    fn x509_svid(&self) -> Result<X509Svid, IdentityError>;
    fn subscribe(&self) -> tokio::sync::watch::Receiver<X509Svid>;
}
pub struct SpiffeId(String);              // newtype; validates `spiffe://...`
pub struct TrustDomain(String);           // newtype; lowercase DNS label
pub struct X509Svid { cert_der: Vec<u8>, key_der: Vec<u8>,
    not_after: SystemTime, bundle: Vec<Vec<u8>> }
pub enum IdentityError { NotYetReady, WorkloadApiUnavailable(String), Decode(String) }
```

Two adapters: `EnvVarAdapter` (reads `SPIFFE_ID` + `SPIFFE_SVID_*` env
vars; tests/dev/CI; zero SPIRE dep; default for `pheno-*-lib` crates
not on SPIRE-managed nodes) and `SpireAgentAdapter` (connects to
SPIRE Workload API over UDS at `SPIFFE_ENDPOINT_SOCKET`; one
background `tokio` task subscribes to `X509SVIDUpdate` and hot-swaps
an `Arc<RwLock<X509Svid>>`).

Tests (ADR-040 gate: 80% lib coverage): `EnvVarAdapter` happy/error
paths; `SpiffeId`/`TrustDomain` validation + `FromStr`/`Display`
round-trip; property test (any valid `SpiffeId` round-trips);
Linux-docker-gated integration test against SPIRE dev server.
Not in this PR: JWT-SVID, federation trust-bundle fetch (ADR-046
phase 2), custom trust-domain attestation.

### 4.2 `pheno-context` — the propagation layer

`Context` gains one optional field (sketch):

```rust
pub struct Context { /* existing: traceparent, baggage, deadline, ... */
    spiffe_id: Option<SpiffeId>,
}
impl Context {
    pub fn with_spiffe_id(self, id: SpiffeId) -> Self;  // builder only
    pub fn spiffe_id(&self) -> Option<&SpiffeId>;
}
```

A custom `tracing` layer reads `Context::spiffe_id()` and calls
`Span::record("spiffe.id", ...)` on every entered span; downstream
`pheno-tracing` (already OTel-instrumented) gets the field for free.
SPIFFE ID flows inside the existing `Context` (which already traverses
`tracing::Span` + `task_local!`) — no new transport.

Tests: `with_spiffe_id` immutability; SPIFFE ID survives `.await`;
span recorder populates `spiffe.id` when present, omits when `None`.
Not in this PR: SPIFFE-aware authz (that's at the transport boundary).
`pheno-context` never talks to SPIRE.

### 4.3 `pheno-mcp-router` — the consumer

New module `pheno_mcp_router/identity.py` (sketch):

```python
class SpiffeWorkloadIdentity:
    def __init__(self, socket_path: str | None = None): ...
    @property
    def spiffe_id(self) -> str: ...
    @property
    def trust_domain(self) -> str: ...
    def x509_svid(self) -> X509Svid: ...
    def on_rotation(self, cb: Callable[[X509Svid], None]) -> None: ...
class X509Svid(NamedTuple):
    cert_pem: str; key_pem: str; bundle_pem: str; not_after: datetime
```

Integration: **HTTP/2 transport** (gRPC, h2c, `mcp+http2`) wraps
`ssl.SSLContext` with current SVID cert+key and registers an
`on_rotation` callback to rebuild context in place (in-flight TLS
finishes on the old cert — acceptable; renegotiates before TTL).
**stdio transport** (current default) — no mTLS, trust derives from
parent process boundary (systemd unit, container); documented in
module docstring; future work when stdio wraps a Unix-socket peer.
**Federation** (ADR-046 phase 2, deferred): cross-trust-domain MCP
calls fetch the federated trust bundle from the SPIRE federation
endpoint.

Tests (ADR-040 gate: 80% lib coverage): unit test against a fake
Workload API (in-process UDS pair); integration test where h2
transport completes mTLS handshake with a peer whose SPIFFE ID matches
the expected URI SAN; negative test where h2 transport refuses a peer
whose SPIFFE ID is in an untrusted trust domain.
Not in this PR: stdio mTLS, federation trust-bundle fetch,
SPIFFE-based authz (caller's job, layered above identity).

---

## 5. mTLS bootstrap flow

```
Workload       SPIRE Agent     SPIRE Server    Peer
  |  read SPIFFE_ENDPOINT_SOCKET    |            |
  |  FetchX509SVID() --------------->|            |
  |                |  attest node +  |            |
  |                |  workload       |            |
  |                |  selector       |            |
  |                | ----------------->|          |
  |                |  (re)issue SVID +|            |
  |                |  bundle (TTL=24h)|           |
  |                | <----------------+          |
  |  X509SVID {cert,key,bundle}      |            |
  | <---------------+                 |            |
  |  mTLS client hello (SVID) -------------------->|
  |  mTLS server validates peer SVID  |            |
  | <---SAN check vs trust bundle------------------+
```

Steps 1–5: SPIRE issuance. Steps 6–7: mTLS handshake. TTL is 24h
(ADR-046); the Workload API streams new SVIDs ~6h before expiry (see §6).

Failure paths:
- Step 1 missing: `EnvVarAdapter` fallback (dev/CI only; production
  fails fast with `IdentityError::WorkloadApiUnavailable`).
- Step 3 fails: SPIRE Agent cannot attest workload; caller decides
  block-startup vs degraded mode.
- Step 5 unusual TTL (>26h): logged as warning (likely clock skew).
- Step 6/7 peer SVID untrusted: connection refused; metric
  `spiffe_mtls_failures_total{reason="untrusted_peer"}` incremented.

---

## 6. Cert rotation

Per ADR-046: TTL = **24h**, automatic via SPIRE. Recommended
pre-expiry refresh window is `TTL / 4` = **6h before `not_after`**.

Per-crate behavior: **`pheno-port-adapter` (`SpireAgentAdapter`)** —
one background `tokio` task holds a long-lived gRPC stream to SPIRE
Agent; on each `X509SVIDUpdate` it writes new SVID into
`Arc<RwLock<X509Svid>>`, emits
`tracing::info!(event = "spiffe.svid.rotated")`, increments
`spiffe_svid_rotations_total`. Two modes: (a) **Lazy** — caller
invokes `x509_svid()` per mTLS handshake (cheap `RwLock::read()`,
SVID ≤ 6h old); (b) **Eager** — caller subscribes via `subscribe()`
to a `watch::Receiver<X509Svid>` for proactive
`rustls::ClientConfig` rebuild before a peer handshake.

**`pheno-context`** — no rotation logic; holds `SpiffeId` (stable for
the workload's lifetime); the actual cert lives in
`pheno-port-adapter`.

**`pheno-mcp-router` (`SpiffeWorkloadIdentity`)** — a
`threading.Thread` subscribes to Workload API updates and invokes
registered `on_rotation` callbacks; the h2 transport callback
rebuilds `ssl.SSLContext` in place (in-flight TLS finishes on the old
cert, acceptable; renegotiates before TTL). Federation (ADR-046
phase 2): trust-bundle updates apply with an *overlap window* — new
bundle must contain every CA in the old bundle. Refuse if overlap is
empty (likely attack or SPIRE Server misconfig).

Edge cases: **Workload API down at rotation** — fall back to
last-known-good SVID; log warning; emit `spiffe_svid_stale_seconds`.
If SVID already expired, `x509_svid()` returns
`IdentityError::NotYetReady`; caller refuses new mTLS handshakes
(fail-closed). **SVID expires before new one arrives** — should not
happen if SPIRE Agent is healthy; if it does, fail-closed at the port
and emit `spiffe_svid_will_expire_in_seconds` for operator alerting.
**Clock skew** — SVID `not_before`/`not_after` validated against
system clock; NTP drift > 60s surfaces as
`spiffe_svid_clock_skew_seconds`.

---

## 7. Failure modes (consolidated)

- **No SPIRE Agent on host** — `SpireAgentAdapter::new` fails; caller
  chooses fallback (`EnvVarAdapter`) or refuses to start (production
  default: fail-closed). SPIRE distinguishes multi-workload hosts via
  workload selectors (k8s `ServiceAccount`, docker label, unix
  UID/GID); `pheno-port-adapter` does not care.
- **Trust domain rename** — SPIRE Server-driven; client picks up new
  bundle on next rotation. No client code change.
- **Phased rollout** — `EnvVarAdapter` and `SpireAgentAdapter`
  coexist; feature-flag `pheno.identity.backend` selects. Dev default
  = `EnvVar`; prod default = `SpireAgent`.

---

## 8. ADR hooks & open questions

- **ADR-046** — SPIFFE is the mTLS half; this sketch closes the design
  intake for v20 T9. OIDC (ADR-079) remains the user/agent path.
- **ADR-014 / ADR-038** — `WorkloadIdentityPort` follows the existing
  hexagonal Port trait pattern; no new convention.
- **ADR-040** — 80% lib coverage applies to `pheno-port-adapter` and
  `pheno-mcp-router`. Integration tests Linux-only, docker-gated
  (ADR-023 Rule 3.1 device-fit gate).
- **ADR-049** — SPIFFE ID propagation is a new drift-detector
  property ("does this call chain carry a SPIFFE ID?").

Open (non-blocking): (1) Rust client lib `rust-spiffe` — pin version
in Phase 1 PR. (2) Python client `spiffe-python` is alpha 2026-Q2;
recommend **vendoring** a minimal client in
`pheno-mcp-router/identity/_spire_proto.py` (smaller supply-chain
surface than alpha dependency). (3) `pheno-mtls` substrate — only spin
off if Phase 1 reveals real `ClientConfig`-rebuild duplication.
(4) Federation trust-bundle fetch — ADR-046 phase 2.

---

## 9. Rollout sketch

| Phase | Deliverable                                            | LoC  | Device       |
|-------|--------------------------------------------------------|-----:|--------------|
| 0     | This sketch + ADR-046 v20 T9 intake                    |  doc | macbook      |
| 1     | `pheno-port-adapter`: trait + 2 adapters               | ~400 | macbook      |
| 2     | `pheno-context`: SPIFFE ID field + span recorder       |  ~80 | macbook      |
| 3     | `pheno-mcp-router`: h2 mTLS + rotation callback        | ~250 | macbook      |
| 4     | Integration tests (SPIRE dev server in docker-compose)| ~150 | heavy-runner |
| 5     | Federation trust-bundle fetch (ADR-046 phase 2)       | ~300 | heavy-runner |

Total ~1,180 LoC + ~250 LoC tests. Heavy-runner only for Phase 4–5
(SPIRE dev server + docker-compose); macbook covers the rest per ADR-023 device-fit gate.

---

## 10. Decision points for follow-up ADRs

- **ADR-046a** — Port shape, error model, adapter contract. Phase 1.
- **ADR-046b** — Propagation contract: field name in `pheno-context`,
  W3C baggage interaction, default when `None`.
- **ADR-046c** — `pheno-mcp-router` mTLS transport matrix (h2, ALPN,
  stdio-peer). Phase 3.
- **ADR-046d** — Federation trust-bundle protocol (SPIFFE Federation
  spec vs vendor). Phase 5.
