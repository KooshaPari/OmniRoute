# Venture Autonomy Platform — Architecture Decision Records (ADR Index)

This file is the master index of all architecture decisions made for the Venture platform. Each decision is documented with context, alternatives considered, and rationale.

---

## ADR-001: Workspace Structure and Agent Isolation

**Status:** ACCEPTED
**Date:** 2025-02-15
**Deciders:** Technical Team, Founder Governor

### Context

The system needs to isolate multiple concurrent agents and workflows without interference. Different agents have different privilege levels (orchestrators can dispatch workflows, researchers can only call specific tools).

### Decision

Adopt a workspace-based isolation model where:
- Each agent session is scoped to a workspace (identified by `workspace_id`)
- Agents operate under a specific role (orchestrator, researcher, solver)
- Tool access is enforced via role-based access control (RBAC)
- Each workspace has isolated ledger, vault, and policy state
- Multi-workspace support is planned for future (v2), but MVP uses single workspace

### Alternatives Considered

1. **Process-level isolation**: Use separate OS processes per agent
   - Pro: Strong OS-level isolation, native resource limits
   - Con: High overhead, complex IPC, harder debugging
   - Rejected: overkill for MVP; workspace isolation is sufficient

2. **Shared namespace with RBAC**: All agents in shared namespace, access controlled via policy
   - Pro: Simple shared state, easier cross-agent coordination
   - Con: Risk of privilege escalation, harder to audit
   - Rejected: less secure than workspace isolation

3. **No isolation**: Agents can access any tool, any data
   - Pro: Simplest implementation
   - Con: Unacceptable security and governance risk
   - Rejected: violates Venture's core security model

### Rationale

Workspace isolation provides:
- **Security**: Agents can't escape their sandbox via namespace tricks
- **Auditability**: Every action is scoped to a workspace and role
- **Scalability**: Workspaces can be deployed independently
- **Compliance**: Easier to demonstrate control separation for auditors

### Implications

- Each agent task envelope must include `workspace_id` and `agent_role`
- Policy engine checks role-based access on every tool call
- Ledger entries are scoped to workspace
- Audit trail includes workspace context for all events

### Links

- See `TECHNICAL_SPEC.md` for control plane architecture
- See `TRACK_C_CONTROL_PLANE.md` for identity and isolation details
- See `docs/reference/WORK_STREAM.md` for implementation status

---

## ADR-002: Headless Artifact Compiler and Spec-Driven Generation

**Status:** ACCEPTED
**Date:** 2025-02-15
**Deciders:** Technical Team, Founder Governor

### Context

Ventures need to generate diverse artifacts (slides, documents, timelines, videos, dashboards) without human interaction. Each artifact type has different generation semantics and quality requirements.

### Decision

Adopt a spec-driven artifact compiler where:
- Each artifact type has an Intermediate Representation (IR) spec: `SlideSpec`, `DocSpec`, `TimelineSpec`, `AudioSpec`, `BoardSpec`
- Specs are defined as structured data (JSON/Pydantic)
- Specs are validated before rendering (type-safe, schema-enforced)
- Rendering is independent of spec (can have multiple renderers per spec)
- Provenance is attached to all artifacts (spec version, policy version, inputs, outputs)

### Alternatives Considered

1. **Template-based generation**: Use Jinja/Handlebars templates for all artifact types
   - Pro: flexible, familiar to developers
   - Con: hard to validate, prone to injection attacks, difficult to audit
   - Rejected: insufficient safety/auditability for mission-critical use

2. **Direct LLM generation**: Let LLM generate artifacts freeform (no spec)
   - Pro: maximum flexibility, fewer constraints on output
   - Con: non-deterministic, hard to validate, audit trail is opaque
   - Rejected: too risky for compliance use cases

3. **Manual templates per venture**: Founders write custom templates
   - Pro: maximum customization per venture
   - Con: scales poorly, hard to maintain consistency across ventures
   - Rejected: too much friction for founders

### Rationale

Spec-driven generation provides:
- **Safety**: Specs are validated before rendering; injection attacks are blocked at validation time
- **Auditability**: Spec version and inputs are captured; outputs are deterministic
- **Quality**: Specs enforce structure (e.g., slide deck must have intro, body, conclusion)
- **Extensibility**: New artifact types can be added by defining new specs and renderers
- **Multi-venue**: Same spec can be rendered to multiple formats (HTML, PDF, Markdown)

