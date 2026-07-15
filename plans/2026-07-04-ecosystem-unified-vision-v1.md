# Phenotype Ecosystem — Unified Vision & Integration Plan

> **Document:** Strategic alignment document for the Phenotype platform.
> **Owner:** Koosha (Founder)
> **Audience:** All contributors and sub-agents across repos.
> **Last Updated:** 2026-07-04

This document is the **north star** for everything in `/Users/kooshapari/CodeProjects/Phenotype/repos/`. The repo-level plans (OmniRoute fork rewrite, BytePort evolution) drill into specific implementations; this document explains the **why** and the **how they fit together**.

---

## 1. The Mission

> **Phenotype** is a self-hosted, AI-native, enterprise-grade infrastructure platform that abstracts away the _how_ of running software so that anyone — from indie developers to Fortune 500 teams — can ship, deploy, observe, and orchestrate applications and AI agents on any hardware, with the same primitives as AWS/GCP/Vercel/Supabase but **without lock-in**.

**Concretely:**

- One declarative file (`odin.nvms`) describes application + infrastructure + portfolio + agent configuration.
- One command (`byteport deploy`) ships it from repo to live URL.
- One control plane (`BytePort`) manages everything that runs.
- One routing layer (`OmniRoute`) routes AI/agent calls to the best provider.
- One isolation stack (`NanoVMS`/`PhenoCompose`) runs workloads in WASM/gVisor/Firecracker.
- The whole system is **multi-language** (Zig/Mojo/Rust/Go/Python/TypeScript — see §3), **multi-engine** (Docker/Firecracker/K8s/local), **multi-cloud** (AWS/GCP/Azure/Vercel/Supabase), and **multi-tenant**.
- Cross-language integration follows [ADR-032 (Polyglot Binding Tiers)](../../docs/adr/0032-polyglot-binding-tiers.md) — **T1 HTTP** for loose coupling, **T2 UDS RPC** for fast local IPC, **T3** for in-process FFI (`napi-rs` Node↔Rust, `cgo` Node↔Go, `pyo3` Python↔Rust).

---

## 2. The Stack (3 Tiers, Layered)

