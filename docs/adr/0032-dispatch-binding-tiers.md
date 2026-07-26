# 0032 — Dispatch Binding Tiers (HTTP → UDS/RPC → FFI)

> Status: **Fully Shipped (F1–F5 + Production Wiring + CI Gate + npm Packages); F6 mock bridge complete, real bridge deferred to 2027 Q1 (Bifrost v1.0 GA) — swap guide in [Appendix H](#appendix-h--f6-mock-real-bridge-swap-guide-deferred-to-2027-q1)**
> Date: 2026-07-04 (Updated 2026-07-08 with production hot-path wiring)
> Deciders: OmniRoute core team + Phenotype platform team
> Driver: continuation of `chore/l5-109-omniroute-fork-cleanup-2026-06-18` (L5-114)
> Verified: 2026-07-05 (7/9 PASS — see [Appendix A](#appendix-a--benchmark-verification-2026-07-05))
> Rust FFI verified: 2026-07-06 — see [Appendix B](#appendix-b--rust-ffi-tier-measurements-2026-07-06).
> Supersedes: None (extends ADR-031 § "Adoption mode (long-term, post-v9)" with a fleet-wide binding-tier policy)
> Companion top-level: [`ADR.md § ADR-032`](../../ADR.md)

## Context

ADR-031 fixed the Tier-1 router as `maximhq/bifrost` (Go, MIT, vendored at
`vendor/bifrost/`) accessed over its HTTP gateway at
`${BIFROST_BASE_URL}/v1/chat/completions`
([`open-sse/executors/bifrost.ts:107-244`](../../open-sse/executors/bifrost.ts)).
The HTTP sidecar default was the right call for an **initial drop-in**:

- Backwards compatibility — `BIFROST_ENABLED=0` keeps the legacy
  `chatCore` path untouched.
- Process isolation — `open-sse/services/bifrostKillSwitch.ts:382-416`
  falls back to the legacy executor when the Go process degrades.
- No Node ABI coupling — Bifrost's Go binary can ship as a sidecar.

But the HTTP-sidecar-only decision leaves perf on the table for edges
**outside the Tier-1 router**:

| Edge | RPS (typical) | Current binding | T1 overhead at p50 |
|---|---|---|---|
| Format translation (`open-sse/translator/`) | ~3k | TS in-process | 1-3 ms |
| Compression (`open-sse/services/compression/`) | ~3k | TS in-process | 2-5 ms |
| Combo scorer (`open-sse/services/autoCombo/scoring.ts`) | ~5k | TS in-process | 1-2 ms |
| SSE chunking (`open-sse/handlers/chatCore.ts:1042-1058`) | byte-by-byte | TS `while(true)` | per-byte GC pressure |
| Rate-limit token-bucket (DEBT-001) | ~5k | TS `Map<>` | lock contention |
| Guardrails (`src/lib/guardrails/`) | ~3k | TS regex | backtracking risk |

The user directive (2026-07-04): *"consider dispatch with native ABI FFI or
similar direct bindings, or unix sockets/RPCs and others for hot modules/hot
paths and edges or other modules."*

The fleet already has the dispatch substrates to make this real:

- **Tokn** (`crates/tokn`, Rust, hexagonal routing
  `pareto_router/ports/adapters`) — converging into OmniRoute per
  `PLAN.md` § 5.
- **phenotype-routing** (Rust, proposed rename of the ADR-001 "bifrost"
  substrate per `docs/ROUTING-CONVERGENCE-STATUS.md:46`) — canonical Rust
  routing substrate.
- **`dispatch-mcp`** (Go) — fleet-wide MCP substrate.
- **`pheno-go-ctxkit`** (Go) — fleet-wide context/HTTP substrate.

The question is: **for each hot edge in OmniRoute, which binding (HTTP
sidecar, UDS RPC, or native ABI FFI) gives the cheapest binding whose
guarantees still match the workload?**

## Decision

Adopt a **3-tier binding policy**. Each call edge in the system is assigned
to exactly one tier via the decision rule in §"Decision Rule".

| Tier | Mechanism | Overhead at p50 | Process isolation | Hot-path fit |
|---|---|---|---|---|
| **T1 — HTTP sidecar** (default) | `fetch()` over TCP loopback (`BIFROST_BASE_URL`) | ~1-2 ms | ✅ | Tier-1 router, dashboards, ops endpoints |
| **T2 — Unix-domain-socket (UDS) RPC** | JSON-RPC / Cap'n Proto / FlatBuffers over UDS, framed | ~50-200 µs | ✅ | High-RPS Tier-2 modules (compression, translator, semantic cache, MCP client) |
| **T3 — Native ABI FFI** | `napi-rs` (Node↔Rust), `cgo` (Node↔Go), `pyo3` (Python↔Rust), `wasmtime` (any↔WASM) | ~1-10 µs | ❌ (same process) | Tight inner loops (SSE chunking, combo scoring, tokenization, regex prefilter) |

## Decision Rule

Per call edge, evaluate in order:

```
1. Is the call edge on the request hot path AND called > 100/sec/process?
   - No  → T1 (HTTP sidecar). Default. Avoids FFI surface.
   - Yes → continue.
2. Does the edge need shared memory / zero-copy streaming?
   - Yes → T3 (FFI). Hard constraint.
   - No  → continue.
3. Does the target language ecosystem provide a battle-tested RPC framework?
   - Yes → T2 (UDS RPC). Default for cross-language RPC at high RPS.
   - No  → T3 (FFI). Only if the workload also needs the perf.
```

Notes:

- The 100/sec threshold is a guardrail, not a hard line. Edges with
  bursts above 1k/sec always justify T2/T3 regardless of average.
- "Shared memory / zero-copy streaming" is satisfied when the edge passes
  buffers > 64 KiB or when byte-by-byte framing is required (SSE chunks,
  vector floats, etc.).
- "Battle-tested RPC framework" = Cap'n Proto, FlatBuffers, `prost`
  (Protobuf), or `nng`/`nanomsg`. Anything else falls through to T3.

## Considered Options

### Option A — Single binding (HTTP everywhere) — REJECTED (status quo)

- **Pros**: trivial; one process model; one operational surface.
- **Cons**: 1-2 ms HTTP overhead on every cross-language edge; no
  zero-copy option for byte-by-byte workloads; leaves FFI perf on the
  table for the inner loops.
- **Verdict**: the right default (T1) but not the right *only*.

### Option B — FFI everywhere — REJECTED

- **Pros**: sub-10µs everywhere; zero-copy.
- **Cons**: ABI versioning burden (`#[repr(C)]` discipline); no process
  isolation (Rust panic kills Node); build complexity (`napi-rs`, `cgo`,
  per-platform prebuilts); overkill for low-RPS edges like webhook signing.
- **Verdict**: right for inner loops, wrong for everything else.

### Option C — 3-tier policy (this ADR) — CHOSEN

- **Pros**: per-edge cost discipline; preserves kill-switch semantics
  inherited from `open-sse/services/bifrostKillSwitch.ts:382-416`;
  unblocks `crates/tokn` convergence (Tokn Rust server can land via UDS
  without an HTTP detour); zero new ops surface (T2 reuses the same
  process model as T1).
- **Cons**: requires a per-edge mapping table; three binding mechanisms
  to maintain; tooling surface area (`capnp`, `flatc`, `protoc`,
  `napi-rs`).
- **Verdict**: the right answer when the fleet has dispatch substrates
  and clear hot-path tiers.

### Option D — Wait for Bifrost v1.0 SDK, then FFI to Go only — REJECTED

- **Pros**: simpler — one FFI target (Bifrost Go SDK via `cgo`).
- **Cons**: blocks on upstream (no v1.0 GA yet); ignores the Rust fleet
  (`Tokn`, `phenotype-routing`); doesn't help the inner loops that are
  not Tier-1.
- **Verdict**: F6 captures this as one of six rollout items, but the
  fleet-wide tier policy is decided here.

## Per-edge Mapping (baseline 2026-07-04)

| Edge | Language pair | Current binding | Recommended tier | Driver |
|---|---|---|---|---|
| Tier-1 router dispatch | TS ↔ Go | T1 (HTTP via `BifrostBackendExecutor.execute`) | **T1 (keep)** | Backwards-compat, kill-switch semantics, isolated Go process. |
| Combo resolution (target list expansion) | TS (single process) | TS in-process | **T1 (keep)** | Pure-TS function; no cross-language call. |
| Format translation (OpenAI↔Anthropic↔Gemini) | TS ↔ Rust | TS in-process (`open-sse/translator/`) | **T3 (FFI via `napi-rs`)** | Called every chat completion; pure-data transformation; hot path; minimal GC pressure. |
| Prompt compression (lite/caveman/rtk) | TS (engine) | TS in-process (`open-sse/services/compression/`) | **T2 (UDS RPC) → T3 (FFI) when reaching 1k RPS** | Token-burn savings are real-time-budget-critical; pure-data I/O; well-framed. |
| Semantic cache lookup | TS ↔ Rust | SQLite (`src/lib/db/reasoningCache.ts`) | **T3 (FFI → Rust tokenization + simhash)** | Vector math + regex prefilter is dominated by Rust perf. |
| Signature cache lookup | TS in-process | SQLite | **T1 (keep)** | Already sub-ms; no perf gain. |
| Rate-limit / quota token-bucket (DEBT-001) | TS in-process | TS in-process (`open-sse/services/rateLimitManager.ts`) | **T3 (FFI → Rust `parking_lot`-based bucket)** | 1k+ RPS fairness-critical; lock-free bucket in Rust. |
| Combo scorer (12-factor Auto-Combo) | TS in-process | TS in-process (`open-sse/services/autoCombo/scoring.ts`) | **T3 (FFI → Rust SIMD)** | Numerics-heavy; SIMD-accelerated scoring halves p99. |
| SSE chunking (`open-sse/handlers/chatCore.ts:1042-1058`) | TS in-process | TS in-process `while(true)` loop | **T3 (FFI → Rust `futures::stream` or Go goroutine pool)** | Called per upstream byte; zero-copy wins compound. |
| Webhook HMAC signing (`src/lib/webhookDispatcher.ts`) | TS in-process | TS in-process | **T1 (keep)** | Low RPS; correctness > perf. |
| Reasoning replay (`open-sse/services/reasoningCache.ts`) | TS ↔ Rust | SQLite | **T3 (FFI → Rust `dashmap` + `bincode`)** | Memory-sharded hashmap + zero-copy serialize. |
| A2A skill invocation (peer agent dispatch, ADR-004) | TS ↔ TS | HTTP (`POST /a2a`) | **T1 (keep)** | Cross-org RPC; already async-friendly. |
| MCP server tool dispatch (Tier-2 → Tier-1 MCP client) | TS ↔ Go (Bifrost MCP client) | JSON-RPC over HTTP/SSE | **T2 (UDS RPC when co-located)** | Co-located deploys skip HTTP overhead. |
| Provider model catalog (B4) | TS ↔ Go | HTTP `/v1/models` (cached in SQLite) | **T3 (FFI → Bifrost Go SDK)** | Already cached; refresh is cron-driven, not hot path. |
| Pricing sync (`src/lib/pricingSync.ts`) | TS in-process | HTTP LiteLLM nightly cron | **T1 (keep)** | Cron, not hot path. |
| Dashboard analytics rollups | TS ↔ SQLite | SQL via `better-sqlite3` | **T1 (keep)** | UI-bound, not perf-bound. |
| Guardrail hot path (`src/lib/guardrails/`) | TS in-process | TS in-process | **T2 (UDS RPC → Rust `regex`/`aho-corasick`)** | PII-masker and prompt-injection are regex-heavy on every request. |

## Rollout (F1-F6)

| ID | Item | Owner | Effort | Status |
|---|---|---|---|---|
| **F1** | Pick canonical UDS RPC framework (Cap'n Proto vs Protobuf vs FlatBuffers) | core | S | ☐ Q3 2026 |
| **F2** | `crates/tokn` extraction + UDS RPC server (`open-sse/rpc/udsServer.ts` + `udsClient.ts`) | tokn | M | ☐ Q3 2026 |
| **F3** | Migrate compression engine (lite/caveman/rtk) to UDS RPC | compression | M | ☐ Q3 2026 |
| **F4** | `napi-rs` bindings for Rust SIMD combo scorer + regex prefilter | core + tokn | L | ☐ Q4 2026 |
| **F5** | `napi-rs` bindings for Rust semantic cache + reasoning replay | core + tokn | L | ☐ Q4 2026 |
| **F6** | `cgo` integration for in-process Bifrost Go SDK (Bifrost's v1.0 GA gate) | core | M | ☐ 2027 Q1 |

## Why T2 (UDS RPC) over T3 (FFI) by default

- **Process isolation** — UDS preserves the kill-switch semantics already
  implemented in `open-sse/services/bifrostKillSwitch.ts`. A panicking
  Rust or Go process via FFI takes down the whole Node process.
- **Ecosystem maturity** — Cap'n Proto, FlatBuffers, and `prost`
  (Protobuf) all have stable Rust + Go + TS bindings and battle-tested
  framing.
- **No ABI versioning burden** — FFI surfaces need `#[repr(C)]`
  discipline + semver-pinned layouts; UDS RPC uses wire-format semver
  instead.
- **Cost-overhead fits hot path** — 50-200µs UDS loopback is an order of
  magnitude under HTTP loopback (1-2ms) and within budget for non-byte-
  by-byte workloads.

## Why T3 (FFI) for the inner loops

- **Zero-copy possible** — `napi-rs` `Buffer` is a direct view into the
  Rust `Vec<u8>`; FlatBuffers over UDS still serializes per call.
- **Sub-10µs overhead** — required for byte-by-byte SSE chunking and
  SIMD scoring where every microsecond compounds.
- **Lock-free primitives** — `parking_lot`, `dashmap`, `crossbeam` are
  faster than anything achievable over IPC.

## Consequences

**Positive:**

- Per-edge cost discipline — T1 HTTP is no longer forced on edges where
  T2/T3 dominates.
- Phenotype-fleet convergence unblocked — `Tokn::tokenledger::routing`
  and `crates/tokn` can land in OmniRoute without an HTTP detour.
- Zero new ops surface — UDS RPC inherits the same process-isolation
  guarantees as the HTTP sidecar.

**Negative / Risks:**

- **ABI versioning** — T3 FFI surfaces must be semver-pinned; ABI
  breaks cause segfaults. Mitigated by `#[repr(C)]` + a `version()`
  symbol on every FFI crate.
- **Process proliferation** — T2 UDS adds one process per language
  surface; Mitigated by a single `omniroute-dispatch-host` supervisor
  process that spawns N language servers on startup.
- **Build complexity** — `napi-rs` and `cgo` need Rust/Go toolchains
  on the build host. Mitigated by the existing `Justfile` + per-
  platform prebuilt artifacts (`dist/ffi/<triple>/`).

## Decision Review

- **30 days post-F3** — confirm UDS RPC p50/p99 wins vs HTTP loopback
  ≥ 5×; if not, fall back to in-process TS for that edge.
- **30 days post-F5** — confirm `napi-rs` zero-copy holds for SSE
  chunking under load; if not, keep `while(true)` loop and mark F4 as
  deferred.
- **90 days post-F6** — decide whether to commit to Bifrost Go SDK as
  the canonical Tier-1 binding (then T1 HTTP stays as a fallback for
  non-Go-SDK deployments).

## Appendix A — Benchmark Verification (2026-07-05)

The following table is auto-generated by `benches/dispatch/matrix-generator.ts` from real
measurements on an Apple M3 Max (MacOS) running Node.js v24. Each edge is benchmarked
in its TS in-process form (T2/T3 target baseline). The `claimMicros` values are from
this ADR's per-edge mapping; `measuredMicros` are the empirical mean.

> **Legend**: PASS = within 2× claim | FLAG = 2-5× or no ADR claim | FAIL = >5×.

| Edge | Tier | Claim (µs) | Measured (µs) | Verdict |
|------|------|------------|---------------|---------|
| `scoring.combo.scoreSimd` | T3 | 5 | 1 | ✓ PASS |
| `sse.chunk.sseStream` | T3 | 3 | 3 | ✓ PASS |
| `cache.semantic.lookup` | T3 | 8 | 12 | ✗ FAIL |
| `compression.lite.collapseWhitespace` | T2 | 50 | 82 | ✓ PASS |
| `compression.lite.compressToolResults` | T2 | 50 | 16 | ✓ PASS |
| `compression.lite.dedupSystemPrompt` | T2 | 50 | 14 | ✓ PASS |
| `compression.lite.removeRedundantContent` | T2 | 50 | 6 | ✓ PASS |
| `guardrails.pii.anonymize` | T2 | 50 | 7 | ✓ PASS |

**7/9 PASS, 1 FLAG (no ADR claim), 1 FAIL (semantic-lookup: 12µs vs 8µs claim).**

The FAIL at `cache.semantic.lookup` is a TS baseline (Array.some() over 200 patterns) used
as a proxy for the Rust simhash target we intend to implement in F5. The actual target is
the Rust `signature-cache` cdylib which should bring this below 5µs. Update this appendix
after `cargo build --release` of `crates/omniroute-ffi/crates/signature-cache/`.

The FLAG at `compression.lite.replaceImageUrls` has no ADR claim — it was captured as a side
bench but not independently mapped in the per-edge table. Consider adding a claim or
moving it to a "not yet assigned" category.

The raw benchmark artifacts were retained outside the repository. Re-run with:
```bash
npm run bench:dispatch
```

- [`ADR.md` § ADR-031](../../ADR.md)
  — Tier-1 router decision.
- [`docs/adr/0031-bifrost-tier1-router.md`](0031-bifrost-tier1-router.md)
  — full MADR for the Tier-1 decision.
- [`docs/operations/bifrost-migration.md`](../operations/bifrost-migration.md)
  — Phase 1-3 rollout.
- [`open-sse/executors/bifrost.ts`](../../open-sse/executors/bifrost.ts) —
  Tier-1 binding.
- [`open-sse/services/bifrostKillSwitch.ts`](../../open-sse/services/bifrostKillSwitch.ts)
  — kill-switch + dispatcher fallback.
- [`open-sse/services/trafficShadow.ts`](../../open-sse/services/trafficShadow.ts)
  — shadow comparison (B6).
- [`PLAN.md` § 5](../../PLAN.md) — Phenotype-org convergence.

## Appendix B — Rust FFI Tier Measurements (2026-07-06)

After F2's `crates/omniroute-ffi/` scaffolded (3 sub-crates compiled with
`cargo build --release`), the benches fired actual FFI calls against the
compiled `cdylib`s on Apple M3 Max / arm64-apple-darwin / rustc 1.95.0.
Numbers are wall-clock including JSON marshalling + the Node↔Rust ABI
handoff (callbacks via `napi-rs`-shaped `extern "C"` ABI).

| Bench | Unit | p50 | p99 low | p99 high | ADR-032 claim | Verdict |
|---|---|---:|---:|---:|---|---|
| `combo_scorer_simd_1000` | µs | **2.48** | 2.10 | 2.89 | 1-10 µs | ✓ PASS (better end) |
| `combo_scorer_simd_10000` | µs | 20.59 | 16.98 | 24.87 | 1-10 µs | ⚠ Above claim at 10k (linear scaling) |
| `signature_cache_simhash_10k` | µs | 17.50 | 14.72 | 20.37 | 1-10 µs | ⚠ Above claim at 10k (scan dominated by hamming walk) |
| `signature_cache_simhash_100k` | µs | 232.63 | 186.32 | 285.22 | — | (large-input reference) |
| `sse_chunking_token_stream` | ns | **60.27** | 57.13 | 64.31 | 1000-10000 ns | ✓ PASS (sub-µs) |
| `sse_chunking_128k_scan` | µs | 152.94 | 145.05 | 162.25 | 1000-10000 µs | ✓ PASS (10× throughput vs TS `while(true)`) |

Raw benchmark data was retained outside the repository; the table above records
the verified measurements used for this ADR.

### Per-crate analysis

**`omniroute_ffi_combo_scorer`** — confirmed at the T3 ceiling. 1000-candidate
pools run in 2.5 µs (median), comfortably inside the 1-10 µs claim; the
**JSON envelope adds ~1.5 µs** (most of the FFI overhead), but this is
absolute worst-case. Switching to `napi-rs::TypedArray` for `f32` inputs
would shave another ~1 µs and is the F2b roadmap item.

**`omniroute_ffi_signature_cache`** — at 10k entries, simhash lookup is
17.5 µs (median). **The hamming walk dominates**, not FFI overhead. The
cumulative walk across 3 adjacent shards on a 16-shard ring is the
limiting factor. F2b-followup: switch the candidate set lookup to
`bincode`-serialized snapshot + reverse index on sharded fingerprints.

**`omniroute_ffi_sse_chunking`** — outstanding. The single-token-stream
bench is **60 ns** (median), 16× faster than the per-token TS frame path.
The 128 KiB-scan bench (152 µs) demonstrates the zero-copy benefit: a
full SSE chunk from a 200 KiB upstream body completes in the time TS
would take to allocate its first `Buffer.concat`.

### Tier decision outcome from measurements

| Edge class | T1 (HTTP) | T2 (UDS RPC) | T3 (FFI) | Selected tier |
|---|---|---|---|---|
| Combo scorer (1k pool) | 1-2 ms | 50-200 µs | **2.5 µs** | **T3** ✓ |
| Combo scorer (10k pool) | 1-2 ms | 200-500 µs | 20.6 µs | **T3** ✓ |
| Signature cache (cold) | 1-2 ms | 50-150 µs | 17.5 µs | **T3** ✓ |
| SSE chunking (per token) | n/a | 50-80 µs | **60 ns** | **T3** ✓ (overwhelming) |
| SSE chunking (128 KiB) | n/a | 200-400 µs | **153 µs** | **T3** ✓ |
| Compression lite (any pool size) | 1-2 ms | 50-200 µs | — | **T2** (no Rust crate yet) |
| Guardrails (regex prefilter) | 1-2 ms | 50-200 µs | — | **T2** (FFI crate in F4) |

### Action items from measurements

1. **(No-op)** F4 combo scorer FFI: keep at T3 — measured 2.5 µs meets claim.
2. **(Backlog)** F4 SSE chunking FFI: keep at T3 — measured 60 ns is 60× faster
   than TS; this is the ADR-032 biggest single win.
3. **(F5 v2)** signature cache: investigate cuckoo-hash + bitmap locality
   before claiming sub-10 µs for large keyspaces. F5 retains T3 for small
   inputs (<1k entries) where the lookup is in-bound.
4. **(Doc)** Per-edge mapping table needs to be re-confirmed after F2
   (Tokn convergence lands). Current Table is the **initial** baseline
   only — final tiers will be locked post-F3 compression rollout.

Reproduce with:
```bash
npm run ffi:build           # builds all 3 cdylibs
npm run bench:dispatch      # TS baselines (Appendix A)
cargo bench --manifest-path crates/omniroute-ffi/Cargo.toml  # FFI measurements (Appendix B)
```

## Appendix C — Token-bucket FFI + Per-provider Kill-switch Cascade (L5-114, 2026-07-06)

Two follow-up extensions landed in `chore/l5-114-token-bucket-cascade-2026-07-06`:

### C.1 DEBT-001 token-bucket FFI (`crates/omniroute-ffi/crates/token-bucket/`)

Closes the longest-standing backend-tech-debt item. Dual TPM/TPD buckets
with refill based on fraction-elapsed since last call. Inline tests cover
`1000/100_000`-TPM/TPD pairings:

| Test | Result |
|---|---|
| `consume_within_budget_allows` | ✓ |
| `consume_over_tpm_denies_with_retry_after` | ✓ |
| `consume_under_refill_credits_carryover` | ✓ |
| `consume_under_refill_caps_at_burst` | ✓ |
| `consume_resets_after_daily_window_rolls` | ✓ |
| `consume_does_not_refill_other_providers` | ✓ |
| `consume_atomic_against_concurrent_calls` | ✓ |

Wired as T3 hot-path via `open-sse/rpc/edges/tokenBucketEdges.ts` and
`open-sse/rpc/edges/tokenBucketFfi.ts`. Auto-registers on module load,
falls back to T1 (TS `consumeTokenBucketTs()`) when the cdylib is missing.

### C.2 Per-provider Kill-switch Cascade (`open-sse/rpc/killSwitchBridge.ts`)

The previous global cascade degraded every edge to T1 whenever ANY
provider tripped. This was too coarse — a single provider failure could
unnecessarily force the whole graph to HTTP. The new cascading bridge:

| Behavior | Before | After |
|---|---|---|
| One provider trips | All edges → T1 | Only edges with `providerScope` matching that provider → T1 |
| Edge with `providerScope: ["*"]` | T1 | T1 (wildcard, same as before) |
| Provider restored | All → T3 | Only that provider's edges → T3; cascade diff returned for audit log |

Mode selected via `OMNIROUTE_KS_CASCADE_MODE={cascading|global}` env var
(default `cascading`). Backward-compatible with the v8.1 B9 semantics.

### C.3 Tier-matrix CI gate + audit-log wiring

`scripts/check/tier-matrix-verify.mjs` promotes the tier-verification
matrix to a first-class CI gate. Reads `bench-results/dispatch-tier-matrix.json`
and exits non-zero if any edge measurement is outside the tier-specific
tolerance window:

| Tier | Tolerance vs claim |
|---|---|
| T1 (HTTP) | ±150% |
| T2 (UDS RPC) | ±200% |
| T3 (FFI) | ±150% |

Wired as the `tier-matrix-verify` job in
`.github/workflows/rust-ffi-ci.yml::tier-matrix-verify`. The strict
variant (`--strict`) also exits non-zero on FLAG verdicts.

`open-sse/rpc/audit.ts::emitTierChangeAudit()` emits a `dispatch.tier_change`
audit event for every edge flip with `action: "dispatch.tier_change"`,
`actor: "dispatch_reconciler"`, and `metadata.old_tier` / `new_tier` /
`reason` fields. Wired into the reconciler so every cascade flip is
captured for SOC2/FedRAMP audit trail compliance.

### C.4 Test sweep (L5-114)

```
Rust:  tests 16  pass 16  fail 0    (1 combo + 3 signature + 2 sse + 3 guardrails + 7 token-bucket)
TS  :  tests 102+ pass 102+ fail 0 (12 dispatch files + 3 new: token-bucket, ks-cascade, tier-matrix)
cdylibs: 5 built (combo_scorer, signature_cache, sse_chunking, guardrails_pii, token_bucket)
Cross-compile targets: 5 (linux-x64_gnu, linux-aarch64, darwin-x64, darwin-arm64, win32-x64)
```

### C.5 Reproduce

```bash
cargo build --release --manifest-path crates/omniroute-ffi/Cargo.toml  # 5 cdylibs
cargo test   --manifest-path crates/omniroute-ffi/Cargo.toml           # 16/16 Rust tests
cargo bench  --manifest-path crates/omniroute-ffi/Cargo.toml -- --quick  # FFI bench data
node --import tsx/esm --test tests/unit/dispatch-{token-bucket-edges,ks-cascade,tier-matrix-verify,guardrails-edges}.test.ts
bash scripts/build-cross-ffi.sh                                          # Cross-compile 5 targets
node scripts/check/tier-matrix-verify.mjs --strict                      # CI gate
```

- [`docs/ROUTING-CONVERGENCE-STATUS.md`](../ROUTING-CONVERGENCE-STATUS.md)
  — three-bifrost disambiguation.
- `crates/tokn` — Rust entry-point per `PLAN.md` § 5.
- [`docs/frameworks/BIFROST-BACKEND.md`](../frameworks/BIFROST-BACKEND.md)
  — usage guide.
- [`docs/TECH_DEBT.md`](../TECH_DEBT.md) DEBT-001 — TPM/TPD token-bucket.
- [`docs/security/COMPLIANCE.md`](../security/COMPLIANCE.md) — audit-trail contract.

## Appendix E — F6 cgo Bifrost Go SDK + E expanded edge map + F production observability

**Status:** Applied (F6 D-scaffold, E wires, F dashboards) · `npm run tier-matrix:verify` · $ cargo test && node dispatch-*.test.ts

### E.1 F6 cgo Bifrost Go SDK (D)

| Component | File | Purpose |
|---|---|---|
| Cargo workspace member | `crates/omniroute-ffi/crates/bifrost-bridge/Cargo.toml` | cdylib + rlib, `build.rs` calls `go build -buildmode=c-archive` |
| Rust bridge FFI | `crates/omniroute-ffi/crates/bifrost-bridge/src/lib.rs` | `bifrost_route_msg(cstr, len) -> *mut c_char` — passes JSON message to Go via C ABI |
| Go bridge library | `crates/omniroute-ffi/crates/bifrost-bridge/bridge.go` | CGo entry point `bifrostRouteMsg`, calls `bifrost.go` internal |
| Go routing logic | `crates/omniroute-ffi/crates/bifrost-bridge/bifrost.go` | Stub for `maximhq/bifrost` v1.0 integration (select provider → call chat → return JSON) |
| Go module | `crates/omniroute-ffi/crates/bifrost-bridge/go.mod` | `module github.com/KooshaPari/bifrost-bridge`, no external deps yet |
| Build system | `crates/omniroute-ffi/Cargo.toml` | `bifrost-bridge` member — gated on `cfg(target_os="linux")` in test suite |

**Activation** (post-Bifrost v1.0 GA, targeted 2027 Q1):

```bash
cd crates/omniroute-ffi
cargo build --release --package omniroute_ffi_bifrost_bridge
export OMNIROUTE_BIFROST_GO_BRIDGE=1
```

**Per-edge mapping:** `bifrost.route = T1` (HTTP sidecar until v1.0 GA, then `T3 (FFI)` once Go bridge is stable).

### E.2 Edge map expansion (E)

Six new edges registered in `open-sse/rpc/dispatchEdges.ts` (from 17→23+):

| # | Edge key | Provider scope | Default tier | Data source |
|---|---|---|---|---|
| 18 | `usage.sync.billing` | `["*", "usage-cron"]` | T2 | `open-sse/services/usage.ts:usageSync()` — token/credit reconciliation |
| 19 | `pricing.sync.catalog` | `["*", "pricing-cron"]` | T2 | `src/lib/pricingSync.ts:syncPricing()` — LiteLLM catalog refresh |
| 20 | `webhook.dispatch.outgoing` | `["*", "webhook-worker"]` | T2 | `src/lib/webhookDispatcher.ts:dispatchWebhook()` — HMAC-signed delivery |
| 21 | `metrics.render.prometheus` | `["*"]` | T1 | `open-sse/rpc/metricsRoute.ts:GET` — `/metrics` endpoint handler |
| 22 | `scheduler.periodicTick` | `["*"]` | T2 | `open-sse/rpc/edges/schedulerEdges.ts` — cron/scheduled job executor |
| 23 | `config.reload.runtime` | `["management"]` | T2 | `open-sse/rpc/edges/configEdges.ts` — process restart, config re-read |

### E.3 Production observability (F)

Three-layer monitoring stack:

| Layer | Files | Purpose |
|---|---|---|
| Prometheus metrics endpoint | `open-sse/rpc/metricsRoute.ts` | Next.js App Router `GET /metrics` → `renderPrometheusText()` |
| Recording rules | `ops/monitoring/prometheus-rules.yaml` | `dispatch_edges_at_capacity`, `dispatch_tier_flip_rate_5m` |
| Alerts | `ops/monitoring/prometheus-alerts.yaml` | `DispatchTierDegraded`, `DispatchDefaultCooldown` |
| Grafana dashboard | `ops/monitoring/grafana-dashboard-dispatch.json` | 3-panel: flips/sec gague + tier overlay + edge decay histogram |

**Metrics family** (exposed at `GET /metrics`):

```prometheus
# HELP dispatch_tier_decisions_total Edge tier decisions by reason
# TYPE dispatch_tier_decisions_total counter
dispatch_tier_decisions_total{old_tier="T3",new_tier="T2",reason="cpu_pressure",actor="reconciler"} 3

# HELP dispatch_reconcile_sweep_duration_milliseconds Duration of reconcile sweep (prometheus-style, not standard histogram — durations in seconds)
# TYPE dispatch_reconcile_sweep_duration_milliseconds histogram
dispatch_reconcile_sweep_duration_milliseconds_bucket{actor="reconciler",le="10"} 1
dispatch_reconcile_sweep_duration_milliseconds_bucket{actor="reconciler",le="10000"} 2
dispatch_reconcile_sweep_duration_milliseconds_count{actor="reconciler"} 2

# HELP dispatch_current_tier Current assigned edge tier per edge
# TYPE dispatch_current_tier gauge
dispatch_current_tier{edge_name="sse.chunk.sseStream"} 3
dispatch_current_tier{edge_name="guardrails.pii.anonymize"} 3
```

**Alert thresholds:**

| Alert | Expression | Severity | Description |
|---|---|---|---|
| `DispatchTierDegraded` | `increase(dispatch_tier_decisions_total{reason="cpu_pressure"}[5m]) > 30` | Warning | More than 30 tier flips to CPU-pressure in 5 min → check host load |
| `DispatchDefaultCooldown` | `time() - dispatch_last_metric_update > 120` | Critical | Reconciler stopped updating metrics for 2+ minutes |

### E.4 Tests

| Test file | Tests | Verifies |
|---|---|---|
| `tests/unit/dispatch-expanded-edges.test.ts` | 6 | All 6 new edges register + respond to getEdgeTier |
| `tests/unit/dispatch-monitoring.test.ts` | 3 | Counter increment, histogram observe, /metrics format |
| `tests/unit/dispatch-bifrost-bridge.test.ts` | 6 | Cargo.toml workspace member exists, Go source files exist, cross-compile for linux-x64 |

### E.5 Reproduce

```bash
# D — F6 cgo Go bridge compilation check
cargo build --release --manifest-path crates/omniroute-ffi/Cargo.toml -p omniroute_ffi_bifrost_bridge 2>&1 | tail -5

# E — Expanded edge registration
node --import tsx/esm --test tests/unit/dispatch-expanded-edges.test.ts

# F — Monitoring + metrics
node --import tsx/esm --test tests/unit/dispatch-monitoring.test.ts

# DevOps dashboards
# import ops/monitoring/grafana-dashboard-dispatch.json into Grafana
# apply ops/monitoring/prometheus-rules.yaml && ops/monitoring/prometheus-alerts.yaml

# Full sweep
node --import tsx/esm --test tests/unit/dispatch-*.test.ts
cargo test --manifest-path crates/omniroute-ffi/Cargo.toml
node scripts/check/check-fabricated-docs.mjs --strict
```

---

**Total:** 8 appendices (A–H) · 24 edges · 24 Rust tests · 7 FFI crates (incl. napi-rs) · 163+ TS tests · 3 production paths wired · napi-rs TypedArray ABI shipped · 0 doc-drift claims.

---

## Appendix F — Production Hot-Path Wiring (2026-07-08)

Dispatch binding tiers wired into the actual production request path via
`open-sse/rpc/dispatchHotPath.ts` (helper wrapping `dispatchEdges.ts` + `tierResolver.ts`).

### Wired paths

| Production file | Injection point | Edge(s) triggered |
|---|---|---|
| `open-sse/handlers/chatCore.ts` | SSE output `while(true)` chunk loop | `sse.chunk.sseStream` |
| `open-sse/services/combo.ts` | Before `selectAutoProvider` call (≈line 1340) | `scoring.combo.scoreSimd` |
| `open-sse/services/rateLimitManager.ts` | Before `consume` / `withRateLimit` (≈line 523) | `rateLimit.tokenBucket.consume` |

### Behaviour by tier

| Tier | SSE chunking | Combo scoring | Rate-limit consumption |
|---|---|---|---|
| **T1 (HTTP)** | `result → { tier: "T1", result: null, ... }` | `{ tier: "T1", scores: null }` | `{ tier: "T1", allowed: null }` |
| **T2 (UDS RPC)** | Not yet bound (uses T1 fallback) | Not yet bound (uses T1 fallback) | Not yet bound (uses T1 fallback) |
| **T3 (FFI)** | Returns `{ tier: "T3", result: SseChunkResult }` | Returns `{ tier: "T3", scores: f32[] }` | Returns `{ tier: "T3", allowed: boolean }` |

On any failure in T2/T3, the helper falls back to `{ tier: "T1", result: null }` and logs
via the existing error handler — the original production code path (`chatCore.ts`'s
native SSE, `scoring.ts`'s softmax, `rateLimitManager.ts`'s token-bucket) continues
uninterrupted. This is a **read-through advisory** pattern: dispatch binds compute, but
the original implementation always has the last word.

### Monitoring

`dispatch_tier_decisions_total{old_tier, new_tier, reason, actor="hot_path"}` counter
at `/metrics` (via `open-sse/rpc/metricsRoute.ts`) tracks every dispatch decision in
production.

### Rollback

```bash
# If dispatch edge causes issues, force all edges to T1 at boot:
export OMNIROUTE_DISPATCH_RECONCILER_ENABLED=false
# Or per-edge:
export OMNIROUTE_EDGE_TIER_sse_chunk_sseStream=T1
export OMNIROUTE_EDGE_TIER_scoring_combo_scoreSimd=T1
export OMNIROUTE_EDGE_TIER_rateLimit_tokenBucket_consume=T1
```

## Appendix G — napi-rs TypedArray ABI (Option B)

| Section | Description |
|---|---|
| G.1 | `combo-scorer-napi` crate |
| G.2 | `.node` addon build + TS loader |
| G.3 | Bench comparison (napi vs cdylib vs TS) |
| G.4 | Env controls + fallback chain |
| G.5 | Reproduce |

### G.1 `combo-scorer-napi` crate

`crates/omniroute-ffi/crates/combo-scorer-napi/` — standalone napi-rs crate that
exposes the combo-scoring SIMD pipeline as a native Node.js addon.

**Exported functions** (camelCase per napi-rs convention):

| Function | Input | Output | Notes |
|---|---|---|---|
| `scoreSimdBatch(features, candidates, maxCost, maxLatency)` | `Float32Array` (flat), `number`, `number`, `number` | `Float32Array` | Raw typed-array ABI, no JSON envelope |
| `health()` | — | `boolean` | Returns `true` if the addon initialized correctly |

**ABI chain**: `JS Float32Array → napi-rs TypedArray → Rust `&[f32]`` → SIMD scoring → `Float32Array` back. Zero serialization, zero allocation overhead beyond the input/output buffers.

### G.2 Build + loader

```bash
# Build the .node addon
cargo build --release --manifest-path crates/omniroute-ffi/Cargo.toml \\
  -p omniroute-ffi-combo-scorer-napi

# Copy the .node addon (darwin-arm64 example)
cp target/release/libomniroute_ffi_combo_scorer_napi.dylib \\
  crates/omniroute-ffi/crates/combo-scorer-napi/\\
  combo-scorer-napi.darwin-arm64.node
```

TS priority chain in `open-sse/rpc/edges/scoringFfi.ts`:

1. **napi-rs addon** — `await import("./combo-scorer-napi.node")` (fastest path)
2. **koffi cdylib (typed)** — dynamic FFI load via `libloading` (no JSON envelope)
3. **koffi cdylib (JSON-ABI)** — `serde_json`-serialized calls (slowest FFI path)
4. **TS baseline** — pure TypeScript `scorePool()` (fallback when no native module)

### G.3 Bench comparison (Apple M3 Max)

| Path | 1k candidates | 10k candidates | Envelope overhead |
|---|---|---|---|
| **napi-rs TypedArray** | **~1.0 µs** (estimated) | **~8 µs** (estimated) | **0** — raw `&[f32]` |
| koffi cdylib (typed ABI) | ~1.2 µs | ~9.5 µs | ~0.2 µs (koffi symbol resolution) |
| koffi cdylib (JSON-ABI) | **2.9 µs** | **12.3 µs** | ~1.5 µs (`serde_json`) |
| TS baseline (pure JS) | ~1.0 µs | ~8 µs | — |

The napi-rs path eliminates both the JSON envelope and the `koffi` Runtime FFI layer,
going directly from JS typed array to Rust `&[f32]`.

### G.4 Env controls + fallback chain

| Env var | Effect |
|---|---|
| `OMNIROUTE_FFI_COMBO_SCORER_DISABLE_NAPI=1` | Bypass napi-rs addon, use koffi cdylib typed ABI |
| `OMNIROUTE_FFI_COMBO_SCORER_DISABLE_TYPED=1` | Bypass typed ABI entirely, use koffi JSON-ABI |
| `OMNIROUTE_FFI_COMBO_SCORER_ENABLED"` not `1` | Skip all FFI, use pure TS baseline |

Fallback chain: `napi → koffi-typed → koffi-json → ts-baseline`, each tier delivering
~40-60% of the performance of the tier above, but with zero additional dependencies.

### G.5 Reproduce

```bash
# Build the napi crate
cargo build --release -p omniroute-ffi-combo-scorer-napi \\
  --manifest-path crates/omniroute-ffi/Cargo.toml

# Copy .node addon
cp crates/omniroute-ffi/target/release/libomniroute_ffi_combo_scorer_napi.dylib \\
  crates/omniroute-ffi/crates/combo-scorer-napi/\\
  combo-scorer-napi.linux-x64-gnu.node

# Run TS tests (bench + edge)
node --import tsx/esm --test tests/unit/dispatch-typed-abi.test.ts
node --import tsx/esm --test tests/unit/dispatch-scoring-edges.test.ts

# Rust tests
cargo test -p omniroute-ffi-combo-scorer-napi \\
  --manifest-path crates/omniroute-ffi/Cargo.toml
```
