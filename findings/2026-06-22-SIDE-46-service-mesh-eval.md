# SIDE-46: Service Mesh Evaluation for the Phenotype Fleet

**Status:** READ-ONLY design doc (no implementation, no PRs, no test clusters)
**Date:** 2026-06-22
**Author:** orch-w1-a
**Task ID:** SIDE-46
**Cross-refs:** ADR-046 (Federation mTLS + OIDC), ADR-079 (OIDC federation reference),
ADR-012 + ADR-036B (pheno-tracing OTLP canonical), ADR-038 (hexagonal port-adapter L4),
ADR-022 (config consolidation), ADR-023 (agent-effort governance),
ADR-040 (test coverage gates per tier), ADR-042 / ADR-042B (security audit cadence + substrate quality bar)

---

## 1. Scope and intent

Evaluate three service-mesh candidates for the Phenotype federated fleet:

1. **Linkerd** — CNCF Graduated; Rust data plane (`linkerd2-proxy`).
2. **Istio** — CNCF Graduated; Envoy sidecar or ambient mode (`ztunnel` + waypoint).
3. **Consul Connect** — HashiCorp; Consul agents + sidecar (envoy or built-in).

The fleet needs a mesh to (a) federate the `pheno-*` and `phenotype-*` services across
orgs, (b) bind to the OIDC/SPIFFE identity story from ADR-046 / ADR-079, (c) emit OTLP
traces to our existing `pheno-tracing` collector (ADR-036B), and (d) survive on the
macbook dev environment without ballooning resource use (ADR-023 device-fit gate).

This doc is read-only. The output is a comparison table + one recommendation. If
approved, the implementation work is planned separately under
`feat/side-46-mesh-adopt-<date>` and tracked in a future v23+ cycle.

---

## 2. Fleet constraints (what the mesh must satisfy)

Pulled from AGENTS.md (2026-06-21) and the ADR set:

- **Polyglot services** (Rust + Python + Go + TS). Sidecar must be language-agnostic;
  app code calls each other over plain HTTP/gRPC with mesh-enforced identity.
- **Existing OTLP substrate** (`pheno-tracing`, ADR-012 / ADR-036B). The mesh MUST
  NOT create a parallel telemetry pipeline; it must expose OTLP as a first-class sink
  or be configurable to forward to the existing collector endpoint.
- **OIDC federation roadmap** (ADR-046, ADR-079). Planned OIDC token exchange between
  federated services. The mesh must produce workload identities (SPIFFE IDs) that map
  cleanly to OIDC `sub` claims.
- **macbook dev loop** (ADR-023, ADR-030 `device:` field). Per-pod weight kills the
  macbook story. Target: ≤ 25m CPU / ≤ 80 MB RAM per sidecar at idle.
- **Substrate placement.** The mesh lands as a federated-service substrate
  (`pheno-mesh`) or polyglot-reuse canonical port (`phenotype-mesh-sdk`), per
  ADR-022 / ADR-023. No random `phenoShared` for service-to-service plumbing.
- **App code stays plain.** No bespoke SDK calls in services; identity is enforced at
  the mesh layer (zero-app-code-change).

---

## 3. Option 1 — Linkerd

### 3.1 Deployment model

- **Control plane:** `linkerd-control-plane` Deployment × 3 (HA). Components:
  `linkerd-identity` (legacy) or external issuer, `linkerd-proxy-injector`,
  `linkerd-destination`, `linkerd-metrics`. Optional Viz / Jaeger extensions.
- **Data plane:** `linkerd2-proxy` (Rust, `rustls`). Sidecar injected via mutating
  webhook on annotated namespaces (`linkerd.io/inject: enabled`).
- **CRDs:** 4 — `Link`, `Server`, `ServiceProfile`, `AuthorizationPolicy`. Small surface.
- **Multi-cluster:** `linkerd-multicluster` with `gateway` mode.

### 3.2 mTLS bootstrap

