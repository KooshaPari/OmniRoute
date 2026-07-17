# Changelog

All notable changes to `PhenoSpecs` are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Lightweight `AGENTS.md` (1 page) — framed for spec-template-spine, not runtime.
- Lightweight `SPEC.md` (1 page, 7 sections) — replaces the 2586-line legacy spec per `templates/SPEC.md.template`.

### Changed
- `CHANGELOG.md` rewritten to Keep-a-Changelog 1.1.0 with explicit `[Unreleased]` checklist and prior 0.1.0 entry.

## [0.1.0] - 2026-04-04

### Added
- Initial public release of `PhenoSpecs` — the unified specification registry for the Phenotype ecosystem.
- `registry.yaml` (v2.0.0) — spec ↔ implementation traceability index.
- 10 ADRs in MADR format under `adrs/` (hexagonal architecture, Rust primary language, spec-driven development, unified registry, multi-format docs, traceability-first dev, evaluation, realtime sync, audit hash chain, storage dual-engine).
- 4 domain spec templates under `specs/` (`crypto/`, `platform/`, `sdks/`, `storage/`).
- Top-level docs: `SPEC.md` (legacy 2586-line version), `PRD.md`, `ADR.md`, `PLAN.md`, `CHARTER.md`, `RESEARCH.md`.
- Triple-license: `LICENSE`, `LICENSE-APACHE`, `LICENSE-MIT`.
