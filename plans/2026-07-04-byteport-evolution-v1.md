# BytePort Evolution — Enterprise Control Surface Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Language Preference (decision-tree ordering for optimality):**
> 1. **Zig** — first pick where Rust memory model / binary size / C-ABI is suboptimal (MicroVM shims, kernelspace bridging)
> 2. **Mojo** — first pick where ML/AI kernel-level optimization matters (cost prediction, portfolio image generation, log anomaly detection)
> 3. **Rust** — control plane API, CLI, secrets, manifest engine, MCP/A2A servers, FFI bridges, Tauri shells, buildpacks
> 4. **Go** — NVMS microVM service, cloud SDK wrappers (AWS/GCP/Azure), pragmatic services
> 5. **Python** — **forced edge** for FastMCP server (`pyo3` Rust↔Python FFI), ML-augmented deploy wizards
> 6. **TypeScript/SvelteKit/Next.js** — UI/dashboard surfaces only
>
> **Volume distribution expectation:** Rust + Go will be the largest portion (control plane + NVMS). Zig and Mojo will be smaller but placed at the **highest-leverage** inner-loop points. Python stays a forced-edge for FastMCP only.

**Goal:** Evolve BytePort from a single-user IaC + portfolio platform into the **enterprise control surface** for the entire Phenotype ecosystem — managing deployments, projects, providers, secrets, observability, and agent orchestration across hybrid host environments (Docker, VMs, MicroVMs, Kubernetes, bare-metal, cloud-native abstractions like Vercel/Supabase/Coolify).

**Architecture:** 3-layer architecture — (1) Rust control plane API (separate from Go NVMS service); (2) Pluggable deployment engines (Docker, K8s, Firecracker via NanoVMS, Lambda, etc.); (3) Multi-tenant secure secrets + observability. Zig hot-path shims in critical inner loops (manifest parse, buildpack cache lookup, secret derivation). Python FastMCP server for agent integration. Frontend: SvelteKit 2 + Tauri 2 shell.

**Tech Stack:**
- **Rust** (axum + sqlx + tonic + OpenTelemetry) — control plane, CLI, manifest, secrets, MCP/A2A servers, buildpacks, Tauri shell, FFI bridges (`napi-rs`)
- **Zig** — MicroVM shims, kernelspace bridging, custom allocators for buildpack cache
- **Mojo** — ML kernels for cost prediction, portfolio generation (when ≥v1.0 ships)
- **Go** — NVMS microVM service (already there), AWS/GCP/Azure SDKs (`cgo` FFI bridge from Rust)
- **Python** — FastMCP server (`pyo3` FFI to Rust core), ML-augmented deploy wizards
- **SvelteKit 2 / Svelte 5 / Tailwind 4** — frontend
- **Tauri 2** — desktop/mobile shell (Rust)
- **SQLite/Postgres** — data
- **OpenTelemetry** — observability (OTLP across all tiers)

---

## Phase 0: Current State Audit (Complete)

### 0.1 Codebase Inventory

| Component | Location | Language | Status |
|-----------|----------|----------|--------|
| Backend (legacy) | `backend/byteport/` | Go 1.25 | Removed (PR fix/remove-dead-auth-stack) |
| Backend (live) | `backend/` | Go 1.25 | Go/Gin/GORM/SQLite, WorkOS AuthKit, AWS SDK, NVMS proxy |
| NVMS service | `backend/nvms/` | Go 1.25 | Spin/Fermyon wasm module, port 3000 |
| byteport-cli | `crates/byteport-cli/` | Rust | CLI binary with DAG, OTel, transport crates |
| byteport-dag | `crates/byteport-dag/` | Rust | DAG execution engine |
| byteport-otel | `crates/byteport-otel/` | Rust | OpenTelemetry instrumentation |
| byteport-transport | `crates/byteport-transport/` | Rust | Upload transport abstraction |
| byteport-registry-adapter | `crates/byteport-registry-adapter/` | Rust | phenotype-registry adapter |
| phenotype-types | `crates/phenotype-types/` | Rust | Shared Phenotype types |
| Frontend | `frontend/web/` | SvelteKit 2 + Svelte 5 + Tailwind 4 | Admin UI |
| Desktop shell | `frontend/web/src-tauri/` | Rust + Tauri 2 | Desktop/mobile shell |
| FFI | `ffi/macos-share/`, `ffi/android-companion/`, `ffi/linux-dbus/` | Rust | Cross-platform FFI |

### 0.2 Architecture Audit

**Current Architecture:**
```
User → SvelteKit + Tauri 2 Shell (port 5173 dev)
  → Go Backend API (Gin, port 8081)
    → GORM → SQLite (database.db)
    → AWS SDK (EC2/S3/IAM)
    → NVMS Go service (Spin/Fermyon wasm, port 3000)
      → Deployment engine
    → WorkOS AuthKit (auth)
    → OpenAI / Anthropic / Gemini API (LLM)
    → Slickport (portfolio site)
```

**Strengths:**
- Self-hosted, no cloud lock-in (tenet 6)
- Encrypted-at-rest with Argon2id (tenet 8)
- SSRF-safe by default (tenet 7)
- Pluggable LLM providers (tenet 5)
- Portfolio as first-class (tenet 3)
- Reproducible deploys via NVMS manifest (tenet 2)
- Local-dev == production (tenet 4)
- Live authentication: WorkOS AuthKit (in progress)

