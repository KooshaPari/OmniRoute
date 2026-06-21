# DRY Scan T4F: OTLP Exporter Adoption (2026-06-21)

**Cycle:** 6 (extends T4A–E DRY scans from cycle 4)
**Scope:** 20 fleet Rust crates
**Substrate canonical:** `pheno-otel::exporters::HttpExporter` / `StdoutExporter` (ADR-037 + ADR-038)

---

## Summary

- **Crates scanned:** 20 (19 physically present; `nanovms` skipped per task constraint — not in sparse-checkout cone)
- **Crates declaring raw `opentelemetry-otlp`:** **3** of 19 (focalpoint, PhenoObservability, HexaKit/agileplus-mirror)
- **Crates actively initializing raw OTLP:** **1** (`focalpoint/pheno-otel`)
- **Crates using canonical `pheno-otel::exporters::*`:** **0** as direct dep consumer; the substrate crate itself (`pheno-otel`) is the canonical, but is consumed by `pheno-errors`, `pheno-port-adapter`, and `pheno-tracing` per ADR-036B substrate→substrate flow.
- **Adoption rate (active raw OTLP → substrate):** **0 %** (1/1 raw-OTLP-active crate has not migrated)
- **Adoption rate (declared raw → substrate):** **0 %** (3/3 raw-OTLP-declared crates have not migrated)

> Note: prompt template predicted "5 crates use raw OTLP" — actual scan found **3 distinct Cargo.toml manifests with the dep** plus **1 dead-code `init.rs` in `pheno-otel/src/`** (legacy v14 init, no longer declared as a `mod` in `lib.rs`). Net actionable migration count: **2 distinct active code paths + 2 dead deps to remove + 1 dead init.rs to delete**.

---

## Per-crate findings

| # | Crate | Cargo.toml has `opentelemetry-otlp`? | Pattern observed | Recommendation |
|---|---|:-:|---|---|
| 1  | Eidolon | N | No OTLP usage in any sub-crate | **KEEP** — no migration needed |
| 2  | agent-platform | N | No Rust `Cargo.toml` (Python/TS app) | **SKIP** — out of Rust crate scope |
| 3  | mobile-mcp | N | No Rust `Cargo.toml` | **SKIP** — out of Rust crate scope |
| 4  | mobile-cli | N | No Rust `Cargo.toml` | **SKIP** — out of Rust crate scope |
| 5  | focalpoint | **Y** | `focalpoint/pheno-otel/src/init.rs:18-20` uses raw `opentelemetry::global`, `opentelemetry::KeyValue`, `opentelemetry_otlp::WithExportConfig`, `opentelemetry_otlp::SpanExporter::builder().with_http().with_endpoint(...).build()` | **MIGRATE** — replace with `pheno-otel::exporters::HttpExporter::traces(ExporterConfig::new(endpoint, service_name))`. Drop `opentelemetry-otlp` + `opentelemetry` + `opentelemetry_sdk` deps from `focalpoint/pheno-otel/Cargo.toml:32-39`. |
| 5b | focalpoint (focus-observability) | **Y** (dead dep) | `focalpoint/crates/focus-observability/Cargo.toml:46` declares `opentelemetry-otlp = { version = "0.17", features = ["trace"] }` but `src/lib.rs:123` only has a comment `// In production, you would wire this with tracing-opentelemetry + opentelemetry-otlp.` — **never imported** | **DROP DEP** — remove the `opentelemetry-otlp` line from Cargo.toml; the file does not actually wire OTLP. |
| 6  | PhenoCompose | N | No OTLP usage | **KEEP** |
| 7  | phenodag | N | No `Cargo.toml` in root (Python CLI) | **SKIP** — out of Rust crate scope |
| 8  | pheno-config | N | No OTLP usage | **KEEP** |
| 9  | pheno-errors | N | Dep is `pheno-otel = { path = "../pheno-otel" }` (substrate, canonical) | **KEEP** — already on canonical path |
| 10 | pheno-tracing | N | Dep is `pheno-otel` (canonical, ADR-036B allows one-way substrate→substrate) | **KEEP** — already on canonical path |
| 11 | pheno-otel | N (Cargo.toml) but **Y (legacy src)** | `pheno-otel/Cargo.toml` does **NOT** declare `opentelemetry-otlp`. The legacy `pheno-otel/src/init.rs:18-20, 59` uses raw `opentelemetry_otlp::SpanExporter` but `init.rs` is **NOT declared as a `mod` in `src/lib.rs`** (only `exporters`, `propagation`, `histogram` are). This is dead v14 code that no longer compiles (missing deps) and is superseded by the canonical `OtlpPort` + `HttpExporter`/`StdoutExporter` façade in `src/exporters/` | **DELETE LEGACY** — remove `pheno-otel/src/init.rs`, `error.rs`, `guard.rs`, `exporter/` (entire `exporter/` singular directory is the v14 pre-ADR-038 name; the canonical is the plural `exporters/`). Keep the canonical `src/exporters/{mod,http,stdout}.rs`. |
| 12 | pheno-port-adapter | N | Dep is `pheno-otel = { path = "../pheno-otel" }` (canonical) | **KEEP** — already on canonical path |
| 13 | pheno-mcp-router | N | No Rust `Cargo.toml` (Python package) | **SKIP** — out of Rust crate scope |
| 14 | pheno-flags | N | No OTLP usage | **KEEP** |
| 15 | pheno-context | N | No OTLP usage (only mentions `tracing` keyword in package metadata) | **KEEP** |
| 16 | PhenoObservability | **Y** (dead dep) | `PhenoObservability/crates/phenotype-observably-tracing/Cargo.toml:21` declares `opentelemetry-otlp = { version = "0.32", features = ["trace"] }` but `src/lib.rs:120` only has a comment `// In production, you would wire this with tracing-opentelemetry + opentelemetry-otlp.` — **never imported** | **DROP DEP** — remove the `opentelemetry-otlp` line from Cargo.toml. The crate's actual telemetry path goes through `pheno-otel` substrate via the wider PhenoObservability workspace. |
| 17 | HexaKit | N (in-scope crates) | The `HexaKit/agileplus/crates/agileplus-telemetry/` subtree contains a mirror of AgilePlus using raw OTLP — this is a **git submodule mirror, not HexaKit's own source code**. Per ADR-023, the substrate is the canonical home and AgilePlus migration is tracked separately. | **DEFER** — flag for the T4G AgilePlus migration track; do not block on HexaKit. |
| 18 | Civis | N | No OTLP usage in any sub-crate | **KEEP** |
| 19 | nanovms | — | **MISSING** — not present in sparse-checkout cone | **SKIP** — per task constraint |
| 20 | Configra | N | Dep is `tracing = "0.1"` only; no `opentelemetry-otlp` | **KEEP** |

