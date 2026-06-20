---
repo: "Configra"
role: substrate-config
status: active
last_boundary_review: 2026-06-20
review_cadence: 30d
tier: pheno-lib
architecture: layered
language: rust
in_scope:
  - "Canonical config substrate per ADR-031 (replaces phenotype-config, pheno-config, settly, Conft)"
  - "Four sub-crates: pheno-config (typed Config + ConfigBuilder), settly (settings lifecycle), config-schema (field-shape validator), phenotype-config-loader (JSON/TOML file loaders)"
  - "TypeScript edge layer at typescript/packages/conft/"
out_of_scope:
  - "Auth/secrets storage (lives in Authvault)"
  - "Feature flag runtime (lives in phenotype-feature-flags)"
  - "Schema authoring tools (use a JSON-schema crate for Draft 4/7/2020-12)"
---

# Boundary — Configra

## In Scope

| Sub-crate | Concern | Tier |
| --- | --- | --- |
| `pheno-config` | Typed runtime `Config` + `ConfigBuilder`; env-var cascade + TOML overlay + `combine()` | 2 (lib) |
| `settly` | Settings lifecycle (validation, versioning, migration) — hexagonal domain/application/adapters/infrastructure | 2 (lib) |
| `config-schema` | JSON-schema field-shape validator (`SchemaField` + `ConfigSchema` + `SchemaError`) | 2 (lib) |
| `phenotype-config-loader` | Generic, type-safe JSON/TOML file loaders (`load_json<T>`, `load_toml<T>`) | 2 (lib) |

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Auth/secrets at rest | `Authvault` | Encryption-at-rest requires AES-256-GCM KMS, out of scope |
| Feature-flag runtime | `phenotype-feature-flags` | Flag lifecycle is a separate domain |
| JSON-schema DSL (Draft 4/7/2020-12) | external crate | `config-schema` is intentionally minimal — no `$ref`, no `oneOf` |
| Env-var-only parsing | `pheno-config` (within this repo) | Cascade is owned by `pheno-config` sub-crate |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| `pheno-config.ConfigBuilder` | this-repo → consumers (e.g. `phenotype-gateway`) | `pub use pheno_config::Config` | green |
| `settly::domain::Setting` | this-repo → consumer schemas | `pub trait SettingsModel` | green |
| `config-schema::ConfigSchema` | consumers → this-repo | `pub fn validate(&self, &serde_json::Value)` | green |
| `phenotype-config-loader::load_json` | consumers → this-repo | `pub fn load_json<T: DeserializeOwned>` | green |
| ABSORBED-FROM source repos | former source → this-repo (one-way) | git history | green |

## Last Boundary Review

**Date:** 2026-06-20
**Reviewer:** forge subagent (T23 dispatch)
**Worklog / finding:** `worklogs/T23-registry-refresh-2026-06-20.json` (planned)
**Decisions:**

- Promoted `Configra` from `role: unknown` to `role: substrate-config` per
  ADR-031 (Configra absorb) + ADR-022 (config consolidation).
- Tier `pheno-lib` (the four sub-crates are all libraries, not a
  framework or federated service).
- Architecture `layered` (NOT hexagonal-l4 — the substrate as a whole is
  a layered collection of crates; individual sub-crates may have their
  own architecture, e.g. `settly` is hexagonal-l4 internally).

**Next review:** 2026-07-20
