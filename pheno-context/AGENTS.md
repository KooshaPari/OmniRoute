# pheno-context

**Date:** 2026-06-18
**Status:** ACTIVE
**MSRV:** 1.82 (see `Cargo.toml`)

## Purpose

Canonical request context for the pheno-* fleet. Builder, header
extraction (X-Request-ID, X-Trace-ID, X-Span-ID), and structured
metadata bag.

## Build

```bash
cargo build --release
cargo test --workspace
```

## Substrate Placement

`pheno-*-lib` (ADR-023) — pure reusable Rust library. Cross-cutting
concern shared by every service that handles HTTP requests.

## Authority

phenotype-org-governance/SUPERSEDED.md
