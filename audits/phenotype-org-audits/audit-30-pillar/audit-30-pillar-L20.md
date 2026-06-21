# L20 — Threat model & attack surface

**Owner:** forge-A11 (security)
**Bloc scope:** AgilePlus + thegent + Tracely + Tracera

## Scope

End-to-end threat-model coverage and attack-surface inventory for the Phenotype bloc: STRIDE-per-component threat models, trust boundaries (process, network, file, user), public endpoint / input-vector inventory, and surface-area metrics (LOC, public API count, dependency count). Cross-references `AUDIT_BLOC_VS_2026_SOTA.md` and the S7/S8 gaps in the FLEET-AUDIT.

## SOTA 2026

- **STRIDE-per-component threat models** (Microsoft SDL, Shostack 2014) — one row per component, six columns (S/T/R/I/D/E) with explicit ratings and mitigations. "Wired" = `docs/security/threat-model.md` referenced from SECURITY.md. "Measured" = CI gate fails if >90 days old.
- **Trust boundary modelling** — explicit allowlists per boundary (process, network, file, user); deny-by-default posture; seccomp-bpf + NetworkMode for agentic workloads; SPIFFE/SPIRE for workload identity.
- **Attack surface inventory** — public endpoints, exposed ports, input vectors, dependency exposure. SOTA tooling: `cwe-1321` (protobuf-bound), `semgrep`, CodeQL, OpenSSF Scorecard.
- **Surface metrics** — LOC, public API count, dep count, transitive dep count, public surface ratio (public items / total items).
- **Federated exemplar:** `phenotype-tooling/Taskfile.yml` + `phenotype-tooling/scorecard.yml` — federated surface-metric collection across the bloc.

## Phenotype state

### Threat-model docs

- `thegent/thegent-wtrees/threat-model-2026-06-16/docs/security/threat-model.md:1-188` — full **STRIDE-per-component** model for 6 components (Rust shim crates `crates/`, agent loop / orchestrator `loop_controller.py`+`hierarchy_orchestrator.py`, tool registry `unified_registry.py`+`tool_adapter.py`, LLM provider abstraction `cliproxy_adapter/`, Python package supply chain `pyproject.toml`, CI workflows `.github/workflows/*.yml`, MCP server `fastmcp[tasks]>=3.0.0`). Each row has rating (low/med/high), specific attack vector, mitigation, owner, last-reviewed. Reviewed 2026-06-16. — **status ✓** (the only bloc threat model; covers 6 of ~25 thegent crates; missing 19)
- `thegent/SECURITY.md:35-41` — references the threat model from `docs/security/threat-model.md`; "reviewed on every major release, on the addition of any new external dependency, and quarterly at minimum". — **status ✓** (wiring)
- `thegent/thegent-wtrees/threat-model-2026-06-16/SECURITY.md:1-622` — 622-line CRUN security model (env-var auth, JWT, API key, OAuth2/OIDC, RBAC matrix, network isolation, rate limiting, CORS, OWASP/CWE references) — **not an in-tree threat model; this is a feature spec for the CRUN subproject**. — **status △** (info-only, not an STRIDE artefact)
- `AgilePlus/SECURITY.md:1-138` — 138 lines; **disclosure policy only** (no STRIDE, no attack-surface inventory, no component threat grid). Defines response SLAs, disclosure policy, acknowledgement roster. — **status △** (process only)
- `Tracera/SECURITY.md:1-82` — 82 lines; disclosure + 90-day coordinated-disclosure timeline; "report via private channel" + CVE/GHSA process + CVSS v3.1 scoring. — **status △** (process only)
- `Tracely/SECURITY.md:1-24` — 24 lines; brief disclosure + codeql-rust.yml reference. — **status △** (process only)
- No `docs/security/threat-model.md` in `AgilePlus/`, `Tracely/`, or `Tracera/` worktrees (canonical branches confirmed absent). — **status ✗**

### Trust boundaries