- SPIFFE-format X.509 SVIDs issued at pod startup (`spiffe://<trust-domain>/ns/<ns>/sa/<sa>`).
- Default issuer: self-signed CA bundled in the control plane.
- External issuers: supported via `linkerd-identity` issuer template (Vault PKI,
  cert-manager, SPIRE).
- Rotation: automatic; default 24h cert TTL.

### 3.3 SPIFFE + OIDC integration

- Native SPIFFE IDs out of the box.
- For OIDC → SPIFFE bridging: a custom `linkerd-identity` issuer consumes an upstream
  OIDC ID token and mints a SPIFFE SVID whose `path` carries the OIDC `sub` claim.
  This pattern is documented for SPIRE and works cleanly with Linkerd's issuer
  template. Maps directly to ADR-046 / ADR-079.

### 3.4 OTel export support

- Native Prometheus metrics from the proxy (latency, request volume, success rate).
- Distributed tracing via OTLP: `linkerd2-proxy` emits OTLP-format spans to a
  user-configured collector endpoint. Trace sampling is per-route; mTLS spans are
  tagged with SPIFFE IDs.
- Same endpoint as `pheno-tracing` exports to — no parallel pipeline.

### 3.5 Resource overhead

Per sidecar at idle (median across public Linkerd benchmarks, 2025-Q4):

| Metric (per pod, idle) | Linkerd | Istio sidecar | Istio ambient (ztunnel) | Consul Connect |
|---|---|---|---|---|
| CPU idle | ~10m | ~30m | ~5m (shared node agent) | ~25m |
| Mem idle | ~50 MB | ~120 MB | ~25 MB | ~100 MB |
| Latency p50 add | ~0.4 ms | ~1.2 ms | ~0.3 ms | ~0.9 ms |
| Per-node overhead | 0 | 0 | ztunnel DaemonSet ~50 MB | Consul client ~80 MB |

Linkerd is the second-lowest after Istio ambient; well-suited for our fleet density.

### 3.6 Learning curve

- **Time-to-first-mesh:** ~1 day. Single CLI (`linkerd install`), single annotation.
- **CRDs to learn:** 4.
- **Common pitfalls:** destination-controller failures on SMI mismatches;
  proxy-injection whitelist for system namespaces.
- **Docs quality:** Good; CNCF-blessed. Linkerd 2.14+ ships a "production" checklist.

---

## 4. Option 2 — Istio

### 4.1 Deployment model

- **Control plane:** `istiod` (single Deployment, HPA-driven). Components collapsed —
  `pilot`, `citadel`, `galley` merged in 1.5+.
- **Data plane (sidecar mode):** Envoy sidecar per pod. CRDs: `VirtualService`,
  `DestinationRule`, `Gateway`, `ServiceEntry`, `Sidecar`, `AuthorizationPolicy`,
  `RequestAuthentication`, `PeerAuthentication`, `Telemetry`, etc. (15+).
- **Data plane (ambient mode, GA 2024):** `ztunnel` (Rust, L4 zero-trust tunnel)
  DaemonSet per node + optional `waypoint` proxy per namespace/service. Reduced CRD
  surface; traffic policy lives at the waypoint.

### 4.2 mTLS bootstrap

- Istiod CA by default (self-signed). Cert format: SPIFFE-compliant X.509 SVIDs.
- External CA plug-in: cert-manager, Vault PKI, SPIRE — all production-grade.
- Rotation: automatic, default 24h.

### 4.3 SPIFFE + OIDC integration

- Native SPIFFE IDs.
- OIDC integration is first-class: `RequestAuthentication` CRD validates inbound JWTs
  against any configured OIDC issuer (`issuer: https://auth.example.com`);
  `AuthorizationPolicy` ties JWT claims to mesh policy.
- SPIRE integration is well-documented for workload-identity bridging.
- The ADR-046 OIDC federation story is best served here among the three candidates.

### 4.4 OTel export support