**Weaknesses:**
- Single-user assumption baked into data models (User UUID as primary key throughout)
- AWS is hardcoded as the deploy target (`backend/byteport/lib/manifest.go` references AWS SDK)
- No multi-tenancy: cannot host multiple organizations/users on one instance
- No project-templating: must author manifest by hand for every project
- No git integration apart from GitHub OAuth link
- No real-time logs streaming (only post-deploy status)
- No domain management (out of scope, tracked)
- No preview environments (out of scope, tracked)
- CLI is light: `byteport deploy`, `byteport status` only
- Backend is Go monolith (not bad, but Rust would be more performant for the new control plane)
- State storage is embedded SQLite — fine for single-user, blocked for multi-user scale

### 0.3 Competitive Landscape

**Existing players (what BytePort must match or exceed):**

| Platform | Specialty | BytePort Advantage |
|----------|-----------|-------------------|
| **Vercel** | Frontend/SaaS deploys | Self-host; multi-engine (Docker, K8s, Firecracker); Linux anywhere |
| **Supabase** | Backend-as-Service | Can deploy to user's own infra; not cloud-hosted lock-in |
| **Railway** | App deploys | Self-host; LLM-aware (manifest can include model configs) |
| **Render** | Backend services | Self-host; multi-engine |
| **Coolify** | Self-hostable Heroku/Netlify/Vercel | Multi-engine vs Docker-only; LLM-aware; portfolio generation |
| **Dokku** | Self-hostable PaaS | Same as Coolify; modern UX vs 12-factor old-school |
| **CapRover** | Self-hostable PaaS | Same; better DAG-based orchestration |
| **Portainer** | Container management | Better application-stack abstraction |
| **Dagger** | CI/CD as code | Built-in DAG; stronger IaC semantics |
| **Terraform / Pulumi** | IaC | Application + infra combined in one manifest |

**Differentiator:** BytePort's enterprise edge is its **multi-engine + LLM-aware + portfolio-generating** combination. Few platforms offer all three. Add multi-tenancy, secrets management, observability, and agent integration (MCP/A2A), and BytePort becomes the canonical Phenotype control plane.

### 0.4 Forced-Edge Audit

Per the user's directive, certain languages are **forced edges** (the ecosystem dictates the choice, not preference):

| Forced edge | Why forced | Integration tier |
|---|---|---|
| **Python (FastMCP)** | FastMCP is the canonical MCP server framework used by the Anthropic ecosystem; agents/clients expect it | T3 (`pyo3` Rust↔Python FFI) |
| **Python (ML deploy wizards)** | scikit-learn / pandas / transformers ecosystem is the de-facto for ML-augmented tooling | T3 (`pyo3`) or T2 (UDS) |
| **TypeScript (UI)** | SvelteKit/Next.js dashboard — no UI alternative at the velocity needed | T1/T2 (HTTP, UDS) |
| **WAT/WASM** | Browser-side execution, edge functions (Vercel adapter) | T1 (HTTP) |
| **SQL** | Declarative queries — no substitute | n/a (within Rust `sqlx`) |
| **Bash/Shell** | System tooling glue | n/a (build/test scripts) |

**Decision rule:** When a forced edge exists, we do NOT write a wrapper in our preferred language. We **integrate** at the binding tier (T1/T2/T3) that minimizes overhead and preserves the forced-edge tool's ecosystem.

### 0.5 Decision-Tree Walk-Through (Language Selection)

For each new component, run this decision tree in order. First match wins:

| Question | If yes → | If no → |
|---|---|---|
| Q1: Is there a forced edge (FastMCP, ML wizards, WAT)? | **Use forced edge** at T1/T2/T3 | Continue |
| Q2: Is this an ML kernel / portfolio generation / cost prediction? | **Mojo** (when ≥v1.0 ships) | Continue |
| Q3: Is binary size <100KB, C-ABI required, or kernelspace bridging? | **Zig** | Continue |
| Q4: Memory safety + perf + single-binary + tokio ecosystem? | **Rust** | Continue |
| Q5: Massive SDK ecosystem (cloud), goroutine fanout, NVMS-style service? | **Go** | Continue |
| Q6: UI / dashboard / agent protocol surface? | **TypeScript/SvelteKit** | **Reconsider scope** |

### 0.6 Goals & Vision (Enterprise Control Surface)

BytePort's evolving scope:

| v1.0 (current) | v2.0 (this plan) | v3.0 (long-term) |
|----------------|------------------|------------------|
| Single-user IaC + Portfolio | Multi-tenant enterprise control surface | Cross-cloud orchestration platform |
| AWS-only deploy | Multi-engine (AWS, Docker, K8s, Firecracker via NanoVMS) | Multi-cloud abstraction (AWS/GCP/Azure/Vercel/Supabase) |
| Go/Gin/GORM/SQLite | Rust + Go split; Postgres option | Distributed state store + event sourcing |
| SvelteKit UI | SvelteKit UI + Tauri + Mobile | Polished dashboard + CLI + VSCode extension |
| WorkOS AuthKit | WorkOS + OIDC + SAML/SSO + passkeys | Full enterprise SSO integration |
| No agent protocol | MCP server + A2A agent card | First-class agent registry |
| No orgs | Teams + organizations + RBAC | Full org/admin/user hierarchy |
| Single-VM self-host | Multi-node orchestration | Federated control plane |

---

## Phase 1: Foundation Hardening (Weeks 1-3)

### Objective
Close the gaps identified in the audit, ship Phase 0/1/2 PRs that were declared in PLAN.md.

### Task 1A: Governance Reset (PR #1 - in progress)

**Already tracked:** BP-DAG-001 through BP-DAG-004 (STATUS.md, CHARTER.md, PLAN.md, README.md rewrite).