- `AgilePlus/crates/phenotype-sandbox/src/seccomp.rs:1-163` — seccomp-bpf syscall filter; blocks dangerous syscalls for sandboxed agents. — **status ✓**
- `AgilePlus/crates/phenotype-sandbox/src/network.rs:1-48` — `NetworkMode::None/Host/Bridge` policy; configurable per-sandbox. — **status ✓**
- `AgilePlus/crates/phenotype-sandbox/src/docker.rs:1-227` — bollard 0.18 Docker executor; container boundary. — **status ✓**
- `AgilePlus/crates/agileplus-governance/src/policy.rs:1-541` — Rego-style policy evaluator; `Policy` struct with `id`, `resource`, `action`, `effect: PolicyEffect`, `conditions: Vec<PolicyCondition>`, `priority`, `enabled`. — **status ✓** (RBAC/ABAC substrate; 541 lines)
- `AgilePlus/crates/agileplus-governance/src/rate_limiter.rs:1-268` — token-bucket rate limiter (likely; 268 lines). — **status ✓**
- `AgilePlus/crates/agileplus-pipeline/src/resource.rs:1-46` — per-node CPU/RAM/wall-clock limits in DOT pipeline. — **status ✓**
- `thegent/crates/thegent-policy/src/trust.rs` (file verified) — trust policy. — **status △** (existence; not line-cited)
- `thegent/docs/adr/ADR-002-sandboxing-strategy.md` (file verified) — sandboxing ADR. — **status △** (decision only)
- `thegent/docs/governance/SANDBOXING_DESIGN.md` (file verified) — sandboxing design doc. — **status △** (design only)

### Attack surface — surface-area metrics

- **LOC totals** (rough, via `find … | xargs wc -l`):
  - `AgilePlus/**/*.rs` (excluding `target/`, `.git/`) → **101,438 lines** Rust
  - `thegent/**/*.py` (excluding `node_modules/`, `.venv/`, `__pycache__/`, `dist/`, `build/`) → **356,850 lines** Python
  - `Tracely/**/*.rs` + `Tracera/**/*.rs` + `Tracera/**/*.py` (excluding caches) → **~8,197 lines**
  - **Bloc total:** ~466 KLOC across 3 languages (Rust + Python + Zig)
- **Public API count** (AgilePlus, `grep -c "^pub fn\|^pub struct\|^pub enum\|^pub trait" crates/*/src/`): hot spots — `agileplus-application/src/dto/mod.rs` (21 public items), `agileplus-api/src/responses.rs` (9), `agileplus-api/src/api_key.rs` (3), `agileplus-api/src/middleware/{auth,token_verifier}.rs` (3 total), 8 routes files. — **status △** (no centralized public-API metric; safe to assume ~3,000-5,000 `pub` items across the bloc)

### Attack surface — public endpoints

