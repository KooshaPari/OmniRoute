# Compute Layer Architecture Spec -- 2026-07-05

Status: DRAFT v0.1
Audience: parent agent /root, the 13-PR absorption squad, future
SDK implementers.
Companion: `01_compute_stack_audit.md` (the audit that motivates this spec).

This spec defines the target architecture for the next-generation
compute layer SDK. The 13 in-flight PRs (A-L) handle the absorption
+ spine work; this spec covers the SDK work that grows on top of
those landing. The two are decoupled: the absorption work can land
without the SDK, and the SDK can be built without the absorption.

================================================================================
## 1. Vision
================================================================================

The Phenotype compute layer is a polyrepo of Rust + Go + Zig + Mojo
crates that exposes a single, stable, multi-provider compute API.
BytePort, Eidolon, and every other Phenotype surface consume this
API instead of talking to AWS / GCP / Vercel / Supabase / Fly /
bare-metal directly. The user (sponsor) is responsible for the
surfaces; this SDK is the substrate.

Five-year trajectory:
- 2026 (now): the SDK exists as a polyrepo with a clean trait
  surface, 3 cloud providers (Fly, AWS Fargate, Vercel/Supabase
  Edge), and 1 microVM target (Nanos). BytePort and Eidolon adopt
  the SDK as their compute backend.
- 2027: the SDK is the default compute backend for every new
  Phenotype project. The 5 cloud providers are at parity for the
  common case (container deploy). The Scheduler and PolicyGate
  are the primary user-facing differentiators.
- 2028: the SDK is a standalone product. Other companies use it
  to deploy multi-cloud workloads without writing cloud-specific
  code. The Phenotype compute layer becomes a "wing for hire".
- 2029: the SDK is the reference implementation for a CNCF-style
  multi-cloud compute spec. The trait surface is ratified as an
  industry standard.
- 2030: the SDK is the runtime for Phenotype's edge network.
  Every Phenotype surface deploys to the edge by default; the
  data center is a fallback, not the default.

Non-negotiable design principles:
1. **No cloud SDK in user code.** A consumer writes against a
   trait; the trait is implemented per cloud. The consumer never
   imports `aws-sdk-*` or `cloud.google.com/go/compute`.
2. **No `unsafe` in the trait surface.** `#![forbid(unsafe_code)]`
   in every public crate. FFI lives behind a typed boundary.
3. **Object-safe, Send+Sync, idempotent.** Every port trait is
   storable as `Box<dyn Trait>` and safe to call from any thread.
   Idempotency is in the doc comments, not just the implementation.
4. **Schemas before code.** The OCI Reference type, the
   WorkloadSpec, and the ProviderCapabilities all have a schema
   (protobuf or WIT) that the Rust/Go/Zig types are generated from.
5. **The polyrepo, not the framework.** Consumers import individual
   crates (`pheno-compute-core`, `pheno-compute-fly`,
   `pheno-compute-aws`, ...). There is no `pheno` "framework" that
   pulls everything.

================================================================================
## 2. Layer model
================================================================================

```
+-----------------------------------------------------------+
|  User surface (BytePort, Eidolon, future surfaces)         |
|  - Tauri / Web / Mobile                                   |
|  - The user owns these; the SDK does not                   |
+-------------------------+---------------------------------+
                          | SDK surface (the public API)
                          v
+-----------------------------------------------------------+
|  pheno-compute-core  (Rust: the trait surface + types)     |
|    - ComputeProvider trait                                |
|    - WorkloadSpec, WorkloadHandle, ProviderCapabilities   |
|    - Scheduler + PolicyGate                               |
|    - EventSink (observability hook)                       |
+-------------------------+---------------------------------+
                          | SDK impls (one per cloud / microVM)
                          v
+-----------------------------------------------------------+
|  pheno-compute-fly       (Fly.io Machines API adapter)    |
|  pheno-compute-aws       (AWS Fargate / Lambda / App Run.) |
|  pheno-compute-vercel    (Vercel Functions + Edge)         |
|  pheno-compute-supabase  (Supabase Edge Functions)         |
|  pheno-compute-local     (local Docker / Podman / nanovms) |
|  pheno-compute-bare      (Hetzner / OVH / bare-metal)     |
+-------------------------+---------------------------------+
                          | FFI / native bridges
                          v
+-----------------------------------------------------------+
|  nano-compute-ffi        (Go <-> Rust FFI for nanovms)    |
|  pheno-compute-wasm      (WASM target for in-browser)    |
+-------------------------+---------------------------------+
                          | Provider APIs
                          v
+-----------------------------------------------------------+
|  Cloud providers (AWS, GCP, Vercel, Supabase, Fly, ...)   |
|  microVM (Nanos, Firecracker, gVisor)                      |
|  OS (Linux, macOS, Windows)                               |
+-----------------------------------------------------------+
```

