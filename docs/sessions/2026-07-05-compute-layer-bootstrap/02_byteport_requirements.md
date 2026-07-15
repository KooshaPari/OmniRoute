# BytePort Requirements -- 2026-07-05

Companion to `01_compute_stack_audit.md` and `04_compute_architecture_spec.md`.
This doc is the BytePort-side delta: what the compute layer SDK must
provide so BytePort can deliver the multi-cloud promise in its CHARTER.

BytePort is the user-owned surface; the compute layer sits below it.
BytePort is NOT in scope for this session -- but the SDK work
(defined in the spec) IS shaped by what BytePort needs.

================================================================================
## 1. BytePort surface summary
================================================================================

BytePort is an Infrastructure-as-Code deployment + portfolio UX platform.
Per its CHARTER (last updated 2026-06-12), it turns a single `odin.nvms`
manifest into a deployed, portfolio-worthy project. The developer writes
one declarative file; BytePort provisions the deployment via the `nvms`
MicroVM runtime, registers endpoints with a portfolio site, and uses an
LLM to generate showcase metadata.

Tenets (from CHARTER.md):
1. One manifest, one source of truth (`odin.nvms`).
2. Deploys are reproducible.
3. Portfolio is first-class, not an afterthought.
4. Local dev == production.
5. Pluggable LLM, no lock-in.
6. Self-hosted, not cloud-locked.

The user's directive frames BytePort as: "a combination + evolution of:
AWS/GCP/Vercel/Supabase... so on for all our use cases that can manage
various host systems + abstract to those true systems." That IS the
multi-cloud promise; the CHARTER's tenet 6 ("self-hosted, not cloud-
locked") reinforces it.

### Crate map (10 Rust crates + 1 Go backend)

| Crate / module | Role |
|----------------|------|
| `frontend/web` | SvelteKit web dashboard |
| `frontend/web/src-tauri` | Tauri desktop shell + Rust integration |
| `backend/byteport` | Go domain logic + server-side coordination |
| `backend/nvms` | Go `nvms` Spin/Fermyon wasm module -- deploy/terminate HTTP API on port 3000 |
| `crates/byteport-cli` | `byteport` CLI binary |
| `crates/byteport-dag` | DAG foundation for Phenotype compute/infra (epic F) |
| `crates/byteport-engine` | **Pluggable deployment-engine abstraction (Phase 3A of byteport-evolution-v1)** -- THE seam where the compute SDK plugs in |
| `crates/byteport-otel` | OpenTelemetry instrumentation (metrics, tracing, OTLP) |
| `crates/byteport-registry-adapter` | Invokes `phenotype-registry` `grade.sh` and parses JSON |
| `crates/byteport-transport` | Transport abstraction (`thiserror` 2.0) |
| `crates/pheno-dag` | Reusable DAG unit abstraction: lifecycle, YAML executor, automation gates |
| `crates/phenotype-types` | **Shared type definitions** (OCI instance records, path helpers, canonical data models) -- the existing `phenotype-types` seat! |
| `crates/integration` | Wires pheno-errors, pheno-tracing, pheno-config |

### Public SDK shape

- **Go SDK** (heavy): `backend/byteport/*` and `backend/nvms/*` are
  Go 1.25 modules. Deps include `aws-sdk-go-v2 v1.41.5`,
  `secretsmanager`, `gin v1.10.0`, `gorm` (postgres + sqlite),
  `workos-go v4.46.1`, `hashicorp/vault/api`. The Go backend is
  the only place AWS is currently consumed.
- **Rust SDK** (light): the 10 crates above, plus the `odin.nvms`
  manifest parser. `byteport-engine` is the pluggable backend.
- **TypeScript SDK** (frontend): SvelteKit + Tauri.

================================================================================
## 2. Compute primitives BytePort already uses
================================================================================

Direct dependencies (from `BytePort/backend/go.mod`):
- `github.com/aws/aws-sdk-go-v2` v1.41.5
- `github.com/aws/aws-sdk-go-v2/service/secretsmanager` v1.41.5
- `github.com/gin-gonic/gin` v1.10.0 (HTTP server)
- `gorm.io/driver/postgres` + `gorm.io/driver/sqlite` (DB)
- `github.com/workos/workos-go/v4` (auth)
- `github.com/hashicorp/vault/api` (secrets)
- `github.com/google/uuid` (ids)