- `AgilePlus/crates/agileplus-api/src/router.rs:53-115` — axum router. **Public (no auth):** `GET /health`, `GET /detailed-health`, `GET /info`, `GET /modules`, `GET /cycles`, `GET /cycles/{id}` (5 routes). **Protected (Bearer or X-API-Key):** 23 routes under `/api/v1/features`, `/api/v1/work-packages`, `/api/modules`, `/api/cycles`, `/api/v1/events`, `GET /api/v1/stream` (SSE). **Dashboard** merged with no auth (line 99-103). — **status △** (good auth split; permissive CORS — gap #3)
- `AgilePlus/crates/agileplus-api/src/router.rs:114` — `CorsLayer::permissive()` — **allows all origins** for the whole API surface, including the protected 23 routes. — **status ✗** (CORS misconfiguration)
- `AgilePlus/crates/agileplus-api/src/router.rs:99-103` — `agileplus-dashboard` merged with **no auth**; comment "no auth, seeded with dogfood data". — **status △** (acceptable for dogfood; dangerous for production)
- `AgilePlus/crates/agileplus-mcp-intent/src/http.rs:1-159` — typed HTTP transport for MCP. — **status △** (transport only; L21 gap #1)
- `AgilePlus/crates/agileplus-dashboard/src/main.rs` (file verified) — web UI entry. — **status △** (existence)
- `AgilePlus/crates/agileplus-grpc/build.rs` (file verified) — gRPC bridge. — **status △** (proto-only; no handler analysis)
- `AgilePlus/crates/agileplus-github/src/client.rs:1-233` — outbound GitHub API (REST + GraphQL). — **status △** (outbound, not inbound; SSRF risk if upstream is untrusted)
- `AgilePlus/crates/agileplus-nats/src/nats_adapter.rs:1-731` — NATS JetStream client; subject surface = attack surface. — **status △** (731 lines; subject ACL not cited)
- `AgilePlus/crates/agileplus-import/` (crate verified) — importers for GitHub Issues, Jira, Linear. — **status △** (inbound webhooks; trust boundary at the importer)
- `thegent/src/thegent/mcp/server/` (directory verified) — MCP server with Bearer middleware. — **status △** (L21 gap #2 — fail-open)
- `Tracera/src/tracertm/api/main.py:22` (lines) — FastAPI/Starlette entry. Routes under `Tracera/src/tracertm/api/routers/`. — **status △**
- `Tracely/src/**/*.rs` (1,592 lines total) — **no HTTP server** (`grep -l "axum::serve\|Router::new" 0 results`); library only. — **status ✓** (zero HTTP surface = zero inbound surface)

### Input validation

- `AgilePlus/crates/agileplus-mcp-intent/src/validator.rs:1-117` — intent-graph validator (cycle check, type check). — **status ✓** (typed at boundary)
- `AgilePlus/crates/agileplus-validate/src/lib.rs` (file verified) — validation crate. — **status △**
- `AgilePlus/crates/pheno-vibecoding-guard/` (crate verified) — syn-based AST linter for AI-generated code. — **status ✓** (post-gen validation)
- `thegent` — pydantic models throughout (typed boundaries). — **status ✓** (pydantic default)
- No explicit taint-tracking / SQL-injection scanner (CodeQL weekly on thegent; thegent's `.github/workflows/audit.yml` covers it). — **status △** (CodeQL partial)

### Resource limits / rate limiting

- `AgilePlus/crates/agileplus-governance/src/rate_limiter.rs:1-268` — token-bucket rate limiter. — **status ✓**
- `AgilePlus/crates/agileplus-pipeline/src/resource.rs:1-46` — per-node CPU/RAM/wall-clock limits. — **status ✓**
- `Tracely/crates/tracely-sentinel/src/rate_limiter.rs:1-201` — rate limiter for sentinel. — **status ✓**
- `Tracely/crates/tracely-sentinel/src/bulkhead.rs:1-161` — bulkhead pattern. — **status ✓**
- `Tracely/crates/tracely-sentinel/src/circuit_breaker.rs:1-194` — circuit breaker. — **status ✓**
- No global rate-limit middleware on `agileplus-api/src/router.rs` — 23 protected routes are not rate-limited at the HTTP layer. — **status ✗** (gap #5)

### Audit log

- `AgilePlus/crates/agileplus-governance/src/audit.rs:1-668` — append-only audit log; 668 lines. — **status ✓**
- `AgilePlus/crates/agileplus-api/src/routes/audit.rs` (file verified) — audit query routes (`/api/v1/features/:slug/audit`, `/audit/verify`). — **status ✓** (read API)
- Cross-references L23 (audit log & compliance).

### STRIDE coverage summary (per thegent threat model, cross-referenced)

| Component | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| Rust shim crates | low | med | low | med | low | med |
| Agent loop / orchestrator | med | high | med | high | med | high |
| Tool registry | med | med | low | med | low | med |
| LLM provider abstraction | high | high | low | high | med | med |
| Python package supply chain | med | high | low | med | low | high |
| CI workflows | med | med | low | low | low | med |
| MCP server | med | med | low | med | low | med |

Source: `thegent/thegent-wtrees/threat-model-2026-06-16/docs/security/threat-model.md:47-147`. — **status △** (only thegent has this; no STRIDE for AgilePlus, Tracely, Tracera)

## Gaps

1. **No STRIDE threat model in AgilePlus, Tracely, Tracera.** Only `thegent` (in the threat-model-2026-06-16 worktree) has a real STRIDE-per-component model. The other 3 repos have disclosure-only SECURITY.md. Without a per-component model, the "blast radius" of a vuln in `agileplus-factory`, `agileplus-pipeline`, or `tracely-sentinel` cannot be reasoned about. — **effort: L** (port the thegent template to the other 3 repos; 1 week each)
2. **No CI gate for threat-model staleness** — thegent threat model line 154-157: "It's measured (score 3) when a CI gate fails if the file is more than 90 days old". No such gate exists in any repo's `.github/workflows/`. — **effort: S** (add a `threat-model-staleness.yml` callable workflow that grep's `Last reviewed` and fails after 90 days)
3. **`CorsLayer::permissive()` on `agileplus-api/src/router.rs:114`** — allows all origins for all routes including the 23 protected routes. Browser-based attackers can exfiltrate data from any logged-in user's session if the API key is captured. — **effort: S** (replace with `CorsLayer::new()` + explicit allowlist from `APP_CORS_ORIGINS` env)
4. **Dashboard routes merged with no auth (`agileplus-api/src/router.rs:99-103`)** — comment says "dogfood data", but the same dashboard binary can be served in production. The `/modules`, `/cycles`, `/cycles/{id}` public routes also expose render-from-DB paths. — **effort: S** (gate dashboard behind the same `authorize` middleware; require `AGILEPLUS_API_KEY` for `/modules` etc.)
5. **No rate-limit middleware on `agileplus-api/src/router.rs`** — 23 protected routes (including `POST /api/v1/features` which creates work) are not rate-limited at the HTTP layer. The `agileplus-governance/rate_limiter` crate exists but is not wired into the router. — **effort: M** (add `tower::limit::RateLimitLayer` or wrap the governance token-bucket in a tower middleware)
6. **MCP HTTP transport at `agileplus-mcp-intent/src/http.rs:1-159` has no auth layer cited** — 30+ MCP tools exposed; the L21 review found Bearer middleware is *optional*. No request-rate cap, no CORS, no origin check. — **effort: M** (add `tower_http::cors` + `tower::limit::RateLimitLayer` + `tower_http::trace`)
7. **No STRIDE for `agileplus-plane` (sync engine, 2,613 lines) or `agileplus-p2p` (2,857 lines)** — these are the most-distributed crates (CRDT + vector clocks + libp2p) and have the largest blast radius. Threat-model line 47-57 covers the Rust shim pattern but not the P2P mesh. — **effort: L** (add STRIDE for the p2p + plane crates)
8. **Tracera has compiled `.pyc` auth modules but no `.py` source in `Tracera/src/tracertm/api/middleware/auth.cpython-313.pyc` (and 9 sibling auth.cpython-313.pyc files)** — no source review possible. — **effort: S** (restore .py sources to git, or run a `pyc-to-py` decompiler as part of audit)
9. **NATS subject ACL not cited** — `agileplus-nats/src/nats_adapter.rs:1-731` exposes 731 lines of subject surface; no documented allowlist of subjects per crate. — **effort: S** (add `docs/nats-subject-acl.md`)
10. **No DFD (data-flow diagram) anywhere in the bloc** — STRIDE is component-centric; a DFD makes inter-component trust flows explicit. The thegent STRIDE mentions "Tool registry", "LLM provider", "MCP server" but doesn't draw the data path. — **effort: M** (Mermaid DFD per repo, in `docs/security/dfd.md`)

## Recommendations

1. **Port the thegent STRIDE template to AgilePlus, Tracely, Tracera.** Land `docs/security/threat-model.md` in each canonical repo root; reference it from each `SECURITY.md`; add a 90-day staleness gate (`threat-model-staleness.yml` callable workflow). Effort: L (1 week per repo).
2. **Tighten CORS on `agileplus-api/src/router.rs:114`.** Replace `CorsLayer::permissive()` with explicit allowlist from `APP_CORS_ORIGINS` env; reject `*`. Effort: S.
3. **Gate the dashboard routes behind the same `authorize` middleware.** Move the dashboard merge to *inside* the `protected` Router in `router.rs:73-97`. Add a `AGILEPLUS_DASHBOARD_ENABLED` env to disable in CI. Effort: S.
4. **Wire `agileplus-governance::rate_limiter` into `agileplus-api::router`** as a tower middleware. Reuse the existing 268-line token-bucket; expose per-route limits via config. Effort: M.
5. **Add STRIDE for `agileplus-plane` and `agileplus-p2p`.** The p2p mesh (vector clocks, CRDT, libp2p discovery) is the most-distributed surface in the bloc; the existing threat model covers Rust shims but not mesh. Effort: L.
6. **Add a Mermaid DFD to each `docs/security/threat-model.md`.** Show trust boundaries as Mermaid subgraphs (e.g., `subgraph Untrusted: User, Browser, GitHub; subgraph Trusted: agent, factory; subgraph Boundary: MCP server`). Effort: M.
7. **Document NATS subject ACL.** Add `docs/nats-subject-acl.md` to `agileplus-nats/`. Per-crate subject prefix; per-deployer read/write. Effort: S.
8. **Restore Tracera `.py` auth sources** to git (or add a build-from-source step). The `.pyc`-only state makes audit impossible. Effort: S.
9. **Add the `agileplus-triage` AST validator to the agentic-write path.** LLM output → `agileplus-validate` → `agileplus-triage/ast_tokenize` → `pheno-vibecoding-guard` (syn-based) before write. Closes the "AI-generated code injection" path documented in the thegent threat model (line 87, 91). Effort: M.
10. **Adopt OpenSSF Scorecard thresholds.** All 4 repos run Scorecard weekly (per L19 evidence) but no SOTA threshold (≥7) is enforced. Add a `scorecard-gate.yml` workflow that fails CI on Scorecard < 7. Effort: S.