- [ ] Verify all 4 files match v1.0 reality (Go/Gin/GORM/SQLite, not Loco.rs)
- [ ] Update README quickstart to reflect current dev workflow (`./start dev`, `./start prod`)
- [ ] Confirm all references to NanoVMS pattern are accurate

### Task 1B: Security & Reliability Floor (PR #2 - queued)

**Files:**
- Modify: `backend/internal/infrastructure/persistence/postgres/deployment_repository.go`
- Modify: `backend/internal/infrastructure/http/handlers/deployment_handler.go`
- Modify: `backend/internal/infrastructure/http/handlers/terminate.go`
- Modify: `backend/internal/infrastructure/http/handlers/create.go`
- Modify: `backend/nvms/main.go`
- Modify: `backend/main.go`

- [ ] **BP-DAG-040:** Re-audit all routes for `Find().Where(...)` patterns (owner scoping)
- [ ] **BP-DAG-041:** Add transaction + idempotency to `routes/pm.go::addNewProject`
- [ ] **BP-DAG-042:** Fix owner scoping in deployment_repository.go (use `Where().Find()`)
- [ ] **BP-DAG-043:** Same fix in projects.go (next file with same bug)
- [ ] **BP-DAG-044:** Add `return` after every error-branch `c.JSON` in deployment_handler.go
- [ ] **BP-DAG-322:** Parameterize `http://localhost:3000/deploy` via env var
- [ ] **BP-DAG-323:** Add request timeout + retry to NVMS calls
- [ ] **BP-DAG-324:** Re-enable auth middleware in NVMS service
- [ ] **BP-DAG-040b:** Don't exit on empty `git_secrets` in main.go (cold-start path)
- [ ] **BP-DAG-040c:** Set `SameSite=Lax` and pin cookie domain in auth middleware

### Task 1C: NVMS Manifest Engine (PR #3)

**Files:**
- Create: `backend/internal/infrastructure/manifest/parser.go`
- Create: `backend/internal/infrastructure/manifest/schema.go`
- Create: `backend/internal/infrastructure/manifest/parser_test.go`
- Create: `backend/internal/infrastructure/manifest/parser_violations_test.go`
- Modify: `backend/internal/application/deployment/create_deployment.go`

- [ ] **BP-DAG-020:** Define canonical `odin.nvms` schema (see `BytePort/SPEC.md` § 8)
- [ ] **BP-DAG-021:** JSON-Schema for `odin.nvms` validation
- [ ] **BP-DAG-022:** Go parser using `yaml.v3`
- [ ] **BP-DAG-023:** Happy path tests (10 cases)
- [ ] **BP-DAG-024:** Schema violation tests (5 cases)
- [ ] **BP-DAG-025:** Wire parser into `create_deployment.go` (replace TODO)
- [ ] **BP-DAG-026:** CLI: `byteport validate` for offline manifest linting
- [ ] **BP-DAG-027:** `docs/manifest.md` with full schema reference

### Task 1D: Backend Hardening (PR #4)

**Files:**
- Modify: `backend/internal/infrastructure/http/middleware/auth.go`
- Modify: `backend/internal/infrastructure/clients/credential_validator.go`
- Create: `backend/internal/infrastructure/observability/`
- Modify: `backend/main.go`

- [ ] **BP-DAG-045:** Wire `lib.AuthMiddleware` into every protected route (audit)
- [ ] **BP-DAG-046:** Switch auth cookie to `httpOnly`, `Secure`, `SameSite=Lax`
- [ ] **BP-DAG-047:** Argon2id params audit (64MiB/3/2/16B/32B)
- [ ] **BP-DAG-048:** PASETO v2 → v3 audit
- [ ] **BP-DAG-049:** Encryption key auto-rotate hook
- [ ] **BP-DAG-050:** SSRF allowlist-of-allowlists
- [ ] **BP-DAG-051:** Tighten OpenAI key validation (single GET /v1/models, no retries)
- [ ] **BP-DAG-052:** slog JSON output
- [ ] **BP-DAG-053:** OTel OTLP exporter (replace ConsoleSpanExporter)
- [ ] **BP-DAG-054:** CORS allowlist (env-driven)
- [ ] **BP-DAG-055:** Rate limiter (per-IP, per-route)
- [ ] **BP-DAG-056:** `GET /healthz` (DB + NVMS ping)
- [ ] **BP-DAG-057:** Graceful shutdown (SIGTERM drains in-flight)
- [ ] **BP-DAG-058:** Strict `golangci.yml`
- [ ] **BP-DAG-059:** Enhanced `justfile` (dev, build, test, lint, smoke)
- [ ] **BP-DAG-060:** `go mod verify` in CI

---

## Phase 2: Multi-Tenant Foundation (Weeks 4-8)

### Objective
Add organizations, teams, roles, RBAC. This unlocks enterprise self-hosting.

### Task 2A: Data Model Migration to Multi-Tenancy

**Files:**
- Modify: `backend/internal/infrastructure/persistence/postgres/models.go`
- Modify: `backend/internal/infrastructure/persistence/sqlite/models.go` (new)
- Create: `backend/internal/infrastructure/migrations/002_multi_tenant.sql`
- Modify: All `*_repository.go` files

- [ ] **Step 1: Add Organization, Team, Membership tables**
  ```sql
  CREATE TABLE organizations (
      id UUID PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free', -- free, team, enterprise
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE teams (
      id UUID PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE memberships (
      user_id UUID NOT NULL REFERENCES users(id),
      team_id UUID NOT NULL REFERENCES teams(id),
      role TEXT NOT NULL, -- 'owner', 'admin', 'developer', 'viewer'
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, team_id)
  );
  ```

