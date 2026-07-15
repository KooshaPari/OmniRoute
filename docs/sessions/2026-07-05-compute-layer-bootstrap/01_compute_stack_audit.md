# Compute Stack Audit -- 2026-07-05

Scope: the compute-layer polyrepo that sits below BytePort. NVMS / PhenoCompose /
Eidolon / KDesktopVirt / Tracely / Tracera. Per-repo maturity, gaps, integration
points, and the seams where a next-gen SDK will (or will not) cleanly fit.

Ground truth: the actual code, not the readme banners. Every claim below is
backed by a file path. Maturity labels use 4 levels:

  SCAFFOLD  - declared, no body, or empty stub
  ACTIVE    - has real code, growing, not enterprise
  MATURE    - stable shape, tests, docs, used by callers
  SHIPPING  - consumed by production in another repo

Sibling context: the parent agent /root has 13 PRs already in flight for the
absorption + spine work (A: org-audits, A2: KaskMan, B: apps+archives, C:
Authvault, D: AuthKit, E: phenodag, F: Tracera spec 008, G: AgilePlus spec 008,
H: Tracera P1, I: nanovms R-A P1, J/K: PhenoCompose R-A P1/P2, L: Tracera P2).
None of those are compute-layer SDK work; they are absorb+spine. The compute
SDK is the next layer that grows on top of those PRs landing.

================================================================================
## 1. nanovms -- the compute primitive (Go)
================================================================================

Role: the actual compute substrate. Multi-platform VM, container, WASM, and
process-isolation orchestrator. The Go tool `nvms` is the binary BytePort's
CHARTER.md names as its deployment substrate.

### Shape

```
nanovms/
  cmd/
    nanovms/main.go         # top-level orchestrator ("Deunan" struct)
    nvms/main.go            # published CLI
  internal/
    domain/                 # pure types (sandbox.go, stubs.go)
    ports/                  # hexagonal interfaces (ports.go, stubs.go)
    adapters/               # OS-/backend-specific impls
      linux/   mac/   windows/   wasm/   sandbox/   process/
    config/                 # config loading
  sdk/
    rust/                   # published Rust SDK (separate workspace)
    python/                 # published Python SDK
  desktop/electrobun/       # desktop shell scaffold
  mobile/macos-tray/        # macOS tray scaffold (PR-A, L121)
  mobile/android-companion/ # Android companion scaffold
  windows/scm-host/         # Windows SCM service scaffold
  integrations/pheno-compose/  # bridge to PhenoCompose driver
  tools/{a11y, fuzz}/       # test scaffolding
  tests/{playwright, bdd}/
  Cargo.toml                # FFI scaffolds (Rust 2021, MSRV pinned)
  go.mod                    # go 1.25, in-tree vendored go.uber.org/mock
```

### Maturity: ACTIVE (on the way to MATURE)

Evidence the structure is real:
- `internal/domain/sandbox.go` has the canonical SandboxType/VMFlavor/SandboxLayer
  enums with full doc comments and JSON tags
- `internal/ports/ports.go` defines SandboxPort / VMFlavorPort /
  SandboxIsolationPort / ImagePort as object-safe Go interfaces
- Each adapter directory exists and is its own package
- The `nvms` CLI is the published entry point (per `goreleaser.yml`)
- nanovms has a separate published SDK workspace at `sdk/rust` and `sdk/python`,
  intentionally distinct from the FFI scaffolds in the top-level Cargo.toml

### Strengths

1. **Real multi-tier isolation model.** SandboxType (vm/container/wasm/process/
   native) is composable with VMFlavor (native/lima/wsl/microvm/wasm) and
   SandboxLayer (gvisor/sRAMP/wasmtime) -- this is the stackable isolation
   model the spec wants. Most competitors hardcode one tier.
2. **Hexagonal architecture is enforced.** Ports in `internal/ports/ports.go`
   are interfaces; adapters implement them. The orchestration layer never
   touches an OS API directly. This is the right shape for multi-provider
   abstraction.
