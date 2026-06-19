# PhenoCompose — Boundary

> Stub boundary file generated on 2026-06-18 by `scripts/render-stubs.py`
> for canonical repos with no curated prompts yet.

## In Scope

- Rust workspace `pheno-compose-driver` (canonical driver surface) and `bindings/rust-ffi` (nvms-ffi) — the only members of the parent workspace
- Single `pheno-compose` CLI API that selects WASM (Tier 1, ~1ms), gVisor (Tier 2, ~90ms), or Firecracker (Tier 3, ~125ms) based on trust/performance tradeoff
- C-ABI FFI surface exposed to `nanovms/cmd/nvms-cgo` and to `thegent/crates/thegent-nvms` (pyo3) bindings
- Cross-platform isolation backend support: macOS (Native/Lima/VZ/Virtualization.framework), Linux (Native/KVM), Windows (Native/WSL2)
- Resource metering (CPU, memory, I/O), bridge/overlay networking, persistent-volume management for each tier

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Go NVMS core (gVisor/Firecracker orchestration logic) | `nanovms` | Go is the polyglot source; PhenoCompose only consumes via FFI |
| Python bindings (pyo3) for thegent | `thegent/crates/thegent-nvms` | Migrated 2026-06-14; PhenoCompose provides the FFI, thegent owns the Python surface |
| Mojo bridge | `thegent/src/thegent/infra/mojo_bridge.py` | Replaced by a Python bridge; Mojo is no longer a tier |
| Zig bindings | `thegent/crates/thegent-wasm-tools` | Replaced by the Wasm SDK; PhenoCompose is the WASM tier caller, not the WASM tool |
| Workload manifest / spec definition | `phenotype-infra` / `AgilePlus` | Workload descriptors live with the app spec; PhenoCompose executes them |

## Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| FFI exports | this-repo→nanovms | C ABI (`cdylib`) | green |
| pyo3 bindings | this-repo→thegent | Rust `cdylib` + Python import | green |
| Build orchestration (CI) | this-repo→phenotype-ops | Docker + compose | amber — llama-cpp + NVMS compose pattern under review |
| Tier-1 (WASM) tool surface | this-repo→thegent-wasm-tools | Crate path | green — replaced Zig bindings |
| Deployment manifest parser | phenotype-infra→this-repo | TOML / JSON | green |

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- ECOSYSTEM_MAP.md § 6 (role classification)
- docs/intent/PhenoCompose.md (intent statement)
- docs/registries.md (Capability & Intent SSOT layer)