- [ ] **Step 2: Add organization_id to projects, instances, secrets**
  ```sql
  ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id);
  ALTER TABLE instances ADD COLUMN organization_id UUID REFERENCES organizations(id);
  ```

- [ ] **Step 3: Backfill existing single-user data into a default organization**

- [ ] **Step 4: Update repositories to scope by org_id**

### Task 2B: WorkOS Multi-Tenant Integration

**Files:**
- Modify: `backend/internal/infrastructure/auth/workos_service.go`
- Create: `backend/internal/infrastructure/auth/org_resolver.go`
- Modify: `backend/internal/infrastructure/http/middleware/auth.go`

- [ ] **Step 1: Map WorkOS organizations → BytePort organizations**
- [ ] **Step 2: Resolve user → org → teams on every request**
- [ ] **Step 3: Inject org context into request handler**
- [ ] **Step 4: Tests for org resolution**

### Task 2C: RBAC Enforcement

**Files:**
- Create: `backend/internal/infrastructure/auth/rbac.go`
- Modify: `backend/internal/infrastructure/http/middleware/auth.go`

- [ ] **Step 1: Define role hierarchy** (owner > admin > developer > viewer)
- [ ] **Step 2: Add permission matrix**:
  ```go
  var Permissions = map[string][]string{
      "projects:read": {"viewer", "developer", "admin", "owner"},
      "projects:write": {"developer", "admin", "owner"},
      "projects:delete": {"admin", "owner"},
      "secrets:read": {"developer", "admin", "owner"},
      "secrets:write": {"admin", "owner"},
      "members:invite": {"admin", "owner"},
      "members:remove": {"admin", "owner"},
      "billing:read": {"owner"},
      // ...
  }
  ```
- [ ] **Step 3: Middleware: `RequirePermission("projects:write")`**
- [ ] **Step 4: Audit log for every permission denial**

### Task 2D: Frontend Team Switcher

**Files:**
- Modify: `frontend/web/src/routes/dashboard/+page.svelte`
- Create: `frontend/web/src/lib/stores/teamContext.ts`
- Modify: `frontend/web/src/lib/components/TopNav.svelte`

- [ ] **Step 1: Team picker in top nav**
- [ ] **Step 2: Org context stored in Pinia/store**
- [ ] **Step 3: All API calls include `X-Org-Id` header**

---

## Phase 3: Multi-Engine Deployment (Weeks 9-14)

### Objective
Move beyond AWS-only deploys. Add Docker, K8s, Firecracker (NanoVMS), and a generic "container" engine that abstracts Vercel/Supabase-like platforms.

### Task 3A: Engine Abstraction Layer

**Files:**
- Create: `backend/internal/application/deployment/engine/engine.go`
- Create: `backend/internal/application/deployment/engine/types.go`
- Create: `backend/internal/application/deployment/engine/local/`
- Create: `backend/internal/application/deployment/engine/docker/`
- Create: `backend/internal/application/deployment/engine/firecracker/`
- Create: `backend/internal/application/deployment/engine/kubernetes/`
- Create: `backend/internal/application/deployment/engine/vercel/`
- Create: `backend/internal/application/deployment/engine/supabase/`
- Create: `backend/internal/application/deployment/engine/registry.go`

- [ ] **Step 1: Define Engine trait**
  ```go
  type Engine interface {
      Name() string
      Capabilities() []Capability // static, dynamic, buildpack, etc.
      Provision(ctx context.Context, manifest *Manifest) (*Deployment, error)
      Terminate(ctx context.Context, deployment *Deployment) error
      Status(ctx context.Context, deployment *Deployment) (Status, error)
      Logs(ctx context.Context, deployment *Deployment, opts LogsOpts) (<-chan LogLine, error)
  }
  ```

- [ ] **Step 2: Local engine** (already exists as `byteport-local`)
- [ ] **Step 3: Docker engine** (Dockerode or docker-cli wrapper)
- [ ] **Step 4: Firecracker engine** (wraps NanoVMS/PhenoCompose)
  - Initialize Firecracker VM with manifest config
  - Wire up networking + storage
  - Expose via Tailscale/Coolify-tunnel/Cloudflare-tunnel
- [ ] **Step 5: Kubernetes engine** (k8s client + Helm)
- [ ] **Step 6: Vercel adapter** (proxy to Vercel API for hosted deploys)
- [ ] **Step 7: Supabase adapter** (DB + Edge Functions)

- [ ] **Step 8: Engine registry** (manifest declares which engine)

### Task 3B: Manifest Engine Schema Extension

**Files:**
- Modify: `backend/internal/infrastructure/manifest/schema.go`

- [ ] **Step 1: Add `engine` field** to manifest root:
  ```yaml
  ENGINE: docker  # or firecracker, kubernetes, vercel, supabase, local
  ENGINE_CONFIG:
    replicas: 3
    resources:
      memory: 512Mi
      cpu: 500m
    # engine-specific config
  ```
- [ ] **Step 2: Update parser + tests**
- [ ] **Step 3: Update `docs/manifest.md`**

### Task 3C: Engine-Specific Buildpacks

**Files:**
- Create: `backend/internal/application/buildpack/`
- Modify: `backend/internal/infrastructure/manifest/schema.go`

- [ ] **Step 1: Define buildpack abstraction**
  ```go
  type Buildpack interface {
      Detect(manifest *Manifest) bool
      Build(ctx context.Context, manifest *Manifest) (*BuildArtifact, error)
  }
  ```

- [ ] **Step 2: Implement Node.js / Go / Rust / Python / Static buildpacks**
- [ ] **Step 3: Wire into provisioning flow**

---

## Phase 4: Observability + Logs Streaming (Weeks 15-18)