Each box has:
- **role**: one-line description
- **language**: Rust / Go / Zig / Mojo / TS
- **API surface**: the public types and functions exposed

### 2.1 Cross-cutting layer: Tracely

```
+-----------------------------------------------------------+
|  pheno-compute-observe   (Tracely integration)            |
|  - EventSink -> OTLP / Prometheus / Jaeger / Zipkin      |
|  - Auto-instruments every ComputeProvider call            |
|  - Sentinel: SLO + error budget engine                    |
+-----------------------------------------------------------+
```

Tracely is the observability layer. It is not a "box in the layer
model" because it cross-cuts every other box. Every
ComputeProvider call emits a trace span; the Scheduler and
PolicyGate decisions are logged; the workload lifecycle is a
metric.

================================================================================
## 3. Core traits (Rust)
================================================================================

The Rust trait surface is the canonical one. Go and Zig ports
follow. Every trait is `Send + Sync`, has no associated types,
no generic methods, and uses only `&self` receivers (object-safe).

### 3.1 ComputeProvider

```rust
//! A destination for workloads: a cloud, a region, a microVM host.
//!
//! Object-safe, Send+Sync, idempotent. The `Capabilities` method
//! is the only one that may return different values across calls
//! (e.g., spot instance availability).

use std::sync::Arc;
use async_trait::async_trait;

#[async_trait]
pub trait ComputeProvider: Send + Sync {
    /// Stable name for the provider (e.g. "fly", "aws-fargate").
    /// Used in config, logs, and policy decisions.
    fn name(&self) -> &str;

    /// What this provider can do, right now.
    /// May be called frequently; the impl may cache.
    async fn capabilities(&self) -> ProviderCapabilities;

    /// Place a workload on this provider. Returns a handle
    /// that can be used to observe / stop / delete.
    /// Idempotency: placing the same WorkloadSpec twice MUST
    /// return a handle to the same workload, not a new one.
    /// This is the contract: callers can safely retry.
    async fn place(
        &self,
        spec: &WorkloadSpec,
    ) -> Result<WorkloadHandle, ComputeError>;

    /// Get the current state of a workload. A workload that
    /// does not exist is Ok(WorkloadState::NotFound), not an error.
    async fn state(
        &self,
        handle: &WorkloadHandle,
    ) -> Result<WorkloadState, ComputeError>;

    /// Stream lifecycle events for a workload. Used by
    /// Tracely to emit metrics; may be used by callers to
    /// block until a workload is Ready.
    async fn watch(
        &self,
        handle: &WorkloadHandle,
    ) -> Result<impl futures::Stream<Item = LifecycleEvent> + Send, ComputeError>;

    /// Stop a workload. Idempotent: stopping an already-stopped
    /// workload returns Ok(()). Deleting requires `delete`.
    async fn stop(
        &self,
        handle: &WorkloadHandle,
    ) -> Result<(), ComputeError>;

    /// Delete a workload and its associated resources. Idempotent.
    async fn delete(
        &self,
        handle: &WorkloadHandle,
    ) -> Result<(), ComputeError>;
}
```

### 3.2 WorkloadSpec

```rust
//! What the caller wants to run. Provider-agnostic.
//! The provider adapter translates this to its native API call.

use serde::{Deserialize, Serialize};
use phenotype_types::oci::Reference;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkloadSpec {
    /// OCI image reference. Parsed and validated by
    /// `phenotype-types`; not a string.
    pub image: Reference,

    /// Human-readable name. Used in logs, tags, and as the
    /// default workload id. Must be unique within a provider.
    pub name: String,

    /// Resource requirements. The provider MAY upgrade
    /// (e.g., 256Mi -> 512Mi) but MUST NOT downgrade.
    pub resources: ResourceSpec,

    /// Isolation level. The provider picks the closest match
    /// if it cannot honor the request exactly.
    pub isolation: IsolationLevel,

    /// Environment variables. Secrets are passed via the
    /// SecretSpec, not the env. Providers MUST NOT log env values.
    pub env: Vec<(String, String)>,

    /// Port mappings. Provider-agnostic; the adapter
    /// translates to security groups / fly.toml / vercel.json.
    pub ports: Vec<PortMapping>,

    /// Volume mounts. The adapter picks the closest
    /// provider-native construct (EBS / fly volume / supabase storage).
    pub volumes: Vec<VolumeMount>,

    /// Free-form tags. Used for cost attribution, env (dev/staging/prod),
    /// team, and the catalog.
    pub tags: Vec<(String, String)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceSpec {
    pub cpu_millicores: u32,      // 1000 = 1 vCPU
    pub memory_mib: u32,          // 1024 = 1 GiB
    pub disk_mib: Option<u32>,    // None = provider default
    pub gpu: Option<GpuSpec>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum IsolationLevel {
    /// Shared process namespace, kernel-level isolation.
    /// Cheapest, fastest cold start. Use for dev.
    Container,
    /// Hardware-virtualized, dedicated kernel. Slower cold
    /// start, stronger isolation. Use for prod.
    MicroVm,
    /// Nanos unikernel. Smallest footprint, fastest cold start,
    /// weakest debugging story. Use for edge.
    Unikernel,
    /// WebAssembly. Sandboxed at the runtime level. Use for
    /// in-browser or trusted code.
    Wasm,
}
```