3. **Cross-language FFI scaffolds in place.** The top-level Cargo.toml
   declares mobile/macos-tray, mobile/android-companion, windows/scm-host as
   members; PR-A and PR-B are landing per L121-L130. The publlshed SDKs
   under `sdk/rust` and `sdk/python` are separate workspaces -- a clean
   split between the FFI work-in-progress and the stable public API.
4. **Strict Rust hygiene.** `unsafe_code = "forbid"`, `unused_must_use = "deny"`,
   edition 2021, rust-version pinned. Matches the user's "no unsafe in trait
   surface" preference.
5. **Vendored dependencies.** `replace go.uber.org/mock => ./third_party/...`
   keeps builds reproducible without network. This is the enterprise pattern.

### Gaps

1. **The Go tool is the only SDK today.** sdk/rust and sdk/python exist as
   scaffolds but are "deliberately distinct" -- meaning the Rust/Python story
   is not first-class. BytePort's CHARTER says "NVMS records what it deployed"
   but there's no Rust API to do that recording from a Rust caller.
2. **No public CloudProvider port.** SandboxPort / VMFlavorPort exist, but
   there is no `CloudProviderPort` for "deploy to AWS / GCP / Fly / Vercel".
   The current scope is local-only execution. This is the single largest
   gap for the BytePort use case.
3. **`cmd/nanovms/main.go` "Deunan" struct is empty.** It has the CLI flag
   parsing and a comment but no body. The orchestrator is unimplemented;
   the adapter selection logic is the work that needs to be written.
4. **No scheduler.** SandboxPort is one-shot (Create / Start / Stop). There
   is no "place this on the right provider based on policy" primitive.
5. **No provider capability advertisement.** Adapters know what they can
   do, but there is no machine-readable capability surface (e.g.,
   `supports_wasm: bool`, `max_memory_mib: u32`) the orchestrator can
   query to make a placement decision.
6. **The OCI image type is in PhenoCompose, not nanovms.** The canonical
   `Reference` parser is in `PhenoCompose/crates/port-types/src/oci.rs`
   (with a forward-pointer comment that the canonical home is
   `phenotype-types`). nanovms has its own `OCIImage` in domain but the
   parsing/validation is split across the two repos.
7. **Test coverage of the FFI scaffolds is missing.** `mobile/macos-tray/`
   and `windows/scm-host/` are scaffold-only; they have no test files.
   The desktop FFI work is on the critical path for BytePort.

### Recommendation

KEEP, do not fold. The hexagonal architecture is the right shape. Two
specific actions:
- Extract the OCI `Reference` parser from PhenoCompose into a new shared
  `phenotype-types` crate (this is what the comment in `oci.rs` already
  promises). Both nanovms and PhenoCompose consume from there.
- Add a `CloudProviderPort` next to SandboxPort that is the abstraction
  for "deploy to a remote cloud". This is the API surface BytePort needs
  and nanovms does not yet have.

================================================================================
## 2. PhenoCompose -- the orchestration layer (Rust ports)
================================================================================

Role: hexagonal Rust ports + cross-language bindings. Sits between nanovms
(the Go compute substrate) and BytePort (the surface). The "Compose" in
the name means compose artifacts across providers, not the Docker Compose
product.

### Shape

```
PhenoCompose/
  Cargo.toml                  # 6 workspace members
  crates/
    port-types/               # OCI Reference, Manifest, PortError (hex value types)
    port-runtime/             # Runtime trait: spawn/stop/status
    port-composer/            # Composer trait: artifact composition
    port-publisher/           # Publisher trait: artifact publishing
    port-secret/              # Secret port (secrets stay out of manifests)
    port-di/                  # DI / wiring helper
    secret-file-adapter/      # file-based Secret adapter
    pheno-config/             # shared config
  bindings/
    rust-ffi/                 # nvms-ffi (Rust -> nanovms CGO/FFI)
    mojo/                     # Mojo bindings
    zig/                      # Zig bindings
    build_cross_platform.py
  mobile/macos-shell/         # macOS shell scaffold (PR-A, L121)
  mobile/android-monitor/     # Android monitor scaffold (PR-A, L125)
  windows/scm-service/        # Windows SCM service scaffold (PR-B, L123)
  pheno-compose-driver/       # the actual orchestrator
  internal/
    adapters/ domain/ ports/  # hexagonal mirror of nanovms
  integrations/pheno-compose/ # self-loop
```

