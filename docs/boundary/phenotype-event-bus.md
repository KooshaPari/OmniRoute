# Boundary: phenotype-event-bus

**Status:** Active (absorbed 2026-07-17)
**Origin:** `KooshaPari/phenoEvents` (renamed from `pheno-events`)
**Location:** `pheno/crates/phenotype-event-bus/`
**Lib name:** `pheno_events` (preserved from upstream — `[lib] name = "pheno_events"`)
**Observability backend:** workspace-level `phenoevents-observability` at `pheno/crates/phenoevents-observability/`

## Purpose

`phenotype-event-bus` provides the canonical typed async pub/sub substrate for Phenotype collections. Two interchangeable bus implementations live behind a single trait:

- `bus::SqliteBus` — durable, at-least-once delivery with idempotency keys, outbox, retries, DLQ.
- `bus::InMemoryBus` — non-persistent, in-process pub/sub for tests and short-lived workers.

The crate also owns:

- `core::EventEnvelope` — v7 UUIDs, causation/correlation IDs, schema versioning.
- `schema::SchemaRegistry` — additive JSON schema validation.
- `projection::OrderProjection` — checkpointed SQL read-model.

## Renaming strategy

The crate **package name** is renamed from `pheno-events` → `phenotype-event-bus`, but the **lib name** (`[lib] name`) is preserved as `pheno_events`. This means:

- Cargo.toml consumers use `phenotype-event-bus = { path = "..." }` (the new package name).
- Rust source imports still use `use pheno_events::...` (the preserved lib name).
- No source-file `use` paths need to be rewritten during the absorption.

This was chosen over a full rename because:

1. The lib name is referenced in 13+ source files (src/, tests/, benches/).
2. A full rename would require touching every file; the lib-name override is a one-line change that achieves the same external cleanliness.
3. The upstream crate is pre-1.0 (`0.1.0`), so any external consumer is conceptually tied to the same release anyway.

## Workspace role

`phenotype-event-bus` fills the phantom workspace dependency declared in `pheno/Cargo.toml`:

```toml
phenotype-event-bus = { path = "crates/phenotype-event-bus" }
```

This entry was previously a broken reference (the path did not resolve). The absorption lands the real crate at that path.

## Interface contracts

| Item | Path | Notes |
|------|------|-------|
| `EventEnvelope` | `pheno_events::core::EventEnvelope` | Builder API: `EventEnvelope::builder(event_type, source, payload)?.build()` |
| `Bus` trait | `pheno_events::bus::Bus` | `publish`, `subscribe`, `ack`, `nack` |
| `SchemaRegistry::register` | `pheno_events::schema::SchemaRegistry::register` | Rejects breaking changes; allows additive only |
| `OrderProjection` | `pheno_events::projection::OrderProjection` | Checkpointed; idempotent replay |
| `init_tracing(service_name, otlp_endpoint)` | `phenoevents_observability::init_tracing` (workspace-level sub-crate) | Installs structured tracing + optional OTLP exporter |

## Adjacent crates

| Crate | Relationship |
|-------|-------------|
| `phenotype-event-sourcing` | Sibling — provides event-store abstraction over `phenotype-event-bus`'s outbox |
| `phenotype-observability` | Sibling — generalized OTel facade |
| `phenoevents-observability` | **Backend dependency** at `pheno/crates/phenoevents-observability/` — provides OTel/OTLP tracing initialization used by `phenotype-event-bus` |
| `agileplus-events` | Sibling — domain event types used by the agileplus crate family |

## What is NOT in this crate

- HTTP/RPC transport (lives in `phenotype-grpc` and `bifrost-routing`).
- Schema *registry* service (HTTP-fronted) — the local in-process `SchemaRegistry` is the only public surface here.
- Persistence layer beyond SQLite (`phenotype-sqlite` is the broader data layer).
- Bus implementations backed by NATS or Kafka (alternate adapters live in agileplus-NATS).

## Restore procedure

```sh
gh repo unarchive KooshaPari/phenoEvents
cd /Users/kooshapari/CodeProjects/Phenotype/repos/pheno
git rm -r crates/phenotype-event-bus/
# Edit Cargo.toml: remove the workspace member entry and the workspace.dependencies path entry
git commit -m "revert: undo phenoEvents absorption"
```

## Cross-references

- Absorption record: `audits/absorption-justifications/phenoEvents-2026-07-17.md`
- Disposition row: `registry/disposition-index.json` → `KooshaPari/phenoEvents`
- Source repo: https://github.com/KooshaPari/phenoEvents
- Workspace phantom-dep resolved: `pheno/Cargo.toml` `phenotype-event-bus = { path = "crates/phenotype-event-bus" }`