```
┌──────────────────────────────────────────────────────────────────────┐
│  TIER 3 — Application / Portfolio / Dashboard                        │
│                                                                       │
│   SvelteKit 2 (BytePort frontend)                                    │
│   Next.js 16 (OmniRoute dashboard)                                   │
│   Tauri 2 (Desktop shells)                                           │
│   Mobile (iOS/Android via Capacitor / Tauri Mobile)                  │
└──────────────────────────────────┬────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  TIER 2 — Control Plane (Orchestration, Policy, Agent Protocols)      │
│                                                                       │
│   BytePort (Rust + Go hybrid control plane)                         │
│   - Manifest engine                                                  │
│   - Multi-engine orchestration                                       │
│   - RBAC + multi-tenant                                              │
│   - Observability (OTel export)                                      │
│   - MCP server (Go → mirrored in FastMCP Python via pyo3)           │
│   - A2A agent card                                                   │
│   - Webhooks, evals, skills, guardrails                              │
│     ↑ Zig shims for Argon2id, manifest validate, buildpack cache    │
│                                                                       │
│   OmniRoute (Next.js 16 + Rust data plane)                           │
│   - LLM provider routing (232 providers, 17 strategies)              │
│   - MCP server (TS) + FastMCP server (Python via pyo3)              │
│   - A2A server                                                       │
│   - Skill/memory/webhook subsystems                                  │
│   - Policy engine, cost rules                                        │
│     ↑ Zig shims for SSE chunker, regex prefilter, arena allocator    │
│     ↑ Mojo kernels for tokenizer scoring, combo routing (gated)     │
└──────────────────────────────────┬────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  TIER 1 — Execution / Runtime Layer                                   │
│                                                                       │
│   NanoVMS (Go, 3-tier isolation):                                    │
│   - Tier 1: WASM (Spin/Wasmtime), <1ms startup                      │
│   - Tier 2: gVisor, ~90ms startup                                    │
│   - Tier 3: Firecracker, ~125ms startup, full VM isolation           │
│     ↑ Zig shim for MicroVM C-ABI (crates/*-shims-zig)               │
│                                                                       │
│   PhenoCompose (Rust/Go Docker-Compose evolution):                   │
│   - Multi-tenant compose files                                       │
│   - Cross-platform orchestrator                                      │
│   - KVMS driver                                                      │
│                                                                       │
│   Engine Adapters:                                                   │
│   - Docker (via shim)                                                │
│   - Kubernetes (via k8s client)                                      │
│   - Local (process supervisor)                                       │
│   - AWS/GCP/Azure/Vercel/Supabase (provider abstractions)            │
│                                                                       │
│   Bifrost (Go, vendored Tier-1 router for OmniRoute):                │
│   - Provider dispatch                                                │
│   - Load balancing, virtual keys                                     │
│   - MCP client integration                                           │
│     ↑ T3 cgo bridge from Rust (F6, 2027 Q1) eliminates HTTP overhead │
│                                                                       │
│   ML Kernels (Mojo, gated on Mojo ≥v1.0):                            │
│   - Tokenizer scoring, combo routing, cost prediction                │
│   - Fallback: Rust + candle or Python + scikit-learn                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. The Language Hierarchy (Decision-Tree Ordering)

The user's explicit preference, restated precisely:

> **Decision-tree priority** (highest optimality first): **Zig > Mojo > Rust > Go > Python (forced edge) > TypeScript**.
> **Volume distribution** (after decision trees settle): **Rust + Go will be the largest portion.** Zig and Mojo will be smaller but placed at the **highest-leverage** inner-loop points. Python stays a forced edge for FastMCP and ML-augmented tooling only. TypeScript is reserved for Tier-3 (UI/dashboard/agent protocol surfaces).

### 3.0 Forced-Edge Audit

Before the decision tree applies, identify **forced edges** — places where the ecosystem dictates the language choice regardless of preference:

| Forced edge                   | Why forced                                                                              | Integration tier (per [ADR-032](../../docs/adr/0032-polyglot-binding-tiers.md), Accepted 2026-07-04) |
| ----------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Python (FastMCP)**          | FastMCP is the canonical MCP server framework; Anthropic ecosystem expects it           | **T3-P** (`pyo3` Rust↔Python FFI, in-process)                                                        |
| **Python (ML wizards)**       | scikit-learn / pandas / transformers ecosystem is the de-facto for ML-augmented tooling | **T3-P** (`pyo3`) or **T2** (UDS RPC)                                                                |
| **TypeScript (UI, MCP, A2A)** | No UI alternative at the velocity needed; Anthropic SDK reference impl is TS            | **T1** (HTTP) or **T2** (UDS RPC)                                                                    |
| **WAT/WASM**                  | Browser-side execution, edge functions                                                  | **T1** (HTTP)                                                                                        |
| **SQL**                       | Declarative queries — no substitute                                                     | n/a (within Rust `sqlx` or `rusqlite`)                                                               |
| **Bash/Shell**                | System tooling glue                                                                     | n/a (build/test scripts)                                                                             |

**Decision rule:** When a forced edge exists, we do NOT write a wrapper in our preferred language. We **integrate** at the binding tier (T1/T2/T3) that minimizes overhead and preserves the forced-edge tool's ecosystem.

### 3.1 Decision Tree (Run for Each New Component)

For each new component, run this tree in order. First match wins:

| Question                                                                                         | If yes →                                                         | If no →              |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------- |
| Q1: Is there a forced edge (FastMCP, ML wizards, WAT, TS UI)?                                    | **Use forced edge** at T1/T2/T3                                  | Continue             |
| Q2: Is this an ML kernel / on-device inference / ML-augmented scoring?                           | **Mojo** (when ≥v1.0 ships; otherwise Rust + `candle` or Python) | Continue             |
| Q3: Is binary size <100KB, C-ABI required, kernelspace bridging, or compile-time codegen needed? | **Zig**                                                          | Continue             |
| Q4: Memory safety + perf + single-binary + tokio ecosystem?                                      | **Rust**                                                         | Continue             |
| Q5: Massive SDK ecosystem (cloud), goroutine fanout, NVMS-style service?                         | **Go**                                                           | Continue             |
| Q6: UI / dashboard / agent protocol surface?                                                     | **TypeScript/SvelteKit/Next.js**                                 | **Reconsider scope** |

### 3.2 Rust — High-volume systems language (largest portion)

**Where:**

- BytePort control plane (Phase 7+)
- OmniRoute data plane (Phase 1+)
- All CLI tools (`byteport`, `pheno-*`)
- PhenoCompose driver (already Rust-heavy)
- All FFI bridges (Tauri/macOS/Android/Linux, `napi-rs` Node↔Rust, `cgo` Node↔Go, `pyo3` Python↔Rust)
- Bifrost absorption candidate (Phase 5 of OmniRoute fork plan)
- ML kernel fallback (`candle`, `tch`) until Mojo ≥v1.0

**Why Rust wins the largest volume:**

- Memory safety + performance = correct at scale
- Single binary deployments (`cargo build --release`)
- tokio ecosystem is unmatched (axum, tonic, hyper, reqwest)
- `cargo` provides tight reproducibility
- Already proven in `pheno-port-adapter`, `pheno-cdylib-bridge`, `pheno-tracing`
- Cross-language FFI host: `napi-rs`, `cgo`, `pyo3` all target Rust as the canonical substrate

### 3.3 Go — High-volume pragmatic services (second largest portion)

**Where:**

- NanoVMS core runtime (already Go)
- Bifrost vendored gateway (already Go, until F6 `cgo` bridge ships)
- Cloud SDK wrappers (AWS/GCP/Azure)
- Quick service scaffolding where Rust is overkill
- `cgo` callable from Rust via F6 bridge (2027 Q1)

**Why Go wins the second-largest volume:**

- Massive cloud SDK ecosystem (AWS, GCP, Azure, K8s, Terraform)
- Goroutines + channels map naturally to request fanout
- Smaller learning curve for casual contributors
- Lower ceremony than Rust for smaller services
- Vendored gateway (Bifrost) is already battle-tested

### 3.4 TypeScript / Next.js / SvelteKit — Tier-3 only

**Where:**

- OmniRoute dashboard (Next.js 16)
- BytePort frontend (SvelteKit 2 + Svelte 5 + Tailwind 4)
- MCP server tooling (TypeScript) — coexists with FastMCP Python
- A2A handler logic (TypeScript)
- Frontend-only portfolio sites

**Why:**

- Fast iteration
- Massive component libraries
- Familiar to most developers
- Tier 3 (UI/dashboard) demands velocity over performance
- Anthropic SDK reference impl is TS — ecosystem expects it

### 3.5 Zig — High-leverage hot-path shims (small portion, big impact)

**Where (concrete):**

- `crates/omniroute-shims-zig/` — SSE chunker, regex prefilter, arena allocator (OmniRoute fork plan §Task 2E)
- `crates/byteport-shims-zig/` — MicroVM shim, manifest validator, buildpack cache (BytePort evolution plan §Task 5D)
- Future: kernelspace/embedded bridging, Wasmtime alternatives if Rust too heavy

**Why Zig earns first-pick at hot paths:**

- Binary size <100KB when needed
- C ABI without overhead (Rust FFI is fast but not zero-cost for C interop)
- Compile-time code generation without macros (cleaner than Rust `const fn` limits)
- Custom allocators trivial to implement (arena for SSE buffer pools, off-heap for token streams)
- No GC, no runtime — predictable latency

**Decision rule:** Zig earns its slot via **measurable optimality** (≥2× speedup over Rust baseline). Otherwise, deprecate and rely on Rust.

### 3.6 Mojo — High-leverage ML kernels (small portion, big impact, gated)

**Where (concrete, planned):**

- `crates/omniroute-ml-kernels/mojo/` — tokenizer scoring, combo routing (OmniRoute fork plan §Task 5C)
- `crates/byteport-ml-kernels/mojo/` — cost prediction, anomaly detection (BytePort evolution plan §Task 5E)
- Future: on-device inference for routing decisions, speculative decoding

**Why Mojo earns first-pick for ML kernels:**

- Native ML primitives (no `candle` indirection)
- GPU/TPU-ready when available
- `comptime` evaluation beats `candle` Rust for inference shape
- Designed for the exact workload ML kernels represent

**Gating constraint:** Mojo is pre-1.0. Tasks 5C and 5E are **gated** until Mojo ≥v1.0 ships. Until then, the slot is held by:

- Rust `candle` or `tch` for inference
- Python scikit-learn via `pyo3` for ML wizards

**Decision rule:** Mojo earns its slot only when ≥3 kernels demonstrate ≥2× speedup over Rust/Python baselines.

### 3.7 Python — Forced edge for FastMCP + ML wizards (small portion, ecosystem-locked)

**Where (concrete, planned):**

- `crates/omniroute-fastmcp/` — FastMCP server (OmniRoute fork plan §Task 5D)
- `crates/byteport-fastmcp/` — FastMCP server (BytePort evolution plan §Task 5C)
- ML-augmented deploy wizards (cost prediction, log anomaly detection)
- Future: third-party tool plugins written by community (Python is the lowest-barrier authoring language)

**Why Python is forced:**

- FastMCP is the de-facto MCP framework; agents/clients expect `@mcp.tool()` decorator-style definitions
- Anthropic ecosystem widely adopts FastMCP
- NumPy / scikit-learn / pandas / transformers are the de-facto ML stack — we cannot replace them
- Lowest barrier to entry for community-contributed tools (encourages ecosystem growth)

**Integration tier:** **T3-P** (`pyo3` Rust↔Python FFI, in-process via `maturin` wheel build).

- Eliminates T1 HTTP overhead (~1-2 ms per call)
- Shares Rust state (no IPC serialization)
- Single deployment unit (one binary boots Rust + embedded Python)

**Fallback:** If `pyo3` build fails or Python interpreter not present at runtime, FastMCP tools degrade to TS MCP tools automatically. No operator action required.

---

## 4. The Three Surfaces BytePort Will Own

Per the user's directive, BytePort becomes a "100% owned Surface" that is a combination + evolution of AWS/GCP/Vercel/Supabase/Coolify. Concretely:

### Surface 1: Application Hosting (Vercel/Railway equivalent)

- One click deploy from `git push`
- Preview environments per PR
- Custom domains with automatic TLS (Caddy integration)
- Edge functions / Serverless functions
- Static asset CDN

### Surface 2: Database Hosting (Supabase equivalent)

- Managed Postgres with extensions
- Realtime subscriptions (Postgres logical replication → WebSocket)
- Row-level security and auth policies
- Vector search (pgvector)
- Schema migrations
- Backups + point-in-time recovery

### Surface 3: Object Storage / Serverless (AWS Lambda + S3 equivalent)

- S3-compatible object storage (MinIO backing)
- Lambda-equivalent serverless functions
- Queue (Redis/NATS backed)
- Cron / scheduled tasks
- Webhooks as first-class resources

### Surface 4: Multi-Cloud Abstraction

- Same primitive (vm, db, bucket, fn) across AWS, GCP, Azure, Hetzner, DigitalOcean
- Engineer writes manifest, BytePort picks provider
- Hybrid: GCP for compute + Cloudflare for CDN + Supabase for DB

### Surface 5: Portfolio / Showcase

- Per BytePort user's portfolio site (Slickport integration)
- LLM-generated descriptions, screenshots, tags
- Auto-updated with every successful deploy

### Surface 6: Agent Platform (MCP + A2A)

- BytePort exposes itself as an MCP server (87+ tools)
- Agents can deploy, manage, observe
- Federation between BytePort instances for multi-org coordination

---

## 5. The Five Underlying Layers BytePort Sits On

BytePort sits on top of five layers; it does NOT replace them. It orchestrates and abstracts.

### Layer 1: Hardware Abstraction — PhenoCompose + NanoVMS

- Hardware-agnostic MicroVM runtime (Firecracker, gVisor, WASM)
- Process supervision, network plumbing, volume management
- Already exists: `nanovms/` (Go), `PhenoCompose/` (Rust/Go hybrid)

### Layer 2: Container Runtimes — Docker / Podman / containerd

- Standard container primitives when MicroVM isn't needed
- Drop-in support for any Docker-style image

### Layer 3: Cluster Orchestrators — Kubernetes, Nomad, Proxmox

- Optional; activated for enterprise scale

### Layer 4: Network — Tailscale, Cloudflare Tunnel, ngrok

- Service mesh + secure ingress without port-forwarding
- Already integrated in OmniRoute fork (`src/lib/{cloudflaredTunnel,ngrokTunnel}.ts`)

### Layer 5: Observability — OpenTelemetry, Prometheus, Grafana, Loki

- OTLP-based tracing everywhere
- Metrics + structured logs as universal protocol

---

## 6. The Three Repos That Define The Stack

| Repo                             | Purpose                    | Phase        |
| -------------------------------- | -------------------------- | ------------ |
| **`BytePort/`**                  | Enterprise control surface | Active work  |
| **`OmniRoute/` (fork)**          | AI proxy/router            | Active work  |
| **`PhenoCompose/` + `nanovms/`** | Execution/runtime          | Pre-existing |

These three repos cooperate. The user's directive: **I own BytePort, I own non-frontend OmniRoute aspects, PhenoCompose/NanoVMS sit below.**

### Integration Points

```
BytePort ──► PhenoCompose (Rust crates for engine dispatch)
         ──► NanoVMS (Go service for Firecracker/VM provisioning)
         ──► OmniRoute (TypeScript API for AI routing, MCP/A2A)