Implicit assumptions (from `BytePort/STATUS.md`):
- `backend/nvms/main.go:25-35` -- `validateAction` has its auth
  middleware commented out. Auth is incomplete; the compute SDK
  must NOT rely on the existing auth path.
- `backend/nvms/projectManager/deploy.go:51` -- "NVMS YAML
  unmarshalling is a TODO". The manifest parsing is incomplete.
- `backend/nvms/lib/llm.go:22` -- `ProviderGemini` is a stub.
  LLM provider is a separate concern from compute.

Provider matrix: BytePort is currently AWS-first. The `nvms`
Spin/Fermyon wasm module is the local-execution backend. There
is NO multi-cloud adapter -- this is the gap the compute SDK
fills.

References in the code (from `rg "nvms|nanovms|pheno.compose" BytePort/`):
- `BytePort/ARCHITECTURE.md:19` documents the `backend/nvms` module
- `BytePort/STATUS.md:10,17,41-44` describes the current state +
  known TODOs
- `BytePort/crates/byteport-engine/src/lib.rs:10` comments on the
  Go backend and `backend/nvms/*.go` paths
- `BytePort/crates/byteport-cli/src/cli.rs:19` documents the
  `odin.nvms` manifest
- `BytePort/USER_JOURNEYS.md:37,48,50,58,65` walks the user
  journey through `nvms` to AWS
- `BytePort/justfile:42,57` runs `gofmt` on `backend/byteport` and
  `backend/nvms`
- `BytePort/packaging/{rpm,debian,snap,appimage}/*` carries
  `odin.nvms` references in metadata

================================================================================
## 3. Compute primitives BytePort needs that don't exist
================================================================================

The spec defines the target SDK. BytePort needs (in priority order):

1. **`byteport-engine` adapter that wraps the SDK's `ComputeProvider`
   trait.** Today `byteport-engine` is a stub; it is the seam
   where the compute SDK plugs in. The adapter translates the
   `odin.nvms` manifest (YAML) into a `WorkloadSpec` and calls
   `pheno_compute::place(...)`.

2. **Multi-cloud `ComputeProvider` impls.** BytePort's CHARTER
   tenet 6 ("self-hosted, not cloud-locked") commits to multi-cloud
   but BytePort's go.mod has only AWS. The SDK provides the impls
   (Fly, Vercel, Supabase); BytePort just needs to register them.

3. **ProviderCapabilities surfaced to the dashboard.** BytePort
   has a SvelteKit dashboard (frontend/web) that shows deployment
   status. The SDK emits `ProviderCapabilities` (regions, isolation
   levels, cold start, cost) -- BytePort surfaces this in the
   dashboard so users can see what each provider offers.

4. **Scheduler that respects the `odin.nvms` provider preference.**
   The manifest should let the user say `provider: fly` or
   `provider: cheapest`. The Scheduler trait (defined in spec
   section 3.5) handles this. BytePort's job: read the manifest
   preference, pass it to the Scheduler, surface the decision.

5. **PolicyGate integration with WorkOS auth.** BytePort uses
   WorkOS for auth (per go.mod: `workos-go/v4`). The `PolicyContext`
   (spec section 3.6) needs an `actor` field populated from the
   WorkOS session. The PolicyGate is the place where "this user
   is not allowed to deploy to that region" gets enforced.

6. **EventSink integration with byteport-otel.** BytePort already
   has `byteport-otel` (uses `tracing-opentelemetry` 0.33). The
   SDK's EventSink trait should plug in there so the compute
   operations emit OTel spans / metrics / logs by default.

7. **Manifest mapping for the `odin.nvms` schema.** The schema
   today is YAML + a TODO unmarshaller. The SDK's `WorkloadSpec`
   has a serde-derive Serialize/Deserialize; BytePort's manifest
   can be parsed directly into `WorkloadSpec` with a small
   `From<OdinManifest>` impl.

8. **Local dev parity (tenet 4).** CHARTER tenet 4 says "local dev
   == production". The SDK's `pheno-compute-local` adapter shells
   out to the `nvms` Go binary. BytePort's existing `nvms`
   backend already provides local execution; the SDK wraps it.

================================================================================
## 4. Contract surface for the compute layer
================================================================================

This is the byteport-engine contract. The `ComputeProvider` trait
(spec section 3.1) is the canonical Rust surface; the Go SDK
mirrors it (spec section 5). BytePort consumes both.