### 3.3 WorkloadHandle + WorkloadState

```rust
//! The runtime representation of a placed workload.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkloadHandle {
    /// Provider-assigned id (e.g., Fly machine id, AWS task ARN).
    pub id: String,
    /// The provider that issued the id. Used to route
    /// follow-up calls.
    pub provider: String,
    /// Region / zone. May be empty if the provider is
    /// region-agnostic.
    pub region: String,
    /// Endpoint URLs the workload is reachable on.
    /// Empty until the workload is Ready.
    pub endpoints: Vec<Endpoint>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum WorkloadState {
    /// Placed but not yet scheduled / started.
    Pending,
    /// Pulling image, starting process.
    Starting,
    /// Accepting traffic.
    Ready,
    /// Stopped by user request. Can be restarted.
    Stopped,
    /// Failed to start or crashed. Check logs.
    Failed,
    /// Does not exist on the provider.
    NotFound,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifecycleEvent {
    pub state: WorkloadState,
    pub at: chrono::DateTime<chrono::Utc>,
    pub reason: Option<String>,
}
```

### 3.4 ProviderCapabilities

```rust
//! What the provider can do, right now. The Scheduler
//! queries this to make a placement decision.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    /// Provider name (matches `ComputeProvider::name()`).
    pub name: String,
    /// Regions the provider is currently serving in.
    pub regions: Vec<Region>,
    /// Isolation levels supported.
    pub isolation: Vec<IsolationLevel>,
    /// Maximum resources the provider will provision.
    pub max_resources: ResourceSpec,
    /// Approximate cold start time. The Scheduler prefers
    /// providers with the lowest value for latency-sensitive
    /// workloads.
    pub cold_start_ms: u32,
    /// USD per vCPU-hour. The Scheduler may use this for
    /// cost-driven placement.
    pub cost_per_vcpu_hour: f64,
    /// Free-form features the provider supports (e.g.,
    /// "auto-scaling", "custom-domains", "preview-deploys").
    pub features: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Region {
    pub id: String,           // "iad", "us-east-1", "fra1"
    pub display_name: String, // "Ashburn, VA"
    pub available: bool,      // false if the region is full
}
```

### 3.5 Scheduler

```rust
//! Given a WorkloadSpec, pick a provider.
//! Pure function: same input -> same output, modulo
//! ProviderCapabilities (which may change over time).

use std::sync::Arc;

#[async_trait]
pub trait Scheduler: Send + Sync {
    /// Choose a provider for the spec.
    /// The Scheduler may consult ProviderCapabilities
    /// across all registered providers.
    /// Returns the chosen provider; the caller then calls
    /// `place()` on it.
    async fn choose(
        &self,
        spec: &WorkloadSpec,
        providers: &[Arc<dyn ComputeProvider>],
    ) -> Result<Arc<dyn ComputeProvider>, ComputeError>;
}
```

### 3.6 PolicyGate

```rust
//! Pre-flight check before a workload is placed.
//! Used for cost limits, allow-lists, audit logging.
//! The default implementation is permissive; production
//! deployments override with a strict policy.

#[async_trait]
pub trait PolicyGate: Send + Sync {
    /// Return Ok(()) if the spec is allowed; Err otherwise.
    /// The error is structured so the caller can present
    /// it to the user / log it.
    async fn check(
        &self,
        spec: &WorkloadSpec,
        ctx: &PolicyContext,
    ) -> Result<(), PolicyError>;
}

#[derive(Debug, Clone)]
pub struct PolicyContext {
    pub actor: String,        // "user:koosha", "ci:gh-actions"
    pub workspace: String,    // "phenotype/compute-layer"
    pub tags: Vec<(String, String)>,
}

#[derive(Debug, thiserror::Error)]
pub enum PolicyError {
    #[error("cost limit exceeded: ${0} > ${1}")]
    CostLimit(f64, f64),
    #[error("region not allowed: {0}")]
    RegionDenied(String),
    #[error("image not in allow-list: {0}")]
    ImageDenied(String),
    #[error("resource limit exceeded: {0}")]
    ResourceLimit(String),
}
```