### Task 4A: Real-Time Log Streaming

**Files:**
- Create: `backend/internal/application/logs/`
- Modify: `backend/internal/infrastructure/http/handlers/`

- [ ] **Step 1: Log ingestion from engines** (every engine emits structured logs)
- [ ] **Step 2: WebSocket/SSE stream to frontend**
  ```ts
  const stream = new EventSource(`/api/deployments/${id}/logs`);
  stream.onmessage = (e) => append(e.data);
  ```
- [ ] **Step 3: Persist logs to OpenTelemetry logs backend**
- [ ] **Step 4: Frontend log tail component**

### Task 4B: Metrics + Tracing

**Files:**
- Modify: `backend/main.go`
- Create: `backend/internal/infrastructure/observability/`

- [ ] **Step 1: OTLP exporter (replace ConsoleSpanExporter)** — already in v1.0 plan
- [ ] **Step 2: Prometheus metrics endpoint** (`/metrics`)
- [ ] **Step 3: Per-deployment latency, error rate, token usage dashboards**

### Task 4C: Cost Tracking

**Files:**
- Create: `backend/internal/application/billing/`
- Modify: `backend/internal/infrastructure/persistence/postgres/usage_repository.go`

- [ ] **Step 1: Track resource usage per deployment** (CPU, memory, network, storage)
- [ ] **Step 2: Track LLM token usage per deployment** (already exists for portfolio)
- [ ] **Step 3: Pricing engine** (input tokens, output tokens, compute time, bandwidth)
- [ ] **Step 4: Cost reports** per org / per project / per deployment

---

## Phase 5: Agent Integration (Weeks 19-22)

### Objective
Make BytePort addressable from AI agents via MCP and A2A — so agents can deploy, manage, observe.

### Task 5A: MCP Server

**Files:**
- Create: `backend/internal/infrastructure/mcp/server.go`
- Create: `backend/internal/infrastructure/mcp/tools/`
- Create: `backend/internal/infrastructure/mcp/scopes.go`

- [ ] **Step 1: Implement MCP server** (stdio + SSE + Streamable HTTP transports)
- [ ] **Step 2: Initial 20 tools:**
  - `byteport_deploy` — deploy from manifest
  - `byteport_terminate` — terminate deployment
  - `byteport_status` — get deployment status
  - `byteport_logs` — tail deployment logs
  - `byteport_list_projects` — list user's projects
  - `byteport_list_deployments` — list user's active deployments
  - `byteport_secrets_list` — list secret keys (not values)
  - `byteport_secrets_get` — get a secret value
  - `byteport_secrets_set` — set a secret
  - `byteport_team_list` — list teams in org
  - `byteport_team_members` — list team members
  - `byteport_org_info` — get current org
  - `byteport_cost_report` — cost summary for period
  - `byteport_metric_query` — query metrics
  - `byteport_health` — health check
  - `byteport_validate_manifest` — validate manifest
  - `byteport_estimate_cost` — estimate cost from manifest
  - `byteport_clone_project` — clone project from template
  - `byteport_rollback` — rollback to previous version
  - `byteport_scale` — adjust replicas

- [ ] **Step 3: Scoped auth** (30 scopes like OmniRoute)

### Task 5B: A2A Agent Card

**Files:**
- Create: `backend/internal/infrastructure/a2a/agent_card.go`
- Create: `backend/internal/infrastructure/a2a/handler.go`

- [ ] **Step 1: `/.well-known/agent.json`**
- [ ] **Step 2: JSON-RPC 2.0 over SSE for agent-to-agent communication**
- [ ] **Step 3: Skills:**
  - `deploy_application` — natural-language deploy intent
  - `analyze_deployment_failure` — debug failing deployments
  - `cost_optimization_recommendation` — suggest cheaper configurations

### Task 5C: Python FastMCP Server (T3-P binding)

**Rationale:** Per the forced-edge audit (§0.4), **Python FastMCP is forced** because:
- FastMCP is the canonical MCP server framework used by the Anthropic ecosystem
- Agents/clients expect `@mcp.tool()` decorator-style tool definitions
- The Python ML ecosystem (NumPy, scikit-learn, transformers) enables ML-augmented deploy wizards (cost prediction, log anomaly detection)

**Strategy:** Run FastMCP server **in-process** via `pyo3` Rust↔Python FFI. Python code calls Rust control plane primitives through `pyo3`. Rust exports Python-callable functions for tool execution. After Phase 7's Rust migration, FastMCP binds directly to the Rust binary.

**Files (Go phase — before Rust migration):**
- Create: `backend/internal/infrastructure/mcp/fastmcp_bridge.go`
- Modify: `backend/internal/infrastructure/mcp/server.go`

**Files (Rust phase — after Phase 7):**
- Create: `crates/byteport-fastmcp/Cargo.toml`
- Create: `crates/byteport-fastmcp/src/lib.rs` (pyo3 module)
- Create: `crates/byteport-fastmcp/python/byteport_fastmcp/server.py`
- Create: `crates/byteport-fastmcp/python/byteport_fastmcp/tools/`

```toml
[dependencies]
pyo3 = { version = "0.21", features = ["auto-initialize"] }
maturin = "1.5"
```