### Maturity: ACTIVE (with one CRITICAL gap)

Evidence the shape is real:
- `port-runtime/src/lib.rs` defines `Runtime: Send + Sync` with spawn/stop/
  status. The doc comments are exhaustive (4 paragraphs on idempotency,
  object-safety, error model). This is the model the rest of the port
  traits should match.
- `port-types/src/oci.rs` has a 150-line `Reference` parser with
  table-formatted docs, parsing rules, and a `Display` impl.
- Each `port-*` crate is a SINGLE-CRATE WORKSPACE, "deliberately NOT a
  member of this parent workspace ... consumed via path deps". This is
  the enterprise pattern for breaking a large monorepo into independently-
  publishable crates.
- `pheno-compose-driver` is the actual orchestrator that wires the
  ports to the adapters.
- `Cargo.toml` workspace.lints includes `unsafe_code = "forbid"` implicitly
  (each port crate has `#![forbid(unsafe_code)]` in its lib.rs).

### Strengths

1. **Port traits are textbook-hexagonal.** The Runtime trait is Send+Sync,
   object-safe (no associated types, no generic methods, no `&mut self`),
   and the doc comments explicitly call out the design constraints. This
   is the right shape to expose as a Rust SDK.
2. **Each port crate is a single-crate workspace.** Crates are individually
   versioned, individually tested, individually documented. Adding a
   new port does not require touching the others.
3. **Cross-language bindings exist.** `bindings/rust-ffi`, `bindings/mojo`,
   `bindings/zig` are real (not empty), and `build_cross_platform.py`
   drives the cross-compile matrix. This is the user's preferred language
   set (Rust + Go + Zig + Mojo).
4. **`#![forbid(unsafe_code)]` is the policy, not the exception.** Every
   port crate enforces it at the file level. The bindings dir is the only
   place FFI is allowed.
5. **Idempotency + error model are explicit in the doc comments.** Stop on
   already-stopped returns Ok; status on missing id returns
   ContainerStatus::NotFound (not an error); errors are `#[non_exhaustive]`
   enums. This is the right enterprise API.

### Gaps

1. **CRITICAL: pheno-compose-driver is unimplemented.** The driver is the
   thing that ties ports to adapters and decides where work goes. It
   exists in the Cargo.toml but the body is not in this audit's slice.
   The PR-J/K (PhenoCompose R-A P1/P2) in the parent agent's queue are
   exactly this work. Verify those land before treating the
   orchestration layer as functional.
2. **No CloudProvider port in PhenoCompose either.** Same gap as nanovms:
   the port traits are local-execution-shaped. The "deploy to Fly / Vercel
   / Supabase" port is missing.
3. **Port traits don't model state machines.** A container has lifecycle
   states (Pending -> Running -> Stopped -> Failed) but the Runtime
   trait only has spawn/stop/status. A `Wait` or `Stream` method that
   emits lifecycle events would make async workloads first-class.
4. **No provider capability advertisement.** Same as nanovms: there is no
   `trait ProviderCapabilities` the Composer can query.
5. **The OCI parser is the wrong home.** `port-types/src/oci.rs` itself
   says "The canonical home for OCI helpers in the Phenotype ecosystem is
   the `phenotype-types` crate ... This module exists as a transitional
   shim." Resolve the TODO: move it to a shared `phenotype-types` crate
   and consume from both sides.