### Implications

- New artifact types require: spec definition + at least one renderer
- Founders can't customize per-artifact; must work within spec constraints
- Renderers are decoupled from specs (easy to add new renderers)
- All artifacts include spec version in metadata (for reproducibility)

### Links

- See `TECHNICAL_SPEC.md` for artifact compiler architecture
- See `docs/reference/ARTIFACT_COMPILER_SPEC.md` for IR spec definitions
- See `TRACK_C_CONTROL_PLANE.md` for spec validation integration

---

## ADR-003: Joule Treasury Integration and Payment Processing

**Status:** ACCEPTED
**Date:** 2025-02-15
**Deciders:** Technical Team, Finance Controller

### Context

Venture needs to process payments (accepting customer payments, paying for third-party APIs, managing reserves). This requires integration with payment processors and treasury management systems.

### Decision

Adopt Joule as the treasury integration layer:
- Joule handles: payment authorization, settlement, reconciliation, ledger
- Venture calls Joule API for all spend operations (default-deny enforcement point)
- Joule maintains the source-of-truth ledger (double-entry accounting)
- Venture maintains audit log (event sourcing) for governance/compliance
- Daily reconciliation: Venture ledger ↔ Joule ledger ↔ bank statements

### Alternatives Considered

1. **Build custom treasury system**: Implement ledger, settlement, reconciliation in Venture
   - Pro: complete control, no external dependency
   - Con: high complexity (double-entry accounting, reconciliation, PCI compliance)
   - Rejected: financial system is safety-critical; use battle-tested solution

2. **Use Stripe only**: Rely on Stripe's Reporting API for ledger
   - Pro: simpler integration, Stripe is well-known
   - Con: Stripe's ledger is not customizable; hard to implement Venture's policy-based controls
   - Rejected: insufficient control for default-deny authorization

3. **Use blockchain/smart contracts**: Self-executing financial rules on-chain
   - Pro: no trusted party, fully transparent
   - Con: slow, expensive, immature tooling, regulatory uncertainty
   - Rejected: wrong tool for centralized system; adds complexity without benefit

### Rationale

Joule provides:
- **Safety**: Joule is a battle-tested financial system (used by institutions)
- **Control**: Venture can enforce authorization rules before calling Joule
- **Compliance**: Joule maintains audit trail (required for financial audits)
- **Integration**: Joule has connectors to banks, payment processors, tax software

### Implications

- Venture is dependent on Joule uptime (critical dependency)
- Every spend decision goes through Joule; latency is important
- Joule ledger is source-of-truth; Venture audit log is supplementary
- Reconciliation failures are escalated immediately (top priority)

### Links

- See `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` for ledger/reconciliation model
- See `docs/context/JOULE_INTEGRATION.md` for API details and error handling
- See `TECHNICAL_SPEC.md` for Money API architecture

---

## ADR-004: Python 3.14+ with FastAPI + Pydantic v2 as Service Runtime

**Status:** ACCEPTED
**Date:** 2026-03-01

### Context

All microservices (control-plane-api, policy-engine, treasury-api, artifact-compiler, compliance-engine, venture-orchestrator, agent-runtime) need a common language runtime and API framework. The decision drives every service's dependency tree, type safety approach, and developer experience.

### Decision

Use Python 3.14+ with FastAPI 0.115+, pydantic v2, and uvicorn[standard] as the uniform service runtime. All services share this stack. Dependency management uses `uv` (not pip or poetry).

Key library choices from pyproject.toml:
- HTTP: httpx for outbound, FastAPI for inbound
- Database: SQLAlchemy (async) + asyncpg + alembic
- Auth: python-jose + passlib[bcrypt]
- Logging: structlog + OpenTelemetry
- Config: pydantic-settings
- Event sourcing: eventsourcing library

### Alternatives Considered

1. **Go microservices**: Statically compiled, excellent concurrency, lower memory footprint
   - Pro: ideal for high-throughput services (policy-engine, orchestrator)
   - Con: splits developer experience across two languages; slower iteration for agent-heavy workloads
   - Rejected for MVP: Python ecosystem dominates AI/ML tooling; single-language repo is lower overhead