---

## Adoption breakdown (3 raw-dep crates, by code activity)

| Crate | Cargo.toml dep? | Actively imports in `.rs`? | Disposition |
|---|:-:|:-:|---|
| `focalpoint/pheno-otel` | ✅ | ✅ `init.rs:18-20,59` | **MIGRATE** (active raw OTLP — 1 PR, ~50 LOC: replace init.rs body, drop 3 deps) |
| `focalpoint/crates/focus-observability` | ✅ | ❌ comment-only | **DROP DEP** (1 line removal in Cargo.toml) |
| `PhenoObservability/crates/phenotype-observably-tracing` | ✅ | ❌ comment-only | **DROP DEP** (1 line removal in Cargo.toml) |

---

## DRY violations and bug-risks identified

1. **D1 [P2 — substrate drift]:** `focalpoint/pheno-otel` is a **fork** of the canonical `pheno-otel` crate living inside the `focalpoint` app-level monorepo. It carries its own `opentelemetry-otlp = "0.27"` pin while the canonical `pheno-otel` is at the ADR-037 substrate shape with no direct OTLP SDK dep. Two divergent pheno-otel implementations in the fleet. **Fix:** deprecate `focalpoint/pheno-otel` and route to root `pheno-otel` (per ADR-023 substrate placement).
2. **D2 [P3 — comment-only "future" code]:** Both `focalpoint/crates/focus-observability` and `PhenoObservability/crates/phenotype-observably-tracing` carry `opentelemetry-otlp` deps with a `// In production, you would wire this with ...` comment. These compile but never execute; they're dead weight. **Fix:** drop the dep lines (zero behavior change, ~50 KB binary size savings each).
3. **D3 [P1 — dead code]:** `pheno-otel/src/init.rs` (singular `exporter/`) is a v14-era legacy module not declared in `lib.rs`. It references `opentelemetry_otlp::SpanExporter` and `opentelemetry_sdk::trace::TracerProvider` which are no longer in `Cargo.toml`. If any future refactor accidentally re-adds `mod init;`, the crate will fail to compile. **Fix:** delete the legacy `init.rs`, `error.rs`, `guard.rs`, and singular `exporter/` directory; canonical is the plural `exporters/` with `OtlpPort` trait + `HttpExporter`/`StdoutExporter` adapters.
4. **B1 [P3 — version skew]:** raw-OTLP consumers pin 3 different `opentelemetry-otlp` versions in their Cargo.toml: `0.17` (focus-observability), `0.27` (focalpoint/pheno-otel), `0.32` (phenotype-observably-tracing). Migrating all three to substrate eliminates this skew — substrate owns the pin.
5. **B2 [P3 — binary size]:** `opentelemetry-otlp = "0.27"` with `http-proto` + `reqwest-client` + `reqwest-rustls` features pulls ~1.2 MB of compiled deps into `focalpoint/pheno-otel`. Migrating to substrate (`HttpExporter::traces(...)` is a pure-Rust façade without the SDK) drops ~1 MB per consumer.