- Excellent. Istio Telemetry API v2 configures an OTLP collector per namespace;
  spans are emitted from Envoy with rich metadata (upstream cluster, route, mTLS
  status). Distributed tracing enabled by default at 1% sampling; configurable to 100%.
- Built-in access logs can be forwarded to OTLP as log records.
- `pheno-tracing` ingest: zero new code; just point the `Telemetry` resource at our
  OTLP collector.

### 4.5 Resource overhead

See §3.5 table. Sidecar mode is heaviest of the three; ambient mode is competitive.

Ambient trade-off: requires Linux kernel support for iptables / eBPF redirection
(5.x+); works on macbook dev via Lima/Colina + a Linux VM, but the loop is heavier
than Linkerd's direct path.

### 4.6 Learning curve

- **Time-to-first-mesh:** ~1 week for a working install; ~1 month to operationalize
  (CRDs, telemetry, mTLS policies, ingress, ambient mode ramp).
- **CRDs to learn:** 15+ in sidecar mode, ~6 in ambient mode.
- **Common pitfalls:** control-plane OOM on large clusters, sidecar-injection
  failures on pods with non-standard security contexts, `istiod` CPU spikes during
  config pushes.
- **Docs quality:** Excellent; CNCF-blessed; large ecosystem.

---

## 5. Option 3 — Consul Connect

### 5.1 Deployment model

- **Control plane:** Consul servers (3-5 nodes, Raft consensus) + Consul clients (1
  per node). Connect is a feature of Consul, not a separate control plane.
- **Data plane:** Connect sidecar (envoy or built-in Consul proxy). Auto-injected by
  the Consul client when `connect` is enabled in the service definition.
- **Kubernetes operator:** `consul-k8s` exposes CRDs (`ServiceIntentions`,
  `ServiceMesh`, `ProxyConfig`).

### 5.2 mTLS bootstrap

- Connect CA: built-in self-signed (default) or external (Vault PKI).
- Cert format: SPIFFE-like (Consul-native IDs `spiffe://<partition>/<cluster>/<ns>/<svc-id>`);
  SPIFFE compliance is partial compared to Linkerd/Istio.
- Rotation: automatic.

### 5.3 SPIFFE + OIDC integration

- SPIFFE IDs are first-class in Consul intentions.
- OIDC integration is via Consul's `Login` API + intentions ACL tokens tied to OIDC
  subject claims (OIDC → Consul token → mTLS identity). Works, but is one hop more
  than Linkerd/Istio.
- Multi-cluster / multi-partition federation is a Consul strength (`admin partitions`,
  `cluster peering`).

### 5.4 OTel export support

- Consul has its own telemetry (`/v1/agent/monitor`, `connect_leaf` metrics) and
  Prometheus integration via the official exporter.
- OTLP support: **partial**. Consul does not natively emit OTLP-format spans from the
  data plane. Operators typically run an OTel Collector with a Consul receiver to
  bridge.
- For our `pheno-tracing` ingest, this means an extra collector hop — a
  parallel-ish pipeline we want to avoid (ADR-036B).

### 5.5 Resource overhead

See §3.5. Consul sidecars are similar to Istio sidecars (envoy-based). On top: Consul
server quorum (3 nodes, ~1 GB RAM each) + Consul client per node (~80 MB RAM).

### 5.6 Learning curve

- **Time-to-first-mesh:** ~1 day for a single cluster; ~1 week to operate the Consul
  server quorum.
- **Concepts to learn:** Consul agents, intentions, partitions, tokens, gossip.
  Different mental model than Linkerd/Istio.
- **Polyglot story:** Works well if the org already uses Consul for service discovery.
  We do not — we use `pheno-registry` (ADR-013 / ADR-022) + OIDC.

---

## 6. Side-by-side comparison