```

Specifically:

- **BytePort's "Firecracker engine"** delegates to **PhenoCompose's** KVMS driver, which talks to **NanoVMS's** Go service.
- **BytePort's AI features** (LLM-powered portfolio descriptions, deploy wizards) call through **OmniRoute** for any provider selection. This means a user can use Anthropic for portfolio text generation and GPT-4o for status summaries, routed through OmniRoute's combo engine.
- **BytePort's MCP server** shares tool style with **OmniRoute's MCP server** (both use the same `mcp-tools` patterns). Each ships a **TS MCP server** (T1 HTTP) and a **FastMCP Python server** (T3-P `pyo3`) so community authors can pick their preferred binding tier per [ADR-032](../../docs/adr/0032-polyglot-binding-tiers.md).
- **Observability flows together**: BytePort exports OTLP traces that OmniRoute's services also export, into a unified collector.
- **Hot-path primitives** (SSE chunker, regex prefilter, MicroVM shim, manifest validator) ship as **Zig shims** (per §3.5) called from Rust via C-ABI. ML kernels (tokenizer scoring, cost prediction) ship as **Mojo** (per §3.6, gated on Mojo ≥v1.0) with Rust `candle`/Python scikit-learn fallbacks.

---

## 7. The Portfolio / Ecosystem Mandate

Per the user's directive, BytePort must be both:

- (a) **A portfolio** (showcase deployed projects)
- (b) **Part of a portfolio/ecosystem**

The "ecosystem" includes:

- Phenotype monorepo (this `repos/`)
- AgnosticPari / MidlDifi (kernel-level infrastructure, hint at `pheno-port-adapter`, `pheno-cdylib-bridge`)
- All `pheno-*` projects for governance, tracing, config, context, errors, schema, llms-txt, drift detection
- `phenotype-journeys` for product experience design
- `phenotype-registry-*` for grade-reporting infrastructure
- Cooperative contracts across the monorepo

BytePort's role: surface a unified dashboard, API, and CLI for these. The user (Koosha) has many `pheno-*` projects; BytePort should be the **canonical control plane** for them.

---

## 8. The Roadmap (Master View)

| Quarter           | Focus                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Q3 2026** (now) | OmniRoute Rust data plane (4 weeks) → BytePort v1.0 gaps closed → Phase 2 multi-tenant → Phase 3 multi-engine first 4 of 7 engines |
| **Q4 2026**       | Phase 4-6 (logs, agents, templates) → Rust control plane migration begins                                                          |
| **Q1 2027**       | Cross-cloud adapter (Phase 8) → Federation (Phase 9) → Enterprise SSO → Marketplace launch                                         |
| **Q2 2027**       | Public SaaS offering (with self-host parity) → first 100 paying orgs                                                               |
| **Q3 2027+**      | Federation at scale → cross-cloud cost optimization → agent-native multi-org coordination                                          |

---

## 9. The Quality Bar

Every layer in this stack must be:

- **Production-grade**: 99.99% SLA target; graceful degradation; zero-downtime deploys
- **Observable**: OTLP traces everywhere; Prometheus metrics; structured logs; cost attribution
- **Secure by default**: Argon2id passwords; AES-256-GCM credentials; SSRF-safe HTTP; auth on every endpoint; rate limiting; audit log
- **Test-covered**: Unit + integration + e2e; coverage floor 60% across the stack
- **Documented**: SPEC.md is the source of truth; status-checks verify no doc claims missing source
- **Multi-tenant safe**: Org-scoping enforced at the data layer; tests verify tenant isolation
- **Polyglot by design**: Each component is implemented in the highest-leverage language per the §3 decision tree, integrated at the appropriate binding tier per [ADR-032](../../docs/adr/0032-polyglot-binding-tiers.md). Every polyglot seam is **benchmarked** (≥2× optimality threshold required for Zig/Mojo hot-paths; otherwise deprecate and fall back to Rust).

---

## 10. Quick Reference — Where To Find What

| I want to...                               | Look here                                                          |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Understand OmniRoute's rewrite plan        | `plans/2026-07-04-omniroute-fork-rewrite-v1.md`                    |
| Understand BytePort's evolution plan       | `plans/2026-07-04-byteport-evolution-v1.md`                        |
| Understand the high-level ecosystem vision | This document                                                      |
| Add a new provider to OmniRoute            | OmniRoute fork README + `src/shared/constants/providers.ts`        |
| Add a new deployment engine to BytePort    | BytePort evolution plan § Phase 3A                                 |
| Add a new MCP tool to OmniRoute            | `open-sse/mcp-server/tools/`                                       |
| Add a new MCP tool to BytePort             | `backend/internal/infrastructure/mcp/tools/` (after Phase 5)       |
| Add an OpenTelemetry export                | Already wired via `pheno-otel`                                     |
| Add a new top-level Phenotype project      | Update `phenotype-registry/index.ts`, then run `agileplus specify` |

---

## 11. Required Reads Before Any Sub-Agent Work

When a sub-agent is dispatched:

1. **Read this document first** to understand context.
2. **Read the relevant repo's CLAUDE.md and AGENTS.md.**
3. **Read the relevant repo's SPEC.md and PLAN.md.**
4. **Check the relevant section of the two evolution plans above.**
5. **Use Spec Kitty + AgilePlus** to track work.
6. **TDD by default**: failing test → minimal impl → passing test → commit.
7. **Never break the local main checkout** — use worktrees (see `OmniRoute/CLAUDE.md` hard rule #19).
8. **Run quality gates before merging** — every repo has its own (`.github/workflows/`).
9. **Update SPEC.md and CLAUDE.md when behavior changes** — both are living docs.

---

## 12. Defining Principles (Non-negotiable)

These are the tenets that survive any individual PR debate:

1. **No lock-in** — every byte of state is portable; users can extract their data in standard formats anytime.
2. **Self-hosted first** — every feature must work without a cloud-hosted BytePort instance.
3. **AI-aware** — every primitive composes with AI agents via MCP/A2A.
4. **Multi-engine** — never assume Docker-only or Kubernetes-only; manifest engine field is the source of truth.
5. **Cost-attributed** — every byte, every token, every compute-second has a billable identity.
6. **Observable by default** — traces, metrics, logs are first-class citizen outputs.
7. **Multi-tenant safe** — every query is org-scoped; RBAC enforced; tested.
8. **Open standards** — OpenAPI, OpenTelemetry, MCP, A2A — proprietary protocols only when absolutely necessary.
9. **Gradual migration** — Go backend stays in production until Rust achieves 100% feature parity.
10. **Fork-clean upstream** — every fork-only artifact is in dedicated paths; never rebase onto upstream without explicit operator sign-off.

---

_Last Updated: 2026-07-04 · Owner: Koosha · Next review: 2026-09-04 (Q3 OKRs)_
