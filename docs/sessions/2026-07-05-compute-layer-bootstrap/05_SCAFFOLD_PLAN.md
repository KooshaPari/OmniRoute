# Compute Layer Scaffold Plan -- 2026-07-05

> **Audit date:** 2026-07-05
> **Companion:** `01_compute_stack_audit.md`, `02_byteport_requirements.md`,
> `04_compute_architecture_spec.md` (draft v0.1)
> **Status:** DRAFT v0.1 (parent agent + sponsor sign-off required)

PR-1 of the compute layer is the workspace skeleton: a Cargo workspace
that compiles end-to-end, with one trait crate (`pheno-compute-core`) and
one provider impl as proof (`pheno-compute-fly`). After PR-1, BytePort
can adopt the SDK by adding `pheno-compute-core` to its `Cargo.toml`
and consuming the `ComputeProvider` trait; the actual implementation
selection (Fly vs AWS vs Vercel) is a runtime config decision.

This plan is opinionated. One path; alternatives only at genuine tradeoffs.

---

## 1. Cargo workspace layout

Root `Cargo.toml` at `pheno-compute/` (new top-level polyrepo checkout,
sibling of `OmniRoute/`):

```toml
[workspace]
resolver = "2"
members = [
    "crates/pheno-compute-core",
    "crates/pheno-compute-fly",
    "crates/pheno-compute-aws",
    "crates/pheno-compute-vercel",
    "crates/pheno-compute-supabase",
    "crates/pheno-compute-local",
    "crates/pheno-compute-bare",
    "crates/pheno-compute-ffi",
    "crates/pheno-compute-wasm",
]
```

| Crate | Purpose (1 line) | Depends on | Depended on by |
|---|---|---|---|
| `pheno-compute-core` | Trait surface, schema types, Scheduler, PolicyGate, EventSink | (none in workspace; serde, async-trait, thiserror, tracing) | Every other crate |
| `pheno-compute-fly` | Fly.io Machines API adapter | `pheno-compute-core`, `reqwest` | BytePort, Eidolon |
| `pheno-compute-aws` | AWS Fargate / Lambda / App Runner adapter | `pheno-compute-core`, `aws-sdk-ecs`, `aws-sdk-lambda` | BytePort |
| `pheno-compute-vercel` | Vercel Functions + Edge adapter | `pheno-compute-core`, `reqwest` | BytePort |
| `pheno-compute-supabase` | Supabase Edge Functions adapter | `pheno-compute-core`, `reqwest` | BytePort |
| `pheno-compute-local` | Local Docker / Podman / nanovms adapter | `pheno-compute-core`, `bollard`, `nanovms-sys` | CLI, dev laptop |
| `pheno-compute-bare` | Hetzner / OVH / bare-metal via SSH | `pheno-compute-core`, `russh` | BytePort (Tier 3+) |
| `pheno-compute-ffi` | C-ABI bridge for Go (cgo) and Zig | `pheno-compute-core`, `cbindgen` | Go SDK, Zig shims |
| `pheno-compute-wasm` | WASM target (browser + edge worker) | `pheno-compute-core`, `wasm-bindgen` | Browser-based dashboards |

**PR-1 lands only 4 of these:** `pheno-compute-core`, `pheno-compute-fly`,
`pheno-compute-local`, `pheno-compute-ffi`. The others are PR-3+ per
the phasing in section 5.

---

## 2. Trait surface sketch (`pheno-compute-core`)

