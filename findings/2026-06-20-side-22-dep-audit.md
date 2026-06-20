# Dependency Audit — Cargo.lock Inventory (side-22)

**Date:** 2026-06-20 10:10 UTC
**Task ID:** side-22
**Agent:** orch-v11-real-research-7
**Verdict:** Fleet shape is healthy. Largest tree is pheno-tracing (97 deps); leanest is pheno-port-adapter (7 deps). No outlier.

## Lock file inventory (8 pheno-* substrate crates, 2026-06-20)

| Crate              | Cargo.lock present | Dep count | Lock SHA (12 chars) |
|--------------------|--------------------|-----------|---------------------|
| pheno-otel         | yes                | 14        | 2b8b19009d2f        |
| pheno-port-adapter | yes                | 7         | 323daee0a757        |
| pheno-tracing      | yes                | 97        | 47840f0f2b10        |
| pheno-errors       | yes                | 69        | 799457e915ab        |
| pheno-flags        | yes                | 7         | fc6fed7bf7e4        |
| pheno-config       | **no**             | -         | -                  |
| pheno-mcp-router   | **no**             | -         | -                  |
| pheno-context      | **no**             | -         | -                  |
| pheno-agents-md    | yes                | 96        | (parallel agent)   |

**Total: 290 resolved packages** across the locked crates. Tracked total lock-file line count: 2,537 lines.

## Interpretation

**Locked crates** (6): emit a reproducible build, can produce an SBOM (see side-28 finding), accept `cargo audit` advisories directly. Healthy.

**Unlocked crates** (3): library-only — the consumer's lock file is the canonical one. This is correct Rust ecosystem behavior; `cargo` doesn't require a lock for libraries. The cost: if you want a per-crate SBOM, run `cargo generate-lockfile` first.

## Concerns observed
- **pheno-tracing at 97 deps** — pulls in the full `tracing-subscriber` + `tracing-opentelemetry` + `opentelemetry-*` stack. This is the right shape for a substrate that owns observability, but it means: (a) any transitive CVE in opentelemetry ecosystem hits here first, (b) compile time is dominated by this crate. Monitor.
- **pheno-errors at 69 deps** — surprisingly heavy for an error substrate. Likely from feature flags pulling in `anyhow`, `thiserror`, `serde`, `tracing`, etc. Consider trimming `default-features` to slimmer defaults.
- **4 crates share no deps directly** — pheno-port-adapter (7) and pheno-flags (7) are both leaves with minimal transitive footprint. Good substrate hygiene.

## Recommended follow-ups

1. **Add `cargo-deny` to fleet CI** — fail on `duplicate` (lock inconsistency), `bans` (license whitelist), `warnings` (unmaintained deps), `advisories` (RUSTSEC). One config file `deny.toml` per crate, top-level `deny.toml` for shared policy.
2. **Run `cargo audit` weekly** — already in scope per ADR-042. Do it for each locked crate in CI.
3. **Prune pheno-errors default features** — if the heavy dep count is from feature bloat, split features and disable the unused ones by default.
4. **Lock the unlocked crates for SBOM emission** — run `cargo generate-lockfile` in a CI step before generating SBOMs. Don't commit the generated lock unless the crate becomes a binary.

**Refs:** ADR-042 (security audit cadence), `pheno-tracing`, `pheno-errors`, side-28 (SBOM finding).
