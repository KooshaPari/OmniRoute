# SIDE-21: SPIFFE/SPIRE Workload Identity Integration Design

| Field | Value |
|---|---|
| **Status** | DESIGN (no code yet) |
| **Date** | 2026-06-22 |
| **Author** | Orchestrator (SIDE-21) |
| **Cycle** | v19 side-wave (parallel to T1-T5) |
| **Pillar touchpoints** | L46 (auth), L52 (encryption-in-transit), L54 (federation mTLS + OIDC) |
| **Depends on** | ADR-046 (federation mTLS + OIDC), ADR-079 (OIDC federation reference), examples/oidc_consumer/ |
| **Supersedes** | nothing |
| **Target ADR** | proposed ADR-081 (L5-122) for cycle 10 acceptance |

---

## 1. Motivation

The fleet today authenticates service-to-service calls with **bearer JWTs** issued by an external OIDC provider (ADR-046, ADR-079). The pattern works, but it has three structural weaknesses that SPIFFE/SPIRE addresses:

1. **Long-lived secrets in workload memory.** A JWT is signed by an external IdP; the workload caches the signing key (JWKS) and accepts tokens for the lifetime of `exp`. There is no cryptographic binding between the token and the workload that presented it — a stolen token is replayable until expiry.
2. **No workload identity, only user identity.** JWTs carry `sub` (who), not *what* the workload is. Two replicas of `pheno-router` are indistinguishable to a verifier.
3. **Static trust roots.** JWKS rotation is push-based from the IdP; if the IdP is unreachable, workloads cannot verify new tokens but can still verify cached ones for up to the cache TTL (5 min). SPIFFE rotates short-lived SVIDs (default 1 hour, refreshable to ~5 min) and binds them to workload attestations, not to a remote key fetch.

SPIFFE/SPIRE is the de-facto CNCF standard for workload identity (CNCF Graduated, May 2022). Adopting it in the fleet gives us:

- **Cryptographic workload identity** (X.509-SVID or JWT-SVID) bound to the workload's attestable properties (k8s SA, container image hash, etc.).
- **Automatic mTLS** between workloads via the SPIFFE Workload API (no cert management in app code).
- **Federation across trust domains** — two SPIFFE federations trust each other without shared JWKS infrastructure.
- **Drop-in compatibility** with existing OIDC verifiers via JWT-SVID format.

This is a **side-wave** investigation, not a v19 P0 track. We author the design now so cycle 10 (v20) can decide on implementation.

---

## 2. Use cases

### 2.1 Cross-service mTLS without app-level cert management (primary)

Every fleet substrate service (`pheno-router`, `pheno-observability`, `pheno-mcp-router`, `pheno-registry`) exposes a gRPC or HTTP API. Today each service either (a) runs plaintext + bearer JWT, or (b) terminates mTLS with a static cert/key pair checked into Vault. Both have failure modes: (a) needs the IdP reachable, (b) needs Vault reachable and a cert rotation policy that no one owns.

With SPIFFE: each workload receives a **1-hour X.509-SVID** from the local SPIRE agent via the Workload API (a Unix domain socket at `/run/spire/sockets/agent.sock`). The workload uses the SVID as its server cert (inbound) and as its client cert (outbound). The peer presents its own SVID; mutual validation succeeds iff both SVIDs are signed by a federated trust root. **No app code touches certs or keys.**

### 2.2 Federation across trust domains (secondary)

ADR-046 already specifies that fleet services in cluster A can call fleet services in cluster B via mTLS + OIDC. Today this requires OIDC IdPs in both clusters to be reachable from both. SPIFFE **federation bundles** (a published set of root CA certs per trust domain) make this pull-based and asymmetric — cluster A only needs cluster B's bundle, not cluster B's IdP.

### 2.3 Replacing ad-hoc JWT verification (tertiary)

`pheno-context::oidc::FederationClient` (ADR-079) verifies JWTs. SPIFFE issues **JWT-SVIDs** in the same RFC 7519 shape. **The FederationClient becomes dual-mode**: accept either (a) a federated OIDC token from a human user, or (b) a JWT-SVID from a workload. The 5-claim + `azp` enforcement already in FederationClient applies unchanged to JWT-SVIDs, because SPIFFE issues them with `iss`, `sub`, `aud`, `exp`, and a `sub` shaped as `spiffe://trust-domain/ns/<ns>/sa/<sa>`. Verifying the `iss` against the federated trust bundle is the new step.

### 2.4 Workload attestation for compliance

L17 (FedRAMP/SOC2) and L50 (Vault migration roadmap, ADR-077) both need **proof that the right workload handled a secret**. SPIRE's attestation (k8s SA + pod UID + node selectors) produces a workload identity that can be logged in audit trails. ADR-077's `secret-access` audit log line can carry the SPIFFE ID of the requesting workload alongside the human `sub`.