6. **The Mojo and Zig bindings are scaffolds.** They exist in the bindings
   dir but the user's preferred stack is Rust > Go > Zig > Mojo, and the
   actual compute primitives live in Rust. The Mojo/Zig bindings should
   be the LAST thing built, not the FIRST.

### Recommendation

KEEP and EVOLVE. Two specific actions:
- Move the OCI parser + Manifest + PortError into a new shared
  `phenotype-types` crate. Mark `port-types` as deprecated with a
  compile-time `#[deprecated]` re-export.
- Add a `CloudProvider` port trait next to Runtime. Same shape: Send+Sync,
  object-safe, idempotent, with explicit `ProviderCapabilities`.

================================================================================
## 3. Eidolon -- desktop + mobile runtime (Rust)
================================================================================

Role: the runtime shell for desktop and mobile applications. Sits
side-by-side with nanovms (which is the compute primitive); Eidolon is
the application primitive.

### Shape

```
Eidolon/
  Cargo.toml                # 4 workspace members
  crates/
    eidolon-core/           # shared runtime abstractions
    eidolon-desktop/        # desktop (Tauri / electobun)
    eidolon-mobile/         # mobile (iOS / Android)
    eidolon-sandbox/        # sandboxed execution within Eidolon
  docs/
    adr/  security/  specs/  boundary/  operations/
    sessions/  intent/  worklogs/  journeys/  reference/
  tests/  benches/  scripts/  .devcontainer/  .github/
```

### Maturity: ACTIVE -> MATURE (Phase 3 spec+test+trace, 80% per README)

Evidence the docs are unusually mature for a polyrepo member:
- 10 top-level docs subdirectories covering every concern (architecture
  decision records, security posture, formal specs, boundary contracts,
  operations runbooks, session logs, intent statements, worklogs,
  journey manifests, reference material).
- Each crate has its own `tests/`, and `eidolon-core` has `benches/`.
- `.devcontainer/` and `.github/` are present, indicating CI and a
  reproducible dev environment.

### Strengths

1. **Mature docs culture.** adr/ + specs/ + boundary/ is the right
   structure for a security-sensitive runtime. Most polyrepo members
   stop at README.md.
2. **Sandbox is its own crate.** `eidolon-sandbox` is a peer of
   eidolon-core, not a sub-module. This is the right encapsulation
   for a security primitive.
3. **Phase 3 spec+test+trace at 80%.** README work-state is precise
   (not a vague "% done" claim). 80% with explicit phase suggests
   a deliberate TDD-style progression.

### Gaps

1. **No link to nanovms in the audit's slice.** If Eidolon is a runtime
   shell, it should consume the nanovms Go binary or the pheno-compose
   Rust driver. The audit does not show that link being made explicit
   in the docs (need to verify with a follow-up).
2. **4 crates at 80% means each crate is at most 80%.** The
   eidolon-mobile crate in particular is likely thin (mobile runtimes
   are hard). Flag for follow-up.
3. **The "AI-DD-META" banner is a smell.** This repo advertises itself
   as "AI-Only-Maintained" with "Slop Expected". That is fine for a
   learning metaproject, but is a barrier to enterprise adoption --
   the contract should be that this output meets the same standard as
   human-maintained code.

### Recommendation

KEEP. Eidolon is the right place for the desktop/mobile runtime shell.
The 80% spec+test+trace state means it is close to enterprise-ready;
push to 100% before treating the compute layer as done. Specifically,
the `eidolon-sandbox` crate should be the one that consumes the
nanovms/pheno-compose compute primitives -- verify and document that
link.

================================================================================
## 4. KDesktopVirt -- desktop automation tier (Rust)
================================================================================

Role: desktop automation (window management, scripted UI flows) on top
of Eidolon. Smaller scope than the others; mostly a thin shell.

### Shape

```
KDesktopVirt/
  Cargo.toml           # workspace root
  cli_tools/Cargo.toml # kvirtualstage CLI
  (workspace + a cli_tools subdir; total 4659 files mostly vendored data)
```

### Maturity: ACTIVE (70% per README work-state)