```rust
//! The contract every compute provider implements.
//!
//! Per design principle 3 in 04_compute_architecture_spec.md:
//! - Object-safe (storable as `Box<dyn ComputeProvider>`).
//! - `Send + Sync` (callable from any thread).
//! - Idempotent (the doc comment on every method is "calling this method
//!   twice with the same arguments has the same effect as calling it once").
//! - `async fn` only via `async-trait` (Rust 1.75 native `async fn in trait`
//!   is allowed but `Box<dyn Trait>` requires the explicit annotation).

#![forbid(unsafe_code)] // principle 2

use std::collections::BTreeMap;
use std::time::Duration;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub mod schema;
pub mod scheduler;
pub mod policy;

// ---------------------------------------------------------------------------
// Public ID types (UUID v7 newtypes, same pattern as omni-core::ids)
// -------------------------------------------------------------------------

pub struct WorkloadId(pub uuid::Uuid);
pub struct TenantId(pub String);  // slug, same shape as omni-core::TenantId

// ---------------------------------------------------------------------------
// Provider capability advertisement
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    /// Human-readable name (e.g. "Fly.io", "AWS Fargate", "Local Docker").
    pub name: String,
    /// Cloud region(s) this provider can target.
    pub regions: Vec<String>,
    /// Maximum cold-start budget the provider guarantees.
    pub cold_start_budget: Duration,
    /// Maximum single-workload memory.
    pub max_memory_mib: u32,
    /// Whether `deploy` is idempotent at the API level (most are not;
    /// the SDK adds idempotency in the PolicyGate layer).
    pub api_idempotent: bool,
}

// ---------------------------------------------------------------------------
// WorkloadSpec -- the input to `deploy`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkloadSpec {
    /// OCI image ref (e.g. `registry.fly.io/myapp:abc123`).
    pub image: String,
    /// Region to deploy to (e.g. `iad`, `sfo`, `us-east-1`).
    pub region: String,
    /// Memory request in MiB; provider may round up.
    pub memory_mib: u32,
    /// CPU millicores (1000 = 1 vCPU).
    pub cpu_millicores: u32,
    /// Environment variables.
    pub env: BTreeMap<String, String>,
    /// Port the workload listens on.
    pub port: u16,
    /// Replica count.
    pub replicas: u32,
    /// Provider-specific extensions. See `schema/extensions.md`.
    #[serde(default)]
    pub extensions: BTreeMap<String, serde_json::Value>,
}

// ---------------------------------------------------------------------------
// WorkloadHandle -- the output of `deploy`, the input to `inspect`/`destroy`
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkloadHandle {
    pub id: WorkloadId,
    pub provider: String,        // e.g. "fly"
    pub region: String,
    /// Provider-specific locator (e.g. Fly app name + machine ID).
    pub locator: BTreeMap<String, String>,
    /// Current state (provider may return its own enum; we normalize).
    pub state: WorkloadState,
    /// Public URL if available.
    pub url: Option<String>,
    /// When the workload entered its current state.
    pub state_changed_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WorkloadState { Pending, Booting, Healthy, Draining, Destroyed, Failed }

// ---------------------------------------------------------------------------
// EventSink -- observability hook (principle: every state change publishes)
// -------------------------------------------------------------------------

#[async_trait]
pub trait EventSink: Send + Sync {
    async fn on_state_change(&self, handle: &WorkloadHandle, from: WorkloadState);
    async fn on_error(&self, handle: Option<&WorkloadHandle>, err: &ComputeError);
}

// ---------------------------------------------------------------------------
// The trait itself
// ---------------------------------------------------------------------------

#[async_trait]
pub trait ComputeProvider: Send + Sync {
    /// What this provider can do. Stable across the provider's lifetime.
    fn capabilities(&self) -> &ProviderCapabilities;

    /// Deploy a workload. Idempotent at the SDK layer (see PolicyGate):
    /// the SDK de-duplicates by `(tenant_id, image, region, replicas)`;
    /// the provider API is hit at most once per WorkloadSpec.
    async fn deploy(&self, spec: WorkloadSpec) -> Result<WorkloadHandle, ComputeError>;

    /// Inspect a deployed workload. Read-only.
    async fn inspect(&self, id: WorkloadId) -> Result<WorkloadHandle, ComputeError>;

    /// Destroy a deployed workload. Idempotent: calling on a destroyed
    /// workload returns `Ok` with `state = Destroyed`.
    async fn destroy(&self, id: WorkloadId) -> Result<(), ComputeError>;

    /// Liveness probe. Cheap (HEAD/OPTIONS to a known endpoint).
    async fn health(&self) -> Result<(), ComputeError>;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum ComputeError {
    #[error("provider API error: {status} {message}")]
    Provider { status: u16, message: String, retriable: bool },
    #[error("authentication failed")]
    Auth,
    #[error("workload not found: {0}")] NotFound(WorkloadId),
    #[error("validation error: {0}")]  Validation(String),
    #[error("rate limited (retry after {retry_after_ms}ms)")]
    RateLimited { retry_after_ms: u64 },
    #[error("internal error: {0}")]    Internal(#[source] anyhow::Error),
}

pub type Result<T> = std::result::Result<T, ComputeError>;
```

