# Governance — pheno-worklog-schema

## Substrate placement

This repository is a **Python library substrate** per `ADR-023` Rule 1:

> `pheno-*-lib` — Pure reusable library.

Bucket: **ACTIVE**.

## ADRs referenced

- **ADR-015** — WORKLOG.md v2.0 schema (6 columns).
- **ADR-025** — WORKLOG.md v2.1 schema bump (adds `device:` field).
- **ADR-030** — pheno-worklog-schema v2.1 implementation.
- **ADR-040** — test coverage gates (80% for lib).

## Quality bar (Rule 3.1 / ADR-040 / ADR-042B)

| Requirement | Status |
| --- | --- |
| Spec | [SPEC.md](../SPEC.md) |
| Docs | [README.md](../README.md) + this file |
| Test matrix | `tests/test_schema.py` (18 tests) |
| Coverage gate (80%) | enforced in CI |
| CI gate | [.github/workflows/ci.yml](../.github/workflows/ci.yml) |
| Worklog v2.1 | [WORKLOG.md](../WORKLOG.md) |
| Observability | N/A |