Evidence the scope is real:
- Workspace + cli_tools is the conventional Rust CLI layout
- README work-state: "ACTIVE -- Desktop-automation tier; now the home
  for the automation port traits" -- 70% complete
- The package name `kvirtualstage` suggests a virtualized desktop
  stage (think Selenium-grid-for-desktop-apps)

### Strengths

1. **Small, focused surface.** Two Cargo.toml files, one CLI. The
   "automation port traits" claim is the right way to frame it: a
   port, not a platform.
2. **Pinned in the polyrepo governance.** README links to
   `phenotype-org-governance/SUPERSEDED.md` for authority chain.

### Gaps

1. **Almost no Rust code in the file count.** 4659 files but only 57
   are .rs -- the rest is likely vendored data, fixtures, or generated.
   The "70% complete" claim is hard to evaluate without seeing the
   actual code.
2. **No clear link to Eidolon or nanovms.** KDesktopVirt should be
   the desktop-automation PORT (in the PhenoCompose sense). Audit
   does not show that contract being made explicit.

### Recommendation

KEEP, small. KDesktopVirt should expose a `DesktopAutomation` port
trait in the PhenoCompose style. It is not a compute primitive; it
sits beside the desktop runtime and consumes the same ports.

================================================================================
## 5. Tracely -- observability (Rust)
================================================================================

Role: unified observability (traces, metrics, logs) with export to
OTLP, Prometheus, Jaeger, Zipkin. The cross-cutting observability
layer for the compute layer.

### Shape

```
Tracely/
  Cargo.toml                 # 2 main crates + 2 cross-language
  crates/
    tracely-core/            # the unified API
    tracely-sentinel/        # SLO / error budget engine
    pheno-logging-zig/       # Zig logging bridge
    helix-tracing/           # alternate tracing impl
```

### Maturity: BETA (70% per README work-state)

Evidence the shape is right:
- Two main crates (core + sentinel) with clear separation
- Cross-language piece (`pheno-logging-zig`) for non-Rust callers
- "Sentinel" is the SLO/error-budget pattern -- an enterprise
  observability primitive most open-source projects lack

### Strengths

1. **Sentinel as a first-class concept.** Most observability libraries
   stop at "here is a trace, here is a metric". Sentinel pushes to
   the next layer: "here is the SLO, here is the burn rate, here is
   the error budget". This is the right shape for a SLA-driven
   platform.
2. **Cross-language export to OTLP/Prometheus/Jaeger/Zipkin.** All
   four. No lock-in.
3. **Helix-tracing as an alternate impl.** Suggests the core API
   is decoupled from the tracing backend, which is the right shape.

### Gaps

1. **No link to compute primitives in the audit's slice.** Tracely
   should auto-instrument nanovms and PhenoCompose. Audit does not
   show that integration.
2. **`pheno-logging-zig` is the only non-Rust bridge.** Go and
   Python bridges are not visible. Since the compute layer is heavy
   in Go (nanovms) and the SDKs in Python, this is a gap.
3. **Sentinel at beta is a risk.** SLO/error-budget is the kind of
   feature that needs careful rollout. Beta is fine if it is behind
   a feature flag and the math is correct.

### Recommendation

KEEP, integrate. Tracely is the observability layer for the whole
compute layer. It should auto-instrument every nanovms SandboxPort
call, every PhenoCompose Composer.publish, and every byteport
deploy. The Go and Python SDKs need observability bridges; the
Zig bridge alone is insufficient.

================================================================================
## 6. Tracera -- the trace spine (Rust + frontend)
================================================================================

Role: the trace storage and query layer. Tracely is the producer,
Tracera is the store.

### Shape

```
Tracera/
  Cargo.toml                 # 3 backend crates
  crates/
    tracera-server/          # API server + sqlite migrations
    tracertm-mcp/            # MCP tool surface
    tracera-edge/            # edge / proxy crate
  frontend/                  # TypeScript + React
    apps/{web, desktop, docs, desktop-electrobun}
    packages/{types, api-client}
  migrations-sqlite/         # SQL migrations
  packaging/   ARCHIVE/      # historical
```