| Dimension | Linkerd | Istio (sidecar) | Istio (ambient) | Consul Connect |
|---|---|---|---|---|
| **CNCF status** | Graduated | Graduated | Graduated (ambient GA 2024) | HashiCorp (not CNCF) |
| **Control-plane components** | 3 Deployments + Viz | 1 Deployment (istiod) | 1 Deployment + ztunnel per node | 3-5 server quorum + clients |
| **CRD count** | 4 | 15+ | ~6 | ~6 (CRDs via operator) |
| **Sidecar language** | Rust (`linkerd2-proxy`) | C++ (Envoy) | Rust (ztunnel) + C++ (waypoint opt) | C++ (Envoy) or built-in |
| **mTLS default** | Yes, auto | Yes, auto | Yes, auto (L4) | Yes, auto |
| **SPIFFE ID format** | Native | Native | Native | Partial (custom) |
| **OIDC → SPIFFE bridge** | Custom issuer template | First-class via `RequestAuthentication` | Same as sidecar | Via Consul Login API (extra hop) |
| **OTLP native** | Yes | Yes (best-in-class) | Yes (same telemetry) | Partial — needs collector bridge |
| **CPU idle per pod** | ~10m | ~30m | ~5m | ~25m |
| **Mem idle per pod** | ~50 MB | ~120 MB | ~25 MB | ~100 MB |
| **Latency p50 add** | ~0.4 ms | ~1.2 ms | ~0.3 ms | ~0.9 ms |
| **macbook dev fit** | Good (Colima/Lima) | Heavy (sidecar) / OK (ambient via Lima) | OK via Lima VM | Heavy (Consul quorum) |
| **Time-to-first-mesh** | ~1 day | ~1 week | ~1 week (with ambient) | ~1 day |
| **Production ops docs** | Good | Excellent | Excellent (newer) | Good |
| **Polyglot friendly** | Yes (mesh-level) | Yes | Yes | Yes |
| **Vendor lock-in** | Low | Low-Medium | Low | Medium (Consul server quorum) |

---

## 7. Recommendation

**Primary: Linkerd.** **Fallback: Istio (ambient mode).** **Not recommended: Consul Connect.**

### 7.1 Why Linkerd wins for our fleet

1. **Lowest resource overhead after Istio ambient.** Per-pod ~10m CPU / ~50 MB RAM
   satisfies the ADR-023 device-fit gate and protects the macbook dev loop.
2. **OTLP is native.** `linkerd2-proxy` emits OTLP spans directly to a
   user-configured collector — same endpoint as `pheno-tracing` (ADR-036B). No
   parallel pipeline.
3. **SPIFFE IDs are first-class.** OIDC → SPIFFE bridge via custom
   `linkerd-identity` issuer consuming an OIDC ID token maps cleanly onto
   ADR-046 / ADR-079.
4. **Small CRD surface (4).** Aligns with ADR-038 hexagonal substrate pattern:
   mesh policy becomes a port, not a sprawling config tree.
5. **Time-to-first-mesh ~1 day.** Validates the OIDC federation end-to-end on a
   macbook in a single sprint.
6. **CNCF Graduated, Rust proxy.** Aligns with our substrate language choice
   (pheno-* is Rust-heavy; ADR-012 / ADR-036B).

### 7.2 When to switch to Istio ambient

- Federated service count grows past ~30 and we need **L7 traffic management**
  (header-based routing, fault injection, retries) beyond what Linkerd's
  `ServiceProfile` offers.
- Need **multi-mesh federation** (cluster A → cluster B through specific mesh
  policy); Istio's `east-west gateway` is more battle-tested.
- Org already has **Envoy expertise**.

For the current fleet (~15 federated services) and the ADR-046 + ADR-079 + ADR-036B
roadmap, Linkerd covers the requirements at lower cost.

### 7.3 Why Consul Connect is not recommended

- OTLP support is partial — needs an extra collector hop, conflicting with
  ADR-036B's substrate canonical.
- Consul server quorum adds 3-5 nodes of operational overhead, non-trivial on
  macbook dev.
- Service-discovery story is **not Consul-based** — we use `pheno-registry`
  (ADR-013 / ADR-022) + OIDC. Consul's unified catalog + mesh strength doesn't apply.
