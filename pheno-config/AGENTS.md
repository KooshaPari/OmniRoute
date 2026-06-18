# pheno-config

**Date:** 2026-06-18
**Status:** ACTIVE
**MSRV:** 1.82 (see `Cargo.toml`)

## Purpose

Canonical typed-config loader for the pheno-* fleet. One crate to load
your service's `Config { url, port, log_level, db_path, feature_flags }`
from env vars, JSON files, or TOML files — with a canonical **12-factor
`combine()`** that overlays env over TOML.

## Build

```bash
cargo build --release
cargo test --workspace
```

## Substrate Placement

`pheno-*-lib` (ADR-023) — pure reusable Rust library; single concern
(config loading), single crate. Slated for absorption into
`KooshaPari/Configra` per ADR-031.

## Authority

phenotype-org-governance/SUPERSEDED.md
