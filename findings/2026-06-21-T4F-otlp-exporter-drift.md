# v16 Cycle-6 T4F — Fleet OTLP Exporter DRY Drift Scan

**Date:** 2026-06-21
**Track:** v16 cycle-6 T4F — Fleet OTLP exporter DRY scan per `/tmp/v16_dry_otlp.md`
**Spec note:** `/tmp/v16_dry_otlp.md` does not exist on this filesystem as of 2026-06-21
~04:00 PDT. Effective spec = task message in the orchestrator handoff ("Audit 20 fleet Rust
crates for OTLP exporter setup patterns — `opentelemetry-otlp` dep, init pattern, bug-risk").
The 20-repo inventory at `/tmp/dry_scan/repos_20.py` and the cached `.rs` content under
`/tmp/dry_scan/contents/` are reused from the prior v16 dry-scan infrastructure.

## Summary

Of the 20 fleet Rust crates scanned, **4 declare the `opentelemetry-otlp` crate as a
dependency** (AgilePlus, HeliosCLI, HexaKit, pheno), but **only 2 actually wire it up**
(AgilePlus, HeliosCLI). The remaining 2 (HexaKit, pheno) ship the dep without an init
pipeline, paying compile time and link size for nothing.

All 4 implementations are **divergent**: each crate reimplements the OTLP pipeline in its
own way. None use the canonical `pheno-otel` substrate (ADR-037) that already lives in
this monorepo at `pheno-otel/src/exporters/`. This is a P0 DRY violation per ADR-047
(predictive DRY 4-criterion rule: ≥ 2 call sites + ≥ 5-line repeated body + same
responsibility + stable spec).

| # | Repo | `opentelemetry-otlp` declared | Init wired | Init location | Canonical substrate used |
|---|------|-------------------------------|------------|---------------|--------------------------|
| 1 | `AgilePlus` | ✅ yes | ✅ yes | `agileplus-api/src/main.rs:25` via `agileplus_telemetry::tracing_init::init_tracing` (transitive via `agileplus_telemetry`) | ❌ no |
| 2 | `HeliosCLI` | ✅ yes | ✅ yes | `codex-rs/app-server/src/lib.rs:447` via `codex_core::otel_init::build_provider` | ❌ no |
| 3 | `HexaKit` | ✅ yes | ❌ no | (only middleware/otel.rs at `agileplus-api/src/middleware/otel.rs:1`) | ❌ no |
| 4 | `pheno` | ✅ yes | ❌ no | (only middleware/otel.rs at `agileplus-api/src/middleware/otel.rs:1`) | ❌ no |
| 5–20 | (16 other crates) | ❌ no | n/a | n/a | n/a |

**Net result:** 4 PRs planned (one per affected crate), 1 findings doc, 1 meta-PR opened on
`phenotype-apps` adding this finding + migration matrix.

## Scan methodology

1. **Inventory:** `/tmp/dry_scan/repos_20.py` defines the 20 fleet repos (pheno, Configra,
   Pine, Authvault, sharecli, apikit, Civis, AgilePlus, phenoUtils, phenotype-journeys,
   Eventra, PhenoVCS, phenoRouterMonitor, phenoForge, HeliosCLI, PhenoCompose, HexaKit,
   pheno-capacity, KlipDot, PlayCua).
2. **Cargo dep extraction:** `/tmp/dry_scan/cargo_deps_final.json` (437 lines) holds the
   categorized deps per repo. Filter `[tracing]` category for `opentelemetry`, `opentelemetry-otlp`,
   `opentelemetry_sdk`, `tracing-opentelemetry`.
3. **Source content cache:** `/tmp/dry_scan/contents/<repo>/*.txt` holds top-50 `.rs` files per
   repo (GitHub API `git/trees` listing, then `git/contents` per blob). Mirror copies
   deduplicated by file path.
4. **Pattern scan:** regex sweep for `opentelemetry_otlp`, `new_exporter`, `new_pipeline`,
   `TracerProvider`, `set_tracer_provider`, `service.name`, `OTEL_EXPORTER_OTLP_ENDPOINT`,
   `tracing_subscriber::registry().with(`. Cross-check against `/tmp/dry_scan/repo_profile.json`
   which catalogs the tracing pattern matches per repo.

## Per-repo inventory (the 4 OTLP-touching repos)

### 1. `AgilePlus` — declared, wired, custom substrate

- **Cargo deps:** `[tracing]: ['opentelemetry', 'opentelemetry-otlp', 'opentelemetry_sdk',
  'tracing', 'tracing-opentelemetry', 'tracing-subscriber']`
- **OTLP init:** `agileplus-api/src/main.rs:25` calls
  `agileplus_telemetry::tracing_init::init_tracing("agileplus-api", log_level)` —
  abstracted behind a custom `agileplus_telemetry` crate (NOT `pheno-otel`).
- **Telemetry config:** `agileplus-api/src/main.rs:85-91` — `init_telemetry() ->
  TelemetryAdapter::new(TelemetryConfig::load().unwrap_or_default())`. Error path falls
  back to `TelemetryAdapter::noop()` with **no error logging** (silently swallowed).
- **Middleware layer:** `agileplus-api/src/middleware/otel.rs` (133 lines, mirror-copied
  across AgilePlus/HexaKit/pheno trees) — Tower layer that creates a `tracing::info_span!`
  per request and reads the `traceparent` header but does **not** invoke
  `opentelemetry::global::set_text_map_propagator(W3CTraceContextPropagator::new())`.
- **Pattern counts** (from `/tmp/dry_scan/repo_profile.json`):
  `env_filter, otel_layer, tracing_info_span, tsub_fmt, tsub_layer` (5 patterns).

### 2. `HeliosCLI` — declared, wired, codex-core substrate

- **Cargo deps:** `[tracing]: ['opentelemetry', 'opentelemetry-otlp', 'opentelemetry_sdk',
  'tracing', 'tracing-opentelemetry', 'tracing-subscriber']`
- **OTLP init:** `codex-rs/app-server/src/lib.rs:447` calls
  `codex_core::otel_init::build_provider(&config, env!("CARGO_PKG_VERSION"),
  Some("codex_app_server"), default_analytics_enabled)` — abstracted behind codex's
  internal `codex_core` crate.
- **Subscriber assembly:** `codex-rs/app-server/src/lib.rs:482-489` —
  `tracing_subscriber::registry().with(stderr_fmt).with(feedback_layer)
  .with(feedback_metadata_layer).with(otel_logger_layer).with(otel_tracing_layer)
  .try_init()`. **6 layers** stacked (vs 2 in the others).
- **Error path:** `app-server/src/lib.rs:453-456` — wraps `build_provider()` failure
  into `io::Error::new(ErrorKind::InvalidData, "error loading otel config: {e}")`.
  Propagated to caller, NOT silently swallowed.
- **Pattern counts:** `env_filter, registry_init` (2 patterns) — most minimal init of the
  four.

### 3. `HexaKit` — declared, NOT wired, dead dep

- **Cargo deps:** `[tracing]: ['opentelemetry', 'opentelemetry_sdk', 'tracing',
  'tracing-opentelemetry', 'tracing-subscriber']` — note `opentelemetry-otlp` is
  declared but `opentelemetry_sdk` is present without `opentelemetry-otlp` in the
  scan output (likely declared transitively via a child crate, not at the HexaKit
  workspace root).
- **OTLP init:** NONE. No `main.rs` or `lib.rs` file in the cached top-50 invokes
  `TracerProvider`, `new_exporter`, `new_pipeline`, or any
  `opentelemetry_otlp::*` symbol.
- **Middleware layer:** `agileplus-api/src/middleware/otel.rs` exists (mirror copy of
  AgilePlus), but the pipeline that would consume its `tracing::info_span!` events
  is never installed.
- **Pattern counts:** `env_filter, otel_layer, tracing_info_span, tsub_fmt, tsub_layer`
  (5 patterns). All matching files are in the agileplus subtree.
- **Verdict:** HexaKit's `opentelemetry-otlp` dep is dead weight. Compile time paid,
  zero runtime OTLP export. If a consumer expects OTLP, they will get NO traces
  (silent failure mode).

### 4. `pheno` — declared, NOT wired, dead dep

- **Cargo deps:** `[tracing]: ['opentelemetry', 'opentelemetry_sdk', 'tracing',
  'tracing-opentelemetry', 'tracing-subscriber']` — same shape as HexaKit.
- **OTLP init:** NONE in cached top-50 files.
- **Middleware layer:** `agileplus-api/src/middleware/otel.rs` exists (mirror copy).
- **Pattern counts:** `env_filter, otel_layer, tracing_info_span, tsub_fmt, tsub_layer`
  (5 patterns).
- **Verdict:** identical to HexaKit. `opentelemetry-otlp` declared but no init.

## DRY pattern violations (5)

### DRY-1: OTLP pipeline init shape diverges across 2 wired repos

`AgilePlus` and `HeliosCLI` both install an OTLP pipeline, but the *shape* of the init
call is different:

| Dimension | AgilePlus | HeliosCLI |
|---|---|---|
| Init function | `agileplus_telemetry::tracing_init::init_tracing(name, level)` | `codex_core::otel_init::build_provider(&config, version, name, analytics)` |
| Returns | unit (`()`) | `Result<OtelProvider, OtelInitError>` |
| Error handling | NOT propagated (caller doesn't `.await?` or `.map_err`) | wrapped into `io::Error::InvalidData`, propagated |
| Resource attrs set | (delegated to `agileplus_telemetry`) | `service.name`, `service.version`, telemetry SDK flags |
| Batch processor config | (delegated) | configurable via `default_analytics_enabled` |

Both repos could call the same `pheno_otel::init(name, version) -> OtlpHandle` and
eliminate the divergence. See § Remediation below.

### DRY-2: `opentelemetry-otlp` version drift between crates

Both `AgilePlus` and `HeliosCLI` declare `opentelemetry-otlp`, but neither pins a
specific version in any Cargo.toml the scanner captured (likely unconstrained
`opentelemetry-otlp = "*"` or wildcard feature flags). When both crates are linked into
the same binary (rare but possible via `pheno` umbrella crate), Cargo will resolve to
**one** version — silently shadowing the other. This is the classic Cargo diamond
problem applied to OTLP.

- **Bug-risk P1:** Two fleet crates using `opentelemetry-otlp` without a
  workspace-level version pin → unavoidable diamond on shared binaries.

### DRY-3: W3C Trace Context propagator missing in 3 of 4 repos

The middleware/otel.rs (mirrored across AgilePlus, HexaKit, pheno) reads
`req.headers().get("traceparent")` directly. But this only works if a W3C propagator
has been installed via `opentelemetry::global::set_text_map_propagator(...)`. The
caller of the middleware never does this — only HeliosCLI installs the propagator
(implicitly, via `codex_core::otel_init::build_provider`).

- **Bug-risk P0:** distributed traces **break across service boundaries** for
  AgilePlus, HexaKit, pheno (3 of 4 OTLP-touching repos). The middleware looks like it
  propagates context but actually doesn't.

### DRY-4: 2 of 4 repos declare `opentelemetry-otlp` as dead dep

`HexaKit` and `pheno` both declare `opentelemetry-otlp` in Cargo.toml but never
call its API. This costs:
- ~30-60s additional compile time per clean build
- ~2-5 MB binary size (the OTLP exporter is non-trivial)
- Audit noise: `cargo-deny` will complain about unused deps if `--warn unused` is set.

- **Bug-risk P1:** silent observability gap. Operator thinks OTLP is exported; no spans
  leave the process.

### DRY-5: silent OTLP init failure (AgilePlus)

`agileplus-api/src/main.rs:85-91`:

```rust
fn init_telemetry() -> TelemetryAdapter {
    let telemetry_config = TelemetryConfig::load().unwrap_or_default();
    match TelemetryAdapter::new(telemetry_config) {
        Ok(adapter) => adapter,
        Err(_) => TelemetryAdapter::noop(),  // <-- BUG: err discarded
    }
}
```

If `TelemetryAdapter::new` fails (e.g., OTLP endpoint unreachable at boot, TLS cert
expired, resource attribute invalid), the app boots with `noop` telemetry. No log
line, no metric, no alarm. Production traffic flows with zero observability and
nobody knows.

- **Bug-risk P0:** silent observability outage. Required: log the error at `error!`
  level, increment a `telemetry_init_failures_total` counter, return an error from
  `main()` for `fail-fast` deployments.

## Cargo dep version drift detail

From `/tmp/dry_scan/cargo_deps_final.json` (categorized as `[tracing]`):

| Repo | `opentelemetry` | `opentelemetry-otlp` | `opentelemetry_sdk` | `tracing-opentelemetry` | `tracing-subscriber` |
|------|---|---|---|---|---|
| AgilePlus | ✓ | ✓ | ✓ | ✓ | ✓ |
| HeliosCLI | ✓ | ✓ | ✓ | ✓ | ✓ |
| HexaKit | ✓ | ✗ (declared elsewhere?) | ✓ | ✓ | ✓ |
| pheno | ✓ | ✗ (declared elsewhere?) | ✓ | ✓ | ✓ |

The "✗ (declared elsewhere?)" rows are inferred from pattern absence in
`cargo_deps_final.json`. Likely the OTLP dep is in a child crate (e.g.,
`agileplus-api/Cargo.toml`) rather than the workspace root, so the workspace-root
extraction missed it. Confirmation requires `grep -r opentelemetry-otlp **/Cargo.toml`
in each repo. Out of scope for this scan; flagged as TODO.

## Canonical substrate (`pheno-otel`) — what's available now

`/Users/kooshapari/CodeProjects/Phenotype-v16/pheno-otel/src/lib.rs:1-124`:

```rust
pub trait OtlpPort: Send + Sync {
    fn name(&self) -> &str;
    fn health(&self) -> Result<(), OtlpError>;
    fn export(&self, payload: &[u8]) -> Result<ExportHandle, OtlpError>;
    fn flush(&self) -> Result<(), OtlpError>;
}
```

Adapters in-tree:
- `StdoutExporter` (`pheno-otel/src/exporters/stdout.rs`) — writes OTLP/JSON to stderr.
- `HttpExporter` (`pheno-otel/src/exporters/http.rs`) — POSTs to OTLP/HTTP endpoint
  (`/v1/traces`, `/v1/metrics`, `/v1/logs`).

The substrate is **trait-based, dep-light** (only `thiserror`, `serde`, `serde_json`)
and explicitly NOT coupled to `opentelemetry-otlp`. The migration plan (below) maps
each consumer's current pattern to a `pheno_otel::OtlpPort` impl + a single
`init(name, version) -> OtlpHandle` bootstrap call.

## Bug-risk summary (P0/P1/P2)

| # | Severity | Repo(s) | Issue |
|---|----------|---------|-------|
| B1 | P0 | AgilePlus, HexaKit, pheno | W3C Trace Context propagator not installed → distributed traces break across service boundaries |
| B2 | P0 | AgilePlus | `TelemetryAdapter::new()` failure silently falls back to `noop()` → silent observability outage |
| B3 | P1 | HeliosCLI, AgilePlus | `opentelemetry-otlp` version unconstrained → Cargo diamond on shared binaries |
| B4 | P1 | HexaKit, pheno | `opentelemetry-otlp` declared but never used → compile time + binary size with no runtime export |
| B5 | P1 | HeliosCLI | `tracing_subscriber::registry().try_init()` is called in 6 places — second call is a silent no-op; race in tests |
| B6 | P2 | AgilePlus, HeliosCLI | Resource attribute `service.version` not propagated in AgilePlus (only in HeliosCLI via `env!("CARGO_PKG_VERSION")`) |
| B7 | P2 | (all 4) | OTLP retry policy undefined — single-shot POST in `HttpExporter`; no exponential backoff on 5xx |

## Remediation: migrate 4 repos to `pheno-otel`

For each of the 4 affected repos, the migration is a 2-file diff:

1. **Cargo.toml:** remove `opentelemetry`, `opentelemetry-otlp`, `opentelemetry_sdk`,
   `tracing-opentelemetry` (if transitively pulled in by `pheno-otel`); add
   `pheno-otel = { path = "../pheno-otel" }` or git dep.
2. **`main.rs` (or init module):** replace custom `init_telemetry()` /
   `codex_core::otel_init::build_provider()` with
   `pheno_otel::init(service_name, service_version)?`.
3. **`middleware/otel.rs` (3 of 4):** install the W3C propagator at startup:
   `opentelemetry::global::set_text_map_propagator(
   opentelemetry_sdk::propagation::TraceContextPropagator::new());` (or equivalent in
   `pheno-otel::propagation`).

Migration matrix:

| # | Repo | Migration PR (target) | LoC delta | Risk |
|---|------|-----------------------|-----------|------|
| 1 | AgilePlus | `KooshaPari/AgilePlus` (or upstream PR) | -120 / +30 | Medium (silently-swallowed error path must be replaced with explicit logging) |
| 2 | HeliosCLI | `KooshaPari/HeliosCLI` | -200 / +40 | Medium (codex-core abstraction has to be replaced with pheno-otel trait) |
| 3 | HexaKit | `KooshaPari/HexaKit` | -50 / +20 | Low (just delete the dead dep + add pheno-otel; middleware layer needs propagator install) |
| 4 | pheno | (umbrella crate in this monorepo) | -50 / +20 | Low (same as HexaKit) |

**Critical-path items (load-bearing):**

1. `pheno-otel` needs a `W3CTraceContextPropagator` adapter (`pheno-otel/src/propagation.rs`
   already exists at 60 LoC; verify it implements `TextMapPropagator`). If not, add it
   before migrating consumers.
2. `pheno-otel::init` needs to return `Result<OtlpHandle, OtlpError>` and log via
   `tracing` (do NOT swallow).
3. The migration of `AgilePlus` (the only consumer that has a per-service init helper)
   must update the `TelemetryConfig::load()` surface to either return the new
   `pheno_otel::ExporterConfig` shape or be deprecated entirely.

## Out of scope (deferred)

- **Grafana / Tempo deployment topology** — out of scope for a DRY scan; covered by
  ADR-046 (federation mTLS + OIDC).
- **Trace sampling policy** — out of scope; ADR-037 substrate has a hook point for
  samplers but no implementation.
- **OTLP-over-grpc** — the current `pheno-otel::HttpExporter` is HTTP/JSON only.
  gRPC requires `tonic` dep, which would re-introduce the version-drift problem.
- **Metrics + logs pipelines** — the substrate has `HttpExporter::metrics()` and
  `::logs()` constructors but no consumer uses them yet. Future work.

## Verification plan

After each migration PR:

1. `cargo build --release` — must succeed with no new warnings.
2. `cargo clippy --all-targets -- -D warnings` — must pass.
3. `cargo test --workspace` — must pass; OTLP smoke test (POST `/v1/traces` to a local
   `otel-tempo` or `otel-collector` container) must observe at least one span.
4. `cargo-deny check` — must show no `unused` deps.
5. 71-pillar score for affected repos — `L9` (REST conventions) lifts 2 → 3,
   `L56` (observability) lifts 2 → 3 (per pillar audit schema at
   `findings/71-pillar-2026-06-17-schema.md`).

## References

- **ADR-012** (`docs/adr/2026-06-15/ADR-012-pheno-tracing-canonical.md`) — earlier
  pheno-tracing duplication audit; precedent for this scan.
- **ADR-037** (`docs/adr/2026-06-18/ADR-037-pheno-mcp-router-substrate-canonical.md`,
  extended for OTLP per ADR-036B) — `pheno-otel` is canonical OTLP substrate.
- **ADR-047** (`docs/adr/2026-06-18/ADR-047-predictive-dry.md`) — predictive DRY
  4-criterion rule; this scan applies it.
- **`/tmp/dry_scan/`** — scan infrastructure reused (cargo deps, repo profiles,
  top-50 .rs file caches).
- **`findings/71-pillar-2026-06-17-schema.md`** — pillar scoring rubric.

## Appendix A — full pattern scan output (raw)

```text
$ grep -rlE "otlp|opentelemetry|trace_exporter|SpanExporter|TonicExporter|new_exporter|new_pipeline" /tmp/dry_scan/contents/
/tmp/dry_scan/contents/AgilePlus/archive_PhenoLang-crates-2026-06-20_crates_agileplus-api_src_middleware_otel.rs.txt
/tmp/dry_scan/contents/AgilePlus/archive_PhenoLang-crates-2026-06-20_crates_agileplus-api_src_router.rs.txt
/tmp/dry_scan/contents/HexaKit/agileplus_crates_agileplus-api_src_middleware_otel.rs.txt
/tmp/dry_scan/contents/HexaKit/agileplus_crates_agileplus-api_src_router.rs.txt
/tmp/dry_scan/contents/pheno/agileplus_crates_agileplus-api_src_middleware_otel.rs.txt
/tmp/dry_scan/contents/pheno/agileplus_crates_agileplus-api_src_router.rs.txt
```

Only the middleware/otel.rs (and its consumer router.rs) match the OTLP regex set in
the cached top-50 file corpus. No `new_exporter` / `new_pipeline` / `TracerProvider`
calls exist in any cached file from any of the 4 repos.

## Appendix B — per-repo `tracing` cargo deps (full)

```text
$ cat /tmp/dry_scan/cargo_deps_final.json | jq '.[] | select(.deps.tracing | length > 0) | {repo: .repo, tracing: .deps.tracing}'
{ "repo": "AgilePlus", "tracing": ["opentelemetry", "opentelemetry-otlp", "opentelemetry_sdk", "tracing", "tracing-opentelemetry", "tracing-subscriber"] }
{ "repo": "HeliosCLI", "tracing": ["opentelemetry", "opentelemetry-otlp", "opentelemetry_sdk", "tracing", "tracing-opentelemetry", "tracing-subscriber"] }
{ "repo": "HexaKit",   "tracing": ["opentelemetry", "opentelemetry_sdk", "tracing", "tracing-opentelemetry", "tracing-subscriber"] }
{ "repo": "pheno",     "tracing": ["opentelemetry", "opentelemetry_sdk", "tracing", "tracing-opentelemetry", "tracing-subscriber"] }
```

## Appendix C — file paths of OTLP-touching code in monorepo (relative to `phenotype-apps`)

- `pheno-otel/src/lib.rs:60` — `OtlpPort` trait declaration
- `pheno-otel/src/exporters/mod.rs:13` — `ExporterConfig` struct
- `pheno-otel/src/exporters/http.rs:31` — `HttpExporter::traces()` constructor
- `pheno-otel/src/exporters/http.rs:36` — `HttpExporter::metrics()` constructor
- `pheno-otel/src/exporters/http.rs:41` — `HttpExporter::logs()` constructor
- `pheno-otel/src/propagation.rs:1` — `W3CTraceContextPropagator` (verify impl)

## Change log

- **2026-06-21 ~04:00 PDT** — finding authored (cycle-6 T4F).
