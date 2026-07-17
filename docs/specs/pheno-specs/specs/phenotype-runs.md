# SPEC-RUNS-001: phenotype-runs CI/job observability substrate

## Status

**Draft** — 2026-06-05

## Source

- Repository: [KooshaPari/phenotype-runs](https://github.com/KooshaPari/phenotype-runs)
- Local seed spec: `C:/Users/koosh/Dev/phenotype-runs/SPEC.md`
- Spec approval issue: [KooshaPari/phenotype-runs#1](https://github.com/KooshaPari/phenotype-runs/issues/1)

## Summary

phenotype-runs is the Phenotype org's universal CI/job observability substrate: one ingest point for workflow events across the repo fleet.
It stores normalized run/job/step metadata, exposes REST health/diff endpoints, and renders a Keycap Palette dashboard for L1 manager triage.
It is read-only by design: no runner replacement, no log-body storage, no telemetry-driven claims beyond surfaced run metadata.

## Functional requirements

- FR-PRUN-001: Ingest GitHub `workflow_run` webhook with HMAC-SHA256.
- FR-PRUN-002: Ingest GitLab CI webhook using `X-Gitlab-Token`.
- FR-PRUN-003: Normalize provider payloads to internal `Run`, `Job`, and `Step` schema.
- FR-PRUN-004: Idempotent upsert keyed on provider `delivery_id`.
- FR-PRUN-005: Last-green diff for red runs, including commit-set and workflow YAML diff.
- FR-PRUN-006: REST API for list/get/diff/repo-health/org-health endpoints.
- FR-PRUN-007: Svelte dashboard using the Phenotype Keycap Palette.
- FR-PRUN-008: Discord/Slack alerts on red transitions with per-repo deduplication.

## Non-functional requirements

- NFR-PRUN-001: p99 ingest under 200 ms; tolerate 1000 events/min/repo.
- NFR-PRUN-002: SQLite shard storage under 10 GB/year with archival path to Parquet.
- NFR-PRUN-003: Read-only API; no PII and no log bodies.

## Acceptance anchor

A toy `phenotype-runs-fixture` repo emits a failing workflow event; phenotype-runs ingests it, exposes it through `GET /runs`, returns last-green diff data through `GET /diff/<run_id>`, and renders the red run in `runs-dash` within five seconds.