2. **Node.js/TypeScript**: Large ecosystem, excellent async support
   - Pro: TypeScript provides type safety; huge community
   - Con: Python is the natural language for AI agent tooling and data processing
   - Rejected: Python alignment with AI/agent ecosystem is more important than Node.js tooling

3. **Mixed language services**: Go for performance-critical, Python for AI/agent services
   - Deferred to v2: once bottlenecks are identified via profiling, specific services may be re-implemented in Go

### Rationale

- Python's AI/agent ecosystem (openai, anthropic, langchain, etc.) is unmatched
- FastAPI + pydantic v2 gives near-Go-level request validation performance with Python ergonomics
- async/await throughout enables high-concurrency I/O (NATS, PostgreSQL, Redis) without threads
- Single language simplifies onboarding, shared libraries, and CI configuration

### Implications

- All services must use `async def` for all I/O handlers; synchronous blocking code is banned in hot paths
- pydantic v2 models are the canonical data schema shared across services via the `schema-registry` concept
- Python 3.14+ required; earlier versions not supported (no compatibility shims)

---

## ADR-005: process-compose for Local Development and Single-Node Deployment

**Status:** ACCEPTED
**Date:** 2026-03-01

### Context

The platform runs 10+ services (6 Python microservices + postgres + nats + redis + optional monitoring). Developer experience for local setup and single-node production deployment needs to be fast, transparent, and observable without requiring Kubernetes or Docker Compose complexity.

### Decision

Use process-compose (Go binary, no container runtime required) as the process orchestrator for both local development and single-node deployment. The canonical configuration lives in `process-compose.yaml` at the repo root. Services run as native processes (no containers in development), except postgres/nats/redis which may run as Docker containers for convenience.

Service startup order is enforced via `depends_on` with `condition: service_healthy`. Health checks use HTTP `/health` endpoints on each service port.

### Alternatives Considered

1. **Docker Compose**: Industry standard for multi-service local dev
   - Pro: familiar, excellent tooling ecosystem, works for CI
   - Con: requires Docker daemon, slower startup, harder to inspect individual process logs in TUI
   - Deferred: Docker Compose retained for CI and production image builds

2. **Kubernetes (k3d/kind)**: Production-identical local dev
   - Pro: exact production parity
   - Con: extreme complexity for 10-service MVP; overkill until service mesh and autoscaling are required
   - Rejected for MVP

3. **Makefile with manual process management**: Each service started in separate terminal
   - Pro: maximum transparency
   - Con: no dependency ordering, no health checking, no unified log view
   - Rejected: too fragile for multi-agent concurrent development

### Rationale

- process-compose provides dependency ordering + health checks + unified TUI log viewer in a single lightweight binary
- Native process model means service code changes are picked up by hot-reload (uvicorn --reload) without container rebuilds
- Port assignments (8000-8005 for Python services, 4222/5432/6379 for infra) are fixed and documented; no port collision risk

### Implications

- `process-compose up` is the canonical dev command; individual services can be restarted with `process-compose process restart <name>`
- Log files land in `.process-compose/logs/<service>.log`; lifecycle markers are injected at start/stop
- Health check timeout and retry config in process-compose.yaml must be tuned when new infrastructure services are added

---

## ADR-004: Labor Commodification Model and Work-Hour Pricing

**Status:** ACCEPTED
**Date:** 2025-02-15
**Deciders:** Founder Governor, Finance Controller

### Context

Venture's fundamental value proposition is monetizing agent work capacity. The system needs a clear model for:
- How much does one agent-hour cost?
- How much can we charge customers per output unit?
- How do we calculate venture margin?

### Decision

Adopt work-hour commodification model:
- **Unit of analysis**: one agent-hour of work (quantified by compute time, API calls, storage)
- **Cost model**: cost per work-hour varies by agent type
  - Orchestrator: expensive (complex reasoning) → $50/hour
  - Researcher: moderate (web search, data aggregation) → $20/hour
  - Solver: moderate (data processing, artifact compilation) → $20/hour
- **Revenue model**: charge customers per output unit (report, code, article), not per work-hour
- **Margin calculation**: (customer price - cost of work-hours to produce) / customer price
- **Ventures track**: work-hours consumed, cost per hour, revenue per output, margin %

### Alternatives Considered

