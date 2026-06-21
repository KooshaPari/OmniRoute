# v17 — L4 Hexagonal Port Pattern Enforcement

**Date:** 2026-06-21
**Cycle:** 7 (P0 reduction)
**Pillar:** L4 (Hexagonal Port Pattern)
**Wave:** A

## Purpose

L4 (Hexagonal Port Pattern) is at 1.00. The pattern is documented in
ADR-014 / ADR-038 but not enforced. Result: drift toward
service-locator, fat adapters, and anemic domain models.

## Pattern (re-affirmed)

Hexagonal architecture = **ports** (traits in `domain/ports/`) +
**adapters** (concrete impls in `adapters/`). Domain depends on
nothing; adapters depend on domain; application orchestrates.

## Enforcement rules

1. **No I/O in domain.** `domain/` modules cannot import
   `tokio::net`, `std::fs`, `std::process`, `reqwest`, `hyper`,
   `rusqlite`, or any adapter crate.
2. **No concrete types in port signatures.** Port trait method
   parameters and return values must be domain types only.
3. **Adapter naming.** `AdaptersNameAdapter` for impl,
   `NamePort` for trait, both in `adapters/` and `domain/ports/`
   respectively.
4. **Composition root.** `app/` (or `bin/`) is the only place that
   constructs adapters and passes them to domain.

## Tool

`cargo-deny` is already wired. New: `scripts/check-hex-arch.sh`
(40 lines) that:
- Greps `domain/` for forbidden I/O imports
- Greps `domain/ports/` for forbidden adapter types in signatures
- Asserts every adapter file is named `*_adapter.rs`
- Asserts every port file is named `*_port.rs`

## CI gate

Append to existing `.github/workflows/ci.yml`:
```yaml
- name: hex-arch check
  run: bash scripts/check-hex-arch.sh
```

## Adoption state (2026-06-21)

| Repo | Hex-arch | Notes |
|------|----------|-------|
| `pheno-port-adapter` | partial | Has `ports/` + `adapters/` but no `domain/` separation |
| `pheno-flags` | yes | Clean separation since 0.4.0 |
| `pheno-tracing` | yes | `tracing-core` is the port, `tracing-subscriber` the adapter |
| `pheno-errors` | n/a | Pure data, no I/O |
| `pheno-config` | partial | Loader is a port; env/filesystem are adapters |

## Closure criterion for L4

L4 moves 1.00 → 3.00 once:
- `scripts/check-hex-arch.sh` exists and is wired to CI
- All 3 partial repos are refactored to full separation
- First PR demonstrates the gate catching a domain/ports violation

Refs: `docs/adr/2026-06-15/ADR-014-hexagonal-L4-ports.md`,
`docs/adr/2026-06-18/ADR-038-hexagonal-port-adapter-l4-policy.md`