**Non-obvious choices and the principle they cite:**

- `Box<dyn ComputeProvider>` (not generic) -- principle 1 (no cloud SDK in
  user code). Consumers should be able to swap providers at runtime.
- `async_trait` (not native `async fn`) -- principle 3 (object-safe).
  Native `async fn in trait` is allowed but breaks `dyn Trait` without
  nightly feature flags. Stick with `async_trait` for v1.
- `WorkloadHandle` carries a `BTreeMap<String, String> locator` -- principle 4
  (schemas before code). The locator is the provider-specific blob; we keep
  it as a map so the consumer never needs to know provider internals.
- `EventSink` is a separate trait -- principle 3 (Send + Sync). Allows
  swapping the OTel exporter for a no-op in tests.
- `ComputeError::retriable: bool` on `Provider` variant -- principle 3
  (idempotency). The Scheduler can read this flag to decide whether to
  retry without parsing the message string.

---

## 3. One provider impl as proof (`pheno-compute-fly`)

```rust
//! Fly.io Machines API adapter.
//!
//! Why Fly first: it has the cleanest API (single endpoint per machine),
//! no implicit VPC peering, and a 30-line `fly machines launch` CLI that
//! maps 1:1 to `deploy`. The other providers (AWS, Vercel) require
//! juggling IAM, subnets, and edge configs that we don't want to debug
//! in the first PR.

use std::time::Duration;
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use pheno_compute_core::{
    ComputeError, ComputeProvider, EventSink, ProviderCapabilities, Result,
    WorkloadHandle, WorkloadId, WorkloadSpec, WorkloadState,
};

/// Fly-specific configuration.
#[derive(Debug, Clone)]
pub struct FlyConfig {
    pub api_token: String,        // Fly API token (env: FLY_API_TOKEN)
    pub org_slug: String,         // e.g. "koosha"
    pub default_region: String,   // e.g. "iad"
    pub request_timeout: Duration,
}

/// The Fly provider. One instance per (api_token, org_slug); the `Client`
/// is shared for connection pooling across all workloads.
pub struct FlyProvider {
    cfg: FlyConfig,
    client: Client,
    event_sink: Box<dyn EventSink>,
}

impl FlyProvider {
    /// Build a new FlyProvider. Validates the config (non-empty token,
    /// non-empty org, non-zero timeout).
    pub fn new(cfg: FlyConfig, event_sink: Box<dyn EventSink>) -> Result<Self>;

    /// Borrow the underlying HTTP client (used by integration tests
    /// to point at `wiremock`).
    pub fn client(&self) -> &Client;
}

#[async_trait]
impl ComputeProvider for FlyProvider {
    fn capabilities(&self) -> &ProviderCapabilities {
        &self.caps   // pre-computed in `new`
    }

    /// POST /v1/apps/{app_slug}/machines  (idempotent at the API level via
    /// the SDK's PolicyGate: we never re-POST the same WorkloadSpec).
    async fn deploy(&self, spec: WorkloadSpec) -> Result<WorkloadHandle>;

    /// GET /v1/apps/{app_slug}/machines/{machine_id}
    async fn inspect(&self, id: WorkloadId) -> Result<WorkloadHandle>;

    /// DELETE /v1/apps/{app_slug}/machines/{machine_id}  (idempotent:
    /// re-DELETE returns 404 which we map to Ok).
    async fn destroy(&self, id: WorkloadId) -> Result<()>;

    /// GET /v1/apps with auth; 200 = ok.
    async fn health(&self) -> Result<()>;
}
```