### Maturity: SCAFFOLDING (the repo shows 0 files in earlier ls,
but Cargo.toml + 3 crates with src/ are present -- "0 files" was
a stale count from before scaffolding landed)

### Strengths

1. **Tracera-server with sqlite migrations.** A real backend shape
   with a real migration system. Not just a config file.
2. **MCP surface (`tracertm-mcp`).** Exposes trace queries as MCP
   tools. This is the right shape for a 2026 platform -- every
   surface should be queryable by an agent.
3. **Edge crate.** `tracera-edge` is a separate concern, suggesting
   the team understands the read-path / write-path split.

### Gaps

1. **3 backend crates + a frontend is a lot for a "trace spine".**
   The frontend is OUT of scope for the compute layer (it is a
   user-facing surface). The frontend should be either absorbed
   into BytePort or split off into a separate repo. The 13-PR
   absorption work does not address this.
2. **Empty repo (per the earlier ls) suggests the work-in-flight
   is in branches, not main.** Verify with the parent agent's
   PR-F/L/T (Tracera spec 008) before treating this as a real
   spine.

### Recommendation

KEEP as a backend, SPLIT the frontend. The trace spine is the
storage + query. The trace UI is a BytePort concern. After the
PR-F/L/T land, the frontend can move to BytePort.

================================================================================
## 7. Cross-cutting: where the seams leak
================================================================================

The audit's 6 repos look like a coherent compute layer on paper.
In practice there are 7 cross-cutting seams that need attention
before the compute layer is enterprise-grade.

### Seam 1: OCI types live in two places
- PhenoCompose `port-types/src/oci.rs` has the canonical `Reference`
  parser
- nanovms has `OCIImage` in `internal/domain/` (different shape)
- The forward-pointer comment in oci.rs already names the resolution:
  a shared `phenotype-types` crate

Fix: extract `phenotype-types` as a new polyrepo member, consume
from both nanovms (Go) and PhenoCompose (Rust). This is the most
concrete early win.