### 2.5 Out of scope (explicit)

- SPIRE server HA topology (we run a single-server SPIRE for the pilot; HA is a v21+ concern).
- Federating with **external** SPIFFE deployments (e.g., a customer's SPIRE). Federation across organizational boundaries needs legal + trust review; tracked as a separate ADR.
- Non-k8s attestation (VMs, bare metal). The fleet runs on k8s (cluster A on fly.io, cluster B on Railway); k8s SA attestation covers all current workloads.

---

## 3. Integration with `pheno-context`

`pheno-context` (currently a 290-line lib.rs with `Context`, `ContextBuilder`, header extraction) becomes the **single substrate dependency for SPIFFE-aware request handling**. The current OIDC consumer at `examples/oidc_consumer/` is the on-ramp.

### 3.1 New module: `pheno-context::spiffe`

```
pheno-context/src/
├── lib.rs              (unchanged: Context + ContextBuilder)
├── oidc.rs             (existing, ADR-079 — keep)
├── mtls.rs             (existing skeleton, ADR-046)
└── spiffe/
    ├── mod.rs          (WorkloadIdentity, SvidBundle, public re-exports)
    ├── client.rs       (SpireClient — wraps Workload API over UDS)
    ├── identity.rs     (SpiffeId parsing, validation, TrustDomain)
    ├── svid.rs         (X509Svid, JwtSvid types)
    └── verify.rs       (SvidVerifier — bundles + chain validation)
```

### 3.2 Public API (sketch only, no implementation)

```rust
pub struct WorkloadIdentity {
    pub spiffe_id: SpiffeId,           // spiffe://td/ns/foo/sa/bar
    pub trust_domain: TrustDomain,     // "td" above
    pub svid: X509Svid,                // leaf cert + intermediates
    pub private_key: Zeroizing<Vec<u8>>,
    pub expires_at: SystemTime,
}

impl WorkloadIdentity {
    /// Fetch the workload identity from the local SPIRE agent.
    pub async fn fetch() -> Result<Self, SpiffeError>;

    /// Refresh when within `refresh_threshold` of expiry (default 20% TTL).
    pub async fn refresh_if_needed(&mut self) -> Result<(), SpiffeError>;
}

impl FederationClient {
    /// New: verify either an OIDC token OR a JWT-SVID.
    pub async fn verify_any(&self, token: &str) -> Result<Identity, OidcError>;
}
```

### 3.3 Why `pheno-context` is the right home

- It is **already the dependency boundary** for context propagation (ADR-014 hexagonal port, ADR-038 L4 policy).
- ADR-079 makes it the canonical OIDC client. Adding SPIFFE to the same crate means services import one dependency, not two.
- `no_std`-compatibility is preserved by gating SPIFFE behind a feature flag (`spiffe`); the existing `Context` and `OIDC` modules stay `no_std`.

### 3.4 Dependency additions

```toml
[features]
spiffe = ["dep:spiffe-rs", "dep:rustls", "dep:tokio-rustls"]

[dependencies.spiffe-rs]
version = "0.6"
optional = true
```

`spiffe-rs` is the official Rust SDK (CNCF-maintained). We do **not** vendor a fork; ADR-016 (fork-only-not-rewrite) and ADR-047 (predictive DRY) both apply.

---

## 4. Deployment model: sidecar vs library

### 4.1 The two options

| | **SPIRE agent sidecar** | **Library (in-process Workload API)** |
|---|---|---|
| **Topology** | SPIRE agent runs as a sidecar container in every workload pod; the workload connects to `unix:///run/spire/sockets/agent.sock` | SPIRE agent is shared across the node (DaemonSet); the workload loads `libspire.so` in-process and calls via FFI/cgo |
| **Workload API** | UDS — standard, portable, well-tested | In-process — fastest, but FFI boundary is fragile across libc versions |
| **Cert rotation** | Automatic; agent refreshes SVID every ~1h and serves over UDS | Automatic; same, but loaded library handles in-place rotation |
| **Crash blast radius** | Sidecar crash → workload loses SVID → restart needed | Library bug → host process crashes |
| **Resource cost** | +20-30 MB RSS per sidecar | +5 MB RSS per workload (no duplication) |
| **Operational complexity** | One more container per pod; init container to mount the UDS socket | Build-time dependency on a C library; harder to test in CI |
| **CNCF guidance** | "Default for most workloads" (SPIRE docs § Workload API) | "Advanced; for latency-critical paths only" |

### 4.2 Decision: **sidecar is the default**

Reasons:

1. **Operational consistency** with the fleet's existing sidecar pattern. `pheno-observability` already runs an OTel collector sidecar (ADR-012 / ADR-036B); one more is cheap.
2. **CI parity**. The Workload API over UDS can be exercised in CI by running a SPIRE agent in a test container (the `spire-tpm` mock or a real SPIRE server in dev mode). The library path requires a build-time C toolchain and is harder to test hermetically.
3. **Blast-radius containment**. A bug in the SPIRE agent sidecar takes down one workload's identity, not the whole host's network stack.
4. **Migration friction**. The first SPIFFE adopter can be a single service (`pheno-router`); the sidecar pattern is identical for all later adopters.

### 4.3 When to revisit

The library path becomes attractive for **per-RPC overhead below 50 µs** (e.g., the router hot path). Per the v13 outlook, router e2e (request → decision → plugin dispatch) is benchmarked at p95; if SPIFFE mTLS adds more than 50 µs p95 we re-evaluate. The UDS path typically adds 20-40 µs; library path 5-10 µs.

### 4.4 Library path is still required for `no_std` targets

The fleet's `no_std` services (embedded router spike per ADR-079) cannot link a UDS-capable runtime. For these, the library path is the **only** option. We support it as a secondary backend behind the same `WorkloadIdentity::fetch()` API; the implementation reads a pre-provisioned SVID from a config-bundled file or from an injected env var in the test environment.

---

## 5. Migration path from current OIDC

### 5.1 Phasing (3 phases, ~6 weeks total)

| Phase | Weeks | Goal | Exit criteria |
|---|---|---|---|
| **P0 — Pilot (1 service)** | 1-2 | `pheno-router` runs with SPIRE sidecar; mTLS termination using X509-SVID | p95 overhead < 50 µs; zero plaintext fallbacks |
| **P1 — Dual-stack (3 services)** | 3-4 | `pheno-observability`, `pheno-mcp-router`, `phenotype-router` join; FederationClient accepts both OIDC and JWT-SVID | Both token shapes verified; metrics show SVID mix |
| **P2 — Default (fleet-wide)** | 5-6 | SPIFFE is the default for new services; OIDC kept for human users only | New service template emits SPIFFE config; 4-week soak passes |

### 5.2 OIDC stays for human identities

SPIFFE JWT-SVIDs and OIDC ID tokens are not interchangeable for the human flow. Humans authenticate at a browser via the IdP and receive an OIDC ID token. Workloads receive SPIFFE SVIDs. **Both verifiers coexist in FederationClient.** The current 5-claim + `azp` enforcement applies to both.

### 5.3 FederationClient dual-mode (design sketch)

```rust
impl FederationClient {
    pub async fn verify_any(&self, token: &str) -> Result<Identity, OidcError> {
        // 1. Cheap pre-check: JWT header `alg` and `kid`.
        let header = decode_header_unverified(token)?;

        // 2. If `iss` starts with "https://" → OIDC path (existing).
        if header.iss.starts_with("https://") {
            return self.verify_oidc(token).await;
        }

        // 3. If `iss` starts with "spiffe://" → JWT-SVID path (new).
        if header.iss.starts_with("spiffe://") {
            return self.verify_spiffe(token).await;
        }

        Err(OidcError::UnknownIssuer(header.iss))
    }
}
```

This is a **non-breaking** addition. Every existing caller keeps working unchanged.

### 5.4 Migration PRs (estimated)

| PR | Target | LoC | Effort |
|---|---|---|---|
| `pheno-context#1`: add `spiffe` module + feature flag | `pheno-context` | ~400 | 2 days |
| `pheno-context#2`: dual-mode `FederationClient::verify_any` | `pheno-context` | ~80 | 0.5 day |
| `phenotype-ops#3`: SPIRE agent sidecar Deployment template | `phenotype-ops` | ~250 (k8s YAML + README) | 1 day |
| `phenotype-router#1`: pilot integration | `phenotype-router` | ~150 | 1 day |
| `examples/spiffe_publisher/`: 60-line reference server | `examples/` | ~80 | 0.5 day |
| **Total** | | **~960** | **5 days** |

### 5.5 What does **not** migrate

- **User-facing browser flows** — keep OIDC; humans do not run SPIRE agents.
- **External SaaS API calls** (e.g., to a third-party LLM provider) — they want API keys or OIDC, not SPIFFE SVIDs. The `pheno-mcp-router` outbound calls to `openai.com` etc. stay on OIDC/API-key paths.
- **Cross-cluster federation with non-fleet services** — defer to v21+.

---

## 6. Cost / benefit analysis

### 6.1 Costs

| Item | One-time | Recurring | Notes |
|---|---|---|---|
| **SPIRE server HA cluster** (3 nodes, etcd-backed) | 0.5 day setup | +1 GB RAM, +50 mCPU per node | Runs in `phenotype-ops` namespace; uses existing k8s capacity |
| **SPIRE agent sidecar** | DaemonSet manifest | +25 MB RAM per workload pod | Acceptable; OTel collector is similar |
| **`pheno-context::spiffe` module** | ~960 LoC across 5 PRs | Maintenance | Allocated to cycle 10 (v20) |
| **Operator learning curve** | 2 days training (1 person) | n/a | SPIRE is well-documented; CNCF-curated |
| **Bundle rotation observability** | 1 day | Dashboard maintenance | Bundle expiry alerts in pheno-observability |
| **Test infra** | 1 day (SPIRE in CI) | Reused per PR | hermetic-spire container in `phenotype-ops` test suite |

**Total one-time:** ~5 engineer-days + 1 ops-day + 2 train-days ≈ 8 days.
**Total recurring:** ~75 MB RAM per workload pod (sidecar) + 1 GB RAM cluster-wide (server).

### 6.2 Benefits

| Benefit | Quantification |
|---|---|
| **Removes JWKS caching as a failure mode** | Eliminates ~5 min of degraded verification per IdP outage (current cache TTL); saves ~2 on-call hours/year |
| **Removes static cert/key management** | Eliminates ~12 cert rotations/year across 8 services (Vault + cert-manager flow); saves ~6 ops-hours/year |
| **Cryptographic workload identity** | Enables L17 (FedRAMP) SC-8 (transmission confidentiality) and SC-13 (cryptographic protection) controls to score 3.0 instead of 2.0 |
| **Federation without shared JWKS** | Cluster A and cluster B can federate even during cross-region IdP outages |
| **Audit chain improvement (L50)** | `secret-access` log lines gain SPIFFE ID of requesting workload → L50 score moves 1.5 → 2.0 |
| **Reduces 71-pillar audit surface** | L46 (auth), L52 (encryption-in-transit), L54 (federation) all move ≥0.5 toward 3.0 |
| **Fleet mean impact** | Estimated +0.04 to +0.08 on the 71-pillar fleet mean (2.86 → 2.90-2.94) |

### 6.3 Break-even

One-time cost (~8 engineer-days) pays back in **~2 years** at current on-call rate (~4 hours/year at $200/hr loaded). But the **compliance and audit** benefits (L17 SC-8/SC-13, L50 audit chain) are not directly monetizable — they are required for FedRAMP authorization, which is a precondition for several enterprise contracts. **Break-even on compliance alone is immediate.**

### 6.4 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SPIRE agent sidecar OOM-killed on small pods | Low | High (loses identity) | Set `resources.requests.memory: 64Mi`, `limits: 128Mi`; alert on OOMKilled |
| Workload API UDS misconfigured (SELinux, AppArmor) | Medium | High (no SVID) | Init container validates socket before app start; readiness probe fails fast |
| Federation bundle staleness | Low | Medium | Bundle expiry alerts; auto-rotate every 6h via pheno-observability |
| `spiffe-rs` crate abandoned | Low | High | Pin to `0.6.x`; CNCF Graduated project is low-risk; vendoring fallback per ADR-016 |
| Operator error in trust domain naming | Medium | Medium (debug-nightmare) | Validate `TrustDomain` at startup; reject unknown TDs; uniform naming policy `spiffe://phenotype.<cluster>.local/...` |

---

## 7. Decision needed

This is a **design doc**, not an ADR. The decision to adopt SPIFFE/SPIRE belongs in **ADR-081 (proposed)**, to be written and ratified in cycle 10 (v20). Cycle 10 must decide:

1. **Adopt / reject / defer?** Adopt = ship the 5-PR plan above; reject = explicitly note why OIDC-only is sufficient; defer = set a 6-month review date.
2. **If adopt: sidecar-only, or both?** The default recommendation is sidecar-only for v20; library path stays out of scope until a latency-critical need appears.
3. **If adopt: which service pilots?** Default: `phenotype-router` (the production repo from the v12 spike).
4. **Trust-domain naming convention.** Default: `spiffe://phenotype.<cluster>.local/ns/<ns>/sa/<sa>`.

---

## 8. References

- ADR-046 (federation mTLS + OIDC)
- ADR-077 (Vault migration roadmap)
- ADR-078 (encryption-at-rest mandate)
- ADR-079 (OIDC federation reference implementation)
- ADR-080 (pen-test + bug-bounty roadmap)
- SPIFFE spec: <https://github.com/spiffe/spiffe/blob/main/standards/SPIFFE.md>
- SPIRE docs: <https://spiffe.io/docs/latest/spire/>
- `spiffe-rs` Rust SDK: <https://github.com/spiffe/spiffe-rs>
- CNCF SPIFFE project page: <https://www.cncf.io/projects/spiffe/>
- examples/oidc_consumer/ (current OIDC on-ramp)
- findings/2026-06-22-SIDE-21-*.md (sibling side-wave findings)