### Rust SDK contract (consumed by `byteport-engine`)

```rust
// crates/byteport-engine/src/adapter.rs (target shape)

use pheno_compute_core::{ComputeProvider, WorkloadSpec, WorkloadHandle};

/// The `byteport-engine` adapter that wraps the compute SDK.
/// Replaces the stub implementation in byteport-engine/src/lib.rs.
pub struct ComputeEngineAdapter {
    provider: Arc<dyn ComputeProvider>,
    scheduler: Arc<dyn Scheduler>,
    policy: Arc<dyn PolicyGate>,
    observer: Arc<dyn EventSink>,
}

impl ComputeEngineAdapter {
    /// Deploy a project from the `odin.nvms` manifest.
    pub async fn deploy(
        &self,
        manifest: OdinManifest,
        actor: WorkosUser,
    ) -> Result<Deployment, EngineError> {
        // 1. Translate manifest -> WorkloadSpec.
        let spec: WorkloadSpec = manifest.into();
        // 2. Check policy.
        self.policy.check(&spec, &PolicyContext {
            actor: format!("user:{}", actor.id),
            workspace: manifest.workspace,
            tags: spec.tags.clone(),
        }).await?;
        // 3. Schedule.
        let provider = self.scheduler.choose(&spec, &[self.provider.clone()]).await?;
        // 4. Place.
        let handle = provider.place(&spec).await?;
        // 5. Watch until ready.
        let mut events = provider.watch(&handle).await?;
        while let Some(ev) = events.next().await {
            match ev.state {
                WorkloadState::Ready => break,
                WorkloadState::Failed => return Err(EngineError::DeployFailed(ev.reason)),
                _ => continue,
            }
        }
        Ok(Deployment::from(handle))
    }
}
```

### Go SDK contract (consumed by `backend/nvms`)

```go
// backend/nvms/deploy/handler.go (target shape)

package deploy

import (
    "context"
    "github.com/phenotype/compute-go/compute"
)

// POST /deploy handler.
func (h *Handler) Deploy(ctx context.Context, manifest OdinManifest) (Deployment, error) {
    // 1. Translate manifest -> WorkloadSpec (Go).
    spec, err := manifest.ToWorkloadSpec()
    if err != nil { return Deployment{}, err }
    // 2. Check policy.
    if err := h.policy.Check(ctx, spec, compute.PolicyContext{
        Actor: manifest.Actor,
        Workspace: manifest.Workspace,
    }); err != nil { return Deployment{}, err }
    // 3. Schedule.
    provider, err := h.scheduler.Choose(ctx, spec, h.providers)
    if err != nil { return Deployment{}, err }
    // 4. Place.
    handle, err := provider.Place(ctx, spec)
    if err != nil { return Deployment{}, err }
    // 5. Watch until ready.
    for ev := range provider.Watch(ctx, handle) {
        if ev.State == compute.WorkloadStateReady { break }
        if ev.State == compute.WorkloadStateFailed {
            return Deployment{}, fmt.Errorf("failed: %s", ev.Reason)
        }
    }
    return Deployment{Handle: handle}, nil
}
```

### TypeScript surface (consumed by the SvelteKit dashboard)

The dashboard reads deployment status. The SDK generates a
TypeScript client from the Rust types (spec section 6). The
SvelteKit dashboard does NOT call the compute SDK directly;
it calls a BytePort API endpoint that wraps the SDK. The
TypeScript surface is for SDK consumers that want to embed
compute operations in their own web apps.

================================================================================
## 5. Top 3 things BytePort is missing for the multi-cloud promise
================================================================================

### 5.1 No `byteport-engine` adapter wired to the SDK

The compute SDK has no consumer today. `byteport-engine` is a
pluggable abstraction but the only implementation is the stub
in `byteport-engine/src/lib.rs:10` (a comment, not code). The
single most leveraged piece of work is: implement the adapter
in `byteport-engine` that wraps `pheno-compute-core::ComputeProvider`.
This is the seam that turns "compute SDK exists" into "BytePort
uses the compute SDK".

### 5.2 No `phenotype-types` consolidation

BytePort already has `crates/phenotype-types` (per the Cargo.toml
listing above). PhenoCompose has `crates/port-types/src/oci.rs`
with a forward-pointer comment that says "the canonical home is
`phenotype-types`". nanovms has its own OCI type. **Three repos,
three OCI types, no consolidation.** The audit's step 1
(extract `phenotype-types`) is the right move, but the source
of truth should be BytePort's `phenotype-types` (it's the most
mature), and PhenoCompose/port-types and nanovms/OCIImage should
consume from there.

