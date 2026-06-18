# pheno-port-adapter

**Date:** 2026-06-18
**Status:** ACTIVE
**MSRV:** 1.82 (see `Cargo.toml`)

## Purpose

Hexagonal port/adapter primitives for the pheno-* fleet. Defines the
`PortAdapter` trait (`name`, `health`, `connect`, `disconnect`) and
concrete transport adapters (TCP, Unix-domain socket). Per ADR-014,
every pheno-* crate that needs an external boundary uses this crate's
trait.

## Build

```bash
cargo build --release
cargo test --workspace
cargo clippy --all-targets -- -D warnings
```

## Substrate Placement

`pheno-*-lib` (ADR-023) — pure reusable Rust library. Hexagonal
pattern primitive (ADR-014). Fleet-critical substrate.

## Authority

phenotype-org-governance/SUPERSEDED.md