- [ ] **Step 1: Define `pyo3` Rust module exposing control-plane primitives**
  ```rust
  #[pyfunction]
  fn deploy_manifest(manifest_yaml: &str) -> PyResult<PyDeployment> {
      // Calls into byteport-control crate via Rust API
  }

  #[pyfunction]
  fn list_deployments(org_id: &str) -> PyResult<Vec<PyDeployment>> {
      // Calls into byteport-control crate via Rust API
  }

  #[pyfunction]
  fn tail_logs(deployment_id: &str, lines: usize) -> PyResult<Vec<PyLogLine>> {
      // Calls into byteport-control crate via Rust API
  }

  #[pymodule]
  fn byteport(_py: Python, m: &PyModule) -> PyResult<()> {
      m.add_function(wrap_pyfunction!(deploy_manifest, m)?)?;
      m.add_function(wrap_pyfunction!(terminate, m)?)?;
      m.add_function(wrap_pyfunction!(status, m)?)?;
      m.add_function(wrap_pyfunction!(list_deployments, m)?)?;
      // ... all 20 MCP tools
      Ok(())
  }
  ```
- [ ] **Step 2: Build Python wheel with `maturin`**
  ```bash
  cd crates/byteport-fastmcp
  maturin build --release
  pip install target/wheels/byteport_fastmcp-*.whl
  ```
- [ ] **Step 3: FastMCP server definition in Python**
  ```python
  from fastmcp import FastMCP
  import byteport_fastmcp as bpcore

  mcp = FastMCP("BytePort")

  @mcp.tool()
  async def byteport_deploy(manifest: str) -> dict:
      """Deploy an application from a BytePort manifest."""
      return bpcore.deploy_manifest(manifest)

  @mcp.tool()
  async def byteport_list_deployments(org_id: str) -> list[dict]:
      """List active deployments for an organization."""
      return bpcore.list_deployments(org_id)

  @mcp.tool()
  async def byteport_estimate_cost(manifest: str) -> dict:
      """Estimate monthly cost for a manifest using ML cost prediction."""
      return bpcore.estimate_cost(manifest)

  if __name__ == "__main__":
      mcp.run()
  ```
- [ ] **Step 4: Mirror Go MCP tools as FastMCP tools** (one-to-one mapping)
- [ ] **Step 5: ML-augmented deploy wizards** (Python-specific value-add)
  - `byteport_analyze_failure` — Python + scikit-learn clustering on failure logs
  - `byteport_suggest_architecture` — Python ML model recommends engine choice
  - `byteport_predict_cost` — Python ML model trained on historical deployments
- [ ] **Step 6: Run alongside Go MCP server** — both expose same tools over different transports
- [ ] **Step 7: Audit log parity** — Python invocations also write to audit table

**Why in-process vs separate Python process?** Running FastMCP in-process via `pyo3`:
- Eliminates T1 HTTP overhead (~1-2 ms per call)
- Shares Rust control-plane state (no IPC serialization of org context, RBAC checks, etc.)
- Single deployment unit (one binary boots both Rust + embedded Python)

**Fallback:** If `pyo3` build fails or Python interpreter not present at runtime, FastMCP tools degrade to Go MCP tools automatically.

### Task 5D: Zig Hot-Path Shims (T3-Z binding)

**Rationale:** Per decision tree Q3, Zig is the **first pick** for BytePort when:
- MicroVM shim layer needs C-ABI for Firecracker/gVisor/WASM runtimes
- Buildpack cache lookup is a hot path (called per layer fetch)
- Custom allocator needed (arena for manifest parse, off-heap for log buffer pools)
- Manifest validation can be 10× faster with Zig compile-time codegen

**Files (post Phase 7 Rust migration):**
- Create: `crates/byteport-shims-zig/Cargo.toml`
- Create: `crates/byteport-shims-zig/build.rs`
- Create: `crates/byteport-shims-zig/src/lib.rs` (Rust FFI wrapper)
- Create: `crates/byteport-shims-zig/zig/microvm_shim.zig`
- Create: `crates/byteport-shims-zig/zig/manifest_validate.zig`
- Create: `crates/byteport-shims-zig/zig/buildpack_cache.zig`

- [ ] **Step 1: Set up Zig build via `zigbuild` crate**
- [ ] **Step 2: Implement MicroVM shim** — C-ABI wrapper for Firecracker/gVisor/WASM runtimes
  - `extern "C" fn microvm_create(spec: *const VmSpec) -> VmHandle`
  - `extern "C" fn microvm_exec(handle: VmHandle, cmd: *const Cmd) -> i32`
  - `extern "C" fn microvm_destroy(handle: VmHandle)`
- [ ] **Step 3: Implement manifest validator** — Zig compile-time codegen for fast schema check
- [ ] **Step 4: Implement buildpack cache lookup** — Zig hashmap with custom memory layout
- [ ] **Step 5: Benchmark suite** — Criterion benchmarks comparing Rust vs Rust+Zig FFI

**Decision rule:** If Zig shim does NOT achieve ≥2× speedup over Rust, deprecate the shim and rely on Rust.

### Task 5E: Mojo ML Kernels (T3-M binding)

**Rationale:** Per decision tree Q2, Mojo is the **first pick** for ML kernel-level work:
- Cost prediction (per-deployment) — trained on historical `usage_repository.go` data
- Portfolio image generation / description (already uses LLM, but image classification needs ML)
- Log anomaly detection (deploy failure clustering)
- Engine selection recommendation (cost vs latency vs capability ML model)

**Constraint:** Mojo is pre-1.0. This task is **gated** until Mojo ≥v1.0 ships. Until then, this slot is held by Rust with `tch`/`candle` ML libraries + Python (via `pyo3`) for scikit-learn models.

**Files (planned, gated on Mojo v1.0):**
- Create: `crates/byteport-ml-kernels/Cargo.toml`
- Create: `crates/byteport-ml-kernels/build.rs`
- Create: `crates/byteport-ml-kernels/src/lib.rs` (FFI loader)
- Create: `crates/byteport-ml-kernels/mojo/cost_predict.mojo`
- Create: `crates/byteport-ml-kernels/mojo/anomaly_detect.mojo`

