---
repo: "phenoData"
role: data-layer-workspace
status: absorbed
last_boundary_review: 2026-07-17
review_cadence: 30d
absorbed_into: pheno
absorbed_on: 2026-07-17
---

# Boundary — phenoData

## Disposition

**Absorbed** on 2026-07-17 into `pheno/crates/pheno-data-*` (5 member crates).

See `docs/absorption/phenoData/README.md` for the full transfer record.

## In Scope (now in pheno)

| Capability | Lives in pheno crate |
|---|---|
| Dataset trait + Record | `crates/pheno-data-core` |
| QueryRequest / QueryStatement / Backend loader | `crates/pheno-data-query` |
| SurrealDB embedded with Pheno extensions | `crates/pheno-data-surreal` |
| PostgreSQL/pgvector bridge | `crates/pheno-data-pg` |
| Smoke test binary | `crates/pheno-data-smoke-tests` |

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| gRPC service definition | `crates/agileplus-grpc` | data layer returns data via `QueryPort`, not over wire |
| HTTP client transports | `crates/phenotype-http-client-core` | data is local; HTTP bridges live in agileplus |
| Vector embeddings / ML models | `crates/phenotype-contracts` | upstream feature; future work in `pheno-data-surreal` (pgvector) |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| `QueryPort::execute` | this → consumers | Rust trait | green |
| `Backend::load(name)` | consumers → this | async registry | green |
| `Dataset::open/destroy` | consumers → this | async fn | green |

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** forge absorption agent (wave 2026-07-17-queue-refresh-2)
**Decision:** absorbed into pheno monorepo; phenoData source repo archived on
GitHub the same day.

**Next review:** 2026-08-17 (post-absorption stability check)