**Which methods are async / blocking / pure:**

- `capabilities` -- **pure sync**, returns a pre-computed static ref.
- `deploy` -- **async, blocking on HTTP** (Fly's `POST /machines` is
  1-3s; we do not background this -- the caller awaits it).
- `inspect` -- **async, blocking on HTTP** (sub-second normally).
- `destroy` -- **async, blocking on HTTP** (1-2s for Fly to release the IP).
- `health` -- **async, blocking on HTTP** (sub-second; used by the
  Scheduler's health-check loop).

No method is "pure compute" -- every method except `capabilities` is an
HTTP call. PR-1 keeps the implementation single-threaded-per-instance;
PR-2 adds a `tokio::sync::Semaphore` if concurrency pressure emerges.

---

## 4. Schemas

**Recommended: Protocol Buffers (proto3) for `WorkloadSpec` and
`ProviderCapabilities`.**

Justification (3 lines):
- proto3 has a stable wire format, code generation for Rust/Go/Zig, and
  is the 2026 default for cross-language polyrepo APIs.
- The Cargo workspace already vendors `tonic` and `prost` for the
  OmniRoute rewrite (per 02_POLYGLOT_ARCHITECTURE.md section 3.1).
- WIT is too WASI-specific; JSON Schema is too verbose for binary-ish
  config like `extensions`.

Example `WorkloadSpec` in proto3:

```protobuf
syntax = "proto3";
package pheno.compute.v1;

import "google/protobuf/duration.proto";

message WorkloadSpec {
  string image = 1;                                  // OCI ref
  string region = 2;
  uint32 memory_mib = 3;
  uint32 cpu_millicores = 4;
  map<string, string> env = 5;
  uint32 port = 6;
  uint32 replicas = 7;
  map<string, google.protobuf.Struct> extensions = 8;
}

message ProviderCapabilities {
  string name = 1;
  repeated string regions = 2;
  google.protobuf.Duration cold_start_budget = 3;
  uint32 max_memory_mib = 4;
  bool api_idempotent = 5;
}
```

**PR-1 ships the `.proto` files plus the generated Rust types in
`pheno-compute-core/src/schema/`.** PR-3 generates the Go and Zig
types from the same `.proto` files (per the polyglot spec).

---

## 5. Scaffolding PR breakdown (3 PRs, in order)

### PR-1: workspace + trait + Fly proof (this session's plan)

Files added:

```
pheno-compute/
  Cargo.toml                                  # workspace root
  Cargo.lock                                  # committed
  rust-toolchain.toml                         # 1.83 stable
  README.md                                   # 50 lines, the charter
  crates/pheno-compute-core/
    Cargo.toml
    src/lib.rs                                # 30 lines
    src/provider.rs                           # 200 lines (the trait)
    src/handle.rs                             # 80 lines (WorkloadHandle)
    src/error.rs                              # 60 lines (ComputeError)
    src/event_sink.rs                         # 30 lines (the trait)
    src/schema/
      mod.rs
      workload.proto                          # 40 lines
      capabilities.proto                      # 20 lines
      BUILD.bazel                             # optional
    src/scheduler/
      mod.rs                                  # placeholder
    src/policy/
      mod.rs                                  # placeholder
  crates/pheno-compute-fly/
    Cargo.toml
    src/lib.rs                                # 30 lines
    src/provider.rs                           # 220 lines (FlyProvider)
    src/machines.rs                           # 180 lines (Fly API shapes)
    src/error.rs                              # mapping to ComputeError
    tests/integration.rs                      # 6 tests
  crates/pheno-compute-local/
    Cargo.toml
    src/lib.rs                                # stub -- returns
    src/provider.rs                           #   NotImplemented("PR-2")
  crates/pheno-compute-ffi/
    Cargo.toml
    cbindgen.toml                             # C header generation
    src/lib.rs                                # 30 lines
    src/bridge.rs                             # 120 lines (C ABI)
    include/pheno_compute.h                   # generated
```

**Exit criteria:** `cargo build --workspace --all-targets` exits 0;
`cargo test -p pheno-compute-core -p pheno-compute-fly` passes
(>= 6 integration tests against `wiremock`); `cargo doc --workspace
--no-deps` produces zero warnings; `cbindgen --config cbindgen.toml
--crate pheno-compute-ffi --output include/pheno_compute.h` produces
a header that compiles in a 5-line C hello-world.

**Single commit message:**
`feat(compute): PR-1 workspace + ComputeProvider trait + Fly proof`

### PR-2: Local provider + Scheduler + PolicyGate

Lands `pheno-compute-local` (real impl, not stub) using `bollard` for
Docker. Lands the Scheduler (decides where to deploy based on
`ProviderCapabilities` and `WorkloadSpec`). Lands the PolicyGate (the
idempotency layer that deduplicates deploys).

**Exit criterion:** a single test deploys the same `WorkloadSpec`
twice and asserts only one upstream call was made.

### PR-3: AWS + Vercel + Supabase + FFI consumers

Lands the other three provider crates + the Go and Zig FFI consumers
(calling `pheno-compute-ffi` via cgo and extern "C"). Lands the
generated proto types for Go and Zig.

**Exit criterion:** `byteport compute deploy --provider aws --image ...`
succeeds against a real AWS account (sponsor-provided credentials);
same for `--provider vercel` and `--provider supabase`.

---

## 6. Deferral (out of v1, with revisit)

| Item | Why deferred | Revisit |
|---|---|---|
| `pheno-compute-bare` (Hetzner / OVH / SSH) | SSH-based deploys need a different transport (no HTTP API). Different error model. Risk of scope creep. | After PR-3 lands; the local-provider pattern is the right template. |
| `pheno-compute-wasm` (browser target) | Browser compute means running providers in the browser via WASM, which is a totally different product surface. | After the desktop polyglot spec (Eidolon) lands. |
| Mojo backend | Per 04_compute_architecture_spec.md section 3.4: Mojo's stable C-ABI is not landed in 2026; ONNX-in-Rust (`ort`) is the 2026 path. | When Mojo ships a stable C-ABI and at least one Tier-1 inference backend (estimate: 2027). |
| Scheduler sophistication (cost-based, region-affinity) | PR-2 lands a "first-fit" Scheduler. Cost-based scheduling needs pricing data the SDK does not have. | After BytePort ships its first 3 multi-cloud deployments. |
| PolicyGate DSL (rego / cedar) | Hard-coded rules in PR-2; a DSL is overkill for v1. | When the rule count exceeds ~20. |
| `pheno-compute-supabase` cross-region replication | Supabase Edge is single-region; multi-region is a 2027 Supabase feature. | 2027+ per Supabase roadmap. |
| `pheno-compute-oci` (Oracle Cloud) | Same shape as AWS Fargate; not in v1 because no Phenotype workload needs OCI in 2026. | If/when a sponsor workload requires OCI. |

---

## 7. Exit criteria for "scaffold plan" (this document)

This plan is "done" when:

1. The 4 PR-1 crates are laid out in section 1.
2. The trait surface in section 2 compiles standalone
   (`cargo build -p pheno-compute-core`).
3. The Fly proof in section 3 has exact signatures the implementation
   PR will follow.
4. The proto3 schemas in section 4 are committed at
   `crates/pheno-compute-core/src/schema/`.
5. The 3-PR breakdown in section 5 is the canonical work order.
6. The deferral list in section 6 is the canonical "out of v1".

Sponsor sign-off requested on:

- **Q1** -- proto3 vs WIT vs JSON Schema. Plan recommends proto3.
- **Q2** -- Fly vs AWS as the PR-1 proof provider. Plan recommends Fly.
- **Q3** -- workspace location: new `pheno-compute/` top-level checkout
  (sibling of `OmniRoute/`) vs. inside an existing repo. Plan recommends
  the new top-level checkout (per the polyglot spec, principle 5: "the
  polyrepo, not the framework").

All three are deferrable; default answers are proto3 / Fly / new
top-level checkout.