1. **Pure API cost model**: Only count external API costs, treat agent compute as free
   - Pro: conservative, easy to audit
   - Con: misses true cost of computation; system appears more profitable than it is
   - Rejected: dishonest; would lead to bad resource allocation decisions

2. **Cloud cost allocation**: Use AWS/GCP pricing for compute resources
   - Pro: objective, based on market rates
   - Con: volatile, dependent on cloud provider, hard to benchmark
   - Rejected: better to use internal cost model, avoid cloud vendor lock-in

3. **No explicit cost model**: Founders set prices based on intuition
   - Pro: simplest
   - Con: no visibility into actual margin, pricing is inconsistent across ventures
   - Rejected: founders need data to make rebalancing decisions

### Rationale

Work-hour commodification provides:
- **Transparency**: founders see exactly what each agent-type costs
- **Scalability**: as agent pool grows, cost per venture can be recalculated
- **Auditability**: every work-hour is traced to an agent and task
- **Portfolio optimization**: margin calculation is consistent across ventures

### Implications

- Every agent action must be instrumented to track work-hours
- Cost per agent-type must be calibrated and updated periodically
- Portfolio rebalancing decisions use work-hour metrics as inputs
- Ventures can become unprofitable if customer prices don't cover work-hours

### Links

- See `PRODUCT_MODEL.md` for detailed labor commodification mechanics
- See `USER_SPEC.md` for how founders view cost/margin metrics
- See docs/research/LABOR_COMMODIFICATION_ANALYSIS.md (to be created)

---

## ADR-005: Default-Deny Treasury Authorization and Policy-Driven Spend

**Status:** ACCEPTED
**Date:** 2025-02-15
**Deciders:** Technical Team, Finance Controller

### Context

Spending is the highest-risk action: mistakes or attacks can drain reserves. The system needs strong authorization controls to prevent unauthorized spend.

### Decision

Adopt default-deny authorization model:
- **Default rule**: all spend is blocked unless explicitly authorized by policy
- **Authorization point**: every spend attempt checks policy before execution
- **Policy as code**: authorization rules are written in policy YAML, versioned, and immutable
- **Escalation on denial**: if spend is blocked, system creates incident and notifies Founder/Finance
- **No silent fallback**: if authorization fails, task fails loudly (no partial execution)

### Alternatives Considered

1. **Default-allow with limits**: Allow all spend up to caps, then block
   - Pro: fewer false-positives, smoother UX
   - Con: risk of policy drift; caps can be misconfigured
   - Rejected: caps are too permissive; policy should be explicit

2. **Role-based spend**: Different roles have different approval thresholds
   - Pro: familiar RBAC model
   - Con: doesn't capture full authorization logic (e.g., spend depends on customer type)
   - Rejected: too simplistic for complex ventures

3. **ML-based anomaly detection**: Learn normal spend patterns, flag anomalies
   - Pro: flexible, adapts to actual patterns
   - Con: non-deterministic, hard to audit, can have false negatives
   - Rejected: not suitable for safety-critical decisions

### Rationale

Default-deny provides:
- **Safety**: overspend is impossible by design
- **Predictability**: founders know exactly what will be approved (policy is code)
- **Auditability**: all authorization decisions are logged with reason codes
- **Governance**: founders retain strategic control (no silent policy drift)

### Implications

- Every spend decision must have a corresponding policy rule
- Policy violations result in task failure (not partial execution)
- Founders must be comfortable with occasional false-negatives (conservative rules)
- Emergency override capability is essential (for handling unforeseen situations)

### Links

- See `TECHNICAL_SPEC.md` for Money API authorization architecture
- See `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` for ledger/authorization model
- See USER_SPEC.md Flow 4 (crisis handling) for emergency procedures

---

## ADR-006: Process-Compose as Orchestration Layer (Not Kubernetes)

**Status:** ACCEPTED
**Date:** 2025-02-15
**Deciders:** Technical Team, Founder Governor

### Context

Venture needs to orchestrate multiple services (agents, API servers, data stores, event bus) locally during development and MVP. Kubernetes is a popular choice, but is it right for Venture?

### Decision

Use process-compose for MVP orchestration:
- Process-compose runs services locally (Docker containers or native processes)
- Scales horizontally within a single machine (all services run on same box)
- Supports dependency ordering (agent waits for API server to be ready)
- Provides logs, health checks, and restart policies
- Suitable for MVP (single-machine deployment)
- Can migrate to Kubernetes later if multi-region/multi-tenant is needed

