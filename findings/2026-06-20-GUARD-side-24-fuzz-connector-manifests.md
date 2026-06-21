# Guard — Fuzz Connector Manifests (side-24)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-24
**Agent:** orch-v11-real-guard-6
**Verdict:** The connector manifest parser (consumed by 11 fleet services via `pheno-connector-registry`) has **1 unit test** for the happy path and **zero fuzz coverage**. Manifests are untrusted: any third-party connector author can submit one. A malformed manifest can currently panic the loader.

## Scope

Connector manifests are YAML or JSON documents describing:
- `id`, `version`, `kind` (data-source | destination | processor)
- `auth` (api_key | oauth2 | mtls)
- `endpoints` (URLs, retries, timeouts)
- `schema` (input/output Avro/JSON-Schema)

They are loaded at runtime by:
- `pheno-connector-registry` (canonical, ADR-013 substrate)
- `phenotype-hub` (registry UI)
- `phenotype-workflow` (workflow steps reference connectors)
- 8 downstream consumers

## Known panics (2026-Q2 incident log)

| Date | Manifest shape | Panic | Fix |
|---|---|---|---|
| 2026-04-12 | empty `endpoints` list | `.unwrap()` on `first()` | patched |
| 2026-05-03 | `version: "1.0.0.0"` (4-segment) | `semver::Version::parse` panic | patched |
| 2026-05-19 | nested `auth` 32 levels deep | stack overflow during validation | **not yet patched** |

The May 19 case is still latent; a fuzz target would have caught it.

## Fuzz target (single, minimal)

```rust
// fuzz/fuzz_targets/manifest_parse.rs
#![no_main]
use libfuzzer_sys::fuzz_target;
use pheno_connector_registry::Manifest;

fuzz_target!(|data: &[u8]| {
    // Try both formats; ignore parse errors, only catch panics.
    let _ = serde_yaml::from_slice::<Manifest>(data);
    let _ = serde_json::from_slice::<Manifest>(data);
});

// fuzz/fuzz_targets/manifest_validate.rs
// — runs full validation pipeline (semver check, endpoint URL parse, schema resolution)

fuzz_target!(|data: &[u8]| {
    if let Ok(m) = serde_yaml::from_slice::<Manifest>(data) {
        let _ = pheno_connector_registry::validate(&m);   // must never panic
    }
});
```

Two targets cover the two distinct surfaces: **parse** (panic-free deser) and **validate** (panic-free full pipeline).

## Seed corpus

- All 47 production manifests in `pheno-connector-registry/testdata/`.
- All 12 manifests in `phenotype-hub/examples/connectors/`.
- A `corpus_gen` (~50 LOC) that emits 5k randomly-shaped manifests obeying the schema, then mutates bytes to produce malformed variants.

## CI integration (identical pattern to side-15)

```yaml
# .github/workflows/fuzz-manifests.yml
on:
  schedule: [{ cron: '0 7 * * *' }]   # nightly 07:00 PDT, 60-min budget
  pull_request:
    paths: ['crates/pheno-connector-registry/src/manifest.rs', 'fuzz/**']
```

## Why this matters

1. **Manifests are the most attacker-controlled input** in the fleet — third-party authors, no review gate, parsed at startup.
2. The May 19 incident is a real panic, not a hypothetical; a fuzzer would have found it within minutes.
3. ADR-049 (drift detector) downstream correlates fuzz regressions with manifest changes — but the upstream fuzzer must exist first.

## Action items

1. **Add `cargo-fuzz` to `pheno-connector-registry`** — `fuzz/Cargo.toml` + 2 target files (~100 LOC total).
2. **Generate seed corpus** — copy existing + `corpus_gen` (~80 LOC).
3. **Fix the May 19 stack-overflow** in `validate()` — recursive depth check + iterative rewrite, ~30 LOC.
4. **Wire nightly cron** (CI yaml above).
5. **Add a unit test for the May 19 shape** — `crates/pheno-connector-registry/tests/regressions.rs` (`deeply_nested_auth_does_not_panic`).

## When to skip

- **Manifest *generation* code** (the `ConnectorBuilder` API) — that's trusted code; only the *parsing* side needs fuzz.
- **Already-validated manifests in registry cache** — once validated, the manifest is in a typed struct; re-validation is idempotent and not a fuzzer target.

## Acceptance criteria

- `pheno-connector-registry/fuzz/` ships with 2 targets and seed corpus within **1 week**.
- May 19 stack-overflow patched and covered by a regression test within **3 days**.
- Nightly cron runs for **2 consecutive weeks** without crash.

**Refs:** `ADR-013` (mcp-router substrate, connector-registry as canonical), `pheno-connector-registry/src/manifest.rs:142-188`, incident log 2026-05-19, `findings/2026-06-15-L5-110-substrate-audit.md`.