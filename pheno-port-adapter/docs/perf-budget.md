# Performance Budget — pheno-port-adapter

## 1. Scope

pheno-port-adapter is the unified hexagonal Port/Adapter layer for the pheno-* fleet (per ADR-014 + ADR-038). It exposes a single `PortAdapter` trait backed by concrete transport adapters (TcpAdapter, UnixAdapter, InProcAdapter, MockAdapter) and is consumed by every pheno-* substrate crate that has an external boundary. This performance budget governs the four hottest paths in the adapter graph that flow through the `PortAdapter::connect → send → recv → disconnect` lifecycle: validate (input shape), transform (struct → DTO), persist (Supabase POST), and hydrate (cache → struct). All measurements assume a release build using the `.cargo/config.toml` rustflags shipped in v14 T2 (`opt-level=3`, `lto=thin`, `codegen-units=1`) on the target hardware listed in Section 4. Out of scope: cold-start time, container image size, and any path that does not flow through the four stages above (for example, `disconnect` cleanup is intentionally not budgeted here and is tracked separately under v13 wave-A flake hygiene).

## 2. Stages

The four stages below are measured independently. Each row is the latency budget for one call to the named operation on a single `Connection`, including trait dispatch and Adapter impl selection so the numbers reflect the public API surface rather than a stripped inner loop. Stage ordering follows the natural request flow: validate the inbound shape, transform to a transport-ready DTO, persist the DTO to durable storage, then hydrate the response back into a domain struct for the caller.

| Stage | Operation | p50 target | p99 target | p999 target |
|---|---|---|---|---|
| validate | input shape (serde + `PortAdapter::health`) | 5 ms | 25 ms | 100 ms |
| transform | struct → DTO (serde_json / postcard) | 5 ms | 25 ms | 100 ms |
| persist | Supabase POST (via `supabase-adapter`) | 5 ms | 25 ms | 100 ms |
| hydrate | cache → struct (moka / in-proc LRU) | 5 ms | 25 ms | 100 ms |

## 3. Budget Allocation

The end-to-end budget for one full validate → transform → persist → hydrate round-trip is 100 ms p99 and 400 ms p99.9 (sum of the four p99 hard caps). Stage weights reflect the observed hot-path share from v11 / v12 wave-2 findings: network I/O dominates, cache hydration is second, and pure-CPU validate + transform share the remaining budget roughly equally. If a stage consistently runs at less than half its hard cap for two consecutive weekly refreshes, the budget can be re-balanced downward in a follow-up; the inverse (raising a hard cap) requires an ADR-level justification because it widens the SLO.

| Stage | % of total budget | Hard cap (ms) | Notes |
|---|---|---|---|
| validate | 10% | 10 ms | serde + trait dispatch; pure CPU, no allocations on hot path |
| transform | 30% | 30 ms | struct → DTO serialization; bound by codec choice (postcard preferred) |
| persist | 40% | 40 ms | network-bound Supabase REST POST; only lever is request batching |
| hydrate | 20% | 20 ms | cache lookup + struct rebuild; moka hit-rate target ≥ 95% |

## 4. Measurement

Benchmarks are run via `cargo bench` with the Criterion harness (per ADR-040 test-coverage gates), using the `bench` profile from `.cargo/config.toml` (v14 T2). Each stage has a dedicated bench target under `benches/perf_budget_<stage>.rs` that calls the operation directly through the `PortAdapter` trait surface so the measured cost includes trait dispatch and Adapter impl selection, not just the inner hot loop. Bench harnesses must seed their inputs from a fixed `benches/fixtures/` snapshot so that weekly runs are directly comparable; random or time-varying inputs are forbidden because they leak benchmark noise into the trend.

- Warmup: 1,000 iterations per stage (Criterion default; the first 200 are discarded as warm-up, the next 800 form the measurement window).
- Sample size: 100 samples per stage with a 10 s wall-clock budget each.
- Capture: `perf record -g -F 999` on Linux and `cargo instruments` time-profiler on macOS, attached as a CI artifact on the run.
- Target hardware: `aarch64-apple-darwin` (Apple M1, 16 GB) and `x86_64-unknown-linux-gnu` (c5.2xlarge, 8 vCPU). Both targets must clear the values in Section 2; CI fails the `perf-budget` job if any p99 exceeds 25 ms.
- Reports land under `target/criterion/<stage>/` and are mirrored to the `#perf-budget` channel weekly, with the previous four weeks retained for trend plots.

## 5. Violations

When a stage breaches its p99 hard cap (or any p999 exceeds 100 ms), the following actions are mandatory before the offending change ships:

- Add a `#[tracing::instrument]` span around the offending stage so `pheno-otel` (ADR-037) captures the latency breakdown per call site, then re-run the bench to confirm the span is not itself adding > 5% overhead.
- Open a follow-up ticket `v14-T3.1-<short-slug>` from the bench report and link it from the offending PR; the follow-up must propose a concrete remediation (allocation elision, codec swap, request batching, or cache TTL retune) with an attached repro bench.
- Notify the `#perf-budget` channel with the bench report path and the follow-up ticket; if the breach is greater than 2x the hard cap the change is blocked from merge until remediation lands and the bench passes.

## Appendix A — Stage-to-ADR anchors

Each stage in Section 2 is constrained by an existing ADR; any change to the corresponding budget row requires an ADR amendment before the PR can merge.

| Stage | Anchor ADR | Why |
|---|---|---|
| validate | ADR-038 (Hexagonal L4 Port/Adapter policy) | Port trait + Adapter impl shape constrains serde cost |
| transform | ADR-014 (Hexagonal L4 ports) | Codec choice (postcard vs serde_json) is an L4 concern |
| persist | ADR-037 (pheno-otel canonical) | Network budget must leave headroom for OTLP export |
| hydrate | ADR-040 (test coverage gates per tier) | Cache hit-rate target backs the lib-coverage gate |

## Appendix B — Revision history

- v1.0 (2026-06-20, v14 T3): initial budget. Four stages, p50/p99/p999 targets, 10/30/40/20 split, Criterion + perf capture on `aarch64-apple-darwin` and `x86_64-unknown-linux-gnu`. Linked from `pheno-port-adapter/docs/perf-budget.md` and mirrored to `findings/71-pillar-2026-06-20.md` once the v14 cycle-3 plan lands.