### Alternatives Considered

1. **Kubernetes from day 1**: Deploy to k8s cluster immediately
   - Pro: cloud-native, scales to any size, industry standard
   - Con: huge complexity overhead, requires k8s expertise, slows down iteration
   - Rejected: overkill for MVP; adds 10x complexity without benefit

2. **Docker Compose**: Simple YAML orchestration
   - Pro: very simple, widely known
   - Con: limited health checks, no orchestration beyond startup
   - Rejected: lacks features needed for agent lifecycle management

3. **Bare metal scripts**: Shell scripts to start/stop services
   - Pro: no dependencies, complete control
   - Con: fragile, error-prone, no standard tooling
   - Rejected: not professional, hard to maintain

### Rationale

Process-compose provides:
- **Simplicity**: Easy to understand, fast iteration
- **Portability**: works on local machine, dev VM, or small server
- **Scalability path**: if needed, can migrate to k8s later
- **Cost**: free and lightweight (vs k8s cluster cost)

### Implications

- MVP runs on single machine (no multi-region support)
- Scaling to multiple machines requires migration to k8s (future work)
- Agent pool size limited by single-machine resources
- All data stores are local (no managed databases yet)

### Links

- See `TECHNICAL_SPEC.md` for orchestration architecture
- See `docs/guides/LOCAL_DEPLOYMENT_GUIDE.md` for process-compose setup
- See `docs/plans/KUBERNETES_MIGRATION_PLAN.md` (for v1+ transition)

---

## ADR-007: Event Sourcing for All State and Audit Trail

**Status:** ACCEPTED
**Date:** 2025-02-15
**Deciders:** Technical Team, Operations Auditor

### Context

Venture needs complete, immutable audit trails for compliance. Every decision and action must be reproducible and verifiable. Should we use a database with transaction logs, or event sourcing?

### Decision

Adopt event sourcing as the core state model:
- **Event bus**: all state changes are recorded as immutable events
- **Event schema**: every event has Event Envelope (trace_id, workflow_id, policy_version, timestamp)
- **Ledger as events**: financial transactions are stored as events, not rows
- **Replay**: system state can be reconstructed by replaying events from t0 to tN
- **Audit trail**: event log is the source-of-truth; no separate audit table

### Alternatives Considered

1. **CRUD database + audit table**: Standard SQL database with change-tracking
   - Pro: familiar pattern, ORM support, easy queries
   - Con: audit table can drift from primary data, hard to enforce immutability
   - Rejected: audit is bolted-on; not inherent to the system

2. **Blockchain ledger**: Immutable distributed ledger for all state
   - Pro: cryptographic immutability, consensus guarantees
   - Con: slow, expensive, regulatory uncertainty, overkill for single-org system
   - Rejected: wrong tool; centralized event log is sufficient

3. **Append-only log + snapshot DB**: Log for audit, database for queries
   - Pro: immutable audit trail, fast queries
   - Con: dual state increases complexity, potential for desync
   - Rejected: simpler to make event log queryable

### Rationale

Event sourcing provides:
- **Immutability**: events can't be modified after creation (only new events can be appended)
- **Replayability**: system state can be reconstructed from events (perfect for forensics)
- **Auditability**: event log is inherently complete (no gaps)
- **Temporal queries**: can ask "what was the state at time T?" and replay to find out

### Implications

- All state updates must be modeled as events
- Queries require event aggregation (not simple SQL SELECT)
- Storage grows indefinitely (no data deletion, only archival)
- Event schema is immutable (schema evolution requires careful versioning)

### Links

- See `TECHNICAL_SPEC.md` for event sourcing architecture
- See `TRACK_C_CONTROL_PLANE.md` for event bus and FSM design
- See `docs/reference/EVENT_SCHEMA.md` for detailed event types

---

## ADR-008: Copilot CLI as L3 Agent Runtime (Not Custom Framework)

**Status:** ACCEPTED
**Date:** 2025-02-15
**Deciders:** Technical Team, Founder Governor

### Context

Venture needs to execute agent tasks autonomously. Should we build a custom agent framework from scratch, or use an existing runtime?

### Decision