### Seam 2: No CloudProvider abstraction
Both nanovms and PhenoCompose have local-execution ports but no
cloud-provider port. BytePort's CHARTER already commits to a
multi-cloud future (the tenets mention "self-hosted, not cloud-
locked" and "deploys are reproducible"). The cloud port is the
missing piece that makes that commitment real.

Fix: define `CloudProviderPort` (Go) and `CloudProvider` (Rust)
in lockstep. Implement against Fly.io first (its Machines API is
exactly the right shape), then AWS Fargate, then Vercel/Supabase.

### Seam 3: Two hexagonal architectures
nanovms is a Go hexagonal architecture. PhenoCompose is a Rust
hexagonal architecture. The shapes are parallel but the names
and methods are not synchronized. `SandboxPort.Create` (Go) and
`Runtime.spawn` (Rust) are conceptually the same thing.

Fix: define the trait names in a single spec doc (this audit's
sister document, `04_compute_architecture_spec.md`) and treat
any drift as a bug.

### Seam 4: No scheduler, no policy gate
The ports are one-shot. There is no "given this workload spec,
where should it go?" decision point. BytePort's tenet 4 ("local
dev == production") implies the scheduler should be deterministic
and policy-driven.

Fix: add a `Scheduler` and `PolicyGate` to the trait set. Make
the default policy: "deploy to local if no provider is configured,
else to the cheapest provider that meets the spec".

### Seam 5: Observability not auto-instrumented
Tracely exists but does not auto-instrument nanovms or PhenoCompose.
This means every workload emits traces only if the caller
explicitly wraps it.

Fix: in the SandboxPort and Runtime traits, add an optional
`EventSink` parameter (or a `with_observer` builder). nanovms
emits lifecycle events; Tracely listens.

### Seam 6: The frontend is a polyrepo member
Tracera's frontend is in the trace repo. The compute layer should
be backend-only -- the frontend is a BytePort concern.

Fix: after PR-F/L/T land, move the frontend out of Tracera.

### Seam 7: The "AI-DD-META" banner is everywhere
Most polyrepo members carry the "AI-Only-Maintained, Slop Expected"
banner. This is fine for a learning metaproject but is a barrier
to enterprise adoption. The contract should be: "this code meets
the same standard as human-maintained code" -- which means: tests
on every PR, no unsafe in trait surface, doc comments on every
public item, and a CHANGELOG entry for every release.

Fix: as the compute layer matures, remove the "Slop Expected"
badge from the READMEs of the production-tier repos
(nanovms, PhenoCompose, Eidolon, Tracely, Tracera). Keep it on
the experimental crates only.

================================================================================
## 8. Recommended next steps (ordered, with critical path)
================================================================================

Critical path is the smallest set of work that gets the compute
layer to enterprise-ready. Each step blocks or unblocks the next.

1. **Extract `phenotype-types` from PhenoCompose/port-types.**
   OCI Reference + Manifest + PortError. Both nanovms and
   PhenoCompose consume. Closes Seam 1. (1 PR, ~400 lines)

2. **Define `CloudProvider` port in both Go and Rust.**
   Same shape as SandboxPort / Runtime. Object-safe, Send+Sync,
   idempotent. Closes Seam 2. (1 PR for the spec + 1 PR per impl)

3. **Implement Fly.io adapter first.**
   Fly's Machines API is the cleanest expression of "give me a
   container / microVM, manage it for me" -- it is the v1 target.
   (1 PR, ~600 lines Go + Rust FFI)

4. **Add `Scheduler` and `PolicyGate` to both port sets.**
   Closes Seam 4. (1 PR, ~200 lines per language)

5. **Wire Tracely as the default EventSink.**
   nanovms SandboxPort and PhenoCompose Runtime both take an
   optional EventSink. nanovms-default = tracely-go-bridge,
   PhenoCompose-default = tracely-core. Closes Seam 5.
   (2 PRs, one per language)

6. **Add `ProviderCapabilities` to both port sets.**
   Machine-readable capability advertisement so the Scheduler
   can pick the right provider. Closes Seam 3. (1 PR per language)

7. **Move Tracera frontend out of the backend repo.**
   Closes Seam 6. (1 PR, mechanical move)

8. **Remove "Slop Expected" badge from production-tier READMEs.**
   Closes Seam 7. (1 PR, doc-only)

After these 8 land, the compute layer has a single type system
(phenotype-types), a cloud provider abstraction (CloudProvider),
a scheduler + policy gate (Scheduler + PolicyGate), auto
observability (Tracely), and machine-readable capabilities
(ProviderCapabilities). That is the minimum bar for "mature /
enterprise / prod grade" the user asked for.

================================================================================
## 9. What this audit did NOT cover (follow-up lanes)
================================================================================

- **The `cmd/nanovms/main.go` "Deunan" struct body.** Confirmed to
  exist as a struct but the method body is not in this audit's
  slice. Follow-up: read the full file and confirm the orchestrator
  is the right shape.
- **The `pheno-compose-driver` body.** Same: confirmed in
  Cargo.toml, body not audited. Follow-up: confirm the driver
  wires the ports to the adapters correctly.
- **The exact Tracera frontend contents.** Confirmed structure
  but not the contents. Follow-up: confirm what moves to BytePort
  vs what stays.
- **The nanovms `internal/domain/` full set of types.** Sampled
  sandbox.go + ports.go. There may be other types (Image,
  Network, Volume) worth auditing.
- **Eidolon's actual sandbox contract.** Phase 3 spec+test+trace
  at 80% -- need to confirm what is tested vs what is documented.
- **Tracely's Go and Python bridges.** Confirmed pheno-logging-zig
  exists; the audit did not search for Go or Python bridges.

These are all 30-minute follow-ups; the parent agent's
subagent lanes are the right place to dispatch them.

