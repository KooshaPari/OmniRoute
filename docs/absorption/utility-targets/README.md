# Utility target repo resolution

Date: 2026-06-20

## Executive decision

The names `phenotype-py-utils` and `phenotype-ts-utils` were suggested as utility absorption targets, but they do not currently resolve under `KooshaPari` via `gh repo list` or direct clone. Do not block source repo deletion readiness on these names.

## Resolved targets

| Suggested target | Resolution evidence | Status | Required action |
|---|---|---|---|
| `phenoUtils` | `KooshaPari/phenoUtils` exists and is local; contains Rust crates `pheno-crypto`, `pheno-fs`, `pheno-net`, `pheno-shell`, `pheno-testing` | usable Rust primitive target | use only for true Rust primitive utilities |
| `phenotype-py-utils` | direct clone failed; `gh repo list KooshaPari` utility search did not return it | `NOT_COVERED` / non-existent target | use `phenotype-python-sdk` packages for Python utilities unless a repo is created intentionally |
| `phenotype-ts-utils` | direct clone failed; `gh repo list KooshaPari` utility search did not return it | `NOT_COVERED` / non-existent target | use a real TS owner or create a tight repo intentionally before migration |
| `phenotype-python-sdk` | local target exists; dirty work preserved on `chore/agentmcp-hex-readme-update-2026-06-18` commit `0f00426` | usable Python SDK target | absorb Python utilities/packages here when package boundary is SDK-like |
| `phenotype-go-sdk` | local target exists and is clean on `feat/port-devhex-adapter-test-2026-06-18` | usable Go SDK target | absorb Go SDK/package work here when not app-specific |
| `phenokits-commons` | cloned locally after missing-target fetch; broad shared-artifact repo | broad/aggregate, not tight final owner | use only for governance/templates/docs, not as a dumping ground for runtime libraries |

## Policy

A source repo is not delete-ready merely because a generic target name exists. Each source item must map to a real repo and a tight package/module boundary, or remain `PARTIAL`, `NOT_COVERED`, or `LAST_RESORT_EXCEPTION` in the absorption matrix.