- [ ] **Step 1: Set up Mojo build via `mojo build --shared` → load via `libloading`**
- [ ] **Step 2: Implement cost prediction kernel**
  - Input: manifest spec, historical usage
  - Output: predicted monthly cost + confidence interval
  - Target: <500µs per call
- [ ] **Step 3: Implement anomaly detection kernel**
  - Input: streaming log lines
  - Output: anomaly score per line
  - Target: <100µs per call
- [ ] **Step 4: Fallback path** — Rust `candle` or Python scikit-learn runs if Mojo kernels fail to load

**Decision rule:** Mojo earns its slot only when ≥3 kernels demonstrate ≥2× speedup over Rust/Python baselines.

---

## Phase 6: Project Templates & Marketplace (Weeks 23-26)

### Task 6A: Template System

**Files:**
- Create: `backend/internal/application/templates/`
- Modify: `backend/internal/infrastructure/persistence/postgres/`

- [ ] **Step 1: Built-in templates** (Next.js, Vite+React, SvelteKit, Go-API, Rust-Axum, Python-FastAPI, Static-Site, Microservices-Starter)
- [ ] **Step 2: Template variables** (project name, git URL, environment, database)
- [ ] **Step 3: `byteport new <template> <name>` CLI command**

### Task 6B: Public Template Marketplace

- [ ] **Step 1: `templates.byteport.dev` registry (Rust service or static site)**
- [ ] **Step 2: `byteport template search <query>`**
- [ ] **Step 3: `byteport template add <author>/<name>`**

---

## Phase 7: Rust Control Plane Migration (Weeks 27-36)

### Objective
Replace Go backend with Rust for performance, safety, and ecosystem consistency.

### Task 7A: Rust Crate Scaffold

**Files:**
- Create: `crates/byteport-core/Cargo.toml`
- Modify: `Cargo.toml` (workspace)

- [ ] **Step 1: Add `byteport-core`, `byteport-control`, `byteport-secrets`, `byteport-agents`, `byteport-fastmcp`, `byteport-shims-zig`, `byteport-ml-kernels` crates**
- [ ] **Step 2: Choose axum + sqlx + tonic + OpenTelemetry stack**
- [ ] **Step 3: Replace Go backend with Rust binary in `backend/` (rename to `backend-legacy/` after migration)**

### Task 7B: Decompose Backend into Rust Crates

| Concern | Rust crate | Binding to other languages |
|---------|-----------|---|
| HTTP routing | `byteport-control` | n/a (Rust core) |
| DB models | `byteport-db` | n/a (Rust + sqlx) |
| Auth (WorkOS + RBAC) | `byteport-auth` | n/a (Rust) |
| Secrets encryption | `byteport-secrets` | T3-Z (Zig hot path for Argon2id) |
| Engine dispatch | `byteport-engines` | T1 (HTTP to NVMS Go service) |
| MCP server | `byteport-mcp` | T3-P (FastMCP Python via `pyo3`) |
| A2A handler | `byteport-a2a` | n/a (Rust + JSON-RPC) |
| Manifest parser | `byteport-manifest` | T3-Z (Zig validator for hot path) |
| FastMCP bridge | `byteport-fastmcp` | T3-P (`pyo3` Rust↔Python) |
| Zig shims | `byteport-shims-zig` | T3-Z (C-ABI to Rust) |
| ML kernels | `byteport-ml-kernels` | T3-M (`libloading` to Mojo shared lib) |
| Cloud providers | `byteport-providers` | T1 (HTTP to AWS/GCP/Azure REST APIs) |

### Task 7C: Dual-Write Compatibility Period

- [ ] **Step 1: Run both Go and Rust backends on different ports**
- [ ] **Step 2: Tauri/Rust desktop shell calls Rust by default**
- [ ] **Step 3: SvelteKit frontend calls whichever backend via `/api/v1/` prefix**
- [ ] **Step 4: Migrate routes one at a time, feature-flagged**
- [ ] **Step 5: Retire Go backend after 100% feature parity**

---

## Phase 8: Cross-Cloud Adapter (Weeks 37-42)

### Objective
Abstract AWS/GCP/Azure/Vercel/Supabase/cloud behind a single interface. Same manifest deploys anywhere.

### Task 8A: Resource Provider Abstraction

**Files:**
- Create: `crates/byteport-providers/src/aws.rs`
- Create: `crates/byteport-providers/src/gcp.rs`
- Create: `crates/byteport-providers/src/azure.rs`
- Create: `crates/byteport-providers/src/vercel.rs`
- Create: `crates/byteport-providers/src/supabase.rs`
- Create: `crates/byteport-providers/src/cloudflare.rs`
- Create: `crates/byteport-providers/src/digitalocean.rs`
- Create: `crates/byteport-providers/src/hetzner.rs`
- Create: `crates/byteport-providers/src/local.rs`

- [ ] **Step 1: Define `ResourceProvider` trait**
  ```rust
  #[async_trait]
  pub trait ResourceProvider: Send + Sync {
      async fn provision_vm(&self, spec: VmSpec) -> Result<VmId>;
      async fn provision_db(&self, spec: DbSpec) -> Result<DbId>;
      async fn provision_object_store(&self, spec: BucketSpec) -> Result<BucketId>;
      async fn provision_serverless_fn(&self, spec: FnSpec) -> Result<FnId>;
      async fn destroy(&self, id: ResourceId) -> Result<()>;
  }
  ```

- [ ] **Step 2: Implement for each provider**
- [ ] **Step 3: Convert manifest `INFRASTRUCTURE:` block to provider calls**