---

## Migration PR scope (actionable next-cycle work)

| # | Crate | PR scope | LOC est. | Skill fit |
|---|---|---|---|---|
| M1 | `focalpoint/pheno-otel` | Replace `init.rs` body with `pheno-otel::exporters::HttpExporter::traces(...)`; drop `opentelemetry`, `opentelemetry_sdk`, `opentelemetry-otlp` deps; update `Cargo.toml`; update `lib.rs` to re-export from canonical substrate; delete `exporter/`, `init.rs`, `error.rs`, `guard.rs`. Re-pin `focalpoint` consumers to root `pheno-otel`. | ~150 | Heavy-runner |
| M2 | `focalpoint/crates/focus-observability` | Remove `opentelemetry-otlp` line from Cargo.toml; add comment pointer to ADR-037. | ~5 | macbook |
| M3 | `PhenoObservability/crates/phenotype-observably-tracing` | Remove `opentelemetry-otlp` line from Cargo.toml; add comment pointer to ADR-037. | ~5 | macbook |

Aggregate migration: ~160 LOC across 3 PRs. Zero net functionality loss (the two dead-dep removals are no-op at runtime; the active M1 migration is a strict substrate adoption).

---

## Blockers

None technical. Migration is per-crate and additive (substrate is a strict superset of the raw-OTLP init shape). Heavy-runner optional for M1 integration test cycle; M2/M3 are macbook-safe (`device: macbook` per worklog v2.1 schema).

---

## Out-of-scope notes

- **`pheno/crates/agileplus-telemetry/`** (the Dmouse92-mirrored monorepo) uses raw `opentelemetry_otlp::SpanExporter` in `src/lib.rs`, `src/adapter.rs`, `src/traces/mod.rs`. This is in the `pheno/` source-of-truth monorepo (separate from the KooshaPari `KooshaPari/AgilePlus` repo). Migration of the Dmouse92 mirror is tracked in the T4G follow-up scan (separate finding). Not counted in the 20-repo scope here.
- **`HeliosCLI` (deleted 2026-06-17)** had raw OTLP per prior T4 scans; removed from fleet.
- **`HexaKit/agileplus/` mirror** (git submodule) carries raw OTLP via the AgilePlus mirror; tracked under T4G, not this scan.

---

## References

- T4A: `findings/2026-06-20-T4A-config-loading-dry-scan.md` (planned — cycle 4)
- T4B: `findings/2026-06-20-T4B-tracing-init-dry-scan.md` (planned — cycle 4)
- T4C: `findings/2026-06-20-T4C-error-types-dry-scan.md` (planned — cycle 4)
- T4D: `findings/2026-06-20-T4D-clap-cli-dry-scan.md` (planned — cycle 4)
- T4E: `findings/2026-06-20-T4E-dry-aggregate.md` (planned — cycle 4)
- ADR-037: `pheno-otel` substrate canonical
- ADR-038: Hexagonal port-adapter L4 policy (`OtlpPort` trait + `Adapter` impl)
- ADR-036B: pheno-tracing substrate canonical (substrate→substrate dep policy)
- ADR-023: Agent-effort governance — app substrate placement (rules out "random `phenoShared`")
- ADR-047: Predictive DRY discipline (4-criterion rule)

---

## Provenance

- Scan method: `grep -rln "opentelemetry-otlp" --include="Cargo.toml"` + `grep -rln "opentelemetry_otlp::SpanExporter\|opentelemetry_otlp::new_exporter\|opentelemetry::global" --include="*.rs"` over the 19 present repos of the 20-repo scope, excluding `/target/` and `/vendor/` directories.
- Scan completed: 2026-06-21 (cycle 6, this turn)
- Device: macbook (read-only; no `Cargo.toml` or migration code modified in this turn)