### 5.3 No policy or cost surface

BytePort's CHARTER says "self-hosted, not cloud-locked" but the
go.mod has no cost tracking, no policy gate, no per-actor limits.
The compute SDK defines `PolicyGate` and `ProviderCapabilities`
(spec sections 3.5, 3.6); BytePort needs to surface both in
its WorkOS-backed dashboard. Without this, the multi-cloud
promise is just "we can deploy to multiple clouds" without
controls, which is not enterprise.

### 5.4 (Bonus) Auth middleware commented out

`backend/nvms/main.go:25-35` has the auth middleware commented
out per `STATUS.md:41`. This is a blocker for the multi-cloud
promise: every provider has its own auth model, and the policy
gate is the place where WorkOS auth + provider auth meet. The
SDK's PolicyGate trait is the right hook, but it needs the
WorkOS session to flow through.

================================================================================
## 6. Migration path for BytePort
================================================================================

BytePort is the user-owned surface; this session does NOT execute
the migration. The path is documented here so the SDK implementers
know what to expect.

| Step | What lands in BytePort | What lands in the SDK |
|------|------------------------|------------------------|
| 1 | Adopt `phenotype-types` from BytePort (no change) | nanovms + PhenoCompose consume from there |
| 2 | (no change) | Add `ComputeProvider` trait + 3 impls (Fly, AWS Fargate, Vercel) |
| 3 | Wire `byteport-engine` adapter to `pheno-compute-core` | Publish `pheno-compute-core` as a path dep |
| 4 | Translate `odin.nvms` -> `WorkloadSpec` (From impl) | (no change) |
| 5 | Surface `ProviderCapabilities` in SvelteKit dashboard | (no change) |
| 6 | Wire WorkOS session -> `PolicyContext` | (no change) |
| 7 | Wire `byteport-otel` -> `EventSink` | Publish `pheno-compute-observe` crate |
| 8 | Uncomment auth middleware in `backend/nvms/main.go` | (no change) |

After step 8, BytePort is multi-cloud. Before step 8, the
multi-cloud promise is partially delivered (the SDK is there,
the dashboard is not, the auth is incomplete).

================================================================================
## 7. Open questions
================================================================================

### For the sponsor

1. **Is the compute SDK the right path to multi-cloud for
   BytePort?** Or is BytePort's plan to write its own multi-
   cloud adapter? The SDK is the recommended path; confirm
   before SDK work begins.
2. **Should `phenotype-types` be lifted out of BytePort into
   a polyrepo member of its own?** BytePort has the most
   mature version today; the SDK work needs it shared.
   Recommend: extract to its own repo, BytePort consumes
   via git dep.
3. **Should the `byteport-engine` adapter be in BytePort or
   in the SDK?** Recommend: in the SDK (so other Phenotype
   surfaces can adopt the same pattern). The adapter is
   `pheno-compute-byteport` and it depends on `byteport-engine`.

### For the SDK implementers

1. **WorkOS integration.** The `PolicyContext.actor` field
   needs a string format. Recommend: `"user:<workos_id>"`.
   Confirm with the WorkOS maintainers.
2. **`odin.nvms` schema.** The manifest format is not yet
   ratified. The SDK's `WorkloadSpec` is the model; the
   manifest should be a 1:1 mirror with field renames
   where needed.
3. **Dashboard surfacing.** The `ProviderCapabilities` is a
   struct; the dashboard needs a TypeScript type. The SDK
   generates the TypeScript type from the Rust struct (spec
   section 6); confirm the generation is in the right place
   (probably `pheno-compute-ts`).

### For the parent agent (/root)

1. **Block on the 13 in-flight PRs?** Specifically F (Tracera
   spec 008) and L (Tracera P2) shape the observability story.
   Land them before SDK step 7 (wire `byteport-otel` to
   `EventSink`).
2. **Block on the `phenotype-types` extraction?** This is
   audit step 1 and the prerequisite for everything else.
   Recommend: spin up a new lane for it, target Q3 2026.
3. **BytePort auth middleware.** `STATUS.md:41` flags the
   commented-out auth. Recommend: open a `byteport` issue
   to track it, but the SDK work does not depend on it.