### 3.7 EventSink

```rust
//! Observability hook. Default impl is a no-op; Tracely
//! overrides with a real OTLP / Prometheus exporter.

use async_trait::async_trait;

#[async_trait]
pub trait EventSink: Send + Sync {
    /// Called at the start of every ComputeProvider method.
    /// The returned guard is dropped when the method returns;
    /// the guard emits the "ended" event with the elapsed time.
    async fn begin(&self, op: &str, attrs: &[(&str, &str)])
        -> Box<dyn EventGuard + Send>;

    /// Record a metric (counter, gauge, histogram).
    /// No-op by default.
    async fn metric(&self, name: &str, value: f64, attrs: &[(&str, &str)]);

    /// Record a structured log line.
    /// No-op by default.
    async fn log(&self, level: LogLevel, message: &str, attrs: &[(&str, &str)]);
}

#[async_trait]
pub trait EventGuard: Send {
    /// Mark the operation as successful. Called by the impl
    /// before dropping the guard.
    async fn ok(self: Box<Self>);
    /// Mark the operation as failed. Called by the impl
    /// before dropping the guard.
    async fn err(self: Box<Self>, error: &dyn std::error::Error);
}

#[derive(Debug, Clone, Copy)]
pub enum LogLevel { Trace, Debug, Info, Warn, Error }
```

================================================================================
## 4. Provider matrix (v1 target)
================================================================================

| Provider | Isolation | Cold start | Cost/vCPU-h | SDK surface | v1 priority |
|----------|-----------|------------|-------------|-------------|--------------|
| Fly.io   | Container, MicroVm (Firecracker) | ~500ms | $0.0000026 | Machines REST | P0 |
| AWS Fargate | Container | ~30s | $0.04048 | AWS SDK (Rust: aws-sdk-fargate) | P0 |
| AWS Lambda | Wasm (custom runtime) | ~100ms | $0.0000166 per request | AWS SDK | P1 |
| Vercel Functions | Container (Node/Deno/Go/Python/Rust) | ~50ms | $0.60 per 1M requests | REST + vercel.json | P0 |
| Supabase Edge | Wasm (Deno) | ~5ms | $2 per 1M requests | REST | P1 |
| Local (nanovms) | All (Container/MicroVm/Unikernel/Wasm) | <100ms | $0 | in-process | P0 |
| Hetzner | Container (via Docker) | ~60s | $0.005 | REST | P2 |

P0 ships in v0.1 (3 months). P1 ships in v0.5 (6 months). P2 is
v1.0 (12 months).

================================================================================
## 5. Go SDK surface
================================================================================