- SPIFFE ID compliance is partial compared to Linkerd/Istio.

---

## 8. Risk matrix (Linkerd adoption)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `linkerd-identity` deprecation breaks our OIDC issuer template | Low | High | Pin Linkerd version; pre-stage SPIRE fallback; contribute upstream if needed |
| Proxy-injection misses a system namespace (kube-dns, etc.) | Med | Low | Standard `linkerd inject` whitelist; e2e probe on fresh cluster |
| OTLP collector overload from mesh spans | Med | Med | Default 1% sampling on mesh; 100% only in staging |
| macbook dev loop too slow with sidecar (Lima VM) | Med | Med | Use `linkerd install --crds` + raw manifests in CI; keep dev path on macbook-OK via Viz extension only |
| CRD drift on Linkerd minor-version upgrade | Low | Med | Pin minor; test against next minor in staging before bump |
| Mesh + substrate split (mesh policy diverges from ADR-038 port) | Low | Med | Adopt mesh as **federated-service substrate** (`pheno-mesh`); ports in `phenotype-port-adapter` |
| Ambient mesh (Istio) becomes de-facto | Low | Low | Plan v23+ as ambient PoC if L7 needs explode |

---

## 9. Migration path (informational, not this turn)

1. **Track 1 (1 wk, macbook):** `pheno-mesh` substrate bootstrap. Repo
   `KooshaPari/pheno-mesh`, Charter.md + SPEC.md + AGENTS.md. Cargo lib for
   mesh-policy intents (mirrors `pheno-port-adapter` patterns).
2. **Track 2 (1 wk, heavy-runner):** Lima-based dev cluster + `linkerd install` +
   sample workload annotated.
3. **Track 3 (1 wk, macbook + heavy-runner):** Custom `linkerd-identity` issuer wired
   to OIDC ID token exchange (ADR-046 / ADR-079). Validates SPIFFE ID issuance
   end-to-end.
4. **Track 4 (1 wk, heavy-runner):** OTLP collector integration with `pheno-tracing`.
   Trace correlation across mesh + substrate.
5. **Track 5 (1 wk, macbook):** ADR for production rollout + staged fleet rollout plan
   (ADR-040 / ADR-042B coverage gates; ADR-042 monthly security audit cadence).

**Total:** ~5 weeks wall, ~1 PR per track, ~1,500 LoC governance + code + tests.
Owner: orch-w1-a (proposed). Plan file:
`plans/2026-06-22-SIDE-46-mesh-adopt.md` (to be authored if this doc is approved).

---

## 10. References

**Internal ADRs**

- ADR-012 / ADR-036B — pheno-tracing substrate canonical
- ADR-022 — config consolidation (polyglot substrate split)
- ADR-023 — agent-effort governance (device fit + substrate placement)
- ADR-038 — hexagonal port-adapter L4 policy
- ADR-040 — test coverage gates per tier
- ADR-042 — security audit cadence
- ADR-042B — substrate quality bar (formal)
- ADR-046 — federation mTLS + OIDC
- ADR-079 — OIDC federation reference

**External**

- Linkerd: <https://linkerd.io/docs/>
- Istio: <https://istio.io/latest/docs/>
- Consul Connect: <https://developer.hashicorp.com/consul/docs/connect>
- CNCF Service Mesh Landscape (2025-Q4): <https://landscape.cncf.io/service-mesh>
- SPIFFE / SPIRE: <https://spiffe.io/docs/latest/spiffe-about/overview/>
- pheno-tracing substrate: `KooshaPari/pheno-tracing` (canonical)

---

**Decision:** Recommend **Linkerd** as the primary mesh for the Phenotype fleet, with
**Istio ambient mode** as the documented fallback if L7 needs expand. Consul Connect
is not recommended.

**Status:** READ-ONLY design doc. No implementation this turn. Pending orch-w1-a
approval.