Use Copilot CLI as the agent runtime:
- Copilot provides: LLM inference, tool calling, multi-turn reasoning, memory
- Venture defines: tool allowlists, policy constraints, task envelope schema
- Copilot executes: `copilot -p "task_prompt" --yolo --model gpt-5-mini &`
- Integration: Venture API sends task prompt → Copilot executes → Venture logs results
- Scaling: spawn multiple Copilot processes for parallel work

### Alternatives Considered

1. **Build custom agent framework**: Implement our own LLM chain, tool calling, reasoning
   - Pro: complete control, no external dependency
   - Con: huge effort (6+ months), error-prone, hard to maintain
   - Rejected: reinventing the wheel; focus on Venture's unique value (treasury, policy)

2. **Use LangChain / LlamaIndex**: Existing agent libraries
   - Pro: mature, flexible, active community
   - Con: still requires significant integration work, abstractions may be leaky
   - Rejected: Copilot is more battle-tested for autonomous tasks

3. **Use Anthropic Claude API directly**: Raw LLM API calls
   - Pro: simplest, no abstraction overhead
   - Con: have to build tool calling, reasoning loop ourselves
   - Rejected: too much work, less reliable than Copilot

### Rationale

Using Copilot provides:
- **Proven**: battle-tested agent framework used by thousands
- **Focus**: Venture can focus on treasury/policy, not agent mechanics
- **Speed**: faster iteration (use existing tool calling, memory systems)
- **Quality**: Copilot's reasoning is better-tuned than our custom implementation would be

### Implications

- Venture is dependent on Copilot availability and performance
- Agent behavior is constrained by what Copilot supports
- Tool definitions must match Copilot's tool schema
- Agents run as separate processes (decoupled from Venture API)

### Links

- See `TECHNICAL_SPEC.md` for agent runtime architecture
- See `docs/context/COPILOT_INTEGRATION.md` for API details
- See docs/guides/AGENT_CONFIGURATION.md (to be created)

---

## Summary Table

| ADR | Title | Status | Impact | Links |
|-----|-------|--------|--------|-------|
| ADR-001 | Workspace Structure | ACCEPTED | Security, isolation | TECHNICAL_SPEC, TRACK_C |
| ADR-002 | Artifact Compiler | ACCEPTED | Quality, auditability | TECHNICAL_SPEC, artifact specs |
| ADR-003 | Joule Integration | ACCEPTED | Treasury, compliance | TRACK_B, Money API |
| ADR-004 | Labor Commodification | ACCEPTED | Pricing, portfolio optimization | PRODUCT_MODEL, USER_SPEC |
| ADR-005 | Default-Deny Authorization | ACCEPTED | Safety, governance | TECHNICAL_SPEC, TRACK_B |
| ADR-006 | Process-Compose Orchestration | ACCEPTED | Simplicity, MVP focus | TECHNICAL_SPEC, deployment |
| ADR-007 | Event Sourcing | ACCEPTED | Auditability, replayability | TECHNICAL_SPEC, TRACK_C |
| ADR-008 | Copilot Agent Runtime | ACCEPTED | Agent execution, speed | TECHNICAL_SPEC, agent docs |

---

## How to Use This Index

- **For decision-makers**: Read the context and rationale to understand why each choice was made
- **For implementers**: Follow the links to technical specs and implementation guides
- **For auditors**: Review the alternatives and implications to assess risk
- **For future decisions**: Use the template (Status, Date, Deciders, Context, Decision, Alternatives, Rationale, Implications, Links) for new ADRs

---

## Decision Template

```
## ADR-NNN: [Title]

**Status:** ACCEPTED / PENDING / REJECTED
**Date:** YYYY-MM-DD
**Deciders:** [Names]

### Context
[Why is this decision needed? What problem does it solve?]

### Decision
[What did we decide to do? Be specific.]

### Alternatives Considered
[What other options did we evaluate? Why did we reject them?]

### Rationale
[Why is this decision the right one? What are the benefits?]

### Implications
[What are the consequences? What does this enable or constrain?]

### Links
[Where can implementers find more details?]
```

---

## Next Steps

1. **ADR-009** (planned): Multi-founder governance and voting
2. **ADR-010** (planned): Multi-currency and international payments
3. **ADR-011** (planned): Agent federation and decentralized execution (v2)

For new decisions, follow the template above and add to this index.