The Go SDK is the same trait surface in Go syntax. Since the
polyrepo is heavy in Go (nanovms is Go, BytePort's backend is Go),
the Go SDK is not optional.

```go
// pheno-compute-go/compute.go

package compute

import (
    "context"
    "io"
)

// ComputeProvider is the Go mirror of the Rust trait.
type ComputeProvider interface {
    Name() string
    Capabilities(ctx context.Context) (ProviderCapabilities, error)
    Place(ctx context.Context, spec WorkloadSpec) (WorkloadHandle, error)
    State(ctx context.Context, handle WorkloadHandle) (WorkloadState, error)
    Watch(ctx context.Context, handle WorkloadHandle) (<-chan LifecycleEvent, error)
    Stop(ctx context.Context, handle WorkloadHandle) error
    Delete(ctx context.Context, handle WorkloadHandle) error
}

// WorkloadSpec is the value type. The OCI Reference is
// imported from `phenotype-types` (the shared Go crate).
type WorkloadSpec struct {
    Image     phenotype_types.OCIReference
    Name      string
    Resources ResourceSpec
    Isolation IsolationLevel
    Env       []EnvVar
    Ports     []PortMapping
    Volumes   []VolumeMount
    Tags      []Tag
}

// Usage example: deploy a workload.
func Deploy(ctx context.Context, p compute.ComputeProvider, spec compute.WorkloadSpec) error {
    handle, err := p.Place(ctx, spec)
    if err != nil {
        return fmt.Errorf("place: %w", err)
    }
    state, err := p.State(ctx, handle)
    if err != nil {
        return fmt.Errorf("state: %w", err)
    }
    if state != compute.WorkloadStateReady {
        events, err := p.Watch(ctx, handle)
        if err != nil {
            return fmt.Errorf("watch: %w", err)
        }
        for ev := range events {
            if ev.State == compute.WorkloadStateReady { break }
            if ev.State == compute.WorkloadStateFailed {
                return fmt.Errorf("workload failed: %s", ev.Reason)
            }
        }
    }
    return nil
}
```

The FFI boundary: nanovms (Go) is a Provider, but the FFI is from
Rust to Go (not the other way around). The Rust adapter
`pheno-compute-local` shells out to the `nvms` Go binary via
subprocess + JSON; the Go `nvms` binary is the source of truth for
local execution. This keeps the Rust SDK pure-Rust (no cgo) and
reuses the existing nanovms codebase.

================================================================================
## 6. TypeScript / WASM surface
================================================================================

The TypeScript surface is generated from the Rust types via
`wasm-bindgen` + `ts-rs`. The output is a single npm package
`@pheno/compute` with:

```typescript
// @pheno/compute - generated from pheno-compute-core

export interface ComputeProvider {
  name(): string;
  capabilities(): Promise<ProviderCapabilities>;
  place(spec: WorkloadSpec): Promise<WorkloadHandle>;
  state(handle: WorkloadHandle): Promise<WorkloadState>;
  watch(handle: WorkloadHandle): AsyncIterable<LifecycleEvent>;
  stop(handle: WorkloadHandle): Promise<void>;
  delete(handle: WorkloadHandle): Promise<void>;
}

export class FlyProvider implements ComputeProvider { /* ... */ }
export class AwsFargateProvider implements ComputeProvider { /* ... */ }
export class VercelProvider implements ComputeProvider { /* ... */ }
export class LocalProvider implements ComputeProvider { /* ... */ }

// Usage example
import { FlyProvider, Scheduler, WorkloadSpec } from '@pheno/compute';

const fly = new FlyProvider({ token: process.env.FLY_TOKEN });
const scheduler = new CheapestProvider([fly]);
const handle = await scheduler.place({
  image: { registry: null, repository: 'my-app', tag: '1.2.3' },
  name: 'my-app-prod',
  resources: { cpuMillicores: 1000, memoryMib: 512 },
  isolation: 'container',
  env: [],
  ports: [{ containerPort: 8080, protocol: 'tcp' }],
  volumes: [],
  tags: [['env', 'prod']],
});
console.log(`Deployed: ${handle.endpoints[0].url}`);
```

The TypeScript target is a 1:1 mirror of the Rust types. The
generation is part of the build (not a hand-maintained file), so
drift is impossible.

================================================================================
## 7. Crate layout
================================================================================

New polyrepo member: `pheno-compute` (the SDK workspace). The
existing `nanovms` and `PhenoCompose` repos are NOT moved; the new
repo consumes from them via path/git deps.

```
pheno-compute/
  Cargo.toml                          # workspace root
  crates/
    pheno-compute-core/               # the trait surface
    pheno-compute-types/              # value types (WorkloadSpec, etc.)
    pheno-compute-scheduler/          # the default Scheduler
    pheno-compute-policy/             # the default PolicyGate
    pheno-compute-observe/            # Tracely integration
    pheno-compute-cli/                # `pheno-deploy` CLI
    pheno-compute-fly/                # Fly.io adapter
    pheno-compute-aws/                # AWS Fargate + Lambda adapter
    pheno-compute-vercel/             # Vercel adapter
    pheno-compute-supabase/           # Supabase Edge adapter
    pheno-compute-local/              # nanovms subprocess adapter
    pheno-compute-bare/               # Hetzner/OVH/DO adapter
  sdk/
    go/                               # Go SDK (submodule)
    ts/                               # TypeScript SDK (submodule, generated)
  proto/                              # protobuf / WIT schemas
  docs/
    adr/  specs/  operations/  reference/
```

Member count is 12 (10 impl + 2 infra) plus 2 SDK submodules.
The number is high but each crate is small (target 200-400 lines)
and independently publishable.

Migration from current state:
- `pheno-compute-core` consumes `phenotype-types` (extracted from
  PhenoCompose/port-types in step 1 of the audit's next-steps).
- `pheno-compute-core` defines the CloudProvider port (Rust
  mirror of nanovms SandboxPort, but for remote clouds).
- `pheno-compute-local` calls the `nvms` Go binary via subprocess
  (no FFI; no cgo; pure-Rust adapter that wraps a Go process).
- `pheno-compute-observe` consumes `tracely-core` and re-exports
  the EventSink impl.

What happens to PhenoCompose port-* crates:
- `port-types` -> deprecated, re-exports from `pheno-compute-types`
- `port-runtime` -> stays; becomes an internal trait used by
  `pheno-compute-local` (and not the public SDK surface)
- `port-composer` -> stays; the Composer becomes part of the
  Scheduler's decision logic
- `port-publisher` -> stays; publishing is a Scheduler concern
- `port-secret` -> stays; the Secret type is consumed by the
  WorkloadSpec, but the secret material is never in the spec
- `port-di` -> deprecated; replaced by `pheno-compute-core`'s
  provider registry
- `secret-file-adapter` -> stays; the file adapter is the
  default impl for local dev

What happens to nanovms:
- nanovms stays. The Go binary `nvms` is the local-execution
  backend. The Rust SDK calls it via subprocess.
- The CloudProviderPort is added to nanovms (Go interface) so
  future Go consumers have the same shape.
- The hexagonal architecture in nanovms is preserved; only the
  port set grows.

================================================================================
## 8. Migration path from current state
================================================================================

The "no backwards compat shims" rule from the user's AGENTS.md
means: clean break, no transition period. Each migration step
removes the old path entirely.

| Step | What lands | What is removed |
|------|------------|-----------------|
| 1. Extract `phenotype-types` | New `phenotype-types` crate with OCI Reference + Manifest + PortError. nanovms and PhenoCompose consume from it. | PhenoCompose `port-types/src/oci.rs` body. |
| 2. Add `CloudProvider` Rust trait | New trait in `pheno-compute-core`. Fly.io impl in `pheno-compute-fly`. | Nothing (additive). |
| 3. Add `CloudProviderPort` Go interface | New interface in nanovms `internal/ports/`. Fly.io impl in `internal/adapters/fly/`. | Nothing (additive). |
| 4. Add `Scheduler` + `PolicyGate` | New traits in `pheno-compute-core`. Default impls in `pheno-compute-scheduler` + `pheno-compute-policy`. | Nothing (additive). |
| 5. Wire `EventSink` -> Tracely | New `pheno-compute-observe` crate. nanovms and PhenoCompose emit via EventSink. | Direct Tracely calls in caller code. |
| 6. Add `ProviderCapabilities` | New struct in `pheno-compute-types` (Rust) + nanovms `internal/domain/` (Go). | Ad-hoc capability checks. |
| 7. Move Tracera frontend out | Move `frontend/` from Tracera to BytePort (or its own repo). | Tracera's frontend dir. |
| 8. Remove "Slop Expected" badge | Doc-only PR. | The badge from production-tier READMEs. |

After step 8, the compute layer has:
- A single type system (`phenotype-types`).
- A multi-cloud provider abstraction (`CloudProvider` Rust,
  `CloudProviderPort` Go).
- A scheduler + policy gate.
- Auto-instrumented observability (Tracely via EventSink).
- Machine-readable capabilities.
- No frontend in the backend repos.
- A coherent docs posture.

This is the minimum bar for "mature / enterprise / prod grade".

================================================================================
## 9. Observability + policy
================================================================================

### 9.1 Observability

Tracely plugs in as the default `EventSink` impl. Every
`ComputeProvider` method call emits:
- a trace span (start, end, attrs: provider, workload, region)
- a metric (counter `pheno_compute_<op>_total`,
  histogram `pheno_compute_<op>_duration_seconds`)
- a structured log line (with the same attrs as the span)

The default exporter is OTLP (so OpenTelemetry collectors work
out of the box). Prometheus, Jaeger, and Zipkin are also supported
via Tracely's existing exporters.

`pheno-compute-sentinel` is the SLO / error-budget engine. It
ships as a separate crate that consumers can opt into. The
sentinel watches the emitted metrics and alerts when the error
budget is burning faster than the policy allows.

### 9.2 Policy

The default `PolicyGate` is permissive: any workload is allowed
if the spec is well-formed. Production deployments override with
a strict policy. The policy language is Rust code (not Rego or
a custom DSL) because the user prefers Rust > Go > Zig > Mojo
and the polyrepo is Rust-heavy. A policy is just a struct that
implements the `PolicyGate` trait.

Example policy: cost limit + region allow-list.

```rust
pub struct ProdPolicy {
    pub max_cost_per_hour: f64,
    pub allowed_regions: Vec<String>,
    pub image_allowlist: Vec<String>,
}

#[async_trait]
impl PolicyGate for ProdPolicy {
    async fn check(
        &self,
        spec: &WorkloadSpec,
        ctx: &PolicyContext,
    ) -> Result<(), PolicyError> {
        // Cost: estimate from resources + cheapest provider.
        // Region: reject if not in allow-list.
        // Image: reject if not in allow-list.
        // ...
    }
}
```

### 9.3 Audit trail

Every `place` call is logged with:
- actor (from `PolicyContext.actor`)
- workspace (from `PolicyContext.workspace`)
- spec (without env / secrets)
- chosen provider + region
- capabilities at decision time
- policy decision (allowed / denied)
- result (WorkloadHandle or error)

The audit log is a structured log line; consumers can ship it
to any log aggregator. Tracely's exporter handles the rest.

================================================================================
## 10. Security model
================================================================================

### 10.1 Threat model summary

The compute layer is the substrate that runs user code. The
threats are:
- **T1: Malicious workload escapes its isolation.** A container
  with a kernel exploit breaks out and accesses the host or
  other workloads. Mitigated by isolation level (Container vs
  MicroVm vs Unikernel vs Wasm), seccomp, and the provider's
  own isolation guarantees.
- **T2: Secret leakage.** The caller passes a secret in env or
  a volume mount; the provider's logs leak it. Mitigated by the
  `SecretSpec` type (the secret material is never in the
  `WorkloadSpec`), the ProviderCapabilities contract (providers
  MUST NOT log env values), and the audit-log filter.
- **T3: Cost amplification.** A bug or attack places thousands
  of workloads. Mitigated by the `PolicyGate` (cost limits) and
  per-workspace rate limits in the Scheduler.
- **T4: Supply chain.** A malicious dependency in the SDK or
  in a cloud adapter exfiltrates data. Mitigated by `cargo-deny`
  + `cargo-audit` in CI, vendored Go dependencies in nanovms,
  and pinned versions in `Cargo.lock` / `go.sum`.
- **T5: API key compromise.** The provider API key is stolen
  and used to deploy workloads outside the policy. Mitigated by
  short-lived tokens (where the provider supports them), the
  PolicyGate checking image allow-lists, and the audit log
  catching the actor.

### 10.2 Must-have controls

1. **No secrets in `WorkloadSpec`.** Secrets are passed via a
   separate `SecretRef` that the provider resolves at runtime.
2. **Provider adapters MUST NOT log env values.** This is in
   the contract; violating it is a bug.
3. **`PolicyGate` is mandatory in production.** The default
   implementation is permissive; production deployments must
   override.
4. **`unsafe_code = "forbid"` in every public crate.** FFI is
   the only place `unsafe` is allowed, and only at the boundary.
5. **Dependencies are pinned and vendored.** `cargo-deny` and
   `cargo-audit` run on every PR. Go deps are vendored (per
   nanovms's existing pattern).

### 10.3 Secret handling

Secrets are NEVER:
- In the `WorkloadSpec` struct.
- In environment variables at compile time.
- In a log line, audit log, or trace span.
- In a config file (use env vars or a secret manager).
- In a test fixture (use mocks).

Secrets are:
- In a `SecretSpec` with a `SecretRef::File` (path on the
  host) or `SecretRef::Provider(name, key)` (provider-native
  secret store). The provider resolves the ref at deploy time.
- In a secret manager (AWS Secrets Manager, HashiCorp Vault,
  Fly Secrets). The SDK does not own secret material; it
  only references it.

================================================================================
## 11. Versioning + release plan
================================================================================

### 11.1 Semver strategy

- `0.x.y` -- pre-1.0; minor versions may break the API.
- `1.0.0` -- stable; minor versions are additive, major versions
  may break.
- Trait additions (new methods with default impls) are MINOR.
- Trait breaking changes (removing a method, changing a signature)
  are MAJOR.
- The Rust + Go + TS SDKs are versioned in lockstep. A
  `1.2.0` of the polyrepo publishes `1.2.0` of every SDK.

### 11.2 v0.1 scope (3 months, ~Q4 2026)

- `pheno-compute-core` (the trait surface) is stable.
- `pheno-compute-types` is stable.
- 3 cloud providers at parity: Fly.io, AWS Fargate, Vercel.
- Local provider via nanovms subprocess.
- Default Scheduler: cheapest provider that meets the spec.
- Default PolicyGate: permissive.
- EventSink -> Tracely (OTLP exporter).
- TypeScript SDK (generated from Rust).
- Go SDK (manual, mirrors the Rust traits).
- 1 end-to-end test per provider (deploy + verify + delete).
- 80% test coverage on `pheno-compute-core`.

### 11.3 v0.5 scope (6 months, ~Q1 2027)

- Lambda + Supabase Edge providers.
- Scheduler: cost-driven + latency-driven policies.
- PolicyGate: production-ready default (cost limits, region
  allow-lists, image allow-lists).
- Sentinel: SLO + error budget engine.
- 1 reference consumer (BytePort adopts the SDK).
- 90% test coverage on `pheno-compute-core`.

### 11.4 v1.0 scope (12 months, ~Q3 2027)

- All 7 providers at parity for the common case.
- Scheduler: full policy DSL (Rust function composition).
- PolicyGate: full audit log integration.
- SDKs: Rust, Go, TypeScript, Python (the user's preferred
  stack is Rust > Go > Zig > Mojo; Python is for glue).
- 2 reference consumers (BytePort + Eidolon).
- 95% test coverage on `pheno-compute-core`.
- API stable; trait surface ratified.
- "Mature / enterprise / prod grade" claim is defensible.

### 11.5 What "mature / enterprise / prod grade" means

The user wrote: "the optimal/mature/enterprise/prod grade version".
The bar is:
- Stable trait surface (no breaking changes between minors).
- 95% test coverage on the trait surface and the scheduler.
- 80% test coverage on each provider adapter.
- All providers pass an integration test against a real account
  (not a mock).
- Full docs: ADR per major decision, specs for every trait,
  operations runbook, reference manual.
- CI on every PR: cargo-deny, cargo-audit, oxlint, clippy,
  go vet, golangci-lint, npm test, tsc, vitest.
- Security: no `unsafe` in trait surface, secrets never logged,
  PolicyGate mandatory in production.

================================================================================
## 12. Open questions
================================================================================

### 12.1 For the sponsor (Koosha)

1. **Is Rust the right canonical language?** The user prefers
   Rust > Go > Zig > Mojo. The spec is Rust-first. Confirm
   this is the right call, or if the canonical surface should
   be language-neutral (e.g., WIT) with Rust as one impl.
2. **Is Fly.io the right v1 priority?** Fly's Machines API is
   the cleanest expression of the trait surface, but the user
   may have a different cloud priority (e.g., Vercel first
   because BytePort already deploys there).
3. **Should the SDK own a CLI?** `pheno-deploy` is in v0.1
   scope. Confirm or defer to BytePort.
4. **Should nanovms be renamed?** The name "nanovms" implies
   Nanos-specific, but the repo now covers containers, WASM,
   process isolation, and VMs. Suggest `phenotype-compute-go`
   or similar. Sponsor sign-off needed before the rename.
5. **Should the polyrepo have a `pheno-compute` umbrella repo
   that consumes nanovms, PhenoCompose, etc.?** Or should
   each repo be standalone with a top-level `pheno-compute`
   workspace? The spec assumes the latter; the former may be
   simpler for adoption.

### 12.2 For the parent agent (/root)

1. **Are the 13 in-flight PRs blocking this work?** Specifically:
   - I (nanovms R-A P1) and J/K (PhenoCompose R-A P1/P2)
     touch the same files this spec references. Land them
     first or in parallel?
   - F (Tracera spec 008) and L (Tracera P2) shape the
     observability story. Land them before step 5 of the
     migration.
2. **Should the spec ship as a `phenotype-rfcs` repo?** The
   polyrepo doesn't have a formal RFC process today. Either
   create one or land the spec in this session folder and
   promote to a canonical location when adopted.
3. **Who is the reviewer pool for the SDK PRs?** The spec
   defines a large surface; review bandwidth is the bottleneck.
   Suggest 2 reviewers per PR, drawn from the substrate +
   nanovms + PhenoCompose + BytePort maintainers.

### 12.3 Unresolved design questions

1. **Multi-region placement.** The Scheduler picks one provider
   + region per workload. Some workloads want replicas across
   multiple regions. The trait surface does not yet model this.
2. **Stateful workloads.** Volumes are modeled as `VolumeMount`,
   but the create / attach / detach lifecycle is not.
3. **Networking.** The trait surface has `ports` and
   `endpoints` but no concept of VPCs, private networks, or
   service mesh. Defer to v1.0 unless a consumer asks earlier.
4. **Cost attribution.** Tags are free-form; cost reports need
   structured tags. Suggest `env`, `team`, `service` as the
   standard tag keys; enforce in the ProviderCapabilities.
5. **Disaster recovery.** The trait surface does not model
   "deploy this workload in a different region if the primary
   region is down". Defer to v1.0.

================================================================================
## 13. What this spec does NOT do
================================================================================

To keep the scope tight:

- No frontend. BytePort and Eidolon own their UIs.
- No marketplace. A compute marketplace is a v1.0+ concern.
- No edge network. The 2030 vision includes it, but the
  v0.1/v0.5/v1.0 scope is cloud + local.
- No multi-tenant. The trait surface assumes a single
  workspace per consumer. Multi-tenant is a v1.0+ concern.
- No auto-scaling. The Scheduler picks a provider + region,
  but does not yet model "scale to N replicas". Defer to v0.5.
- No GitOps. The trait surface has no concept of "deploy from
  this Git ref". The integration is the consumer's job
  (BytePort already does it via its `odin.nvms` manifest).

These are all explicit out-of-scope statements, not omissions.
Each one is a candidate for a follow-up spec.