### Task 8B: Cross-Cloud Manifest Format

**Files:**
- Modify: `crates/byteport-manifest/src/schema.rs`

```yaml
INFRASTRUCTURE:
  compute:
    provider: aws        # aws, gcp, azure, hetzner, digitalocean, vercel, supabase
    engine: firecracker  # which engine runs the workload
    region: us-east-1
    instance_type: t3.micro
  database:
    provider: supabase   # managed Postgres
    name: my-db
  storage:
    provider: aws
    type: s3
    bucket: my-app-uploads
  serverless_functions:
    - provider: vercel
      entrypoint: api/hello.ts
  cdn:
    provider: cloudflare
    zone: example.com
```

---

## Phase 9: Federation & Multi-Instance (Weeks 43-50)

### Task 9A: Multi-Node Coordination

- [ ] **Step 1: Define control-plane / data-plane roles**
  - Control plane: Rust API service, DB, observability
  - Data plane: agents that run on each host/region/engine target
- [ ] **Step 2: Wire protocol** (gRPC + NATS for pub/sub)
- [ ] **Step 3: Agent registration + heartbeat**
- [ ] **Step 4: Workload scheduler** (which agent runs which deployment)

### Task 9B: Federation

- [ ] **Step 1: Wire auth between BytePort instances** (OIDC issuer)
- [ ] **Step 2: Cross-instance project visibility** (federated search)
- [ ] **Step 3: Multi-region orchestration**

---

## File Map

| Path | Purpose | Phase | Language |
|------|---------|-------|----------|
| `backend/internal/infrastructure/manifest/` | Manifest parser | 1C | Go (later Rust) |
| `backend/internal/infrastructure/auth/rbac.go` | RBAC | 2C | Go (later Rust) |
| `backend/internal/application/deployment/engine/` | Engine abstraction | 3A | Go (later Rust) |
| `backend/internal/application/buildpack/` | Buildpacks | 3C | Go (later Rust) |
| `backend/internal/application/logs/` | Real-time logs | 4A | Go (later Rust) |
| `backend/internal/application/billing/` | Cost tracking | 4C | Go (later Rust) |
| `backend/internal/infrastructure/mcp/` | MCP server | 5A | Go (then mirrored in FastMCP Python) |
| `backend/internal/infrastructure/a2a/` | A2A handler | 5B | Go (later Rust) |
| `backend/internal/infrastructure/mcp/fastmcp_bridge.go` | FastMCP bridge | 5C | Go ↔ Python |
| `backend/internal/application/templates/` | Templates | 6A | Go (later Rust) |
| `crates/byteport-core/` | Rust control plane | 7A | Rust |
| `crates/byteport-control/` | HTTP routing | 7B | Rust |
| `crates/byteport-secrets/` | Secrets encryption | 7B | Rust + Zig shim |
| `crates/byteport-agents/` | MCP/A2A | 7B | Rust |
| `crates/byteport-fastmcp/` | FastMCP Python bridge | 7B | Rust + Python (pyo3) |
| `crates/byteport-shims-zig/` | Zig hot-path shims | 7B | Zig + Rust FFI |
| `crates/byteport-ml-kernels/` | Mojo ML kernels | 7B | Mojo (gated) + Rust fallback |
| `crates/byteport-providers/` | Cloud providers | 8A | Rust |
| `crates/byteport-federation/` | Multi-node | 9A | Rust |
| `frontend/web/src/routes/` | SvelteKit routes | various | SvelteKit/TypeScript |
| `frontend/web/src/lib/components/` | Svelte components | various | Svelte 5/TypeScript |
| `frontend/web/src-tauri/` | Tauri shell | various | Rust + Tauri 2 |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WorkOS org mapping breaks auth | Medium | High | Keep dual-auth period with PASETO as fallback |
| Multi-tenant data leaks | High | Critical | Aggressive scoping tests, audit every query |
| Cloud provider API divergence | High | Medium | Comprehensive integration tests, contract tests |
| Rust migration too slow | Medium | Medium | Phase gates; ship each phase as standalone |
| Cost calculation errors | Medium | High | Test against known reference workloads |
| Zig shims don't outperform Rust baselines | High | Low | Auto-fallback to Rust; deprecate shims |
| Mojo v1.0 ships late / kernels underperform | High | Low | Task 5E is gated; Rust + `candle` or Python scikit-learn covers gap |
| Python interpreter not present at deploy time | Low | Medium | pyo3 fallback to Go MCP tools; documented in README |
| FastMCP framework breaks (API drift) | Medium | Medium | Pin FastMCP version; mirror tools in Go MCP server as redundant |

---

## Success Criteria

1. **Phase 1 complete:** All v1.0 bugs closed, manifest parser shipped, RBAC foundation laid
2. **Phase 2 complete:** Multi-tenant org support, RBAC enforced, frontend team switcher
3. **Phase 3 complete:** All 7 engines (local, docker, firecracker, kubernetes, vercel, supabase, gcp) work
4. **Phase 4 complete:** Real-time logs in dashboard, cost tracking operational
5. **Phase 5 complete:** 20+ MCP tools + A2A agent card live + FastMCP Python bridge + Zig shims benchmarked + Mojo kernels evaluated
6. **Phase 6 complete:** Built-in templates + marketplace
7. **Phase 7 complete:** Rust control plane at 100% feature parity with Go (with `byteport-fastmcp`, `byteport-shims-zig`, `byteport-ml-kernels` crates)
8. **Phase 8 complete:** Manifest deploys to any provider with single config change
9. **Phase 9 complete:** Federation protocol operational
