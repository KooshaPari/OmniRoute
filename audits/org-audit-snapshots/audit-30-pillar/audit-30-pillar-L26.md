# L26 — Resilience (retries / backoff / circuit / bulkhead / timeouts / health / chaos)

## Scope
Catalogue every resilience primitive in the Phenotype bloc (AgilePlus + thegent + Tracely + Tracera). Sub-pillars: retry/backoff/jitter, circuit breakers, bulkheads/partition guards, timeouts (connect/read/total), health checks (liveness/readiness/startup), chaos engineering.

## SOTA 2026
- **Resilience4j** (Java) — `circuitbreaker`, `ratelimiter`, `bulkhead`, `retry`, `timelimiter` modules; sliding-window failure-rate metrics
- **Polly v8** (Microsoft) — `ResiliencePipeline` with composed strategies (retry→circuit→timeout)
- **Polaris / Solo.io** — service-mesh resilience policies (Retry/Timeout/CB as xDS)
- **C4 model (Brunel) + SRE workbook (Beyer et al.)** — health-probe triad (liveness/readiness/startup)
- **Chaos Engineering (Netflix Chaos Monkey, Gremlin, Chaos Toolkit, Litmus)** — fault-injection in pre-prod
- **Burn-rate alerting (Google SRE workbook, 2017; Jones et al. 2019)** — multi-window multi-burn-rate (MWMB)
- **Tower (Rust) / Polly (C#) / resilience4j (Java)** — composable middleware stacks

## Phenotype state

### ✅ Tracely (SOTA-grade resilience library — best in bloc)
- `Tracely/crates/tracely-sentinel/src/circuit_breaker.rs:1-194` — **full Nygard-style circuit breaker**: `CircuitState {Closed, Open, HalfOpen}` (lines 18-26), `failure_threshold` + `recovery_timeout` configuration (lines 33-54), `record_success`/`record_failure`/`is_allowed`/`execute` (lines 75-160), plus unit tests at lines 163-193. **Status: ✓ — feature-equivalent to Resilience4j's circuit breaker module**
- `Tracely/crates/tracely-sentinel/src/bulkhead.rs:1-161` — **partition-based bulkhead isolation**: `Bulkhead::new(num_partitions, capacity_per_partition)` (lines 26-38), `try_acquire(partition)` returns `PartitionGuard` with `Drop`-release (lines 41-122), separate `PartitionExhausted`/`TotalExhausted` errors (lines 99-105). **Status: ✓ — semantically equivalent to Resilience4j SemaphoreBulkhead**
- `Tracely/crates/tracely-sentinel/src/rate_limiter.rs:1-201` — **token bucket + leaky bucket** rate limiters with `try_acquire() -> bool` interface (lines 38-138), `From<std::io::Error>` and `From<AddrParseError>` error mappings (lines 20-24, 167-200). **Status: ✓**
- `Tracely/crates/tracely-sentinel/src/config.rs:44-46` — `SentinelConfig { circuit_breaker, rate_limiter, bulkhead }` — typed config object composing all three
- `Tracely/crates/tracely-sentinel/src/validation.rs:49-191` — `validate_circuit_breaker`/`validate_rate_limiter`/`validate_bulkhead` with proper threshold/sanity checks
- `Tracely/crates/tracely-sentinel/src/lib.rs:29-32` — public re-exports of `Bulkhead`, `PartitionGuard`, `CircuitBreaker`, `TokenBucket`, `LeakyBucket`, etc.
- `Tracely/crates/tracely-sentinel/tests/bdd/` — Cucumber BDD suite (`features/test.feature`, `steps.rs`) with 5 scenarios including `@FR-005 @performance` load scaling (10/100/1000 concurrent)
- `Tracely/crates/tracely-sentinel/src/validation.rs:1-200` — config validation, including `validate_circuit_breaker_threshold` test (line 181)

### ✅ Tracera (resilience primitives, fewer integrations)
- `Tracera/crates/tracera-core/src/health.rs:1-321` — **Kubernetes-style probe triad**: `ProbeType::{Liveness, Readiness, Startup}` (lines 21-30), `HealthStatus::{Healthy, Degraded, Unhealthy}` (lines 33-39), `HealthCheck` trait + `HealthRegistry` + `FnCheck` adapter (lines 69-235), aggregate severity in `HealthReport::record` (lines 104-116). Test coverage: empty registry, startup-vs-readiness, degraded-still-serves-traffic, mixed-probes-overall (lines 262-319). **Status: ✓ — feature-equivalent to Spring Boot Actuator probes**
- `Tracera/crates/tracera-core/src/rate_limit.rs:1-229` — **three rate-limit strategies** in one file: `TokenBucket` (lines 24-70), `SlidingWindow` (lines 81-124), `LeakyBucket` (lines 135-179), all with `try_acquire() -> bool` (lines 55, 109, 164). Capacity 0 rejects all, refills over time, drains over time. Tests cover each algorithm (lines 184-228). **Status: ✓**
- `Tracera/crates/tracera-core/src/observability.rs` — health/observability scaffolding (file referenced; requires read for full content)
- ⚠️ Tracera has the *primitives* (health, rate limit, matrix) but no integration with circuit-breaker or retry — the SOTA triad is split (health + rate limit) but missing CB/bulkhead
- `Tracera/tests/chaos/` — empty `__pycache__/` only, no `chaos-tests.yml` workflow found in `.github/workflows/` (verified; only `cargo-deny.yml`, `governance-gates.yml`, `python-ci.yml`, `rust-tests.yml`, `release-plz.yml`, `release-attestation.yml`, `scorecard.yml` exist)
- `Tracera/src/tracertm/services/chaos_mode_service.py` — chaos mode service file (referenced via mypy cache; content not deeply read but existence confirmed)

### △ AgilePlus (resilience implemented per-component, not unified library)
- `AgilePlus/crates/agileplus-pipeline/src/executor.rs:46-309` — **per-node retry with exponential backoff**: `default_timeout_secs: 60` config (line 47), step "6. Retry on failure with exponential backoff" (line 64), per-node timeout from `node.attributes.timeout` (lines 201-205), `tokio::time::timeout` enforcement (lines 256-257, 284), backoff `2^(attempt-1) seconds` (lines 307-309), explicit `Timeout after Xs` error. **Status: ✓ for pipeline-level; partial — no jitter, no max-cap on attempts visible in snippet**
- `AgilePlus/crates/agileplus-p2p/src/replication.rs:328-450` — **NATS connect with exponential backoff**: 3 retries (1 s / 2 s / 4 s) hard-coded in `delays` array (lines 394-396), per-attempt `debug!`/`warn!`/`error!` logging (lines 408-416), `drain_pending` uses 250 ms `tokio::time::timeout` (line 442-447). **Status: ✓ for replication; partial — no jitter**
- `AgilePlus/crates/agileplus-nats/src/bus.rs:25, 55, 106-108, 230` — request/timeout API: `EventBusError::Timeout` variant (line 25), `request(envelope, timeout: Duration)` (line 216), `tokio::time::timeout` enforcement (line 230), `request_timeout` integration test (line 344). **Status: ✓ for timeouts; no retry at bus layer**
- `AgilePlus/crates/phenotype-dep-guard/src/osv.rs:38` — HTTP client with `Duration::from_secs(DEFAULT_TIMEOUT_SECS)` for OSV API calls. **Status: ✓ for timeouts; no retry on transient failure**
- `AgilePlus/crates/agileplus-governance/src/rate_limiter.rs:109-172` — `RateLimitResult::denied(remaining, reset_at, retry_after: Duration)` (line 124), `retry_after` is always populated when denied (line 171, "Minimum retry interval"). **Status: ✓ for rate limiting with retry-after semantics**
- `AgilePlus/crates/agileplus-convoy/src/lib.rs:29, 40-51` — `Convoy { timeout: DateTime<Utc> }` (line 40) — convoy-level timeout boundary. **Status: partial — no per-bead retry policy**
- `AgilePlus/crates/agileplus-convoy/src/coordinator.rs:48` — `Utc::now() > convoy.timeout` — timeout enforcement
- ⚠️ **Missing unified library**: AgilePlus has no `agileplus-resilience` crate. The `agileplus-pipeline` and `agileplus-p2p` each implement their own retry policy. No `CircuitBreaker` struct anywhere in the workspace. The Tracely `tracely-sentinel` crate is the canonical resilience library but **it is not consumed by AgilePlus**.
- `AgilePlus/crates/agileplus-integration-tests/tests/service_failure.rs:40-90` — **chaos-style integration test**: `pkill -f dragonfly` (line 51), verify `/health` returns 503 (line 85), assert degraded-mode behavior. **Status: ✓ for in-test chaos**
- ⚠️ No dedicated chaos workflow file (`.github/workflows/chaos-tests.yml` not present in AgilePlus)
- `AgilePlus/audit_scorecard.json:151, 360` — Prometheus/Health/Tracing/Metrics/SLO all marked as `0` — **confirms the lack of runtime resilience infrastructure**: `"details": "Prometheus: 0, Health: 0, Tracing: 0, Metrics: 0, SLO: 0."`
- `AgilePlus/.claude/dag-v2-audit-AgilePlus.json:124` — `"agileplus-telemetry is wired but no /metrics or /healthz endpoint shape is documented in SPEC.md (no SLO contract)"` — confirms runtime resilience infra is **deferred**
- `AgilePlus/crates/agileplus-subcmds/src/platform/health.rs:1-178` — `wait_for_health` with `poll_interval`/`timeout` (lines 11-41), progress bar (lines 25-28), `fetch_platform_health` fallback (lines 51-69), `synthetic_platform_health` for stub mode (lines 73-127). **Status: ✓ for CLI-side health polling**
- `AgilePlus/crates/agileplus-subcmds/src/platform/status.rs:27` — `"DEGRADED ({} service{} slow, {} service{} down)"` — degraded-mode reporting in platform status

### △ thegent (SLO regulator + retry primitive, no CB)
- `thegent/crates/thegent-policy/src/slo.rs:1-99` — **`SloRegulator`**: `latency_slo_ms`, `error_slo_rate`, rolling 100-metric window (lines 6-49), `is_compliant` checks both latency and error-rate (lines 35-50), PyO3 bindings (lines 62-99). **Status: ✓ — equivalent to a mini-error-budget tracker, but only "in-memory" — no multi-window burn rate, no Prometheus export**
- `thegent/crates/thegent-subprocess/src/lib.rs:5, 159-377` — `run_with_retry` (line 160), `run_retry` (line 274) — exponential backoff retry for subprocess execution; PyO3 export at line 377. **Status: ✓**
- `thegent/crates/thegent-subprocess/src/lib.rs:287` — `run_with_retry` invoked from `run_retry` wrapper
- ⚠️ **No circuit breaker, no bulkhead, no health-check registry** in any thegent crate (verified by grep). The thegent is consumer-side; resilience logic lives in Tracely/Tracera and AgilePlus.
- `thegent/crates/target/.../tower-0.5.3` — Tower library is *transitively* compiled (Cargo cache), so `tower::timeout`/`tower::retry` are available to any Rust consumer, but **no first-party crate wraps them** in thegent (verified)
- `thegent/qa-config.json:365, 370, 406-413, 468` — chaos/litmus/chaoskube/toxiproxy **detection patterns defined** in QA config: `"detection_patterns": ["chaos-toolkit", "toxiproxy", "litmus", "chaoskube", "fault_injection"]`, tool `"chaos": "chaos-toolkit"`, lane `"chaos_resilience"`. **Status: △ — patterns/config present, no first-party chaos harness; relies on `chaos-toolkit` external**
- `thegent/pytest-fast.ini:6, 22` + `pytest-pr-flake.ini:19-20` + `pytest-pr.ini:20-21` + `pyproject.toml:104, 110-111` — pytest markers `chaos: marks chaos/resilience tests`, `deep: marks integration/chaos tests`, lane `nightly_lane_marker = "slow or integration or e2e or load or deep or chaos or a11y"`. **Status: ✓ for test infrastructure**
- `thegent/pyproject.toml:104` — `markers = [..., "chaos: marks chaos/resilience tests", ...]` — chaos marker registered
- `thegent/tests/test_wl234_incident_runbook.py:1-50` — **incident-runbook unit tests**: `RunbookStep` dataclass, `IncidentRunbook` step-management, markdown rendering. **Status: ✓**
- `thegent/thegent/integrations/incident_runbook.py` — source for the runbook module (referenced in test imports)

## Gaps
1. **AgilePlus has no unified `agileplus-resilience` crate** — circuit-breaker, bulkhead, and rate-limit primitives are *only* in `tracely-sentinel`. AgilePlus should depend on it or extract a parallel `agileplus-resilience` crate. **Effort: M (3-5 days)**
2. **No circuit breaker in AgilePlus or thegent** — `agileplus-github`, `agileplus-p2p`, `agileplus-pipeline` would all benefit from `CircuitBreaker` wrapping remote calls. **Effort: M (2-3 days)**
3. **No jitter on backoff** — `agileplus-pipeline` (line 307) and `agileplus-p2p` (line 394) both use deterministic delays, which causes thundering herd. Add `rand::random::<u64>() % jitter_ms`. **Effort: S (1 day)**
4. **No max-retry cap on pipeline executor** — `attempts` could in theory run forever. **Effort: S (0.5 day)**
5. **AgilePlus has no /healthz, /readyz, /startupz HTTP endpoints** — `audit_scorecard.json:151` shows 0 health endpoints, despite `service_failure.rs` testing `/health`. The HTTP API surface needs `axum` routes for k8s probe triad. **Effort: M (2-3 days)**
6. **No chaos engineering workflow** — Tracely has the BDD framework, Tracera has `chaos_mode_service.py`, thegent has pytest markers + detection config, but **no repo has a scheduled chaos workflow** (`.github/workflows/chaos-tests.yml`). **Effort: M (1 week)**
7. **No burn-rate / multi-window alerting** — thegent's `SloRegulator` uses single-window (last 100 metrics), not the SRE-workbook MWMB (1h/6h/24h/3d windows). **Effort: M (3 days)**
8. **thegent subprocess retry lacks cancellation** — `run_with_retry` at `thegent-subprocess/src/lib.rs:160` does not propagate cancellation token; long-running subprocesses cannot be aborted mid-retry. **Effort: S (1 day)**
9. **No graceful-shutdown drain** — `agileplus-pipeline` and `agileplus-p2p` lack SIGTERM handling for in-flight tasks. **Effort: M (2-3 days)**

## Recommendations
1. **Adopt `tracely-sentinel` from AgilePlus** — add `agileplus-resilience = { path = "../Tracely/crates/tracely-sentinel" }` to relevant crates, or extract `tracely-sentinel` into a top-level `phenotype-resilience` crate that both AgilePlus and thegent can consume.
2. **Add `tower::timeout` + `tower::retry` wrappers** in AgilePlus HTTP API to get a real composable resilience pipeline.
3. **Add jitter to all backoff** — wrap `tokio::time::sleep` calls in `tokio::time::sleep(backoff + jitter::full_jitter())`.
4. **Ship a `/healthz` + `/readyz` axum router** in `agileplus-api` modeled on Tracera's `ProbeType` triad.
5. **Create `.github/workflows/chaos-tests.yml`** in AgilePlus and Tracely that runs the BDD chaos suite on a weekly cron.
6. **Extend `SloRegulator`** to multi-window burn rate (1h/6h/24h/3d) per Jones et al. 2019 and add Prometheus exporter.
